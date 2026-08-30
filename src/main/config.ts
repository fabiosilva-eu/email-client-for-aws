import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AppConfig, SmtpConfig } from '../renderer/src/types'

export type { AppConfig, SmtpConfig }
export type AwsConfig = AppConfig

const DEFAULT_CONFIG: AppConfig = {
  bucket: '',
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  sessionToken: '',
  prefix: '',
  maxKeys: 100,
  autoRefreshEnabled: true,
  autoRefreshInterval: 60,
  showRefreshCountdown: true,
  smtp: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    fromName: '',
    fromEmail: ''
  }
}

export function getConfigPath(): string {
  try {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'config.json')
  } catch {
    return path.join(process.cwd(), 'config.json')
  }
}

export function getConfig(): AppConfig {
  const filePath = getConfigPath()
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(data)
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        smtp: {
          ...DEFAULT_CONFIG.smtp,
          ...(parsed.smtp || {})
        }
      }
    }
  } catch (error) {
    console.error('Failed to read config file:', error)
  }
  return DEFAULT_CONFIG
}

export function saveConfig(newConfig: AppConfig): { success: boolean; message?: string } {
  const filePath = getConfigPath()
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(newConfig, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    console.error('Failed to save config file:', error)
    return { success: false, message: errMessage }
  }
}
