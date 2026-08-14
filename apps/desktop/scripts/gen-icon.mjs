/**
 * Generates build/icon.png (256), build/tray.png (32), and build/icon.ico
 * from the official favicon (apps/web/public/favicon.svg), read in place.
 * Pure Node: sharp (libvips) rasterizes the SVG, to-ico wraps the 256px PNG
 * into a multi-size ICO — no Electron, so it also runs on CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '..', 'build')
const faviconPath = join(here, '..', '..', 'web', 'public', 'favicon.svg')

const svg = readFileSync(faviconPath)
const png256 = await sharp(svg).resize(256, 256).png().toBuffer()
const png32 = await sharp(svg).resize(32, 32).png().toBuffer()
if (png256.length === 0 || png32.length === 0) throw new Error('icon: favicon rasterization produced no PNG')

mkdirSync(buildDir, { recursive: true })
writeFileSync(join(buildDir, 'icon.png'), png256)
writeFileSync(join(buildDir, 'tray.png'), png32)
writeFileSync(join(buildDir, 'icon.ico'), await toIco([png256]))
console.log('icon: build/icon.png, build/tray.png, build/icon.ico written')
