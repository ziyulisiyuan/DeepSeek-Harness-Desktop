import { Menu, shell } from 'electron'

/**
 * A minimal application menu. The Edit/View roles keep the standard
 * clipboard and zoom accelerators working on Windows (they disappear when no
 * menu exists); 帮助 links the project home in the system browser.
 */
export function installAppMenu(show: () => void, quit: () => void): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        { label: '显示窗口', click: show },
        { type: 'separator' },
        { label: '退出', click: quit },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '项目主页',
          click: () => void shell.openExternal('https://github.com/deepseek-ai/deepseek-harness'),
        },
      ],
    },
  ]))
}
