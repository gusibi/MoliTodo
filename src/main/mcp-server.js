const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const reminderPolicySchema = z.object({
  mode: z.enum(['default', 'disabled', 'relative', 'absolute'])
    .describe('提醒模式：default=默认不自动提醒；disabled=显式关闭；relative=开始前 N 分钟提醒；absolute=按 reminder_at 指定时刻提醒'),
  minutesBefore: z.number().int().nonnegative().nullable().optional().describe('relative 模式的提前分钟数（0 表示开始时）')
}).nullable().optional();

class MoliTodoMcpServer {
  constructor({ taskUseCases }) {
    this.taskUseCases = taskUseCases;
  }

  /**
   * 任务输出统一使用 snake_case，与工具入参命名保持一致。
   * 应用层返回 camelCase；这里只做键名映射，不改值。
   */
  serializeTaskOutput(data) {
    if (Array.isArray(data)) {
      return data.map((item) => this.serializeTaskOutput(item));
    }
    if (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      data.id !== undefined &&
      (data.content !== undefined || data.status !== undefined)
    ) {
      const {
        id, content, status, completed,
        createdAt, updatedAt, reminderTime, startedAt, completedAt,
        totalDuration, listId, metadata, recurrence, seriesId, occurrenceDate,
        dueDate, dueTime, scheduledStartAt, scheduledEndAt, reminderPolicy, timeWarning,
        ...rest
      } = data;
      return {
        id,
        content,
        status,
        completed,
        created_at: createdAt,
        updated_at: updatedAt,
        reminder_at: reminderTime,
        started_at: startedAt,
        completed_at: completedAt,
        total_duration: totalDuration,
        project_id: listId,
        metadata,
        recurrence,
        series_id: seriesId,
        occurrence_date: occurrenceDate,
        due_date: dueDate,
        due_time: dueTime,
        scheduled_start_at: scheduledStartAt,
        scheduled_end_at: scheduledEndAt,
        reminder_policy: reminderPolicy,
        time_warning: timeWarning,
        ...rest
      };
    }
    return data;
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
      description: '查询 MoliTodo 任务，可按项目、状态、分类或关键词筛选。分类基于任务时间模型：today=今天安排/截止/逾期/过去安排未完成/进行中；planned=未完成且有安排或截止；inbox=待办且无安排无截止；unscheduled=未完成且无安排无截止。只有提醒的任务不占日期。',
      inputSchema: {
        project_id: z.number().int().nonnegative().optional().describe('项目 ID'),
        status: z.enum(['todo', 'doing', 'paused', 'done']).optional(),
        category: z.enum(['all', 'today', 'planned', 'inbox', 'unscheduled', 'doing', 'paused', 'completed']).optional()
          .describe('任务分类（基于安排/截止的时间语义）'),
        query: z.string().optional().describe('搜索关键词'),
        include_completed: z.boolean().optional().default(false)
      }
    }, async (input) => this.toolResult(this.serializeTaskOutput(await this.taskUseCases.listTasks({
      listId: input.project_id,
      status: input.status,
      category: input.category,
      query: input.query,
      includeCompleted: input.include_completed
    }))));

    server.registerTool('get_task', {
      title: '读取任务',
      description: '按任务 ID 读取完整任务信息（含安排、截止、提醒策略），适合在编辑或操作前确认当前状态。',
      inputSchema: { task_id: z.string().min(1) }
    }, async ({ task_id }) => this.toolResult(this.serializeTaskOutput(await this.taskUseCases.getTask(task_id))));

    server.registerTool('create_task', {
      title: '创建任务',
      description: '在指定项目中创建任务，可设置安排、截止、提醒、元数据和重复规则。时间语义：scheduled_start_at/scheduled_end_at 表示“什么时候做”（必须含具体时刻，结束不得早于开始）；due_date/due_time 表示“最晚何时完成”（日期必填，due_time 可选）；reminder_policy 独立控制通知，relative 模式需要 scheduled_start_at，absolute 模式需同时给 reminder_at 且必须在未来。',
      inputSchema: {
        content: z.string().min(1).describe('任务内容'),
        project_id: z.number().int().nonnegative().optional().default(0),
        scheduled_start_at: z.string().datetime({ offset: true }).nullable().optional().describe('计划开始时间（ISO 8601 含时区）'),
        scheduled_end_at: z.string().datetime({ offset: true }).nullable().optional().describe('计划结束时间，需晚于开始时间'),
        due_date: z.string().nullable().optional().describe('截止日期，格式 YYYY-MM-DD'),
        due_time: z.string().nullable().optional().describe('截止时刻，格式 HH:mm；不传表示日期型截止'),
        reminder_policy: reminderPolicySchema,
        reminder_at: z.string().datetime({ offset: true }).nullable().optional().describe('绝对提醒时间；reminder_policy 为 absolute 时必填'),
        metadata: z.record(z.string(), z.unknown()).optional(),
        recurrence: z.record(z.string(), z.unknown()).nullable().optional()
      }
    }, async (input) => this.toolResult(this.serializeTaskOutput(await this.taskUseCases.createTask({
      content: input.content,
      listId: input.project_id,
      scheduledStartAt: input.scheduled_start_at,
      scheduledEndAt: input.scheduled_end_at,
      dueDate: input.due_date,
      dueTime: input.due_time,
      reminderPolicy: input.reminder_policy,
      reminderTime: input.reminder_at,
      metadata: input.metadata,
      recurrence: input.recurrence
    }))));

    server.registerTool('edit_task', {
      title: '编辑任务',
      description: '编辑任务内容、所属项目、安排、截止、提醒、元数据或重复规则。未传的字段保持原值；传 null 清除可空字段（清除 scheduled_start_at 会连带清除结束时间并把相对提醒转为关闭；清除 due_date 会连带清除 due_time；仅清除 due_time 得到日期型截止）。',
      inputSchema: {
        task_id: z.string().min(1),
        content: z.string().min(1).optional(),
        project_id: z.number().int().nonnegative().optional(),
        scheduled_start_at: z.string().datetime({ offset: true }).nullable().optional(),
        scheduled_end_at: z.string().datetime({ offset: true }).nullable().optional(),
        due_date: z.string().nullable().optional(),
        due_time: z.string().nullable().optional(),
        reminder_policy: reminderPolicySchema,
        reminder_at: z.string().datetime({ offset: true }).nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        recurrence: z.record(z.string(), z.unknown()).nullable().optional()
      }
    }, async (input) => {
      const updates = {};
      if (input.content !== undefined) updates.content = input.content;
      if (input.project_id !== undefined) updates.listId = input.project_id;
      if (input.scheduled_start_at !== undefined) updates.scheduledStartAt = input.scheduled_start_at;
      if (input.scheduled_end_at !== undefined) updates.scheduledEndAt = input.scheduled_end_at;
      if (input.due_date !== undefined) updates.dueDate = input.due_date;
      if (input.due_time !== undefined) updates.dueTime = input.due_time;
      if (input.reminder_policy !== undefined) updates.reminderPolicy = input.reminder_policy;
      if (input.reminder_at !== undefined) updates.reminderTime = input.reminder_at;
      if (input.metadata !== undefined) updates.metadata = input.metadata;
      if (input.recurrence !== undefined) updates.recurrence = input.recurrence;
      return this.toolResult(this.serializeTaskOutput(await this.taskUseCases.updateTask(input.task_id, updates)));
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
    }, async ({ task_id }) => this.toolResult(this.serializeTaskOutput(await action(task_id))));
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
