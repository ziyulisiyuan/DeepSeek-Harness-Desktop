# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

The Windows desktop shell for DeepSeek Harness: an Electron window over the real `dsh web` profile. The product is untouched — the shell boots the same `web` profile the browser GUI runs, loads its settled URL, and adds only operating-system furniture (window, tray, menu, self-update). UI, features, data, and the session log are identical to the web GUI; both launchers read the same Harness home.

## How it works

1. On launch the shell claims a single-instance lock, then spawns a **sidecar**: `node <dsh-cli> --profile web --port <p>` (dev) or the bundled runtime + `pnpm deploy`ed CLI tree (packaged).
2. The only readiness signal trusted is the settled stdout line `dsh web: http://127.0.0.1:<port>` printed by `dsh-web-app` after its Loader tree settles — never process-alive or port-open (see postmortem 0003). Ports are tried in order `3080`, then `0` (OS-assigned); a stale pid file from a crashed run is reaped first.
3. The window loads the announced URL with a browser-grade renderer (`contextIsolation`, `sandbox`, no preload/IPC) under the named partition `persist:harness`, so UI state survives port changes.
4. Closing the window hides it to the tray; 退出 quits and kills the whole sidecar tree (`taskkill /t`). A failed boot retries once automatically, and the error dialog's 重试 restarts the chain.

## Commands

```sh
pnpm desktop:dev        # build the shell and open it against the checkout (dev sidecar)
pnpm desktop:test       # unit tests (url-line, path resolution, real sidecar spawn)
pnpm desktop:test:e2e   # real-composition smoke: launches Electron, boots real dsh web, asserts window + cleanup
pnpm desktop:pack       # NSIS installer for Windows x64 in apps/desktop/dist/
```

`desktop:pack` runs `prepare-sidecar`, which downloads the bundled Node runtime from `https://npmmirror.com/mirrors/node/` and `pnpm deploy`s `@deepseek-ai/dsh` (mirror registry) into `.cache/sidecar/`. Mirrors first, per repo policy; set `ELECTRON_MIRROR` and `ELECTRON_BUILDER_BINARIES_MIRROR` to the npmmirror equivalents when installing/building behind a slow link.

## Known Limitations and Deferred Work

- **Windows x64 only.** The shell logic is platform-neutral, but packaging, the bundled runtime, and tray lifecycle are wired for Windows.
- **No auto-update yet.** The update channel arrives with the first published release; until then the app performs no update checks and no downloads.
- **No code signing yet.** Plan for it before broad distribution; per-user NSIS keeps the blast radius small until then.
- **One GUI instance at a time.** The single-instance lock is per-app; a second copy on the same port falls back to an OS-assigned port.
