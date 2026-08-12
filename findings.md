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
