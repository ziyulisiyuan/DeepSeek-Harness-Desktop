import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Heavy real-composition smoke: runs only under `pnpm run desktop:test:e2e` (scripts/e2e.mjs sets the gate). */
const run = process.env.DSH_DESKTOP_E2E === '1' ? describe : describe.skip

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const cliBin = join(desktopDir, '..', 'cli', 'lib', 'bin.js')

run('desktop shell', () => {
  it('opens the real web GUI in its own window and cleans up on quit', async () => {
    if (!existsSync(cliBin)) {
      throw new Error('desktop e2e needs the built CLI: run pnpm run build from the repository root first')
    }
    // The smoke must never touch the developer's real Harness home: a sidecar
    // booted against live session data (and then killed) is how a concurrent
    // writer can tear a session log. The web profile materializes from the
    // shipped templates on first boot, so a fresh home exercises that path.
    const freshHome = mkdtempSync(join(tmpdir(), 'dsh-desktop-e2e-'))
    const { _electron } = await import('playwright')
    const require = createRequire(import.meta.url)
    // DSH_DESKTOP_EXE switches the smoke to a packaged (win-unpacked) build:
    // the same assertions then cover the installed runtime instead of dev.
    const packagedExe = process.env.DSH_DESKTOP_EXE
    const executablePath = packagedExe ?? (require('electron') as string)
    const baseEnv = { ...process.env, DSH_HOME: freshHome } as Record<string, string>
    const devLaunch = {
      args: ['.'],
      cwd: desktopDir,
      env: { ...baseEnv, DSH_DESKTOP_NODE: process.execPath, DSH_DESKTOP_CLI: cliBin },
    }
    const electronApp = await _electron.launch(
      packagedExe === undefined ? { executablePath, ...devLaunch } : { executablePath, env: baseEnv },
    )
    let url = ''
    try {
      const window = await electronApp.firstWindow({ timeout: 60_000 })
      await window.waitForURL(/^http:\/\/127\.0\.0\.1:\d+\//, { timeout: 60_000 })
      await window.waitForFunction(
        () => typeof (window as unknown as { __DSH_BOOT__?: unknown }).__DSH_BOOT__ === 'object',
        undefined,
        { timeout: 30_000 },
      )
      url = window.url()
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//)
      await window.waitForFunction(() => (document.body?.textContent?.length ?? 0) > 0, undefined, { timeout: 30_000 })
      const windowCount = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
      expect(windowCount).toBe(1)
    } finally {
      await electronApp.evaluate(({ app }) => { app.quit() }).catch(() => {})
      await electronApp.waitForEvent('close', { timeout: 30_000 }).catch(() => {})
      await electronApp.close().catch(() => {})
      rmSync(freshHome, { recursive: true, force: true })
    }
    if (url === '') return
    await expectSidecarDead(url)
  }, 240_000)
})

/** After quit, the sidecar must stop answering: poll until connection fails. */
async function expectSidecarDead(url: string): Promise<void> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      await fetch(url)
      await new Promise(resolve => setTimeout(resolve, 250))
    } catch {
      return
    }
  }
  throw new Error(`sidecar still answering after quit: ${url}`)
}
