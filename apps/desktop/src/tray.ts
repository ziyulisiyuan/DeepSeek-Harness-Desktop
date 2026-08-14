import { Menu, Tray, nativeImage } from 'electron'

/** The two actions the tray surfaces. */
export interface TrayActions {
  show: () => void
  quit: () => void
}

/**
 * The tray icon: left-click opens the menu, double-click shows the window,
 * 退出 quits the whole app (window close alone only hides it).
 */
export function createTray(iconPath: string, actions: TrayActions): Tray {
  const tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('DeepSeek Harness')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 DeepSeek Harness', click: actions.show },
    { type: 'separator' },
    { label: '退出', click: actions.quit },
  ]))
  tray.on('double-click', actions.show)
  return tray
}
