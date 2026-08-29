export interface AwsConfig {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  prefix?: string
  maxKeys?: number
}

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

export interface ElectronAPI {
  getConfig: () => Promise<AwsConfig>
  saveConfig: (config: AwsConfig) => Promise<{ success: boolean; message?: string }>
  testConnection: (config?: AwsConfig) => Promise<TestConnectionResult>
  listEmails: (options?: { prefix?: string; maxKeys?: number }) => Promise<ListEmailsResult>
  getEmailContent: (key: string) => Promise<EmailContentResult>
  openEmailViewer: (key: string) => Promise<void>
  getConfigPath: () => Promise<string>
  saveAttachment: (payload: {
    filename: string
    contentBase64: string
    contentType: string
  }) => Promise<SaveAttachmentResult>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
