# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

DeepSeek Harness 的 Windows 桌面壳:一个 Electron 窗口,里面跑的是**真实的 `dsh web` profile**。产品代码零改动——壳启动的正是浏览器版运行的那个 `web` profile,加载它结算后公布的地址,只额外提供操作系统层面的壳能力(窗口、托盘、菜单、自更新)。界面、功能、数据、会话日志与网页版完全一致,两个入口读的是同一份 Harness home。

## 工作原理

1. 启动时先抢占单实例锁,然后拉起 **sidecar**:开发态为 `node <dsh-cli> --profile web --port <p>`,打包态为自带运行时 + `pnpm deploy` 出来的 CLI 树。
2. 唯一可信的就绪信号是 `dsh-web-app` 在 Loader 树结算后打印的 `dsh web: http://127.0.0.1:<port>` 行——绝不把"进程活着/端口能连"当就绪(见 postmortem 0003)。端口按 `3080`、`0`(系统分配)顺序尝试;上次崩溃遗留的 pid 文件会先被清理。
3. 窗口以浏览器级渲染器(`contextIsolation`、`sandbox`,无 preload/IPC)加载公布的地址,并使用命名分区 `persist:harness`,端口变化也不丢界面状态。
4. 点 × 收进托盘;托盘"退出"才真正退出,并整树清理 sidecar(`taskkill /t`)。启动失败会先自动重试一次,错误弹窗里的"重试"按钮会重启整套启动流程。

## 命令

```sh
pnpm desktop:dev        # build the shell and open it against the checkout (dev sidecar)
pnpm desktop:test       # unit tests (url-line, path resolution, real sidecar spawn)
pnpm desktop:test:e2e   # real-composition smoke: launches Electron, boots real dsh web, asserts window + cleanup
pnpm desktop:pack       # NSIS installer for Windows x64 in apps/desktop/dist/
```

`desktop:pack` 会执行 `prepare-sidecar`:从 `https://npmmirror.com/mirrors/node/` 下载自带 Node 运行时,并把 `@deepseek-ai/dsh` `pnpm deploy`(镜像 registry)到 `.cache/sidecar/`。镜像优先;网络慢时把 `ELECTRON_MIRROR` 与 `ELECTRON_BUILDER_BINARIES_MIRROR` 指向 npmmirror 对应镜像。

## Known Limitations and Deferred Work

- **仅 Windows x64。** 壳逻辑本身平台无关,但打包、自带运行时与托盘生命周期目前只接 Windows。
- **暂无自动更新。** 更新渠道随首个正式发布而来;在那之前应用不做任何更新检查、不下载任何东西。
- **暂无代码签名。** 广泛分发前需要补齐;在此之前按用户级 NSIS 安装控制影响面。
- **同一时间一个 GUI 实例。** 单实例锁按应用生效;同端口被占用时自动回退到系统分配端口。
