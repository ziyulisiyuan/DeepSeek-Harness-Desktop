import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import type { SidecarPaths } from './resources.ts'
import { parseUrlLine } from './url-line.ts'

/**
 * The web app's own flag family, passed verbatim after the launcher flags
 * (the launcher itself parses only `--profile`/`--patch`/dumps).
 */
export function sidecarArgs(port: number): string[] {
  return ['--profile', 'web', '--port', String(port)]
}

/** Lifecycle callbacks the shell wires. */
export interface SidecarEvents {
  onUrl?: (url: string) => void
  onExit?: (code: number | null, signal: string | null) => void
}

/** Kill a process tree by pid (Windows). Best-effort: an already-dead pid is a no-op. */
export function killProcessTree(pid: number): void {
  if (process.platform !== 'win32' || pid <= 0) return
  try {
    // Ignored exit status: the pid may already be gone; taskkill still reaps the tree.
    spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
  } catch {
    // taskkill exists on every supported Windows; the try only guards non-win32 dev runs.
  }
}

/**
 * One dsh web sidecar process. stdout is buffered per line and scanned for
 * the settled `dsh web:` announcement; stderr is retained as a bounded tail
 * for failure dialogs. stop() kills the whole tree so no agent subprocess
 * outlives the shell.
 */
export class Sidecar {
  private child: ChildProcess | undefined
  private stderrTail = ''

  constructor(private readonly paths: SidecarPaths, private readonly events: SidecarEvents) {}

  get pid(): number | undefined {
    return this.child?.pid
  }

  /** Recent stderr, for human-readable failure dialogs. */
  get stderr(): string {
    return this.stderrTail
  }

  /** Start one attempt on the given port. */
  start(port: number): void {
    this.stop()
    const child = spawn(this.paths.node, [this.paths.cli, ...sidecarArgs(port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.child = child
    let buffer = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      let at = buffer.indexOf('\n')
      while (at !== -1) {
        const line = buffer.slice(0, at)
        buffer = buffer.slice(at + 1)
        const url = parseUrlLine(line)
        if (url !== undefined) this.events.onUrl?.(url)
        at = buffer.indexOf('\n')
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-4000)
    })
    child.on('exit', (code, signal) => {
      // A stopped previous attempt exits after the next one started; only the
      // current child may clear the reference.
      if (this.child === child) this.child = undefined
      this.events.onExit?.(code, signal)
    })
  }

  /** Kill the process tree. taskkill owns Windows tree semantics; other platforms kill the direct child. */
  stop(): void {
    const child = this.child
    this.child = undefined
    if (child?.pid === undefined) return
    if (process.platform === 'win32') killProcessTree(child.pid)
    else child.kill()
  }
}
