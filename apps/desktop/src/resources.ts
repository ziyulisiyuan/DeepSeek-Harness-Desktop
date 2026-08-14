import { join } from 'node:path'

/** The two executables the shell needs: the Node runtime and the dsh CLI entry. */
export interface SidecarPaths {
  node: string
  cli: string
}

/**
 * Resolve the sidecar launch paths.
 *
 * Packaged builds carry a bundled Node runtime and a `pnpm deploy`ed dsh tree
 * under resources/sidecar. Dev checkouts use the node on PATH and the sibling
 * apps/cli build; DSH_DESKTOP_NODE / DSH_DESKTOP_CLI override both (tests).
 * @param packaged - `app.isPackaged`.
 * @param resourcesPath - `process.resourcesPath`.
 * @param appPath - `app.getAppPath()`.
 * @param env - the process environment.
 */
export function resolveSidecarPaths(
  packaged: boolean, resourcesPath: string, appPath: string, env: NodeJS.ProcessEnv,
): SidecarPaths {
  if (packaged) {
    return {
      node: join(resourcesPath, 'sidecar', 'node', 'node.exe'),
      cli: join(resourcesPath, 'sidecar', 'dsh', 'lib', 'bin.js'),
    }
  }
  const node = env.DSH_DESKTOP_NODE?.trim() || 'node'
  const cli = env.DSH_DESKTOP_CLI?.trim() || join(appPath, '..', 'cli', 'lib', 'bin.js')
  return { node, cli }
}

/**
 * Resolve the tray icon. Packaged builds read it beside the resources; dev
 * checkouts read the generated build/ copy.
 */
export function trayIconPath(packaged: boolean, resourcesPath: string, appPath: string): string {
  return packaged ? join(resourcesPath, 'tray.png') : join(appPath, 'build', 'tray.png')
}
