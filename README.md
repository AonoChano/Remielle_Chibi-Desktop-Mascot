# Remielle Chibi Desktop Mascot

**Character Asset Pack & Multi-Platform Desktop Mascot Framework**

> Q版蕾米埃尔桌宠 — 角色资产包 & 多平台桌宠框架

A high-quality chibi (Q-version) Spine animation asset pack of **Remielle (蕾米埃尔)** from miHoYo's *Zenless Zone Zero (绝区零)*, bundled with a ready-to-use multi-platform desktop mascot framework.

本项目包含米哈游《绝区零》角色 **蕾米埃尔 (Remielle Dan)** 的高质量 Q 版 Spine 动画资产，附带可开箱即用的多平台桌宠框架。

---

## About Remielle / 关于蕾米埃尔

Remielle Dan is an S-Rank Agent introduced in Zenless Zone Zero Version 3.1. As a founding member of the first-generation **Void Hunters (虚狩)**, she wields the **Lumiflux (光)** attribute with angelic wings and a gentle yet determined personality.

蕾米埃尔是《绝区零》3.1 版本的限定 S 级代理人，初代 **虚狩 (Void Hunter)** 核心成员，拥有 **光 (Lumiflux)** 属性和天使般的翅膀。

| Property | Detail |
|----------|--------|
| Agent Name | Remielle Dan (蕾米埃尔·丹) |
| Rank | S-Rank (限定) |
| Faction | Void Hunters (虚狩) |
| Attribute | Lumiflux (光) |
| Version | 3.1 |

---

## Features / 功能特性

- **9 Spine Animations** — Idle, victory, talking, shy, nervous, light effects, and more / 9 种 Spine 动画：待机、胜利、说话、害羞、紧张、光效等
- **5 Outfit Skins** — Switchable chibi outfits (A through E) / 5 套可切换 Q 版换装
- **257 Bones & 80 Physics Constraints** — Rich skeletal structure with hair, ribbon, wing, and cloth physics / 257 骨骼 + 80 物理约束，含头发、飘带、翅膀、布料物理
- **Pseudo-3D Head Tracking** — Constraint-driven interactive head follow / 伪 3D 头部跟随
- **Electron Desktop Pet** — Transparent always-on-top window with drag support / Electron 桌宠：透明置顶窗口，支持拖拽
- **Control Panel** — Real-time animation and outfit switching / 实时控制面板
- **Multi-Platform Build** — Windows (NSIS), macOS (DMG), Linux (AppImage) / 多平台打包
- **Extensible Framework** — Bongo Cat, Web Component, Wallpaper Engine, Unity, and AI pet hooks planned / 可扩展框架

---

## Directory Structure / 目录结构

```
Remielle_Chibi-Desktop-Mascot/
├── .gitignore
├── README.md                          # This file / 本文件
├── LICENSE
├── docs/
│   ├── getting-started.md             # Electron quick start guide / Electron 快速开始
│   └── spine-animation-guide.md       # Spine asset documentation / Spine 资产说明
├── spine/
│   └── remeille-chibi/
│       ├── remeille-chibi.atlas       # Texture atlas / 贴图图集
│       ├── remeille-chibi.json        # Skeleton JSON (see note below)
│       └── remeille-chibi.png        # Texture image (to be added)
└── mascots/
    ├── electron/                      # Electron desktop pet / Electron 桌宠
    │   ├── package.json
    │   ├── main.js                    # Electron main process
    │   ├── preload.js                 # Context bridge
    │   ├── pet.html                   # Transparent pet renderer
    │   ├── pet.js                     # Spine animation engine
    │   ├── panel.html                 # Control panel UI
    │   ├── panel.css                  # Control panel styles
    │   └── panel.js                   # Control panel logic
    ├── bongo-cat/                     # Bongo Cat integration (planned)
    │   └── README.md
    ├── codex-cli-pet/                 # Codex CLI pet hook (planned)
    │   └── README.md
    ├── claude-code-pet/               # Claude Code pet hook (planned)
    │   └── README.md
    ├── web/                           # Web component (planned)
    │   └── README.md
    ├── wallpaper-engine/              # Wallpaper Engine (planned)
    │   └── README.md
    └── unity/                         # Unity runtime (planned)
        └── README.md
```

