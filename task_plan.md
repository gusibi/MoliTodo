# MCP Support Implementation Plan

## Goal
Add a local MCP Streamable HTTP endpoint that supports project/list discovery and complete task creation, editing, start, stop, completion, querying, and deletion while sharing business orchestration with the existing HTTP API.

## Success criteria
- MCP clients can initialize and discover task tools at `/mcp`.
- Tools support list projects/tasks, get/create/edit/start/stop/complete/delete tasks.
- Creating/editing reminders schedules or cancels desktop notifications.
- Project existence, timestamps, and editable due fields are validated consistently.
- HTTP API behavior remains compatible and uses the shared orchestration module.
- Automated tests and a production renderer build pass.

## Execution

### Phase 1: Audit
**Status:** complete

Audit runtime, persistence, tests, and SDK compatibility.

### Phase 2: Shared use cases
**Status:** complete

Add the shared task use-case module and focused tests.

### Phase 3: HTTP integration
**Status:** complete

Refactor Local API to use the shared module and close behavior gaps.

### Phase 4: MCP adapter
**Status:** complete

Add the MCP Streamable HTTP adapter and tool schemas.

### Phase 5: Product integration
**Status:** complete

Add settings, documentation, and localhost security integration.

### Phase 6: Verification
**Status:** complete

Run tests, build, protocol-level verification, and Electron runtime checks.

## Decisions
- Treat existing `pause` semantics as MCP `stop_task`.
- Keep existing persisted field name `listId`; expose `project_id` in MCP.
- Use modern Streamable HTTP, not legacy SSE.

## Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `node --test test` treated the directory as a module | 1 | Changed the script to target `test/*.test.js`. |
| Planning skill completion script was not executable | 1 | Run it explicitly with `bash`. |
| Completion script did not recognize the compact numbered format | 1 | Changed the plan to the script's expected heading and status format. |
