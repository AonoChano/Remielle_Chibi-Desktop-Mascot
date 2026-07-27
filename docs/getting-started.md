# Getting Started - Electron Desktop Pet

This guide walks you through setting up and running the Remielle Chibi Desktop Mascot as an Electron application.

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x (or yarn / pnpm)
- A working internet connection for dependency installation

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/AonoChano/Remielle_Chibi-Desktop-Mascot.git
cd Remielle_Chibi-Desktop-Mascot
```

### 2. Install Dependencies

```bash
cd mascots/electron
npm install
```

### 3. Place Spine Assets

Copy the Spine animation assets into the `spine/remeille-chibi/` directory at the project root. You need:

- `remeille-chibi.json` — Skeleton data (export from Spine Editor as JSON)
- `remeille-chibi.atlas` — Texture atlas (already included)
- `remeille-chibi.png` — Texture image (included as `leimi.png` — rename to `remeille-chibi.png`)

The project expects the following directory structure:

```
spine/
  remeille-chibi/
    remeille-chibi.json
    remeille-chibi.atlas
    remeille-chibi.png
```

> **Note:** The `remeille-chibi.json` file is too large for direct Git hosting. Please obtain it from the original `.spine` binary project file using Spine Editor's JSON export feature.

### 4. Run the Mascot

```bash
npm start
```

A transparent pet window will appear on your screen with Remielle in her chibi form. You can:

- **Drag** the pet by clicking and holding on the window.
- **Right-click** to open the Control Panel.
- Use the Control Panel to switch animations and outfits.

## Build for Distribution

### Windows

```bash
npm run build:win
```

Produces NSIS installer and portable executable.

### macOS

```bash
npm run build:mac
```

Produces a DMG file.

### Linux

```bash
npm run build:linux
```

Produces an AppImage.

## How It Works

| Component | Description |
|-----------|-------------|
| `main.js` | Electron main process — creates the transparent pet window, system tray, and IPC handlers |
| `preload.js` | Secure bridge between main and renderer processes via `contextBridge` |
| `pet.html` | Transparent renderer page with a `<canvas>` for Spine rendering |
| `pet.js` | Spine animation engine — loads skeleton, manages animation state, handles drag |
| `panel.html` | Control panel UI for animation/outfit switching |
| `panel.css` | Control panel styling |
| `panel.js` | Control panel logic — sends IPC commands to main process |

## Animations Available

| Track | Name | Description |
|-------|------|-------------|
| 0 | `a` | Default idle |
| 0 | `a_win` | Victory animation (Outfit A) |
| 0 | `b` | Talking / shy expression |
| 0 | `c` | Light idle |
| 0 | `d` | Nervous expression |
| 0 | `d_win` | Victory animation (Outfit D) |
| 0 | `e` | Expression E |
| 0 | `light` | Light effect animation |

## Outfits Available

| Prefix | Description |
|--------|-------------|
| `A` | Default outfit |
| `B` | Outfit variant B |
| `C` | Outfit variant C |
| `D` | Outfit variant D |
| `E` | Outfit variant E |

## Troubleshooting

**Q: The pet window is blank/white.**
A: Ensure the Spine assets are correctly placed in `spine/remeille-chibi/`. Check the browser console (DevTools) for loading errors.

**Q: Drag doesn't work.**
A: Click on the pet character itself, not the transparent border area. On some Linux window managers, you may need to enable click-through settings.

**Q: Build fails on macOS with "code signing" errors.**
A: For development builds, add `--config.mac.identity=null` to skip code signing, or set up an Apple Developer certificate.

## Next Steps

- Explore the [Spine Animation Guide](../spine-animation-guide.md) for detailed asset information.
- Check out other mascot implementations in the `mascots/` directory.
