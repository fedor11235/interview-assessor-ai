import { app, BrowserWindow, desktopCapturer, ipcMain, screen, shell, systemPreferences } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let latestOverlaySnapshot: unknown = null

interface CaptureSourceDescriptor {
  id: string
  name: string
  kind: 'window' | 'screen'
  thumbnail: string
  appIcon?: string
}

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

function setDockIcon(): void {
  const iconPath = getWindowIconPath()

  if (process.platform === 'darwin' && iconPath) {
    app.dock?.setIcon(iconPath)
  }
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
    sendOverlaySnapshot()
    overlayWindow.focus()
    return
  }

  const { workArea } = screen.getPrimaryDisplay()
  const width = 430
  const height = 620

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + 72,
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

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setFullScreenable(false)
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.webContents.once('did-finish-load', () => sendOverlaySnapshot())
  loadRenderer(overlayWindow, '/overlay')
  overlayWindow.showInactive()

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function sendOverlaySnapshot(): void {
  if (overlayWindow && !overlayWindow.isDestroyed() && latestOverlaySnapshot) {
    overlayWindow.webContents.send('overlay:snapshot', latestOverlaySnapshot)
  }
}

app.whenReady().then(() => {
  setDockIcon()

  ipcMain.handle('capture:list-sources', async (): Promise<CaptureSourceDescriptor[]> => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      fetchWindowIcons: true,
      thumbnailSize: { width: 320, height: 200 }
    })

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon?.toDataURL()
    }))
  })
  ipcMain.handle('capture:get-screen-access-status', () => systemPreferences.getMediaAccessStatus('screen'))
  ipcMain.handle('capture:open-screen-settings', () =>
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
  )

  ipcMain.handle('overlay:open', () => createOverlayWindow())
  ipcMain.handle('overlay:close', () => overlayWindow?.close())
  ipcMain.handle('overlay:get-snapshot', () => latestOverlaySnapshot)
  ipcMain.handle('overlay:update', (_event, snapshot: unknown) => {
    latestOverlaySnapshot = snapshot
    sendOverlaySnapshot()
  })
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
