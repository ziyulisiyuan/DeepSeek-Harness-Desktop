# DeepSeek Harness Desktop 🐟

**把 AI 编程助手装进每个普通人的桌面 —— 双击即用,零配置,零依赖。**

> 一句话:下载 → 双击 → 粘贴你的 API 密钥 → 开干。
> 不需要会命令行,不需要装 Node,不需要"跑服务"。

## ✨ 它是什么

这是开源项目 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 **Windows 桌面版**:一个 Electron 窗口,里面运行着原汁原味的 DeepSeek Harness Web 界面 —— 界面、功能、数据与网页版**完全一致**,只是把"打开浏览器输网址"变成了"双击桌面图标"。

**社区构建,非官方出品**;核心全部来自上游 DeepSeek Harness(MIT 许可证),本项目同样以 MIT 开源。

## 🎯 为什么它不一样

- **零门槛**:安装包自带窗口引擎、运行环境、全部代码。没有任何前置依赖,双击就能用。
- **同源同体**:与 DeepSeek Harness 网页版功能逐一对应 —— 文件读写、命令执行、技能、子代理、工作流、目标管理、计划模式,一个不少;两边读同一份数据。
- **会照顾人**:点 × 收进托盘继续后台干活(像微信);后台没起来绝不白屏,弹"说人话"的提示 + 一键重试;和网页版同开也互不冲突。
- **完全开源**:仓库里的每一行壳代码、构建脚本、测试都可审查。

## 🚀 三步上手(给完全不懂技术的人)

1. 到本仓库右侧 **Releases** 下载 `DeepSeek Harness-Setup-*.exe`。
2. 双击安装。若 Windows 提示"未知发布者",点 **更多信息 → 仍要运行**(未购代码签名证书,属正常)。
3. 打开桌面图标,按引导粘贴你自己的 DeepSeek API 密钥,开始对话。

> 唯一需要你"自带"的,是一把 DeepSeek API 密钥 —— 就像第一次用微信要登录一样,这是 AI 服务的门票,与软件无关。

## 🌏 技术平权

**技术和知识,从来不是少数人的特权。**

命令行、环境变量、包管理器、Docker……这些名词挡住了多少想使用 AI 的人。我们的理想是**打破一切技术门槛**:一个不懂编程的人,也应该能拥有自己的 AI 助手。

这个项目把"部署一个 AI 编程助手"这件事,从开发者专属的工程,变成了所有人都能完成的"双击一下"。工具应当服务人,而不是筛选人。这就是我们做这个桌面的全部理由。

## 📦 从源码构建

```sh
pnpm install
pnpm desktop:pack   # 在 apps/desktop/dist/ 产出 Windows x64 安装包
```

桌面壳的架构与设计决策见 [`apps/desktop/README.md`](apps/desktop/README.md)。

## ⚖️ 声明

- 本项目基于 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness),遵循其 [MIT LICENSE](LICENSE)。
- 与 DeepSeek 公司无隶属关系,不提供任何官方支持。
- 仓库副本未包含上游的内部开发文档(`.agents/`)。
