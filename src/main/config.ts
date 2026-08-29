import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface AwsConfig {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  prefix?: string
  maxKeys?: number
}

const DEFAULT_CONFIG: AwsConfig = {
  bucket: '',
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  sessionToken: '',
  prefix: '',
  maxKeys: 100
}

export function getConfigPath(): string {
  try {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'config.json')
  } catch {
    // Fallback if app is not yet initialized in tests
    return path.join(process.cwd(), 'config.json')
  }
}

export function getConfig(): AwsConfig {
  const filePath = getConfigPath()
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(data)
      return {
        ...DEFAULT_CONFIG,
        ...parsed
      }
    }
  } catch (error) {
    console.error('Failed to read config file:', error)
  }
  return DEFAULT_CONFIG
}

export function saveConfig(newConfig: AwsConfig): { success: boolean; message?: string } {
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

