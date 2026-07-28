# Agent Initialization — Remielle Chibi Desktop Mascot

## Project Overview

This is a **character digital asset pack + multi-platform desktop mascot framework** for Remielle Dan, an S-Rank agent from Zenless Zone Zero.

- **Core asset**: Spine 2D chibi animation (`spine/remeille-chibi/`)
- **Working implementation**: Electron desktop pet (`mascots/electron/`)
- **Planned platforms**: Bongo Cat, Codex CLI, Claude Code, Web, Wallpaper Engine, Unity

## Directory Structure

```
Remielle_Chibi-Desktop-Mascot/
├── AGENTS.md                    ← You are here
├── README.md
├── ASSET_LICENSE.md
├── LICENSE
│
├── docs/
│   ├── getting-started.md       ← Electron setup guide
│   └── spine-animation-guide.md ← Spine asset docs
│
├── spine/
│   └── remeille-chibi/
│       ├── remeille-chibi.atlas
│       ├── remeille-chibi.json  ← Export from .spine (not in repo, ~488KB)
│       └── remeille-chibi.png
│
├── assets/
│   ├── remi_drawing.gif         ← README demo animation
│   ├── BannerLogo.png
│   └── leimi.png
│
└── mascots/
    ├── electron/                ← ✅ Working desktop pet
    ├── bongo-cat/               ← 📋 Planned
    ├── codex-cli-pet/           ← 📋 Planned
    ├── claude-code-pet/         ← 📋 Planned
    ├── web/                     ← 📋 Planned
    ├── wallpaper-engine/        ← 📋 Planned
    └── unity/                   ← 📋 Planned
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | `@esotericsoftware/spine-webgl` | ~4.2.0 |
| Desktop | Electron | ^43.2.0 |
| Build | electron-builder | (packaging) |
| Spine Editor | Esoteric Spine | 4.2.x |

## Known Pitfalls

- **Spine WebGL alpha rendering**: See `.harness/pitfalls/spine-webgl-alpha-rendering.md`
  - The atlas does NOT have `pma` tag → always use `drawSkeleton(skeleton, false)`
  - Using `true` causes bright edge artifacts on overlapping meshes

- **UI literalism trap**: See `.harness/pitfalls/ui-literalism.md`
  - Do not convert user's illustrative descriptions into overstated visual designs
  - Default to subtle, market-standard affordances; whitespace is not a bug

## Development Commands

```bash
cd mascots/electron
npm install
npm start              # Launch desktop pet
```

## Assets Note

`spine/remeille-chibi/remeille-chibi.json` is **not tracked in Git** (~488KB). Export it from the original `.spine` project using Spine Editor's JSON export. The atlas and PNG are tracked.

## License

- Code: MIT
- Character art & design: Property of miHoYo / HoYoverse (personal/educational use only)
