# Spine WebGL Alpha Rendering Pitfalls

## Problem Summary

When rendering Spine animations with `spine-webgl`, incorrect `premultipliedAlpha` settings cause visible edge artifacts — bright halos, color fringing, or "inverted color" outlines around mesh boundaries where multiple attachments overlap.

## Root Cause

`spine-webgl` uses a different blend function depending on whether `premultipliedAlpha` is enabled:

| Mode | `srcColor` | `dstColor` | When to use |
|------|-----------|-----------|-------------|
| **Normal** (non-PMA) | `gl.SRC_ALPHA` | `gl.ONE_MINUS_SRC_ALPHA` | Atlas has **no** `pma` tag |
| **PMA** (premultiplied) | `gl.ONE` | `gl.ONE_MINUS_SRC_ALPHA` | Atlas **has** `pma` tag |

The `spine-webgl` runtime decides this via the **second argument** of `drawSkeleton()`:

```js
// Signature: drawSkeleton(skeleton, premultipliedAlpha = false, ...)
renderer.drawSkeleton(this.skeleton, false); // Normal blending ✓
renderer.drawSkeleton(this.skeleton, true);  // PMA blending
```

Most custom Spine projects (including this chibi Remielle) **do NOT use PMA textures**, so passing `true` causes the RGB values to be blended at full intensity regardless of alpha, producing the bright/ghostly edge artifacts.

## How to Check Your Atlas

Open the `.atlas` file and look for the `pma` tag near the top:

```
leimi.png
size:2048,2048
filter:Linear,Linear
# If you see "pma: true" here, use drawSkeleton(..., true)
# If there is NO pma tag, use drawSkeleton(..., false)
```

If there is **no `pma` tag** (the common case), always pass `false`.

## Fixing Existing Code

### In `pet.js` / `capture.html` / any renderer

```js
// BEFORE (wrong — causes edge artifacts)
renderer.drawSkeleton(this.skeleton, true);

// AFTER (correct — clean edges)
renderer.drawSkeleton(this.skeleton, false);
```

### Transparent Background for Screenshots

If you are capturing frames to build a GIF/PNG sequence, **do NOT use chroma keying** (colorkey with magenta). Instead, configure transparency at every layer:

1. **Electron window**: `transparent: true, backgroundColor: '#00000000'`
2. **HTML body**: `background: #00000000;`
3. **SpineCanvas**: `backgroundColor: new spine.Color(0, 0, 0, 0)`
4. **WebGL context** (optional): `webglConfig: { alpha: true, premultipliedAlpha: false }`

Then `capturePage()` will produce PNGs with native alpha channels — no post-processing needed.

## Reference: Official Custom Implementation

The official website (`temp_ref/index_*.js`) uses Three.js with:

- `WebGL1Renderer({ alpha: false, premultipliedAlpha: false })`
- Custom `ShaderMaterial` with `transparent: true, blending: 1` (Three.js `NormalBlending`)
- Fragment shader multiplies texture by vertex color: `gl_FragColor *= vColor`

This is equivalent to `drawSkeleton(..., false)` in `spine-webgl`.

## Related Files in This Repo

| File | Purpose |
|------|---------|
| `mascots/electron/pet.js` | Live desktop pet renderer |
| `mascots/electron/capture.html` | Frame capture for GIF export |
| `spine/remeille-chibi/leimi.atlas` | Texture atlas (no pma tag) |
