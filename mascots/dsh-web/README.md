# 🐾 @aonochano/remi-pet-dsh — Remielle Chibi Pet for the DeepSeek Harness Web Page

**Q 版蕾米埃尔 · DeepSeek Harness 网页桌宠插件**

A drop-in **dual-face Cordis plugin** that renders the Spine chibi Remielle as a
floating, draggable pet on the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
Web GUI (`dsh web`). The node half serves the Spine assets over an HTTP route;
the browser half (a pre-built bundle) registers into the `shell.overlay` slot.

```
┌─────────────────────────── DeepSeek Harness Web page ───────────────────────────┐
│                                                                                  │
│   ┌───────────────────────────────┐            ┌───────────┐                     │
│   │ session list                  │  chat      │   🐾      │ ← drag / click      │
│   │ ...                           │  ...       │  (Spine)  │   bottom-right      │
│   └───────────────────────────────┘            └───────────┘                     │
│   [Settings] [🐾] ← sidebar.footer.action toggle                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

> [!WARNING]
> **Fan-made derivative assets.** Remielle and all related intellectual property
> belong to **HoYoverse / miHoYo**. This project is for **personal and
> educational use only** — see [`ASSET_LICENSE.md`](../../ASSET_LICENSE.md) at
> the repository root.

---

## Features

| Feature | Detail |
| :------ | :------ |
| Spine rendering | `@esotericsoftware/spine-webgl` **bundled inline** — no extra runtime deps |
| Animations | idle (`a`), cute reaction (`e`), user drawing (`d` → `d_win`), appreciation (`c`) after 12 idle loops |
| **State-linked** | Reads `ctx.sessions.list` **and** the current session's `ConversationSnapshot`: **thinks** (`b`) while reasoning/tool calls/jobs run, **writes** (`d` loop) while the assistant streams **formal text**, **pleads** (`e`, teary pleading) while waiting for approval / AskUser questions / plan review; when the whole conversation flow ends, the pet puts the brush down (`d_win`) and **appreciates the work** (`c`) — with a 50% chance it also **overlays the golden light** (`light`) on a separate animation track for a few seconds, never locking the character |
| Drag | Pointer-based, clamped to the viewport; **pixel-accurate click-through** — only pixels the character actually draws intercept clicks (a `gl.readPixels` alpha probe drops pointer-events over transparent areas, so the page underneath stays clickable) |
| Persistence | Position + hidden state in `localStorage` (`remi-pet.pos` / `remi-pet.hidden`) |
| Show/hide | `IconSparkle16` + current-state label 「宠物：显示/隐藏」 in the sidebar footer, aligned beside Settings (theme tokens) |
| **Plugin config card** | Settings → Plugins → 插件配置: a collapsible card like the shipped ones (header + in-place body, ⓘ tooltips on every control) — pet size (120–320px), celebration-light probability, agent-state link, position reset, show/hide; all applied immediately |
| Hide/show reliability | Engine is created/disposed with visibility — hiding disposes the WebGL context, showing rebuilds it (no page refresh needed) |
| No server changes | Assets served by the plugin's own node half via `/remi-pet/assets/*` |
| Graceful degradation | WebGL/asset failure shows a small message instead of breaking the page |

**Roadmap** (not in v1): eye tracking, swirl eyes, a settings page, i18n.

---

## How it works (the integration contract)

Third-party packages plug into the DSH **web profile** (`$DSH_HOME/profiles/web`)
in two steps: install the package into the profile, and add one loader row to
the profile's patch layer. No DSH source changes.

- **Package manifest**: `dsh.client: { platform: "web" }` + `exports["./client"]`
  → the built browser bundle. `@deepseek-ai/dsh-client-modules` scans loader
  entries for this declaration, serves the bundle at `/plugins/<id>/client.js`
  and injects it into the page boot graph (`window.__DSH_BOOT__`).
- **Bundle format**: a classic script calling
  `window.__ModuleLoader__.load({ id, factory })`; the factory receives a
  synchronous `require` that may resolve **only** the shell's seed words and
  shell-own modules (`react`, `@deepseek-ai/dsh-client-ui-primitives`,
  `@deepseek-ai/cordis`, …). Everything else — including the Spine runtime — is
  **inlined at build time** (see `build.mjs`, which keeps only `react` and
  `@deepseek-ai/dsh-client-ui-primitives` external).
- **UI seats**: `shell.overlay` — a frame-wide floating layer above every
  column; additive (list) registration, no replacement risk. The show/hide
  toggle sits in `sidebar.footer.action` beside Settings, and the
  plugin-configuration card sits in `settings.plugin.item` (Settings → Plugins
  → 插件配置). The card is self-contained and localStorage-backed — it does
  not use the host settings namespace, whose exposure is an upstream
  allowlist. `settings.plugin.item` is a **keyed** slot since dsh 0.1.0-rc.7;
  the registration probes keyed then list, so a protocol flip degrades to "no
  card" instead of failing. Every UI seat and the session feed are isolated
  with try/catch — the plugin never throws through `apply`, so a DSH update
  cannot take the page down.
- **State feed**: `ctx.sessions.list` (`ObservableSnapshot`) — the same
  `useSessions` standard feed the sidebar reads. The plugin derives the pet
  activity (idle / thinking / writing / waiting) from the current session's
  `running`, `pendingInteraction`, `jobsBySession` and the `ConversationSnapshot`
  (`partial.blocks` kinds, `runningCalls`, `pending`).
- **Assets**: the node half registers a `webServer` prefix route (`/remi-pet`)
  serving `assets/` from the package directory (exact > longest-prefix >
  fallback match order, so it never collides with `/plugins` or the SPA
  fallback).

---

## Quick start (for end users)

Prerequisites: Node.js ≥ 18, a running `dsh web` profile.

```bash
# 1. One-command install from npm (no need to clone the repository)
dsh plugin --profile web add @aonochano/remi-pet-dsh

# 2. Add one row to the profile patch layer
#    $DSH_HOME/profiles/web/cordis.patch.yml
```

```yaml
- insert:
    - id: remi-pet
      name: '@aonochano/remi-pet-dsh'
```

```bash
# 3. Restart dsh web — the pet appears bottom-right
```

**Notes**

- The install step runs `pnpm add <pkg>` inside the profile; the profile's
  `pnpm-workspace.yaml` uses a hoisted linker, so the package is linked into
  the profile's `node_modules`.
- Not published yet? Install from a local checkout instead:
  `dsh plugin --profile web add "<repo>\mascots\dsh-web"` (absolute path, since
  pnpm runs inside the profile directory). For offline distribution,
  `npm pack` in `mascots/dsh-web` produces an installable tarball.
- The bundle is built by the `prepare` script on install — `dist/` is not
  committed (repository `.gitignore` ignores `dist/`).

**Uninstall**

```bash
# remove the row from cordis.patch.yml, then:
dsh plugin --profile web remove @aonochano/remi-pet-dsh
```

---

## Development

```bash
cd mascots/dsh-web
npm install
npm run build   # rollup: src/client -> dist/client.js (wrapped loader script)
npm test        # behavior/activity/bundle/route suites
```

The profile install is a **symlink to this directory** (`pnpm add <path>`), so
**client-half** changes only need `npm run build` + a page refresh; **node-half**
changes (`lib/index.js`) need a `dsh web` restart.

```
mascots/dsh-web/
├── package.json          # dual-face manifest: dsh.client + exports["./client"]
├── build.mjs             # rollup + loader-script wrapper (+ Spine license)
├── assets/               # remi.json / leimi.atlas / leimi.png (served by node half)
├── lib/index.js          # node half: /remi-pet asset route (webServer prefix)
├── src/client/
│   ├── factory.js        # build entry: export default plugin
│   ├── plugin.js         # { inject: ['slots'], apply } — slots + sessions feed
│   ├── PetView.js        # overlay React view: drag, click/dblclick, canvas
│   ├── ToggleView.js     # sidebar.footer.action row (IconSparkle16 + 宠物)
│   ├── ConfigCard.js     # settings.plugin.item card (size/light/link/reset)
│   ├── spine.js          # SpineCanvas app lifecycle (drawSkeleton(…, false)!)
│   ├── behavior.js       # pure animation state machine incl. activity drive
│   ├── activityStore.js  # sessions.list -> activity derivation + notify
│   ├── settings.js       # reactive pet settings (size / light / activity)
│   ├── css.js            # refcounted style-tag injection
│   ├── persist.js        # localStorage position/visibility/settings
│   └── store.js          # hidden-state + position-reset store
└── test/                 # node --test suites
```

### Rendering gotchas (learned the hard way)

- The atlas has **no `pma` tag** → always `renderer.drawSkeleton(skeleton, false)`.
  Passing `true` produces bright edge artifacts on overlapping meshes.
- The canvas buffer is sized by `renderer.resize(ResizeMode.Expand)` from the
  CSS size × devicePixelRatio — the host size is configurable (120–320px) and
  the skeleton scale follows it (`petSize / BASE_SIZE`, base 420).
- The single-click / double-click race is resolved with a 260ms timer in
  `PetView`; the behavior machine itself is event-driven and framework-free.

### Configuration

No loader config in v1. User state lives in `localStorage` (edited from the
plugin-configuration card and the sidebar toggle):

| Key | Meaning |
| :-- | :------ |
| `remi-pet.pos` | `{"x":…,"y":…}` left/top CSS px after the last drag |
| `remi-pet.hidden` | `"1"`/`"0"` — pet visibility |
| `remi-pet.size` | Host CSS size in px (120–320) |
| `remi-pet.lightChance` | Golden-light overlay probability, 0–1 |
| `remi-pet.activityEnabled` | `"1"`/`"0"` — whether the pet animates with the agent state |

---

## License

- **Code**: MIT (see the repository root `LICENSE`).
- **Character & art**: property of miHoYo / HoYoverse — personal/educational
  use only (`ASSET_LICENSE.md`).
- **Spine runtime**: redistributed under the Spine Runtimes License Agreement
  (Esoteric Software); the notice is prepended to `dist/client.js` by
  `build.mjs`.
