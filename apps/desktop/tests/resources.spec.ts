import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveSidecarPaths, trayIconPath } from '../src/resources.ts'

describe('resolveSidecarPaths', () => {
  it('uses the bundled resources when packaged', () => {
    expect(resolveSidecarPaths(true, 'C:\\res', 'C:\\app', {})).toEqual({
      node: join('C:\\res', 'sidecar', 'node', 'node.exe'),
      cli: join('C:\\res', 'sidecar', 'dsh', 'lib', 'bin.js'),
    })
  })

  it('defaults to the PATH node and the sibling CLI build in dev', () => {
    const paths = resolveSidecarPaths(false, '', 'E:\\deepseek-harness\\apps\\desktop', {})
    expect(paths.node).toBe('node')
    expect(paths.cli).toBe(join('E:\\deepseek-harness\\apps', 'cli', 'lib', 'bin.js'))
  })

  it('honours the dev overrides', () => {
    const paths = resolveSidecarPaths(false, '', 'C:\\app', {
      DSH_DESKTOP_NODE: 'C:\\node.exe',
      DSH_DESKTOP_CLI: 'C:\\cli\\bin.js',
    })
    expect(paths).toEqual({ node: 'C:\\node.exe', cli: 'C:\\cli\\bin.js' })
  })
})

describe('trayIconPath', () => {
  it('reads the extra resource when packaged', () => {
    expect(trayIconPath(true, 'C:\\res', 'C:\\app')).toBe(join('C:\\res', 'tray.png'))
  })

  it('reads the generated build copy in dev', () => {
    expect(trayIconPath(false, 'C:\\res', 'C:\\app')).toBe(join('C:\\app', 'build', 'tray.png'))
  })
})
