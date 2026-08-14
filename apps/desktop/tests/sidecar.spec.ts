import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Sidecar, sidecarArgs } from '../src/sidecar.ts'

/** Prints noise, then the settled URL line, then keeps running until killed. */
const fixture = fileURLToPath(new URL('./fixtures/announce.mjs', import.meta.url))

describe('sidecarArgs', () => {
  it('passes the web profile and the port verbatim', () => {
    expect(sidecarArgs(3080)).toEqual(['--profile', 'web', '--port', '3080'])
    expect(sidecarArgs(0)).toEqual(['--profile', 'web', '--port', '0'])
  })
})

describe('Sidecar', () => {
  const active: Sidecar[] = []
  afterEach(() => {
    for (const sidecar of active.splice(0)) sidecar.stop()
  })

  it('announces the URL line, ignores other output, and reports the kill', async () => {
    const urls: string[] = []
    const exits: Array<{ code: number | null; signal: string | null }> = []
    const sidecar = new Sidecar({ node: process.execPath, cli: fixture }, {
      onUrl: url => urls.push(url),
      onExit: (code, signal) => exits.push({ code, signal }),
    })
    active.push(sidecar)
    sidecar.start(1) // The fixture never reads argv; the port value is irrelevant here.
    await expect.poll(() => urls).toEqual(['http://127.0.0.1:4567'])
    expect(exits).toEqual([])
    sidecar.stop()
    await expect.poll(() => exits.length).toBe(1)
  })
})
