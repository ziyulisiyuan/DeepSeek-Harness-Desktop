/**
 * Runs the Electron e2e spec with DSH_DESKTOP_E2E=1 on every platform
 * (inline `ENV=1 cmd` breaks in Windows cmd.exe, so the env is set here).
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(desktopDir, '..', '..')
const vitest = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs')

// The root vitest config (projects + repo-relative globs) only resolves
// correctly from the repository root, so the spec path is repo-relative.
const child = spawn(process.execPath, [vitest, 'run', 'apps/desktop/tests/desktop-e2e.spec.ts'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, DSH_DESKTOP_E2E: '1' },
})
child.on('exit', (code, signal) => {
  if (signal !== null) {
    console.error(`desktop e2e killed by ${signal}`)
    process.exit(1)
  }
  process.exit(code ?? 1)
})
