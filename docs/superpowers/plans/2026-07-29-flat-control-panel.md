# 扁平控制面板实现计划

**规范：** `docs/superpowers/specs/2026-07-29-flat-control-panel-design.md`

## Slice 1：窗口置顶事务

- 先新增服务测试，覆盖默认开启、幂等、非法载荷、窗口应用失败、持久化失败回滚及无窗口提交。
- 实现独立 `AlwaysOnTopService`。
- 接入主进程的 `get-always-on-top`、`set-always-on-top` 和 `always-on-top-changed`。
- 验证：服务测试、主进程与预加载语法检查。

## Slice 2：统一扁平控件

- 先扩展面板合同测试，要求两个桌宠开关使用相同结构，并锁定设置页的扁平 DOM、可访问名称和测试模式回归契约。
- 把测试模式复选框改为透明横排胶囊开关。
- 把设置页改为 64px 扁平列表行、紧凑下拉框、可用的置顶胶囊和禁用状态标签。
- 连接置顶 getter、setter、广播和失败回滚。
- 验证：完整 `npm test`、JSON 与 JavaScript 语法检查。

## Slice 3：运行时与视觉 QA

- 隐藏 Electron 面板分别以 860px 和 640px 加载桌宠页与设置页。
- 断言透明背景、控件右对齐、下拉框宽度、无横向溢出和测试控件显示切换。
- 启动真实主进程路径，验证置顶初值及切换 IPC 无错误。
- 清理临时 QA 文件，执行 `git diff --check` 与 `git status --short`。
