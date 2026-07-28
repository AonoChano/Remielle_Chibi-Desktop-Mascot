# Electron 桌宠优化 — 点击穿透、尺寸控制、面板重构

**日期**: 2026-07-28
**状态**: 已对齐，待实现

## 概述

本轮开发周期对 Electron 桌宠进行三项优化：
1. 透明区域点击穿透（骨骼包围盒方案）
2. 角色尺寸控制（下拉菜单多档预设）
3. 控制面板重构为模板项目架构（测试模式开关 + 换装 toggle）

## 需求 A — 透明区域点击穿透

### 现状

`main.js` 中 `petWindow.setIgnoreMouseEvents(false)` 使整个 420×420 窗口可点击，包括透明区域。用户无法点击透明区域背后的桌面内容。

### 方案

使用 Spine `skeleton.getBounds()` 获取角色骨骼包围盒矩形。鼠标在包围盒内时窗口可交互，在外时调用 `setIgnoreMouseEvents(true, { forward: true })` 穿透。

### 实现细节

**pet.js 变更：**

1. 在 `render()` 中渲染完成后，调用 `skeleton.getBounds()` 获取包围盒坐标 `(x, y, width, height)`。Spine-webgl 的 `getBounds` 返回的是 skeleton 局部坐标系下的值，需要转换为窗口坐标。

2. 在 `setupDrag()` 中添加 `mousemove` 事件处理（节流到 ~60fps）：
   - 计算鼠标相对于 canvas 的坐标
   - 判断是否在包围盒矩形内
   - 在内：`electronAPI.send('set-mouse-events', false)` （可交互）
   - 在外：`electronAPI.send('set-mouse-events', true)` （穿透）

3. 使用 `setIgnoreMouseEvents(true, { forward: true })` 的 `forward: true` 确保鼠标事件仍被转发，这样鼠标移回角色区域时能检测到并恢复可交互。

**main.js 变更：**

新增 IPC 通道 `set-mouse-events`：
```javascript
ipcMain.on('set-mouse-events', (event, ignore) => {
  if (petWindow) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});
```

**preload.js 变更：**

`set-mouse-events` 加入 `validSendChannels` 白名单。

### 边界情况

- 动画切换时包围盒会变化，每帧 render 后更新包围盒缓存即可
- 窗口尺寸变化时包围盒需重新计算（SpineCanvas 的 `renderer.resize(Expand)` 已处理 canvas 适配）
- `getBounds` 在 spine-webgl 中可能需要传入临时数组：`let bounds = new spine.Vector3_like()` 或使用 `skeleton.getBounds(offset, size)` API（需确认 4.2 API 签名）

## 需求 B — 角色尺寸控制

### 现状

`main.js` 中 pet 窗口 `width/height = 420` 写死，`resizable: false`。`pet.js` 中 `skeletonJson.scale = 1` 写死。设置 tab 的"渲染缩放"为纯文本占位。

### 方案

在设置 tab 中将"渲染缩放"占位替换为 `<select>` 下拉菜单，提供 5 档预设尺寸。切换时同步调整窗口尺寸和 Spine 渲染缩放。

### 尺寸档位

| 档位 | 窗口尺寸 (px) | skeletonJson.scale |
|------|---------------|-------------------|
| 小   | 240           | 0.57              |
| 中   | 320           | 0.76              |
| 默认 | 420           | 1.0               |
| 大   | 560           | 1.33              |
| 特大 | 640           | 1.52 |

scale 计算：`targetSize / 420`（以默认 420px 为基准）。

### 实现细节

**panel.html 变更：**

设置 tab 中将"渲染缩放"的 `.setting-row` 替换为带 `<select>` 的版本：
```html
<div class="setting-row">
  <label>角色尺寸</label>
  <select id="size-select">
    <option value="240">小 — 240px</option>
    <option value="320">中 — 320px</option>
    <option value="420" selected>默认 — 420px</option>
    <option value="560">大 — 560px</option>
    <option value="640">特大 — 640px</option>
  </select>
</div>
```

**panel.js 变更：**

监听 `#size-select` 的 `change` 事件，发送 `set-size` IPC 通道，参数为窗口尺寸数值。

**main.js 变更：**

新增 IPC 通道 `set-size`：
```javascript
ipcMain.on('set-size', (event, size) => {
  if (petWindow) {
    const [x, y] = petWindow.getPosition();
    // 以窗口中心为锚点调整尺寸，保持角色位置不变
    const centerX = x + petWindow.getBounds().width / 2;
    const centerY = y + petWindow.getBounds().height / 2;
    petWindow.setSize(size, size);
    petWindow.setPosition(
      Math.round(centerX - size / 2),
      Math.round(centerY - size / 2)
    );
    petWindow.webContents.send('apply-scale', size / 420);
  }
});
```

**pet.js 变更：**

监听 `apply-scale` 通道，将 `skeletonJson.scale` 或 `skeleton.scaleX/Y` 设为新值。由于 `skeletonJson.scale` 在初始化时使用，运行时调整应使用 `skeleton.scaleX` 和 `skeleton.scaleY`：
```javascript
window.electronAPI.on('apply-scale', (scale) => {
  if (this.skeleton) {
    this.skeleton.scaleX = scale;
    this.skeleton.scaleY = scale;
  }
});
```

