import { defineConfig } from 'tsdown'

/**
 * The desktop shell ships one entry: the Electron main referenced by
 * package.json `main`. electron stays unbundled — the electron module
 * resolves to the runtime's binary path. fixedExtension matches the apps/cli
 * build: a `type: module` package emits plain .js.
 */
export default defineConfig({
  entry: ['lib/types/main.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  deps: {
    neverBundle: ['electron'],
  },
  dts: false,
  clean: false,
})
