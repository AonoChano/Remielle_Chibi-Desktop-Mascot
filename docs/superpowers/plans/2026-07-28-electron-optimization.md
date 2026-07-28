# Electron 桌宠优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现透明区域点击穿透、角色尺寸下拉菜单控制、控制面板重构为模板项目架构（测试模式开关 + 换装 toggle）

**Architecture:** 三项独立优化，按依赖顺序实施：先加 IPC 通道（preload + main），再改 pet.js 渲染逻辑（穿透 + 缩放），最后重构面板 UI（HTML + CSS + JS）。所有变更在 6 个文件内完成，不新增依赖。

**Tech Stack:** Electron 43, spine-webgl 4.2, vanilla HTML/CSS/JS

**Spec:** `docs/superpowers/specs/2026-07-28-electron-optimization-design.md`

---

## File Structure

| File | Responsibility | Changes |
|------|---------------|---------|
| `mascots/electron/preload.js` | IPC 通道白名单 | 新增 3 个通道 |
| `mascots/electron/main.js` | 主进程 IPC 路由 + 窗口管理 | 新增 2 个 IPC handler |
| `mascots/electron/pet.js` | Spine 渲染 + 拖拽 + 穿透检测 + 缩放 | 包围盒检测 + 缩放监听 |
| `mascots/electron/panel.html` | 面板结构 | 重构 tab 结构 + 尺寸下拉 |
| `mascots/electron/panel.css` | 面板样式 | toggle 样式 + 灰度 + select 样式 |
| `mascots/electron/panel.js` | 面板逻辑 | 测试模式 + 换装 toggle + AppState + 尺寸 |

---

### Task 1: preload.js — 新增 IPC 通道白名单

**Files:**
- Modify: `mascots/electron/preload.js`

- [ ] **Step 1: 读取当前 preload.js 内容**

Run: `cat mascots/electron/preload.js`

确认当前白名单：
- `validSendChannels`: `['drag-pet', 'open-panel', 'play-animation', 'set-outfit', 'set-expression']`
- `validReceiveChannels`: `['play-animation', 'set-outfit', 'set-expression']`

- [ ] **Step 2: 添加新通道到白名单**

