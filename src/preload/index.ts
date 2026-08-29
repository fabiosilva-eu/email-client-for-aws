import { contextBridge, ipcRenderer } from 'electron'
import type { AwsConfig, ElectronAPI } from '../renderer/src/types'

const api: ElectronAPI = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: AwsConfig) => ipcRenderer.invoke('config:save', config),
  testConnection: (config?: AwsConfig) => ipcRenderer.invoke('s3:testConnection', config),
  listEmails: (options?: { prefix?: string; maxKeys?: number }) =>
    ipcRenderer.invoke('s3:listEmails', options),
  getEmailContent: (key: string) => ipcRenderer.invoke('s3:getEmailContent', key),
  openEmailViewer: (key: string) => ipcRenderer.invoke('window:openViewer', key),
  getConfigPath: () => ipcRenderer.invoke('config:getPath'),
  saveAttachment: (payload) => ipcRenderer.invoke('attachment:save', payload)
}

contextBridge.exposeInMainWorld('electronAPI', api)

