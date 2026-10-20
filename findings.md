# MCP Implementation Findings

- The current Local API already exposes list discovery, task listing/creation/edit/delete, and start/pause/complete actions.
- Reminder scheduling currently lives in `LocalApiServer`, so a second adapter would duplicate orchestration unless it is extracted.
- `TaskService.createTaskInList` validates the ID shape but not whether the list exists.
- `TaskService.updateTask` does not edit `dueDate` or `dueTime`.
- HTTP completion calls `completeTaskWithTracking`, while recurring-task continuation exists in a different `completeTask` method.
- The server uses wildcard CORS and has no Host validation or authentication.
- Official MCP guidance recommends Streamable HTTP for network endpoints and Host validation for localhost DNS-rebinding protection.
- Local development Node is v22.15.1; packaged Electron is 28.3.3, so dependency runtime compatibility must be checked before selecting an SDK version.
- Official SDK 2.0 requires Node 20; `@modelcontextprotocol/sdk` 1.30 supports Node 18 and modern Streamable HTTP, so it is the compatible choice for Electron 28.

## 2026-10-13 重复任务与悬浮窗口修复
- 当天实例被创建时刻排除；无日期头行挡住虚拟实例；广播遗漏任务面板。
- 时间编辑复用 ui Input 的 time 类型；系列截止时刻标记存于现有 recurrence JSON，避免给旧无安排系列凭空生成截止。
- 完整 npm test 的 AI 测试使用固定 2026-09-25 提醒，当前日期已过期；该未修改区域失败，单独记录。
- 完成系列首项后，活动头行会有新 id、原 seriesId；编辑目标必须查找活动系列，不能改写已完成的原头行。新增 Electron 回归已通过。
