import { contextBridge, ipcRenderer } from 'electron'

const api = {
  platform: process.platform,
  listCaptureSources: (): Promise<unknown> => ipcRenderer.invoke('capture:list-sources'),
  getScreenAccessStatus: (): Promise<unknown> => ipcRenderer.invoke('capture:get-screen-access-status'),
  openScreenSettings: (): Promise<void> => ipcRenderer.invoke('capture:open-screen-settings'),
  openOverlay: (): Promise<void> => ipcRenderer.invoke('overlay:open'),
  closeOverlay: (): Promise<void> => ipcRenderer.invoke('overlay:close'),
  getOverlaySnapshot: (): Promise<unknown> => ipcRenderer.invoke('overlay:get-snapshot'),
  updateOverlay: (snapshot: unknown): Promise<void> => ipcRenderer.invoke('overlay:update', snapshot),
  onOverlaySnapshot: (callback: (snapshot: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown): void => callback(snapshot)

    ipcRenderer.on('overlay:snapshot', listener)
    return () => ipcRenderer.removeListener('overlay:snapshot', listener)
  },
  setOverlayPassThrough: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('overlay:set-pass-through', enabled)
}

contextBridge.exposeInMainWorld('assessor', api)
