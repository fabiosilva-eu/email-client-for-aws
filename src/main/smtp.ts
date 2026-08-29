import nodemailer from 'nodemailer'
// @ts-ignore MailComposer is exported as CJS in nodemailer/lib/mail-composer
import MailComposer from 'nodemailer/lib/mail-composer'
import { getConfig } from './config'
import { saveEmailToS3 } from './s3'
import type { SmtpConfig, OutgoingEmailPayload, SendEmailResult, TestSmtpResult } from '../renderer/src/types'

/**
 * Validate that essential SMTP fields are populated
 */
export function isSmtpConfigured(config?: SmtpConfig): boolean {
  if (!config) return false
  return Boolean(
    config.host &&
    config.host.trim() &&
    config.user &&
    config.user.trim() &&
    config.password &&
    config.password.trim()
  )
}

/**
 * Test SMTP connectivity using transporter.verify()
 */
export async function testSmtpConnection(smtpConfig: SmtpConfig): Promise<TestSmtpResult> {
  try {
    if (!smtpConfig.host || !smtpConfig.host.trim()) {
      return { success: false, message: 'SMTP Host/Server address is required.' }
    }
    if (!smtpConfig.user || !smtpConfig.user.trim()) {
      return { success: false, message: 'SMTP Username is required.' }
    }
    if (!smtpConfig.password || !smtpConfig.password.trim()) {
      return { success: false, message: 'SMTP Password is required.' }
    }

    const port = Number(smtpConfig.port) || (smtpConfig.secure ? 465 : 587)
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host.trim(),
      port,
      secure: Boolean(smtpConfig.secure),
      auth: {
        user: smtpConfig.user.trim(),
        pass: smtpConfig.password.trim()
      },
      connectionTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    })

    await transporter.verify()
    return { success: true, message: `Successfully connected to SMTP server ${smtpConfig.host}:${port}!` }
  } catch (error: any) {
    let message = error?.message || 'Failed to connect to SMTP server.'
    if (error?.code === 'EAUTH' || error?.responseCode === 535) {
      message = 'SMTP Authentication failed. Please check your username and password.'
    } else if (error?.code === 'ESOCKET' || error?.code === 'ETIMEDOUT') {
      message = `Connection timed out connecting to ${smtpConfig.host}:${smtpConfig.port}. Check your host and port.`
    } else if (error?.code === 'ENOTFOUND') {
      message = `SMTP Host "${smtpConfig.host}" could not be resolved. Check server spelling.`
    }
    return { success: false, message }
  }
}

/**
 * Send an email message via configured SMTP server and save to S3 sent/ prefix
 */
export async function sendSmtpEmail(
  payload: OutgoingEmailPayload,
  customSmtp?: SmtpConfig
): Promise<SendEmailResult> {
  try {
    const appConfig = getConfig()
    const smtp = customSmtp || appConfig.smtp

    if (!isSmtpConfigured(smtp)) {
      return {
        success: false,
        error: 'SMTP is not configured. Please open Settings -> Outgoing Mail (SMTP) and enter your server credentials before sending emails.'
      }
    }

    if (!payload.to || payload.to.length === 0) {
      return { success: false, error: 'Recipient "To" address is required.' }
    }

    const port = Number(smtp!.port) || (smtp!.secure ? 465 : 587)
    const transporter = nodemailer.createTransport({
      host: smtp!.host.trim(),
      port,
      secure: Boolean(smtp!.secure),
      auth: {
        user: smtp!.user.trim(),
        pass: smtp!.password.trim()
      },
      tls: {
        rejectUnauthorized: false
      }
    })

    // Construct From address
    const fromAddr = smtp!.fromEmail && smtp!.fromEmail.trim() ? smtp!.fromEmail.trim() : smtp!.user.trim()
    const from = smtp!.fromName && smtp!.fromName.trim()
      ? `"${smtp!.fromName.trim()}" <${fromAddr}>`
      : fromAddr

    // Format attachments for Nodemailer
    const attachments = (payload.attachments || []).map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.contentBase64, 'base64'),
      contentType: att.contentType
    }))

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: payload.to.join(', '),
      cc: payload.cc && payload.cc.length > 0 ? payload.cc.join(', ') : undefined,
      bcc: payload.bcc && payload.bcc.length > 0 ? payload.bcc.join(', ') : undefined,
      subject: payload.subject || '(No Subject)',
      text: payload.textBody,
      html: payload.htmlBody,
      inReplyTo: payload.inReplyTo,
      references: payload.references,
      attachments: attachments.length > 0 ? attachments : undefined
    }

    // 1. Send via SMTP
    const info = await transporter.sendMail(mailOptions)

    // 2. Automatically compile and save .eml to S3 bucket under sent/ prefix
    let s3Key: string | undefined
    try {
      const composer = new (MailComposer as any)(mailOptions)
      const rawBuffer: Buffer = await new Promise((resolve, reject) => {
        composer.compile().build((err: any, message: Buffer) => {
          if (err) reject(err)
          else resolve(message)
        })
      })

      const rawMsgId = (info.messageId || `msg_${Date.now()}`).replace(/[<>\s]/g, '')
      s3Key = `sent/${Date.now()}_${rawMsgId}.eml`
      const s3Res = await saveEmailToS3(s3Key, rawBuffer, 'message/rfc822')
      if (!s3Res.success) {
        console.warn('Failed to upload sent email to S3:', s3Res.error)
      }
    } catch (saveErr) {
      console.warn('Error saving sent email to S3:', saveErr)
    }

    return {
      success: true,
      messageId: info.messageId,
      s3Key
    }
  } catch (error: any) {
    console.error('Failed to send email via SMTP:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred while sending email.'
    }
  }
}
