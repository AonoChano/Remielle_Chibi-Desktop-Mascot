# 眼神追踪与桌宠动画行为实现计划

**目标：** 实现已确认的自动动画状态机、全局眼神追踪、桌宠页胶囊开关和结构化调试日志。

**规范：** `docs/superpowers/specs/2026-07-28-eye-tracking-pet-behavior-design.md`

## Slice 1：可验证的行为状态机

**文件：**
- 新增 `mascots/electron/pet-behavior.js`
- 新增 `mascots/electron/test/pet-behavior.test.js`
- 修改 `mascots/electron/package.json`

**步骤：**
1. 先写状态、概率边界、循环范围、计时竞争、播放 ID 和日志顺序测试并确认失败。
2. 实现无 DOM/Spine 依赖的 `PetBehaviorController`。
3. 运行状态机测试与语法检查。

**验收：**
- 所有随机分支可用固定随机序列重现。
- 迟到播放事件不能推进状态。
- 10/20/30 秒与大 delta 行为符合规范。
- 日志能重建一次完整动作链。

## Slice 2：可验证的眼神数学与设置生命周期

**文件：**
- 新增 `mascots/electron/eye-tracking.js`
- 新增 `mascots/electron/test/eye-tracking.test.js`
- 修改 `mascots/electron/main.js`
- 修改 `mascots/electron/preload.js`

**步骤：**
1. 先写归一化、单位圆限幅、Y 轴翻转、平滑和非法输入测试并确认失败。
2. 实现纯眼神映射函数。
3. 在主进程实现布尔设置单一事实来源、幂等 30 Hz 采样器和安全 IPC。
4. 运行单元测试与主进程/预加载语法检查。

**验收：**
- 眼球偏移始终在 24x16 骨骼单位限幅内。
- 相同总时长在不同帧率下得到等效平滑结果。
- 重复开关不创建重复采样器；窗口销毁后不发送。

## Slice 3：Spine、双击和测试模式集成

**文件：**
- 修改 `mascots/electron/pet.html`
- 修改 `mascots/electron/pet.js`
- 修改 `mascots/electron/main.js`
- 修改 `mascots/electron/preload.js`
- 修改 `mascots/electron/panel.js`

**步骤：**
1. 加载两个纯模块并实例化状态机。
2. 将 Spine TrackEntry 与 `playbackId` 绑定，转发真实完成事件。
3. 添加角色双击入口和测试模式独占 IPC。
4. 在 Spine 动画应用后叠加瞳孔平滑偏移。
5. 运行完整测试与所有 JavaScript 语法检查。

**验收：**
- 正常启动从 IDLE 开始。
- 瞬态状态忽略双击且日志说明原因。
- 测试模式清空自动 Track，退出后回 IDLE。
- 金光只占 Track 1，不打断 IDLE。

## Slice 4：桌宠页开关与国际化

**文件：**
- 修改 `mascots/electron/panel.html`
- 修改 `mascots/electron/panel.css`
- 修改 `mascots/electron/panel.js`
- 修改 `mascots/electron/locales/zh-CN.json`
- 修改 `mascots/electron/locales/en-US.json`

**步骤：**
1. 将“主面板”改为“桌宠”，将“画完炫耀”改为“画完欣赏”。
2. 添加透明设置行与原生 checkbox 胶囊开关。
3. 连接有确认返回值的设置 IPC，并处理跨窗口广播。
4. 运行 JSON、JavaScript 和静态 DOM 检查。

**验收：**
- 文本左对齐、胶囊右对齐、无额外卡片背景。
- 默认开启并可持久化。
- 中英文文案完整，键盘焦点可见。

## Slice 5：端到端验证

1. 运行 `npm test`。
2. 对所有修改的 JavaScript 运行 `node --check`。
3. 启动 Electron 并检查主进程、渲染进程控制台。
4. 捕获面板桌面与窄窗口截图，检查文字、开关、布局和溢出。
5. 检查 `git diff --check` 与 `git status --short`。

**完成标准：** 自动测试全绿、Electron 正常启动、面板视觉符合需求、无新增控制台错误，并记录无法自动验证的真实交互项目。
