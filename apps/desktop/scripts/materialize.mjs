/**
 * Replace every junction/symlink in a directory tree with a real copy of its
 * target. pnpm links node_modules entries (workspace junctions on Windows,
 * store symlinks elsewhere), and a packaged sidecar must not depend on the
 * build machine's store or checkout paths — the installer copies real files.
 * Targets resolve through the OS (realpath), never by hand-joining link
 * print names: pnpm's nested .pnpm reparse chains mangle manual joins.
 */
import { cp, lstat, readdir, realpath, rm } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Walk a tree and materialize every link. The link is deleted first so the
 * replacement directory cannot recurse into its own target.
 * @param {string} root - tree root to walk.
 */
export async function materializeTree(root) {
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(root, entry.name)
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) {
      const target = await realpath(path)
      await rm(path, { recursive: true, force: true })
      await cp(target, path, { recursive: true, dereference: true })
      continue
    }
    if (stat.isDirectory()) await materializeTree(path)
  }
}
