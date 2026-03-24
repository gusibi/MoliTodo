---
name: molitodo-local-api
description: Use this skill when an AI needs to control a locally running MoliTodo app through its localhost API. It explains how to discover the server, where to read the API docs, which task and list endpoints exist, and the recommended call order for safe usage.
---

# MoliTodo Local API

Use this skill when MoliTodo has enabled its local server in Settings > Local API.

## Workflow

1. Read the base URL from the user or assume the default `http://127.0.0.1:1234`.
2. Call `GET /api/health` to confirm the server is online.
3. Call `GET /api/docs` for a compact endpoint list.
4. If the caller needs structured tooling metadata, call `GET /api/openapi.json`.
5. Use task and list endpoints from the reference below.

## Default endpoints

- `GET /api/health`
- `GET /api/docs`
- `GET /api/openapi.json`
- `GET /api/lists`
- `POST /api/lists`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/start`
- `POST /api/tasks/:id/pause`
- `POST /api/tasks/:id/complete`

## Notes

- The server only listens on localhost by default.
- All requests and responses use JSON.
- Start with reads before writes whenever the current task state matters.
- Read the reference file for request examples and query parameters.

See [references/api.md](references/api.md) for concrete examples.
