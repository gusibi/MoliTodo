# MoliTodo Local API Reference

Base URL default: `http://127.0.0.1:1234`

## Discovery

### Health check

```bash
curl http://127.0.0.1:1234/api/health
```

### Docs

```bash
curl http://127.0.0.1:1234/api/docs
```

### OpenAPI

```bash
curl http://127.0.0.1:1234/api/openapi.json
```

## Lists

### Get all lists

```bash
curl http://127.0.0.1:1234/api/lists
```

### Create a list

```bash
curl -X POST http://127.0.0.1:1234/api/lists \
  -H "Content-Type: application/json" \
  -d '{"name":"AI Tasks","color":"#4F46E5","icon":"star"}'
```

## Tasks

### Get tasks

```bash
curl "http://127.0.0.1:1234/api/tasks?includeCompleted=true"
```

Optional query params:

- `status=todo|doing|paused|done`
- `listId=0`
- `category=inbox|today|doing|paused|planned|completed|all`
- `query=keyword`
- `includeCompleted=true`

### Create a task

```bash
curl -X POST http://127.0.0.1:1234/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "content": "整理 AI 接口说明",
    "listId": 0,
    "metadata": { "source": "ai" },
    "dueDate": "2026-03-24",
    "dueTime": "18:00"
  }'
```

### Update a task

```bash
curl -X PATCH http://127.0.0.1:1234/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{
    "content": "更新后的任务标题",
    "listId": 0,
    "metadata": { "priority": "high" }
  }'
```

### Start a task

```bash
curl -X POST http://127.0.0.1:1234/api/tasks/TASK_ID/start
```

### Pause a task

```bash
curl -X POST http://127.0.0.1:1234/api/tasks/TASK_ID/pause
```

### Complete a task

```bash
curl -X POST http://127.0.0.1:1234/api/tasks/TASK_ID/complete
```

### Delete a task

```bash
curl -X DELETE http://127.0.0.1:1234/api/tasks/TASK_ID
```
