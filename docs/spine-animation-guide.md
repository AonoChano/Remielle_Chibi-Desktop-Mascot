# Spine Animation Asset Guide

This document provides detailed information about the Remielle Chibi Spine animation assets used in this project.

## Overview / 概述

The Spine project contains a high-quality chibi (Q-version) character model of **Remielle (蕾米埃尔)** from *Zenless Zone Zero (绝区零)*, featuring rich animations, multiple outfits, and advanced physics simulations.

本项目包含《绝区零》角色 **蕾米埃尔 (Remielle Dan)** 的 Q 版 Spine 动画资产，具备丰富的动画、多套换装和高级物理模拟。

## Asset Specifications / 资产规格

| Property | Value |
|----------|-------|
| Skeleton Bones | 257 |
| Physics Constraints | 80 |
| Total Animations | 9 |
| Outfit Skins | 5 (A through E) |
| Texture Atlas Size | 2048 x 790 px |
| Atlas Scale | 0.2 |
| Spine Version | 4.2 |

## Animations / 动画列表

| Animation Name | Duration | Loop | Description |
|----------------|----------|------|-------------|
| `a` | — | Yes | Default idle — standard breathing and subtle movement |
| `a_win` | — | Yes | Victory pose (Outfit A variant) |
| `b` | — | Yes | Talking / shy expression — mouth movement, blushing |
| `c` | — | Yes | Light idle — gentle swaying |
| `d` | — | Yes | Nervous expression — sweat drops, trembling |
| `d_win` | — | Yes | Victory pose (Outfit D variant) |
| `e` | — | Yes | Expression E — special reaction animation |
| `light` | — | Yes | Light effect — lumiflux attribute glow |
| *(head tracking)* | — | — | Pseudo-3D head follow (constraint-driven) |

## Outfits / 换装列表

Each outfit uses a prefix-based attachment system. Switch outfits by changing the attachment prefix on each slot.

| Prefix | Character / 特点 |
|--------|-----------------|
| `A` | Default outfit — angelic wings (left/right), standard hair accessories, earrings, book |
| `B` | Variant B — different hair style, different expression, earrings, book |
| `C` | Variant C — closed eyes style, wings (A/B), unique hair ribbon |
| `D` | Variant D — extended left hand pose, sweat drops, nervous eyebrows, detailed arm |
| `E` | Variant E — symmetrical wings, four-part eye highlights, detailed arms |

### Attachment Regions per Outfit

Each outfit typically includes:
- **Hair** (front, back, side, ribbon): `X_发_a`, `X_发_b`, ..., `X_发带_a`
- **Face**: `X_脸_a`, `X_脸红_a`, `X_脸红_b`
- **Eyes**: `X_眼框_a`, `X_眼珠_a`, `X_眼白_a`, `X_眼眉毛_a`, `X_眼高光_a`
- **Mouth**: `X_嘴_a`
- **Hands**: `X_手_L`, `X_手_R`
- **Arms**: `X_手臂_l`, `X_手臂_r`
- **Accessories**: `X_耳环_a`, `X_发饰_a`, `X_翅膀_l`, `X_翅膀_r`
- **Body**: `X_身体_a`
- **Book**: `X_书_a`
- **Special**: `X_汗_a` (sweat, outfit D only)

Shared parts (no prefix): `脚_L`, `脚_R`, `腿`, `腿a`, `闭眼R`, `闭限L`, `飘带a`, `飘带b`, `light_b`, `c_身体_a`, `aaat`

## Texture Atlas / 贴图图集

The texture atlas (`remeille-chibi.atlas`) references a single texture image:

- **Image**: `leimi.png` (2048 x 790 pixels)
- **Format**: PNG with RGBA channels
- **Filtering**: Linear / Linear
- **Page Count**: 1

All attachment regions are packed into this single atlas page using Spine's atlas packer.

## Physics System / 物理系统

The project includes **80 physics constraints** that drive:

- **Hair physics**: Natural hair movement during idle and animation transitions
- **Ribbon dynamics**: Flowing ribbon attachments (`飘带a`, `飘带b`) that react to movement
- **Wing dynamics**: Subtle wing fluttering and response to gravity
- **Cloth simulation**: Skirt and clothing fabric movement

## Pseudo-3D Head Tracking / 伪 3D 头部跟随

The skeleton includes constraint-based head tracking that simulates a pseudo-3D effect:
- The head subtly rotates based on configurable target positions
- This can be driven by mouse position, cursor input, or programmatic control
- Useful for creating an interactive "looking at cursor" effect

## Integration Guide / 接入指南

### For Electron / Web (spine-webgl)

```javascript
// Load the skeleton
var atlas = assetManager.require("spine/remeille-chibi/remeille-chibi.atlas");
var atlasLoader = new spine.AtlasAttachmentLoader(atlas);
var skeletonJson = new spine.SkeletonJson(atlasLoader);
skeletonJson.scale = 1;
var skeletonData = skeletonJson.readSkeletonData(
  assetManager.require("spine/remeille-chibi/remeille-chibi.json")
);
var skeleton = new spine.Skeleton(skeletonData);

// Play idle animation
var stateData = new spine.AnimationStateData(skeletonData);
var state = new spine.AnimationState(stateData);
state.setAnimation(0, "a", true); // looping idle
```

### Switching Outfits

```javascript
function applyOutfit(skeleton, prefix) {
  var slots = skeleton.slots;
  var skin = skeleton.data.defaultSkin;
  if (!skin) return;
  for (var i = 0; i < slots.length; i++) {
    var data = slots[i].data;
    var attachments = skin.attachments[data.index];
    if (!attachments) continue;
    var names = Object.keys(attachments);
    var target = names.find(n => n.startsWith(prefix + '_'));
    if (target) {
      skeleton.setAttachment(data.name, target);
    }
  }
  skeleton.updateWorldTransform(spine.Physics.update);
}

// Switch to Outfit B
applyOutfit(skeleton, 'B');
```

### For Unity (spine-unity)

1. Import the `spine-unity` runtime package from EsotericSoftware.
2. Place `remeille-chibi.json`, `remeille-chibi.atlas`, and `remeille-chibi.png` in your `Assets/` folder.
3. Use Spine's Unity import wizard to generate the skeleton data asset.
4. Attach `SkeletonAnimation` component to a GameObject.
5. Select animations and skins from the Inspector.

### For Bongo Cat Integration

The Bongo Cat framework expects a specific JSON structure. The outfit prefix system (`A_`, `B_`, etc.) maps naturally to Bongo Cat's "set" concept:

- Each outfit prefix can be registered as a Bongo Cat set
- Animation states map to Bongo Cat's trigger system
- Physics constraints are automatically handled by the Spine runtime

## File Size Notes / 文件大小说明

| File | Size | Notes |
|------|------|-------|
| `remeille-chibi.json` | ~488 KB | Too large for direct Git hosting — obtain from `.spine` binary |
| `remeille-chibi.atlas` | ~11 KB | Included in repository |
| `remeille-chibi.png` | varies | Texture image — requires manual upload |
| `.spine` binary | varies | Original Spine project file (not included) |

## License

These character assets are derived from miHoYo's *Zenless Zone Zero*. Please respect the original intellectual property rights. This project is intended for personal and educational use.
