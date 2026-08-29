import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, ElectronAPI, FolderType, OutgoingEmailPayload, SmtpConfig } from '../renderer/src/types'

const api: ElectronAPI = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('config:save', config),
  testConnection: (config?: AppConfig) => ipcRenderer.invoke('s3:testConnection', config),
  testSmtpConnection: (smtpConfig: SmtpConfig) => ipcRenderer.invoke('smtp:test', smtpConfig),
  listEmails: (options?: { prefix?: string; maxKeys?: number; folder?: FolderType }) =>
    ipcRenderer.invoke('s3:listEmails', options),
  getEmailContent: (key: string) => ipcRenderer.invoke('s3:getEmailContent', key),
  sendEmail: (payload: OutgoingEmailPayload) => ipcRenderer.invoke('smtp:send', payload),
  openEmailViewer: (key: string) => ipcRenderer.invoke('window:openViewer', key),
  getConfigPath: () => ipcRenderer.invoke('config:getPath'),
  saveAttachment: (payload) => ipcRenderer.invoke('attachment:save', payload),
  deleteEmail: (key: string, permanent?: boolean) =>
    ipcRenderer.invoke('s3:deleteEmail', { key, permanent })
}

contextBridge.exposeInMainWorld('electronAPI', api)
