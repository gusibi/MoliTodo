const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

class MoliTodoMcpServer {
  constructor({ taskUseCases }) {
    this.taskUseCases = taskUseCases;
  }

  async handleRequest(request, response) {
    if (request.method !== 'POST') {
      this.sendProtocolError(response, 405, -32000, 'Method not allowed');
      return;
    }

    const body = await this.readJsonBody(request);
    const server = this.createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, body);
    } finally {
      await transport.close();
      await server.close();
    }
  }

  createServer() {
    const server = new McpServer({ name: 'molitodo', version: '1.0.0' });

    server.registerTool('list_projects', {
      title: '列出项目',
      description: '列出 MoliTodo 中可以创建任务的所有项目（清单）。',
      inputSchema: {}
    }, async () => this.toolResult(await this.taskUseCases.listProjects()));

    server.registerTool('list_tasks', {
      title: '列出任务',
      description: '查询 MoliTodo 任务，可按项目、状态、分类或关键词筛选。',
      inputSchema: {
        project_id: z.number().int().nonnegative().optional().describe('项目 ID'),
        status: z.enum(['todo', 'doing', 'paused', 'done']).optional(),
        category: z.string().optional(),
        query: z.string().optional().describe('搜索关键词'),
        include_completed: z.boolean().optional().default(false)
      }
    }, async (input) => this.toolResult(await this.taskUseCases.listTasks({
      listId: input.project_id,
      status: input.status,
      category: input.category,
      query: input.query,
      includeCompleted: input.include_completed
    })));

    server.registerTool('get_task', {
      title: '读取任务',
      description: '按任务 ID 读取完整任务信息，适合在编辑或操作前确认当前状态。',
      inputSchema: { task_id: z.string().min(1) }
    }, async ({ task_id }) => this.toolResult(await this.taskUseCases.getTask(task_id)));

    server.registerTool('create_task', {
      title: '创建任务',
      description: '在指定项目中创建任务，可设置提醒、截止日期、元数据和重复规则。',
      inputSchema: {
        content: z.string().min(1).describe('任务内容'),
        project_id: z.number().int().nonnegative().optional().default(0),
        reminder_at: z.string().datetime({ offset: true }).nullable().optional(),
        due_date: z.string().nullable().optional().describe('截止日期，格式 YYYY-MM-DD'),
        due_time: z.string().nullable().optional().describe('截止时间，格式 HH:mm'),
        metadata: z.record(z.string(), z.unknown()).optional(),
        recurrence: z.record(z.string(), z.unknown()).nullable().optional()
      }
    }, async (input) => this.toolResult(await this.taskUseCases.createTask({
      content: input.content,
      listId: input.project_id,
      reminderTime: input.reminder_at,
      dueDate: input.due_date,
      dueTime: input.due_time,
      metadata: input.metadata,
      recurrence: input.recurrence
    })));

    server.registerTool('edit_task', {
      title: '编辑任务',
      description: '编辑任务内容、所属项目、提醒、截止日期、元数据或重复规则。传入 null 可清除可空字段。',
      inputSchema: {
        task_id: z.string().min(1),
        content: z.string().min(1).optional(),
        project_id: z.number().int().nonnegative().optional(),
        reminder_at: z.string().datetime({ offset: true }).nullable().optional(),
        due_date: z.string().nullable().optional(),
        due_time: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        recurrence: z.record(z.string(), z.unknown()).nullable().optional()
      }
    }, async (input) => {
      const updates = {};
      if (input.content !== undefined) updates.content = input.content;
      if (input.project_id !== undefined) updates.listId = input.project_id;
      if (input.reminder_at !== undefined) updates.reminderTime = input.reminder_at;
      if (input.due_date !== undefined) updates.dueDate = input.due_date;
      if (input.due_time !== undefined) updates.dueTime = input.due_time;
      if (input.metadata !== undefined) updates.metadata = input.metadata;
      if (input.recurrence !== undefined) updates.recurrence = input.recurrence;
      return this.toolResult(await this.taskUseCases.updateTask(input.task_id, updates));
    });

    this.registerTaskAction(server, 'start_task', '开始任务', '开始任务并进入计时中的状态。',
      (taskId) => this.taskUseCases.startTask(taskId));
    this.registerTaskAction(server, 'stop_task', '结束本次工作', '结束当前计时并将任务设为暂停，任务不会被标记为完成。',
      (taskId) => this.taskUseCases.stopTask(taskId));
    this.registerTaskAction(server, 'complete_task', '完成任务', '完成任务并停止计时；重复任务会创建下一次实例。',
      (taskId) => this.taskUseCases.completeTask(taskId));
    this.registerTaskAction(server, 'delete_task', '删除任务', '永久删除指定任务。',
      (taskId) => this.taskUseCases.deleteTask(taskId));

    return server;
  }

  registerTaskAction(server, name, title, description, action) {
    server.registerTool(name, {
      title,
      description,
      inputSchema: { task_id: z.string().min(1) }
    }, async ({ task_id }) => this.toolResult(await action(task_id)));
  }

  toolResult(data) {
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: { result: data }
    };
  }

  async readJsonBody(request) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    if (chunks.length === 0) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new Error('MCP 请求体不是合法的 JSON');
    }
  }

  sendProtocolError(response, statusCode, code, message) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
  }
}

module.exports = MoliTodoMcpServer;
