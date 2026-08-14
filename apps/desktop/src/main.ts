import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, dialog } from 'electron'
import { installAppMenu } from './menu.ts'
import { resolveSidecarPaths, trayIconPath } from './resources.ts'
import { Sidecar, killProcessTree } from './sidecar.ts'
import { createTray } from './tray.ts'
import { createAppWindow } from './window.ts'

/** Wait for the settled URL line before declaring an attempt failed. */
const URL_TIMEOUT_MS = 20_000

/** Pause before the one automatic full retry (an interrupted install can leave locks for a moment). */
const RETRY_PAUSE_MS = 2500

/** Port chain: the web default first, then an OS-assigned port (another dsh web instance may hold the default). */
const PORT_ATTEMPTS = [3080, 0]

/** Remove a sidecar pid file left by a previous crash and reap the orphaned tree. */
function clearStaleSidecar(userData: string): void {
  const file = join(userData, 'sidecar.pid')
  if (!existsSync(file)) return
  const raw = readFileSync(file, 'utf8').trim()
  const pid = Number(raw)
  if (Number.isInteger(pid) && pid > 0) killProcessTree(pid)
  rmSync(file, { force: true })
}

function bootstrap(): void {
  let quitting = false
  let announced = false
  let attempt = 0
  let sidecar: Sidecar | undefined
  let timer: NodeJS.Timeout | undefined
  let fullRetryUsed = false

  clearStaleSidecar(app.getPath('userData'))

  const win = createAppWindow()
  const show = (): void => { win.show(); win.focus() }
  const quit = (): void => { quitting = true; app.quit() }

  createTray(trayIconPath(app.isPackaged, process.resourcesPath, app.getAppPath()), { show, quit })
  installAppMenu(show, quit)

  win.on('close', (event) => {
    if (!quitting) { event.preventDefault(); win.hide() }
  })

  win.webContents.on('did-fail-load', (_event, errorCode, description, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return // -3 = ERR_ABORTED (reload/devtools)
    fail(`页面加载失败:${description}`)
  })

  const paths = resolveSidecarPaths(app.isPackaged, process.resourcesPath, app.getAppPath(), process.env)

  const beginBoot = (): void => {
    announced = false
    attempt = 0
    attemptNext()
  }

  /** Shown only after the automatic retry pass; 重试 restarts the whole chain. */
  const fail = (detail: string): void => {
    void (async () => {
      const { response } = await dialog.showMessageBox({
        type: 'error',
        title: 'DeepSeek Harness 启动失败',
        message: '后台服务无法启动',
        detail: `${detail}\n\n可能是上次安装还没完成。点"重试"再试一次,或者重启电脑后再打开。`,
        buttons: ['重试', '退出'],
        defaultId: 0,
        cancelId: 1,
      })
      if (response === 0) {
        sidecar?.stop()
        fullRetryUsed = false
        beginBoot()
        return
      }
      quitting = true
      app.quit()
    })()
  }

  const attemptNext = (): void => {
    if (announced) return
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    const port = PORT_ATTEMPTS[attempt]
    attempt += 1
    if (port === undefined) {
      sidecar?.stop()
      // One automatic full pass heals transient install/lock races, then the
      // human dialog (whose 重试 restarts the whole chain from scratch).
      if (!fullRetryUsed) {
        fullRetryUsed = true
        timer = setTimeout(() => {
          timer = undefined
          beginBoot()
        }, RETRY_PAUSE_MS)
        return
      }
      fail(`后台服务无法启动:${sidecar?.stderr ?? ''}`)
      return
    }
    // Late events from a stopped attempt must not disturb the current one:
    // both callbacks ignore anything that is not this attempt's sidecar.
    const attemptSidecar = new Sidecar(paths, {
      onUrl: (url) => {
        if (sidecar !== attemptSidecar) return
        announced = true
        if (timer !== undefined) clearTimeout(timer)
        const pid = attemptSidecar.pid
        if (pid !== undefined) writeFileSync(join(app.getPath('userData'), 'sidecar.pid'), String(pid))
        void win.loadURL(url)
      },
      onExit: () => {
        if (sidecar !== attemptSidecar) return
        if (timer !== undefined) clearTimeout(timer)
        if (!announced) {
          attemptNext()
          return
        }
        rmSync(join(app.getPath('userData'), 'sidecar.pid'), { force: true })
        if (!quitting) fail('后台服务意外退出了。')
      },
    })
    sidecar?.stop()
    sidecar = attemptSidecar
    timer = setTimeout(() => {
      timer = undefined
      attemptNext()
    }, URL_TIMEOUT_MS)
    attemptSidecar.start(port)
  }

  app.on('before-quit', () => {
    quitting = true
    sidecar?.stop()
    rmSync(join(app.getPath('userData'), 'sidecar.pid'), { force: true })
  })
  app.on('second-instance', show)
  // Close hides instead of quitting, so this normally never fires; keep the
  // handler as a no-op so the tray session outlives an empty window set.
  app.on('window-all-closed', () => {})

  attemptNext()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  void app.whenReady().then(bootstrap)
}