**preload.js 变更：**

`set-size` 加入 `validSendChannels`，`apply-scale` 加入 `validReceiveChannels`。

## 需求 C — 控制面板重构

### 现状

`panel.html` 的 `#tab-expressions` 包含动画播放按钮（8个）和换装按钮（5个），全部直接展示。`#tab-settings` 为纯文本占位。无测试模式概念。

### 目标

将当前面板重构为面向模板项目的结构：
- 引入"测试模式"全局开关（普通 checkbox，非视觉强调）
- 测试模式 OFF：内容区留白（未来新功能加在复选框上方）
- 测试模式 ON：测试控件展开（动画按钮 + 换装 toggle），正式功能灰度禁用
- 换装按钮改为 toggle 锁定态（点击选中，再次点击取消，同时只有一个锁定）
- 为未来"动画连续排布"和"动画触发接口"预留空间

### 实现细节

**panel.html 变更：**

`#tab-expressions`（重命名为 `#tab-main`）内容区结构：
```html
<section id="tab-main" class="tab active">
  <!-- 未来正式功能加在这里（复选框上方） -->
  <!-- 当前为空，留白 -->

  <!-- 测试模式开关 — 普通设置项，无特殊装饰 -->
  <div class="setting-row">
    <label>
      <input type="checkbox" id="test-mode-toggle">
      进行动画控制测试
    </label>
  </div>

  <!-- 测试控件 — 默认隐藏，勾选后展开 -->
  <div id="test-controls" style="display:none;">
    <h2>动画播放</h2>
    <div class="button-grid">
      <!-- 8 个动画按钮 -->
    </div>
    <h2>换装</h2>
    <div class="button-grid">
      <!-- 5 个换装 toggle 按钮 -->
    </div>
  </div>
</section>
```

侧边栏 nav-item 文案从"表情测试"改为"主面板"。

**panel.js 变更：**

1. 测试模式开关：
```javascript
const testToggle = document.getElementById('test-mode-toggle');
const testControls = document.getElementById('test-controls');
testToggle.addEventListener('change', () => {
  testControls.style.display = testToggle.checked ? 'block' : 'none';
  // 正式功能区域灰度（通过 CSS class 控制）
  document.body.classList.toggle('test-mode-active', testToggle.checked);
});
```

2. 换装 toggle：
```javascript
document.querySelectorAll('.btn-outfit').forEach(btn => {
  btn.addEventListener('click', () => {
    const outfit = btn.dataset.outfit;
    const wasLocked = btn.classList.contains('locked');

    // 取消所有锁定
    document.querySelectorAll('.btn-outfit').forEach(b => b.classList.remove('locked'));

    if (!wasLocked) {
      // 锁定当前
      btn.classList.add('locked');
      window.electronAPI.send('set-outfit', outfit);
    } else {
      // 取消锁定，恢复默认
      window.electronAPI.send('set-outfit', 'A'); // 或发送 'reset'
    }
  });
});
```

3. 动画按钮保持原有逻辑，但当前播放的按钮高亮（添加 `.active` class）。

**panel.css 变更：**

换装 toggle 锁定态样式（克制、不张扬）：
```css
.btn-outfit.locked {
  background: #8e44ad;
  opacity: 1;
}
.btn-outfit:not(.locked) {
  opacity: 0.6;
}
```

测试模式激活时正式功能灰度：
```css
body.test-mode-active .formal-feature {
  opacity: 0.4;
  pointer-events: none;
}
```

**全局状态预留：**

在 `panel.js` 顶部定义全局状态对象，为未来扩展预留：
```javascript
const AppState = {
  testMode: false,
  currentAnimation: 'a',
  lockedOutfit: null,
  // 预留
  animationQueue: [],      // 未来动画连续排布
  triggerHandlers: {},     // 未来动画触发接口
};
```

### IPC 通道汇总

| 通道 | 方向 | 新增/修改 | 用途 |
|------|------|-----------|------|
| `set-mouse-events` | pet→main | 新增 | 动态切换点击穿透 |
| `set-size` | panel→main | 新增 | 设置窗口尺寸 |
| `apply-scale` | main→pet | 新增 | 应用渲染缩放 |
| `play-animation` | panel→main→pet | 修改 | 保持，增加高亮反馈 |
| `set-outfit` | panel→main→pet | 修改 | 保持，改为 toggle 语义 |
| `set-expression` | panel→main→pet | 不变 | 保持预留 |

## 涉及文件

| 文件 | 变更类型 |
|------|----------|
| `mascots/electron/main.js` | 修改：新增 2 个 IPC 通道 |
| `mascots/electron/pet.js` | 修改：包围盒穿透 + 缩放 + IPC 监听 |
| `mascots/electron/preload.js` | 修改：白名单新增通道 |
| `mascots/electron/panel.html` | 修改：面板结构重构 |
| `mascots/electron/panel.css` | 修改：toggle 样式 + 灰度样式 |
| `mascots/electron/panel.js` | 修改：测试模式 + 换装 toggle + 状态对象 |

## 不涉及

- 不修改 Spine 资产文件
- 不修改 capture 相关脚本
- 不修改 README.md（下轮再更新文档）
- 不新增依赖包
