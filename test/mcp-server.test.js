const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const MoliTodoMcpServer = require('../src/main/mcp-server');

async function startMcpServer(taskUseCases) {
  const adapter = new MoliTodoMcpServer({ taskUseCases });
  const server = http.createServer((request, response) => {
    adapter.handleRequest(request, response).catch((error) => {
      response.writeHead(500).end(error.message);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const client = new Client({ name: 'molitodo-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${address.port}/mcp`)
  );
  await client.connect(transport);
  return { server, client };
}

test('MCP endpoint discovers and invokes all task tools', async (t) => {
  const calls = [];
  const task = { id: 'task-1', content: '测试', status: 'paused', listId: 7 };
  const taskUseCases = {
    listProjects: async () => [{ id: 7, name: '工作' }],
    listTasks: async () => [task],
    getTask: async () => task,
    createTask: async (input) => {
      calls.push(['createTask', input]);
      return { ...task, ...input };
    },
    updateTask: async (id, updates) => {
      calls.push(['updateTask', id, updates]);
      return { ...task, id, ...updates };
    },
    startTask: async (id) => {
      calls.push(['startTask', id]);
      return { ...task, id, status: 'doing' };
    },
    stopTask: async (id) => {
      calls.push(['stopTask', id]);
      return { ...task, id, status: 'paused' };
    },
    completeTask: async (id) => {
      calls.push(['completeTask', id]);
      return { ...task, id, status: 'done' };
    },
    deleteTask: async (id) => {
      calls.push(['deleteTask', id]);
      return { success: true };
    }
  };
  const { server, client } = await startMcpServer(taskUseCases);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => client.close());

  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name), [
    'list_projects',
    'list_tasks',
    'get_task',
    'create_task',
    'edit_task',
    'start_task',
    'stop_task',
    'complete_task',
    'delete_task'
  ]);

  await client.callTool({
    name: 'create_task',
    arguments: { content: '新任务', project_id: 7, reminder_at: '2026-08-01T09:00:00+08:00' }
  });
  await client.callTool({
    name: 'edit_task',
    arguments: {
      task_id: 'task-1',
      content: '更新任务',
      reminder_at: null,
      scheduled_start_at: '2026-08-01T10:00:00+08:00',
      reminder_policy: { mode: 'relative', minutesBefore: 10 }
    }
  });
  await client.callTool({ name: 'start_task', arguments: { task_id: 'task-1' } });
  const result = await client.callTool({ name: 'stop_task', arguments: { task_id: 'task-1' } });
  await client.callTool({ name: 'complete_task', arguments: { task_id: 'task-1' } });
  await client.callTool({ name: 'delete_task', arguments: { task_id: 'task-1' } });

  assert.deepEqual(calls, [
    ['createTask', {
      content: '新任务',
      listId: 7,
      reminderTime: '2026-08-01T09:00:00+08:00',
      dueDate: undefined,
      dueTime: undefined,
      scheduledStartAt: undefined,
      scheduledEndAt: undefined,
      reminderPolicy: undefined,
      metadata: undefined,
      recurrence: undefined
    }],
    ['updateTask', 'task-1', {
      content: '更新任务',
      reminderTime: null,
      scheduledStartAt: '2026-08-01T10:00:00+08:00',
      reminderPolicy: { mode: 'relative', minutesBefore: 10 }
    }],
    ['startTask', 'task-1'],
    ['stopTask', 'task-1'],
    ['completeTask', 'task-1'],
    ['deleteTask', 'task-1']
  ]);
  assert.match(result.content[0].text, /"status": "paused"/);
});

test('MCP outputs use snake_case and round-trip the task time model', async (t) => {
  const outputs = {};
  const storedTask = {
    id: 't9',
    content: '写周报',
    status: 'todo',
    completed: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    dueDate: '2026-09-20',
    dueTime: null,
    scheduledStartAt: '2026-09-20T02:00:00.000Z',
    scheduledEndAt: '2026-09-20T03:00:00.000Z',
    reminderTime: '2026-09-20T01:50:00.000Z',
    reminderPolicy: { mode: 'relative', minutesBefore: 10 },
    timeWarning: null,
    listId: 0
  };
  const taskUseCases = {
    listProjects: async () => [],
    listTasks: async () => [storedTask],
    getTask: async () => storedTask,
    createTask: async (input) => {
      outputs.created = input;
      return { id: 't10', ...input };
    },
    updateTask: async (id, updates) => {
      outputs.edited = { id, ...updates };
      return { ...storedTask, ...updates };
    },
    startTask: async () => ({}),
    stopTask: async () => ({}),
    completeTask: async () => ({}),
    deleteTask: async () => ({ success: true })
  };
  const { server, client } = await startMcpServer(taskUseCases);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => client.close());

  // 读取：输出为 snake_case，时间模型字段完整
  const got = await client.callTool({ name: 'get_task', arguments: { task_id: 't9' } });
  const task = got.structuredContent.result;
  assert.equal(task.due_date, '2026-09-20');
  assert.equal(task.due_time, null);
  assert.equal(task.scheduled_start_at, '2026-09-20T02:00:00.000Z');
  assert.equal(task.scheduled_end_at, '2026-09-20T03:00:00.000Z');
  assert.equal(task.reminder_policy.mode, 'relative');
  assert.equal(task.reminder_policy.minutesBefore, 10);
  assert.equal(task.reminder_at, '2026-09-20T01:50:00.000Z');
  assert.equal(task.project_id, 0);
  assert.equal(task.listId, undefined);
  assert.equal(task.scheduledStartAt, undefined);

  // 列表输出同样是 snake_case
  const listed = await client.callTool({ name: 'list_tasks', arguments: {} });
  assert.equal(listed.structuredContent.result[0].scheduled_start_at, '2026-09-20T02:00:00.000Z');

  // 清除语义：仅清 due_time 得到日期型截止；清 scheduled_start_at 连带语义交给应用层
  await client.callTool({
    name: 'edit_task',
    arguments: { task_id: 't9', due_time: null, scheduled_start_at: null }
  });
  assert.deepEqual(outputs.edited, {
    id: 't9',
    dueTime: null,
    scheduledStartAt: null
  });

  // 创建：新字段映射到应用层 camelCase
  await client.callTool({
    name: 'create_task',
    arguments: {
      content: '开会',
      scheduled_start_at: '2026-09-21T01:00:00.000Z',
      reminder_policy: { mode: 'relative', minutesBefore: 5 },
      due_date: '2026-09-21'
    }
  });
  assert.equal(outputs.created.scheduledStartAt, '2026-09-21T01:00:00.000Z');
  assert.deepEqual(outputs.created.reminderPolicy, { mode: 'relative', minutesBefore: 5 });
  assert.equal(outputs.created.dueDate, '2026-09-21');

  // 非任务对象（删除结果）不受序列化影响
  const deleted = await client.callTool({ name: 'delete_task', arguments: { task_id: 't9' } });
  assert.deepEqual(deleted.structuredContent.result, { success: true });
});
