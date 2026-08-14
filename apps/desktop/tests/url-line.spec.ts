import { describe, expect, it } from 'vitest'
import { parseUrlLine } from '../src/url-line.ts'

describe('parseUrlLine', () => {
  it('extracts the canonical loopback URL', () => {
    expect(parseUrlLine('dsh web: http://127.0.0.1:3080')).toBe('http://127.0.0.1:3080')
  })

  it('stops at the LAN suffix', () => {
    expect(parseUrlLine('dsh web: http://127.0.0.1:4317 (LAN: http://192.168.1.5:4317)')).toBe('http://127.0.0.1:4317')
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseUrlLine('  dsh web: http://127.0.0.1:80  ')).toBe('http://127.0.0.1:80')
  })

  it('ignores unrelated lines and empty input', () => {
    expect(parseUrlLine('info: something else')).toBeUndefined()
    expect(parseUrlLine('')).toBeUndefined()
  })
})
