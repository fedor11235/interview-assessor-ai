import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null

function rendererEntry(hash?: string): { url?: string; file?: string; hash?: string } {
  if (process.env.ELECTRON_RENDERER_URL) {
    return { url: `${process.env.ELECTRON_RENDERER_URL}${hash ? `#${hash}` : ''}` }
  }

  return { file: join(__dirname, '../renderer/index.html'), hash }
}

function loadRenderer(window: BrowserWindow, hash?: string): void {
  const entry = rendererEntry(hash)

  if (entry.url) {
    void window.loadURL(entry.url)
    return
  }

  void window.loadFile(entry.file!, { hash: entry.hash })
}

function getWindowIconPath(): string | undefined {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../build/icon.png')

  return existsSync(iconPath) ? iconPath : undefined
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#f3f0e8',
    show: false,
    icon: getWindowIconPath(),
    title: 'Interview Assessor AI',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  loadRenderer(mainWindow)
}

function createOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus()
    return
  }

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 560,
    minWidth: 360,
    minHeight: 420,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: getWindowIconPath(),
    title: 'Interview Assessor AI Overlay',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  loadRenderer(overlayWindow, '/overlay')

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

app.whenReady().then(() => {
  ipcMain.handle('overlay:open', () => createOverlayWindow())
  ipcMain.handle('overlay:close', () => overlayWindow?.close())
  ipcMain.handle('overlay:set-pass-through', (_event, enabled: boolean) => {
    overlayWindow?.setIgnoreMouseEvents(enabled, { forward: true })
  })

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
