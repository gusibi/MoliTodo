# MCP Implementation Progress

## 2026-07-30

- Audited the existing Local API, task domain module, list module, notification integration, package metadata, and API documentation.
- Confirmed the requested task capabilities largely exist.
- Started runtime and MCP SDK compatibility audit.
- Added the shared `TaskUseCases` module and initial unit tests.
- Unified completion tracking/recurrence logic and added due date/time editing.
- Added the stateless Streamable HTTP MCP adapter with nine task/project tools.
- Refactored Local API task routes onto the shared use-case module and added single-task retrieval.
- Added localhost Host-header validation, narrowed CORS, settings UI endpoint display, and MCP documentation.
- Protocol integration test connects with the official MCP client, discovers all tools, and invokes `stop_task` successfully.
- Expanded protocol verification to create, edit, start, stop, complete, and delete tool calls.
- All 6 tests pass; the Vite production renderer build passes.
- Confirmed the MCP SDK loads under Electron 28's bundled Node 18.18.2 runtime.

## 2026-10-13 重复任务与悬浮窗口修复
- 新增回归检查先失败（当天实例、Today 分组、主窗到悬浮面板同步）；修复验证进行中。
- 针对性 35 检查和悬浮同步 E2E 已通过；实际 UI 时刻保存检查通过，测试选择器已按真实分组/控件文案修正。
- 60 项相关单元检查通过。全量 127 项：126 通过，1 项固定过期 AI 提醒测试失败（未修改模块）。
- 4 项新增重复时间 Electron 场景通过；悬浮窗口原有 14 场景及重复选择器检查也通过。
- 最后 11 项相关 Electron E2E 全部通过；最新输入样式构建通过并重跑 4 项重复时间检查通过。
- 截图保存在 .scratch/recurring-task-fixes；详细结果见 doc/recurring-task-fixes-acceptance.md。
- 后续日期弹窗问题：选择开始/结束先保存本地选择，关闭时提交。先复现失败后新场景通过，相关回归首次 7 通过、1 失败：重复开关保存正确但编辑器显示旧状态；修正同步后 8 项通过。
