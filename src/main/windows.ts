import { BrowserWindow, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
const viewerWindows = new Map<string, BrowserWindow>()

// Helper to get preload path safely for .cjs, .mjs and .js outputs
function getPreloadPath(): string {
  const cjsPath = path.join(__dirname, '../preload/index.cjs')
  if (fs.existsSync(cjsPath)) {
    return cjsPath
  }
  const mjsPath = path.join(__dirname, '../preload/index.mjs')
  if (fs.existsSync(mjsPath)) {
    return mjsPath
  }
  return path.join(__dirname, '../preload/index.js')
}

// Helper to get application icon path
function getIconPath(): string {
  const resourceIcon = path.join(__dirname, '../../resources/icon.png')
  if (fs.existsSync(resourceIcon)) return resourceIcon
  return path.join(process.cwd(), 'resources/icon.png')
}

// Attach debugging, logging and hotkey listeners
function attachWindowLogging(win: BrowserWindow, windowName: string) {
  // Forward all console logs from renderer to terminal stdout
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelName = level === 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO'
    console.log(`[${windowName} ${levelName}] ${message} (${path.basename(sourceId || '')}:${line})`)
  })

  // Log any load failures
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[${windowName} LOAD FAILED] Code: ${errorCode}, Description: ${errorDescription}, URL: ${validatedURL}`)
  })

  // DevTools toggle shortcut (F12 or Cmd+Option+I / Ctrl+Shift+I)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.key === 'I' && input.control && input.shift) || (input.key === 'i' && input.meta && input.alt)) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools()
      } else {
        win.webContents.openDevTools({ mode: 'detach' })
      }
      event.preventDefault()
    }
  })
}

/**
 * Create or focus the main application window
 */
export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    return mainWindow
  }


  mainWindow = new BrowserWindow({
    title: 'Email Client for AWS S3 and SES',
    icon: getIconPath(),
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  attachWindowLogging(mainWindow, 'MainWindow')

  // Open external URLs in default web browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
    // Open DevTools in dev mode to assist diagnostics
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

/**
 * Open a standalone viewer window for a specific email S3 key
 */
export function createViewerWindow(key: string): BrowserWindow {
  const existingWindow = viewerWindows.get(key)
  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.isMinimized()) existingWindow.restore()
    existingWindow.focus()
    return existingWindow
  }

  const encodedKey = encodeURIComponent(key)
  const windowTitle = `Email: ${key.split('/').pop() || key}`

  const viewerWin = new BrowserWindow({
    title: windowTitle,
    icon: getIconPath(),
    width: 900,
    height: 750,
    minWidth: 600,
    minHeight: 450,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  attachWindowLogging(viewerWin, `Viewer[${key}]`)

  viewerWin.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    viewerWin.loadURL(`${devServerUrl}#viewer?key=${encodedKey}`)
  } else {
    viewerWin.loadFile(path.join(__dirname, '../../dist/index.html'), {
      hash: `viewer?key=${encodedKey}`
    })
  }

  viewerWindows.set(key, viewerWin)

  viewerWin.on('closed', () => {
    viewerWindows.delete(key)
  })

  return viewerWin
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
