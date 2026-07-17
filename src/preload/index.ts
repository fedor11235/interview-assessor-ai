import { contextBridge, ipcRenderer } from 'electron'

const api = {
  platform: process.platform,
  openOverlay: (): Promise<void> => ipcRenderer.invoke('overlay:open'),
  closeOverlay: (): Promise<void> => ipcRenderer.invoke('overlay:close'),
  setOverlayPassThrough: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('overlay:set-pass-through', enabled)
}

contextBridge.exposeInMainWorld('assessor', api)

