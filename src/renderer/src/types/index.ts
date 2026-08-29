export type FolderType = 'inbox' | 'sent' | 'trash'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromName?: string
  fromEmail?: string
}

export interface AppConfig {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  prefix?: string
  maxKeys?: number
  smtp?: SmtpConfig
}

export type AwsConfig = AppConfig

export interface EmailHeader {
  from?: string
  to?: string
  subject?: string
  date?: string
  messageId?: string
}

export interface EmailSummary {
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

export interface ParsedAttachment {
  filename: string
  contentType: string
  size: number
  cid?: string
  contentBase64: string
  isInline: boolean
  checksum?: string
}

export interface ParsedEmail {
  html: string | false
  text?: string
  textAsHtml?: string
  subject: string
  from: string
  to: string
  cc?: string
  bcc?: string
  replyTo?: string
  date: string
  messageId?: string
  attachments: ParsedAttachment[]
  headers: Record<string, string>
}

export interface EmailDetail {
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

export interface TestConnectionResult {
  success: boolean
  message?: string
}

export interface TestSmtpResult {
  success: boolean
  message?: string
}

export interface ListEmailsResult {
  success: boolean
  data?: EmailSummary[]
  error?: string
}

export interface EmailContentResult {
  success: boolean
  data?: EmailDetail
  error?: string
}

export interface SaveAttachmentResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface OutgoingEmailPayload {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  textBody?: string
  htmlBody?: string
  inReplyTo?: string
  references?: string
  attachments?: Array<{
    filename: string
    contentBase64: string
    contentType: string
  }>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  s3Key?: string
  error?: string
}

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<{ success: boolean; message?: string }>
  testConnection: (config?: AppConfig) => Promise<TestConnectionResult>
  testSmtpConnection: (smtpConfig: SmtpConfig) => Promise<TestSmtpResult>
  listEmails: (options?: { prefix?: string; maxKeys?: number; folder?: FolderType }) => Promise<ListEmailsResult>
  getEmailContent: (key: string) => Promise<EmailContentResult>
  sendEmail: (payload: OutgoingEmailPayload) => Promise<SendEmailResult>
  openEmailViewer: (key: string) => Promise<void>
  getConfigPath: () => Promise<string>
  saveAttachment: (payload: {
    filename: string
    contentBase64: string
    contentType: string
  }) => Promise<SaveAttachmentResult>
  deleteEmail: (key: string, permanent?: boolean) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
