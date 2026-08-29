import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from 'electron'
import { getConfig, saveConfig, getConfigPath, AwsConfig } from './config'
import { testS3Connection, listS3Emails, getS3EmailContent, saveAttachmentToDisk } from './s3'
import { createMainWindow, createViewerWindow } from './windows'

// Handle rendering color quirks
app.commandLine.appendSwitch('disable-color-correct-rendering')

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const }
            ]
          : [{ role: 'close' as const }])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function registerIpcHandlers() {
  // Config handlers
  ipcMain.handle('config:get', async () => {
    return getConfig()
  })

  ipcMain.handle('config:save', async (_, config: AwsConfig) => {
    return saveConfig(config)
  })

  ipcMain.handle('config:getPath', async () => {
    return getConfigPath()
  })

  // S3 handlers
  ipcMain.handle('s3:testConnection', async (_, config?: AwsConfig) => {
    return testS3Connection(config)
  })

  ipcMain.handle('s3:listEmails', async (_, options?: { prefix?: string; maxKeys?: number }) => {
    return listS3Emails(options)
  })

  ipcMain.handle('s3:getEmailContent', async (_, key: string) => {
    return getS3EmailContent(key)
  })

  ipcMain.handle(
    'attachment:save',
    async (
      _,
      payload: {
        filename: string
        contentBase64: string
        contentType: string
      }
    ) => {
      return saveAttachmentToDisk(payload)
    }
  )

  // Window management handlers
  ipcMain.handle('window:openViewer', async (_, key: string) => {
    createViewerWindow(key)
  })
}

app.whenReady().then(() => {
  setupApplicationMenu()
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
