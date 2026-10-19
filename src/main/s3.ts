import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
import { dialog } from 'electron'
import fs from 'node:fs'
import { AwsConfig, getConfig } from './config'
import { parseMimeEmail } from './parser'
import type { ParsedEmail, SaveAttachmentResult, FolderType } from '../renderer/src/types'

export interface ParsedHeaders {
  headers: Record<string, string>
  from: string
  to: string
  subject: string
  date: string
  messageId: string
}

export interface EmailSummaryItem {
  key: string
  size: number
  lastModified: string
  eTag?: string
  from: string
  to?: string
  subject: string
  date: string
  isParsedHeader?: boolean
}

export interface EmailDetailItem {
  key: string
  size: number
  lastModified: string
  eTag?: string
  headers: Record<string, string>
  from: string
  to: string
  subject: string
  date: string
  rawContent: string
  parsed?: ParsedEmail
}

/**
 * Decode RFC 2047 encoded words in email headers (e.g., =?utf-8?B?...?= or =?utf-8?Q?...?=)
 */
export function decodeMimeWords(text: string): string {
  if (!text) return ''
  return text.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_: string, _charset: string, encoding: string, encodedText: string) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(encodedText, 'base64').toString('utf-8')
      } else if (encoding.toUpperCase() === 'Q') {
        const decoded = encodedText
          .replace(/_/g, ' ')
          .replace(/=([A-Fa-f0-9]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        return Buffer.from(decoded, 'binary').toString('utf-8')
      }
    } catch {
      return encodedText
    }
    return encodedText
  })
}

/**
 * Parse an email date string or fallback into a numeric unix timestamp in milliseconds
 */
export function parseEmailDate(dateStr?: string, fallback?: string): number {
  if (dateStr) {
    let t = Date.parse(dateStr)
    if (!isNaN(t)) return t
    // Strip trailing timezone annotations like " (UTC)" or " (PST)"
    const cleaned = dateStr.replace(/\s*\([^)]*\)\s*$/, '').trim()
    t = Date.parse(cleaned)
    if (!isNaN(t)) return t
  }
  if (fallback) {
    const t = Date.parse(fallback)
    if (!isNaN(t)) return t
  }
  return 0
}

/**
 * Parse headers from the raw email text stream
 */
export function parseRawEmailHeaders(rawText: string): ParsedHeaders {
  const headers: Record<string, string> = {}
  
  // Find where the headers section ends (first blank line)
  const headerEndMatch = rawText.match(/(?:\r?\n){2}/)
  const headerSection = headerEndMatch && headerEndMatch.index !== undefined
    ? rawText.substring(0, headerEndMatch.index)
    : rawText

  const lines = headerSection.split(/\r?\n/)
  let currentKey = ''
  let currentValue = ''

  for (const line of lines) {
    // Header continuation lines start with space or tab
    if (/^[ \t]/.test(line) && currentKey) {
      currentValue += ' ' + line.trim()
    } else {
      if (currentKey) {
        headers[currentKey.toLowerCase()] = decodeMimeWords(currentValue.trim())
      }
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        currentKey = line.substring(0, colonIndex).trim()
        currentValue = line.substring(colonIndex + 1).trim()
      } else {
        currentKey = ''
        currentValue = ''
      }
    }
  }

  if (currentKey) {
    headers[currentKey.toLowerCase()] = decodeMimeWords(currentValue.trim())
  }

  return {
    headers,
    from: headers['from'] || headers['sender'] || headers['reply-to'] || headers['return-path'] || '(No Sender)',
    to: headers['to'] || '',
    subject: headers['subject'] || '(No Subject)',
    date: headers['date'] || '',
    messageId: headers['message-id'] || ''
  }
}

/**
 * Instantiate an AWS S3 Client instance
 */
export function createS3Client(customConfig?: AwsConfig): S3Client {
  const cfg = customConfig || getConfig()

  if (!cfg.region || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error('AWS credentials (Region, Access Key ID, Secret Access Key) are incomplete in configuration.')
  }

  const credentials: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  } = {
    accessKeyId: cfg.accessKeyId.trim(),
    secretAccessKey: cfg.secretAccessKey.trim()
  }

  if (cfg.sessionToken && cfg.sessionToken.trim()) {
    credentials.sessionToken = cfg.sessionToken.trim()
  }

  return new S3Client({
    region: cfg.region.trim(),
    credentials
  })
}

/**
 * Test S3 connectivity and bucket access
 */