---

## Quick Start (Electron) / 快速开始

### Prerequisites / 前置要求

- Node.js >= 18.x
- npm >= 9.x

### Setup / 安装

```bash
# Clone the repository / 克隆仓库
git clone https://github.com/AonoChano/Remielle_Chibi-Desktop-Mascot.git
cd Remielle_Chibi-Desktop-Mascot

# Install Electron dependencies / 安装 Electron 依赖
cd mascots/electron
npm install
```

### Place Spine Assets / 放置 Spine 资产

Copy the skeleton JSON and texture image into `spine/remeille-chibi/`:

- `remeille-chibi.json` — Export from the original `.spine` project via Spine Editor
- `remeille-chibi.png` — The texture image (rename from `leimi.png` if needed)

> **Note:** The `remeille-chibi.json` file (~488 KB) is too large for direct Git hosting. Please export it from the original `.spine` binary project file using Spine Editor's JSON export.
>
> **注意：** `remeille-chibi.json` 文件 (~488 KB) 因体积限制未直接托管于 Git，请从原始 `.spine` 项目文件通过 Spine Editor 导出。

### Run / 运行

```bash
npm start
```

The pet window will appear on your desktop. Right-click to open the Control Panel.

桌宠窗口将出现在桌面。右键点击可打开控制面板。

See [Getting Started Guide](docs/getting-started.md) for detailed instructions. / 详见 [快速开始指南](docs/getting-started.md)。

---

## Spine Asset Integration / Spine 资产接入

The Spine assets in `spine/remeille-chibi/` can be used with any Spine 4.2 compatible runtime:

`spine/remeille-chibi/` 中的 Spine 资产可用于任何 Spine 4.2 兼容的运行时：

| Runtime | File | Description |
|---------|------|-------------|
| spine-webgl | `pet.js` | WebGL renderer for Electron / Web |
| spine-unity | — | Unity SkeletonAnimation component |
| spine-csharp | — | Generic C# runtime |
| spine-ts | — | TypeScript/JavaScript runtime |

See the [Spine Animation Guide](docs/spine-animation-guide.md) for detailed integration instructions. / 详见 [Spine 动画资产说明](docs/spine-animation-guide.md)。

---

## Building for Distribution / 打包分发

```bash
cd mascots/electron

# Windows (NSIS installer + portable)
npm run build:win

# macOS (DMG)
npm run build:mac

# Linux (AppImage)
npm run build:linux
```

---

## Planned Integrations / 计划中的集成

| Platform | Directory | Status |
|----------|-----------|--------|
| Electron Desktop Pet | `mascots/electron/` | Working / 可用 |
| Bongo Cat | `mascots/bongo-cat/` | Planned |
| Codex CLI Pet Hook | `mascots/codex-cli-pet/` | Planned |
| Claude Code Pet Hook | `mascots/claude-code-pet/` | Planned |
| Web Component | `mascots/web/` | Planned |
| Wallpaper Engine | `mascots/wallpaper-engine/` | Planned |
| Unity Runtime | `mascots/unity/` | Planned |

Contributions to any of these integrations are welcome! / 欢迎贡献任何平台的实现！

---

## License / 许可证

This project is licensed under the **MIT License**.

Character design and original art are property of miHoYo / HoYoverse. These assets are intended for **personal and educational use only**. Please respect the original intellectual property rights.

本项目采用 **MIT 许可证**。角色设计和原始美术素材归米哈游 / HoYoverse 所有，仅供**个人和教育用途**。请尊重原始知识产权。

---

## Acknowledgments / 致谢

- **miHoYo / HoYoverse** — Original character design and Zenless Zone Zero / 原始角色设计与《绝区零》
- **EsotericSoftware** — Spine 2D Animation Runtime / Spine 2D 动画运行时
- **Electron** — Cross-platform desktop application framework / 跨平台桌面应用框架
- **Bongo Cat** — Desktop pet framework inspiration / 桌宠框架灵感来源
