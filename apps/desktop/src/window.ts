import { BrowserWindow, shell } from 'electron'

/**
 * The app window: a plain browser-grade renderer (contextIsolation, sandbox,
 * no node integration — the page needs none of Electron). The named persist
 * partition keeps UI state across launches even when the sidecar's port
 * changes, because localStorage is keyed by origin.
 */
export function createAppWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'DeepSeek Harness',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:harness',
    },
  })
  win.once('ready-to-show', () => { win.show() })
  // The app never navigates away from its own origin; foreign http(s) targets
  // go to the system browser instead.
  win.webContents.on('will-navigate', (event, url) => {
    const next = new URL(url)
    const current = new URL(win.webContents.getURL())
    if (next.origin === current.origin) return
    event.preventDefault()
    if (next.protocol === 'http:' || next.protocol === 'https:') void shell.openExternal(url)
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  return win
}
