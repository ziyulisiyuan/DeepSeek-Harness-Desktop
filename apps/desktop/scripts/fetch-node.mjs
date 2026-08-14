/**
 * Downloads the bundled Node runtime zip from the npmmirror mirror and keeps
 * only node.exe under .cache/sidecar/node/ (electron-builder extraResources).
 * Mirrors first, per project policy; fails loud with the mirror URL on 404.
 */
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { get } from 'node:https'
import { unzipSync } from 'fflate'

const here = dirname(fileURLToPath(import.meta.url))
const version = process.argv[2] ?? 'v24.15.0'
const base = 'https://npmmirror.com/mirrors/node'
const zipUrl = `${base}/${version}/node-${version}-win-x64.zip`
const outDir = join(here, '..', '.cache', 'sidecar', 'node')

/** GET the mirror URL, following no redirects; 200 means the version exists. */
function fetchBytes(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        res.resume()
        if (redirectsLeft <= 0 || res.headers.location === undefined) reject(new Error(`too many redirects for ${url}`))
        else resolve(fetchBytes(new URL(res.headers.location, url).href, redirectsLeft - 1))
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

const zip = await fetchBytes(zipUrl)
const files = unzipSync(new Uint8Array(zip))
const nodeEntry = Object.keys(files).find((name) => name.endsWith('/node.exe'))
if (nodeEntry === undefined) throw new Error(`node zip ${zipUrl} contains no node.exe`)
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'node.exe'), files[nodeEntry])
console.log(`node runtime: ${outDir}/node.exe (${(files[nodeEntry].length / 1024 / 1024).toFixed(1)} MB) from ${zipUrl}`)
