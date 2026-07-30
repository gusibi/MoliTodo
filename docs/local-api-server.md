# MoliTodo 本地接口

MoliTodo 现在支持在本机开启一个本地接口服务，默认地址是 `http://127.0.0.1:1234`。

## 开启方式

1. 打开设置
2. 进入“本地接口”
3. 打开“开启本地服务”
4. 需要的话修改端口

## 先看哪里

- 健康检查：`GET /api/health`
- 接口说明：`GET /api/docs`
- OpenAPI：`GET /api/openapi.json`
- MCP：`POST /mcp`（Streamable HTTP）

## MCP

开启本地服务后，把以下地址配置到支持 Streamable HTTP 的 MCP 客户端：

```text
http://127.0.0.1:1234/mcp
```

MCP 提供以下工具：

- `list_projects`
- `list_tasks`
- `get_task`
- `create_task`
- `edit_task`
- `start_task`
- `stop_task`
- `complete_task`
- `delete_task`

其中 `stop_task` 表示结束本次计时并暂停任务，不会把任务标记为完成。提醒时间使用带时区的 ISO 8601 格式，例如 `2026-07-31T09:00:00+08:00`。

## 主要接口

### 任务

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/start`
- `POST /api/tasks/:id/pause`
- `POST /api/tasks/:id/complete`

支持的查询参数：

- `status`
- `listId`
- `category`
- `query`
- `includeCompleted=true`

### 清单

- `GET /api/lists`
- `POST /api/lists`

## 示例

```bash
curl http://127.0.0.1:1234/api/health
```

```bash
curl http://127.0.0.1:1234/api/tasks?includeCompleted=true
```

```bash
curl -X POST http://127.0.0.1:1234/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"content":"写一份对接说明","listId":0}'
```

```bash
curl -X PATCH http://127.0.0.1:1234/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"content":"更新后的标题"}'
```

```bash
curl -X POST http://127.0.0.1:1234/api/tasks/TASK_ID/complete
```