将 `preload.js` 完整替换为：

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    const validSendChannels = [
      'drag-pet',
      'open-panel',
      'play-animation',
      'set-outfit',
      'set-expression',
      'set-mouse-events',
      'set-size'
    ];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel, callback) => {
    const validReceiveChannels = [
      'play-animation',
      'set-outfit',
      'set-expression',
      'apply-scale'
    ];
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  }
});
```

新增：`set-mouse-events` 和 `set-size` 加入 send 白名单；`apply-scale` 加入 receive 白名单。

- [ ] **Step 3: 验证语法正确**

Run: `node -c mascots/electron/preload.js`
Expected: 无输出（语法正确）

- [ ] **Step 4: Commit**

```bash
cd /workspace/Remielle_Chibi-Desktop-Mascot
git add mascots/electron/preload.js
git commit -m "feat(preload): add IPC channels for mouse-events, size, and apply-scale"
```

---

### Task 2: main.js — 新增 IPC handlers

**Files:**
- Modify: `mascots/electron/main.js`

- [ ] **Step 1: 读取当前 main.js**

确认现有 IPC handlers：`drag-pet`, `open-panel`, `play-animation`, `set-outfit`, `set-expression`。

- [ ] **Step 2: 添加 set-mouse-events 和 set-size IPC handlers**

在 `main.js` 的 `ipcMain.on('set-expression', ...)` 块之后，添加以下代码：

```javascript
ipcMain.on('set-mouse-events', (event, ignore) => {
  if (petWindow) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('set-size', (event, size) => {
  if (petWindow) {
    const [x, y] = petWindow.getPosition();
    const currentBounds = petWindow.getBounds();
    const centerX = x + currentBounds.width / 2;
    const centerY = y + currentBounds.height / 2;
    petWindow.setSize(size, size);
    petWindow.setPosition(
      Math.round(centerX - size / 2),
      Math.round(centerY - size / 2)
    );
    petWindow.webContents.send('apply-scale', size / 420);
  }
});
```

- [ ] **Step 3: 验证语法正确**

Run: `node -c mascots/electron/main.js`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd /workspace/Remielle_Chibi-Desktop-Mascot
git add mascots/electron/main.js
git commit -m "feat(main): add set-mouse-events and set-size IPC handlers"
```

---

### Task 3: pet.js — 点击穿透（包围盒检测）

**Files:**
- Modify: `mascots/electron/pet.js`

- [ ] **Step 1: 读取当前 pet.js**

确认现有结构：`PetApp` 类有 `loadAssets`, `initialize`, `setupIPC`, `setupDrag`, `update`, `render` 方法。`render()` 中调用 `renderer.drawSkeleton(this.skeleton, false)`。

- [ ] **Step 2: 在 PetApp 类中添加包围盒缓存字段**

在 `constructor()` 中，将：

```javascript
constructor() {
    this.skeleton = null;
    this.animationState = null;
    this.canvas = null;
    this.pendingAnim = null;
  }
```

替换为：

```javascript
constructor() {
    this.skeleton = null;
    this.animationState = null;
    this.canvas = null;
    this.pendingAnim = null;
    this.boundsRect = { x: 0, y: 0, width: 0, height: 0 };
    this.currentlyIgnoringMouse = false;
  }
```

- [ ] **Step 3: 在 render() 中更新包围盒缓存**

在 `render(canvas)` 方法中，将：

```javascript
  render(canvas) {
    let renderer = canvas.renderer;
    renderer.resize(spine.ResizeMode.Expand);
    canvas.clear(0, 0, 0, 0);
    renderer.begin();
    if (this.skeleton) {
      renderer.drawSkeleton(this.skeleton, false);
    }
    renderer.end();
  }
```

替换为：

```javascript
  render(canvas) {
    let renderer = canvas.renderer;
    renderer.resize(spine.ResizeMode.Expand);
    canvas.clear(0, 0, 0, 0);
    renderer.begin();
    if (this.skeleton) {
      renderer.drawSkeleton(this.skeleton, false);
    }
    renderer.end();
    if (this.skeleton) {
      this.boundsRect = this.skeleton.getBoundsRect();
    }
  }
```

- [ ] **Step 4: 在 setupDrag() 中添加鼠标穿透检测**

将 `setupDrag()` 方法完整替换为：

```javascript
  setupDrag() {
    let isDragging = false;
    let startX = 0, startY = 0;
    const canvasEl = document.getElementById('canvas');

    canvasEl.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        startX = e.screenX;
        startY = e.screenY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      // 鼠标穿透检测：判断鼠标是否在角色包围盒内
      if (!isDragging) {
        const rect = canvasEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const b = this.boundsRect;
        const inside = mx >= b.x && mx <= b.x + b.width &&
                       my >= b.y && my <= b.y + b.height;
        if (inside && this.currentlyIgnoringMouse) {
          this.currentlyIgnoringMouse = false;
          if (window.electronAPI) window.electronAPI.send('set-mouse-events', false);
        } else if (!inside && !this.currentlyIgnoringMouse) {
          this.currentlyIgnoringMouse = true;
          if (window.electronAPI) window.electronAPI.send('set-mouse-events', true);
        }
        return;
      }
      const dx = e.screenX - startX;
      const dy = e.screenY - startY;
      if (window.electronAPI) {
        window.electronAPI.send('drag-pet', dx, dy);
      }
      startX = e.screenX;
      startY = e.screenY;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvasEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (window.electronAPI) {
        window.electronAPI.send('open-panel');
      }
    });
  }
```

- [ ] **Step 5: 验证语法正确**

Run: `node -c mascots/electron/pet.js`
Expected: 无输出

- [ ] **Step 6: Commit**

```bash
cd /workspace/Remielle_Chibi-Desktop-Mascot
git add mascots/electron/pet.js
git commit -m "feat(pet): add click-through via skeleton bounding box detection"
```

---

### Task 4: pet.js — 角色尺寸缩放

**Files:**
- Modify: `mascots/electron/pet.js`

- [ ] **Step 1: 在 setupIPC() 中添加 apply-scale 监听**

在 `setupIPC()` 方法中，在 `window.electronAPI.on('set-expression', ...)` 块之后添加：

```javascript
    window.electronAPI.on('apply-scale', (scale) => {
      if (this.skeleton) {
        this.skeleton.scaleX = scale;
        this.skeleton.scaleY = scale;
      }
    });
```

- [ ] **Step 2: 验证语法正确**

Run: `node -c mascots/electron/pet.js`
Expected: 无输出

- [ ] **Step 3: Commit**

```bash
cd /workspace/Remielle_Chibi-Desktop-Mascot
git add mascots/electron/pet.js
git commit -m "feat(pet): add apply-scale listener for runtime size adjustment"
```

---

### Task 5: panel.html — 面板结构重构

**Files:**
- Modify: `mascots/electron/panel.html`

- [ ] **Step 1: 读取当前 panel.html**

确认现有结构：侧边栏（表情测试 / 设置 nav），`#tab-expressions`（动画按钮 + 换装按钮），`#tab-settings`（3 个占位 setting-row）。

- [ ] **Step 2: 完整替换 panel.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>小蕾米管理面板</title>
  <link rel="stylesheet" href="panel.css">
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="logo">小蕾米</div>
      <nav>
        <a href="#" class="nav-item active" data-tab="main">主面板</a>
        <a href="#" class="nav-item" data-tab="settings">设置</a>
      </nav>
    </aside>
    <main class="content">
      <section id="tab-main" class="tab active">
        <!-- 未来正式功能加在这里（复选框上方），当前留白 -->

        <div class="setting-row">
          <label class="checkbox-label">
            <input type="checkbox" id="test-mode-toggle">
            进行动画控制测试
          </label>
        </div>

        <div id="test-controls" style="display:none;">
          <h2>动画播放</h2>
          <div class="button-grid">
            <button class="btn-anim active" data-anim="a">待机 (a)</button>
            <button class="btn-anim" data-anim="a_win">胜利A (a_win)</button>
            <button class="btn-anim" data-anim="b">说话/害羞 (b)</button>
            <button class="btn-anim" data-anim="c">轻待机 (c)</button>
            <button class="btn-anim" data-anim="d">紧张 (d)</button>
            <button class="btn-anim" data-anim="d_win">胜利D (d_win)</button>
            <button class="btn-anim" data-anim="e">表情E (e)</button>
            <button class="btn-anim" data-anim="light">光效 (light)</button>
          </div>

          <h2>换装</h2>
          <div class="button-grid">
            <button class="btn-outfit locked" data-outfit="A">套装 A</button>
            <button class="btn-outfit" data-outfit="B">套装 B</button>
            <button class="btn-outfit" data-outfit="C">套装 C</button>
            <button class="btn-outfit" data-outfit="D">套装 D</button>
            <button class="btn-outfit" data-outfit="E">套装 E</button>
          </div>
        </div>
      </section>

      <section id="tab-settings" class="tab">
        <h2>设置</h2>
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
        <div class="setting-row">
          <label>窗口置顶</label>
          <span class="hint">桌宠窗口始终保持在最上层</span>
        </div>
        <div class="setting-row">
          <label>开机自启</label>
          <span class="hint">暂未实现</span>
        </div>
      </section>
    </main>
  </div>
  <script src="panel.js"></script>
</body>
</html>
```

关键变更：
- nav-item `data-tab="expressions"` → `data-tab="main"`，文案"表情测试"→"主面板"
- `#tab-expressions` → `#tab-main`
- 内容区：测试模式 checkbox（普通 setting-row）+ 隐藏的 `#test-controls`
- 套装 A 默认带 `.locked` class（初始锁定）
- 设置 tab："渲染缩放"占位 → 尺寸 `<select>` 下拉

- [ ] **Step 3: Commit**

```bash
cd /workspace/Remielle_Chibi-Desktop-Mascot
git add mascots/electron/panel.html
git commit -m "refactor(panel): restructure to template architecture with test mode toggle"
```

---

### Task 6: panel.css — 新增样式

**Files:**
- Modify: `mascots/electron/panel.css`

- [ ] **Step 1: 读取当前 panel.css**

确认现有样式结构。

- [ ] **Step 2: 在文件末尾追加新样式**

在 `panel.css` 末尾追加：

```css
/* Checkbox label */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 600;
}

.checkbox-label input[type="checkbox"] {
  transform: scale(1.2);
  cursor: pointer;
}

/* Size select */
#size-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #bdc3c7;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
  margin-top: 6px;
}

/* Outfit toggle — locked vs unlocked */
.btn-outfit.locked {
  background: #8e44ad;
  opacity: 1;
}

.btn-outfit:not(.locked) {
  opacity: 0.6;
}

/* Animation button active state */
.btn-anim.active {
  background: #2980b9;
}

/* Test mode: formal features grayed out */
body.test-mode-active .formal-feature {
  opacity: 0.4;
  pointer-events: none;
}
```

- [ ] **Step 3: Commit**

```bash
cd /workspace/Remielle_Chibi-Desktop-Mascot
git add mascots/electron/panel.css
git commit -m "style(panel): add toggle, select, and test-mode gray styles"
```

---

### Task 7: panel.js — 测试模式 + 换装 toggle + 尺寸 + AppState

**Files:**
- Modify: `mascots/electron/panel.js`

- [ ] **Step 1: 完整替换 panel.js**

```javascript
// Global app state — reserved for future features
const AppState = {
  testMode: false,
  currentAnimation: 'a',
  lockedOutfit: 'A',
  // Reserved for future use
  animationQueue: [],
  triggerHandlers: {},
};

// --- Tab navigation ---
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    item.classList.add('active');
    const tabId = 'tab-' + item.dataset.tab;
    document.getElementById(tabId).classList.add('active');
  });
});

// --- Test mode toggle ---
const testToggle = document.getElementById('test-mode-toggle');
const testControls = document.getElementById('test-controls');

testToggle.addEventListener('change', () => {
  const enabled = testToggle.checked;
  AppState.testMode = enabled;
  testControls.style.display = enabled ? 'block' : 'none';
  document.body.classList.toggle('test-mode-active', enabled);
});

// --- Animation buttons ---
document.querySelectorAll('.btn-anim').forEach(btn => {
  btn.addEventListener('click', () => {
    const anim = btn.dataset.anim;
    AppState.currentAnimation = anim;
    document.querySelectorAll('.btn-anim').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (window.electronAPI) {
      window.electronAPI.send('play-animation', anim);
    }
  });
});

// --- Outfit toggle buttons (lock/unlock) ---
document.querySelectorAll('.btn-outfit').forEach(btn => {
  btn.addEventListener('click', () => {
    const outfit = btn.dataset.outfit;
    const wasLocked = btn.classList.contains('locked');

    // Unlock all
    document.querySelectorAll('.btn-outfit').forEach(b => b.classList.remove('locked'));

    if (!wasLocked) {
      btn.classList.add('locked');
      AppState.lockedOutfit = outfit;
      if (window.electronAPI) {
        window.electronAPI.send('set-outfit', outfit);
      }
    } else {
      AppState.lockedOutfit = null;
      if (window.electronAPI) {
        window.electronAPI.send('set-outfit', 'A');
      }
    }
  });
});

// --- Size select ---
const sizeSelect = document.getElementById('size-select');
sizeSelect.addEventListener('change', () => {
  const size = parseInt(sizeSelect.value, 10);
  if (window.electronAPI) {
    window.electronAPI.send('set-size', size);
  }
});
```

- [ ] **Step 2: 验证语法正确**

Run: `node -c mascots/electron/panel.js`
Expected: 无输出

- [ ] **Step 3: Commit**

```bash
cd /workspace/Remielle_Chibi-Desktop-Mascot
git add mascots/electron/panel.js
git commit -m "feat(panel): add test mode toggle, outfit lock, size control, AppState"
```

---

### Task 8: 集成测试 — 启动验证

**Files:**
- 无文件修改，仅验证

- [ ] **Step 1: 启动应用验证无崩溃**

Run: `cd mascots/electron && xvfb-run -a npx electron --no-sandbox . 2>&1 | head -20`
Expected: 应用启动，无 JavaScript 错误

- [ ] **Step 2: 检查面板加载**

在 xvfb 环境中无法手动交互，但确认无启动错误即可。手动测试项：
- [ ] 面板打开后"主面板"tab 默认显示
- [ ] 测试模式复选框未勾选，下方留白
- [ ] 勾选后动画按钮和换装按钮出现
- [ ] 换装按钮点击 toggle（锁定/取消）
- [ ] 设置 tab 尺寸下拉菜单可选
- [ ] 透明区域可穿透点击

- [ ] **Step 3: Commit pitfalls doc + AGENTS.md update**

```bash
cd /workspace/Remielle_Chibi-Desktop-Mascot
git add .harness/pitfalls/ui-literalism.md AGENTS.md .gitignore docs/superpowers/
git commit -m "docs: add UI literalism pitfall, design spec, and implementation plan"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 需求 A（点击穿透）→ Task 1 (preload) + Task 2 (main) + Task 3 (pet.js)
- [x] 需求 B（尺寸控制）→ Task 1 (preload) + Task 2 (main) + Task 4 (pet.js) + Task 5 (panel.html) + Task 7 (panel.js)
- [x] 需求 C（面板重构）→ Task 5 (panel.html) + Task 6 (panel.css) + Task 7 (panel.js)
- [x] AppState 预留 → Task 7
- [x] 换装 toggle → Task 7
- [x] pitfalls 记录 → Task 8 Step 3

**Placeholder scan:** 无 TBD/TODO，所有代码完整。

**Type consistency:** `set-mouse-events`, `set-size`, `apply-scale` 通道名在 preload/main/pet/panel 间一致。`AppState` 字段名一致。