export async function testS3Connection(customConfig?: AwsConfig): Promise<{ success: boolean; message?: string }> {
  try {
    const cfg = customConfig || getConfig()
    if (!cfg.bucket || !cfg.bucket.trim()) {
      return { success: false, message: 'Bucket name is required.' }
    }

    const client = createS3Client(cfg)
    const bucket = cfg.bucket.trim()

    // Test bucket existence and access using HeadBucketCommand
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      return { success: true, message: `Successfully connected to S3 bucket "${bucket}"!` }
    } catch (headErr) {
      // Some IAM policies allow ListBucket but deny HeadBucket; try ListObjectsV2 as fallback
      const listRes = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: 1
      }))
      const count = listRes.KeyCount ?? 0
      return {
        success: true,
        message: `Successfully connected to S3 bucket "${bucket}" (List verified, returned ${count} objects).`
      }
    }
  } catch (error: any) {
    let message = error?.message || 'Unknown error occurred while connecting to AWS S3.'
    if (error?.name === 'InvalidAccessKeyId') {
      message = 'The AWS Access Key ID you provided does not exist in our records.'
    } else if (error?.name === 'SignatureDoesNotMatch') {
      message = 'The Secret Access Key provided is incorrect for this Access Key ID.'
    } else if (error?.name === 'NoSuchBucket' || error?.$metadata?.httpStatusCode === 404) {
      message = 'The specified bucket does not exist.'
    } else if (error?.name === 'AccessDenied' || error?.$metadata?.httpStatusCode === 403) {
      message = 'Access Denied: The IAM credentials lack s3:ListBucket / s3:GetObject permissions.'
    }
    return { success: false, message }
  }
}

/**
 * List email objects from S3 and extract header summaries
 */
/**
 * List email objects from S3 and extract header summaries with folder filtering
 */
export async function listS3Emails(options?: {
  prefix?: string
  maxKeys?: number
  folder?: FolderType
}): Promise<{
  success: boolean
  data?: EmailSummaryItem[]
  error?: string
}> {
  try {
    const cfg = getConfig()
    if (!cfg.bucket) {
      return { success: false, error: 'S3 Bucket is not configured. Please open Settings and configure AWS credentials.' }
    }

    const client = createS3Client(cfg)
    const folder = options?.folder || 'inbox'

    // Determine query prefix based on folder
    let queryPrefix: string | undefined
    if (folder === 'sent') {
      queryPrefix = 'sent/'
    } else if (folder === 'trash') {
      queryPrefix = 'trash/'
    } else {
      // Inbox: use configured prefix or root
      const customPrefix = options?.prefix !== undefined ? options.prefix : (cfg.prefix || '')
      queryPrefix = customPrefix.trim() || undefined
    }

    const maxKeys = options?.maxKeys || cfg.maxKeys || 100

    const listCmd = new ListObjectsV2Command({
      Bucket: cfg.bucket.trim(),
      Prefix: queryPrefix,
      MaxKeys: maxKeys
    })

    const listResponse = await client.send(listCmd)
    let contents = listResponse.Contents || []

    // Filter out folder markers (e.g. key === 'sent/' or 'trash/')
    contents = contents.filter((item) => {
      const k = item.Key || ''
      if (k === 'sent/' || k === 'trash/' || k.endsWith('/')) return false

      if (folder === 'inbox') {
        // Exclude sent and trash objects from the inbox view
        if (k.startsWith('sent/') || k.startsWith('trash/') || k.startsWith('deleted/')) {
          return false
        }
      }
      return true
    })

    // Sort objects by LastModified descending
    contents.sort((a, b) => {
      const timeA = a.LastModified ? a.LastModified.getTime() : 0
      const timeB = b.LastModified ? b.LastModified.getTime() : 0
      return timeB - timeA
    })

    // Process items and extract email header metadata
    const results: EmailSummaryItem[] = await Promise.all(
      contents.map(async (item): Promise<EmailSummaryItem> => {
        const key = item.Key || ''
        const size = item.Size || 0
        const lastModified = item.LastModified ? item.LastModified.toISOString() : ''
        const eTag = item.ETag

        let from = '(No Sender)'
        let to = ''
        let subject = '(No Subject)'
        let headerDate = ''
        let isParsedHeader = false

        if (size > 0 && key && !key.endsWith('/')) {
          try {
            // If file is under 64KB, fetch full object; if over 64KB, fetch first 64KB (preventing 416 Range Not Satisfiable)
            const rangeHeader = size > 65536 ? 'bytes=0-65535' : undefined
            const getHeaderCmd = new GetObjectCommand({
              Bucket: cfg.bucket.trim(),
              Key: key,
              Range: rangeHeader
            })
            const headerObj = await client.send(getHeaderCmd)
            const chunkStr = (await headerObj.Body?.transformToString('utf-8')) || ''
            if (chunkStr) {
              const parsed = parseRawEmailHeaders(chunkStr)
              from = parsed.from
              to = parsed.to
              subject = parsed.subject
              headerDate = parsed.date
              isParsedHeader = true
            }
          } catch (headerErr) {
            console.error(`Failed to read header for key "${key}":`, headerErr)
            subject = key.split('/').pop() || key
          }
        }

        return {
          key,
          size,
          lastModified,
          eTag,
          from,
          to,
          subject,
          date: headerDate || lastModified,
          isParsedHeader
        }
      })
    )

    // Sort results by true parsed email date descending (newest first)
    results.sort((a, b) => {
      const timeA = parseEmailDate(a.date, a.lastModified)
      const timeB = parseEmailDate(b.date, b.lastModified)
      if (timeA !== timeB) return timeB - timeA
      return a.key.localeCompare(b.key)
    })

    return { success: true, data: results }
  } catch (error: any) {
    const message = error?.message || 'Failed to list emails from S3.'
    return { success: false, error: message }
  }
}

