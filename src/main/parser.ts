import { simpleParser, AddressObject } from 'mailparser'
import type { ParsedEmail, ParsedAttachment } from '../renderer/src/types'

function formatAddress(addr: AddressObject | AddressObject[] | undefined): string {
  if (!addr) return ''
  if (Array.isArray(addr)) {
    return addr.map((a) => a.text || '').filter(Boolean).join(', ')
  }
  return addr.text || ''
}

/**
 * Parse a raw RFC 822 email message into structured HTML, plain text, headers, and attachments.
 */
export async function parseMimeEmail(rawContent: string | Buffer): Promise<ParsedEmail> {
  const parsed = await simpleParser(rawContent)

  const headers: Record<string, string> = {}
  if (parsed.headers) {
    for (const [key, val] of parsed.headers) {
      if (typeof val === 'string') {
        headers[key.toLowerCase()] = val
      } else if (val && typeof val === 'object') {
        if ('text' in val && typeof (val as any).text === 'string') {
          headers[key.toLowerCase()] = (val as any).text
        } else {
          headers[key.toLowerCase()] = JSON.stringify(val)
        }
      }
    }
  }

  const attachments: ParsedAttachment[] = []
  let processedHtml = parsed.html || false

  if (parsed.attachments && parsed.attachments.length > 0) {
    for (const att of parsed.attachments) {
      const filename = att.filename || `attachment_${attachments.length + 1}`
      const contentType = att.contentType || 'application/octet-stream'
      const contentBase64 = att.content ? att.content.toString('base64') : ''
      const cid = att.cid || undefined
      const isRelated = Boolean(att.related)
      const isInline = isRelated || (Boolean(cid) && typeof processedHtml === 'string' && processedHtml.includes(`cid:${cid}`))

      // If inline attachment, substitute CID references in HTML with base64 data URI
      if (cid && typeof processedHtml === 'string' && contentBase64) {
        const dataUri = `data:${contentType};base64,${contentBase64}`
        const cidRegex = new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi')
        processedHtml = processedHtml.replace(cidRegex, dataUri)
      }

      attachments.push({
        filename,
        contentType,
        size: att.size || (att.content ? att.content.length : 0),
        cid,
        contentBase64,
        isInline,
        checksum: att.checksum
      })
    }
  }

  return {
    html: processedHtml,
    text: parsed.text || undefined,
    textAsHtml: parsed.textAsHtml || undefined,
    subject: parsed.subject || '(No Subject)',
    from: formatAddress(parsed.from) || '(No Sender)',
    to: formatAddress(parsed.to) || '',
    cc: formatAddress(parsed.cc) || undefined,
    bcc: formatAddress(parsed.bcc) || undefined,
    replyTo: formatAddress(parsed.replyTo) || undefined,
    date: parsed.date ? parsed.date.toISOString() : '',
    messageId: parsed.messageId || undefined,
    attachments,
    headers
  }
}
