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

## 主要接口

### 任务

- `GET /api/tasks`
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