/**
 * Save raw email content to S3 (e.g. for storing sent emails under sent/ prefix)
 */
export async function saveEmailToS3(
  key: string,
  content: Buffer | string,
  contentType = 'message/rfc822'
): Promise<{ success: boolean; key?: string; error?: string }> {
  try {
    const cfg = getConfig()
    if (!cfg.bucket) {
      return { success: false, error: 'S3 Bucket is not configured.' }
    }

    const client = createS3Client(cfg)
    const putCmd = new PutObjectCommand({
      Bucket: cfg.bucket.trim(),
      Key: key,
      Body: content,
      ContentType: contentType
    })

    await client.send(putCmd)
    return { success: true, key }
  } catch (error: any) {
    console.error(`Failed to save email to S3 at "${key}":`, error)
    return { success: false, error: error?.message || 'Failed to save email to S3.' }
  }
}

/**
 * Fetch complete email content for a specific S3 object key with full MIME parsing
 */
export async function getS3EmailContent(key: string): Promise<{
  success: boolean
  data?: EmailDetailItem
  error?: string
}> {
  try {
    const cfg = getConfig()
    if (!cfg.bucket) {
      return { success: false, error: 'S3 Bucket is not configured.' }
    }

    const client = createS3Client(cfg)
    const getCmd = new GetObjectCommand({
      Bucket: cfg.bucket.trim(),
      Key: key
    })

    const response = await client.send(getCmd)
    const rawContent = (await response.Body?.transformToString('utf-8')) || ''
    const parsedFast = parseRawEmailHeaders(rawContent)

    let parsedMime: ParsedEmail | undefined
    try {
      parsedMime = await parseMimeEmail(rawContent)
    } catch (mimeErr) {
      console.warn(`MIME parsing error for "${key}":`, mimeErr)
    }

    const detail: EmailDetailItem = {
      key,
      size: response.ContentLength || rawContent.length,
      lastModified: response.LastModified ? response.LastModified.toISOString() : '',
      eTag: response.ETag,
      headers: parsedMime?.headers || parsedFast.headers,
      from: parsedMime?.from || parsedFast.from,
      to: parsedMime?.to || parsedFast.to,
      subject: parsedMime?.subject || parsedFast.subject,
      date: parsedMime?.date || parsedFast.date || (response.LastModified ? response.LastModified.toISOString() : ''),
      rawContent,
      parsed: parsedMime
    }

    return { success: true, data: detail }
  } catch (error: any) {
    const message = error?.message || `Failed to fetch email content for key "${key}".`
    return { success: false, error: message }
  }
}

/**
 * Save an email attachment to local disk via native system save dialog
 */
export async function saveAttachmentToDisk(payload: {
  filename: string
  contentBase64: string
  contentType: string
}): Promise<SaveAttachmentResult> {
  try {
    const { filename, contentBase64 } = payload
    const saveResult = await dialog.showSaveDialog({
      title: `Save Attachment: ${filename}`,
      defaultPath: filename
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true }
    }

    const buffer = Buffer.from(contentBase64, 'base64')
    fs.writeFileSync(saveResult.filePath, buffer)

    return { success: true, filePath: saveResult.filePath }
  } catch (error: any) {
    console.error('Failed to save attachment:', error)
    return { success: false, error: error?.message || 'Failed to save attachment file.' }
  }
}

/**
 * Delete an email from S3 or move it to trash
 * If permanent is true OR the item is already in trash/, it is permanently deleted with DeleteObjectCommand.
 * Otherwise, it is copied to trash/ and the original key is deleted.
 */
export async function deleteS3Email(
  key: string,
  permanent = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const cfg = getConfig()
    if (!cfg.bucket) {
      return { success: false, error: 'S3 Bucket is not configured.' }
    }

    const client = createS3Client(cfg)
    const bucket = cfg.bucket.trim()
    const isAlreadyInTrash = key.startsWith('trash/')

    if (permanent || isAlreadyInTrash) {
      // Permanently delete the object
      const delCmd = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      })
      await client.send(delCmd)
      return { success: true }
    } else {
      // Move to trash/: Copy to trash/ then delete original
      const filename = key.split('/').pop() || key
      const destinationKey = `trash/${filename}`

      // Copy to trash (CopySource must be bucket/key URL encoded)
      const copyCmd = new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${encodeURIComponent(key)}`,
        Key: destinationKey
      })
      await client.send(copyCmd)

      // Delete original
      const delCmd = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      })
      await client.send(delCmd)

      return { success: true }
    }
  } catch (error: any) {
    console.error(`Failed to delete email key "${key}":`, error)
    return { success: false, error: error?.message || `Failed to delete email "${key}".` }
  }
}

