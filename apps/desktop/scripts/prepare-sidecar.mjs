/**
 * Assembles the packaged sidecar under .cache/sidecar/:
 *   sidecar/node/node.exe — the bundled Node runtime (npmmirror mirror)
 *   sidecar/dsh/          — `pnpm deploy` of @deepseek-ai/dsh with its whole
 *                          production closure, including the built frontend
 *                          dist resolved through dsh-web-frontend's exports
 * Both halves are verified before electron-builder copies them.
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { cp, copyFile, readFile, rm } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const desktopDir = join(here, '..')
const repoRoot = join(desktopDir, '..', '..')
const cacheDir = join(desktopDir, '.cache')
const sidecarDir = join(cacheDir, 'sidecar')
const deployDir = join(sidecarDir, 'dsh')

/** Run a program with inherited stdio; exit code is the caller's problem. */
function run(command, args, cwd, env) {
  const storeDir = env.DSH_PNPM_STORE_DIR
  const fullArgs = storeDir === undefined ? args : ['--store-dir', storeDir, ...args]
  // A configured-but-dead local proxy makes every pnpm fetch ECONNREFUSED;
  // deployment reads the warm store and the npmmirror registry, so proxy
  // variables are cleared for the child while the caller's shell keeps them.
  const result = spawnSync(command, fullArgs, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...env, HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', NO_PROXY: '' },
  })
  return result.status ?? 1
}

function assertExists(path, what) {
  if (!existsSync(path)) throw new Error(`prepare-sidecar: missing ${what} at ${path} — run pnpm run build from the repository root first`)
}

mkdirSync(cacheDir, { recursive: true })

assertExists(join(repoRoot, 'apps', 'cli', 'lib', 'bin.js'), 'built dsh CLI')
assertExists(join(repoRoot, 'apps', 'web', 'dist', 'index.html'), 'built frontend dist')

// pnpm deploy requires an empty target; a previous run's tree would block it.
rmSync(sidecarDir, { recursive: true, force: true })
mkdirSync(sidecarDir, { recursive: true })

const status = run(
  'pnpm',
  [
    // Hoisted layout materializes real files at the top level instead of the
    // .pnpm virtual store's junction/symlink soup, whose workspace link
    // cycles (cordis ↔ cordis-plugin-include) defeat any link-following copy.
    '--config.node-linker=hoisted',
    '--config.link-workspace-packages=false',
    '--filter', '@deepseek-ai/dsh', 'deploy', '--prod', '--legacy', deployDir,
  ],
  repoRoot,
  {
    ...process.env,
    npm_config_registry: 'https://registry.npmmirror.com',
  },
)
if (status !== 0) throw new Error(`prepare-sidecar: pnpm deploy exited ${status}`)

// Safety pass: any residual link (a future pnpm change) becomes a real copy;
// under the hoisted layout this walk normally finds nothing to do.
const { materializeTree } = await import('./materialize.mjs')
await materializeTree(deployDir)

// The store's packed dsh-web-frontend entry normally carries the built dist
// (pnpm refreshes the pack when apps/web/dist changes); a stale store would
// lack it, so backfill from the built checkout when the index is absent.
const deployedFrontend = join(deployDir, 'node_modules', '@deepseek-ai', 'dsh-web-frontend')
if (!existsSync(join(deployedFrontend, 'dist', 'index.html'))) {
  await cp(join(repoRoot, 'apps', 'web', 'dist'), join(deployedFrontend, 'dist'), { recursive: true })
  await copyFile(join(repoRoot, 'apps', 'web', 'package.json'), join(deployedFrontend, 'package.json'))
}

// The deploy's prod closure drops workspace packages that built code imports
// at runtime but that only sit in devDependencies (util/timeout and friends),
// and it never packs the link: overrides (cosmokit/schemastery). Backfill
// every workspace package from its built lib + manifest: vendor packages are
// always force-copied (source of record), the rest only when missing.
// Registry dependencies stay as deployed.
const packageDirs = []
for (const entry of readdirSync(join(repoRoot, 'vendor'), { withFileTypes: true })) {
  if (entry.isDirectory()) packageDirs.push(join(repoRoot, 'vendor', entry.name))
}
for (const group of readdirSync(join(repoRoot, 'packages'), { withFileTypes: true })) {
  if (!group.isDirectory()) continue
  for (const pkg of readdirSync(join(repoRoot, 'packages', group.name), { withFileTypes: true })) {
    if (pkg.isDirectory()) packageDirs.push(join(repoRoot, 'packages', group.name, pkg.name))
  }
}
for (const dir of packageDirs) {
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  const name = manifest.name
  if (typeof name !== 'string' || !name.startsWith('@deepseek-ai/')) {
    throw new Error(`prepare-sidecar: workspace package ${dir} has no @deepseek-ai/ name`)
  }
  const target = join(deployDir, 'node_modules', name)
  const force = dir.startsWith(join(repoRoot, 'vendor'))
  if (!force && existsSync(join(target, 'package.json'))) continue
  await rm(target, { recursive: true, force: true })
  for (const entry of ['package.json', 'lib']) {
    const source = join(dir, entry)
    if (existsSync(source)) await cp(source, join(target, entry), { recursive: true, dereference: true })
  }
}

assertExists(join(deployDir, 'lib', 'bin.js'), 'deployed dsh CLI')
assertExists(
  join(deployDir, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html'),
  'frontend dist inside the deployed tree',
)

await import('./fetch-node.mjs')
console.log(`prepare-sidecar: ${sidecarDir} ready`)
