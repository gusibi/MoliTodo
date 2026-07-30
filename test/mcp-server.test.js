const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const MoliTodoMcpServer = require('../src/main/mcp-server');

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
  const adapter = new MoliTodoMcpServer({ taskUseCases });
  const server = http.createServer((request, response) => {
    adapter.handleRequest(request, response).catch((error) => {
      response.writeHead(500).end(error.message);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const client = new Client({ name: 'molitodo-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${address.port}/mcp`)
  );
  await client.connect(transport);
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
    arguments: { task_id: 'task-1', content: '更新任务', reminder_at: null }
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
      metadata: undefined,
      recurrence: undefined
    }],
    ['updateTask', 'task-1', { content: '更新任务', reminderTime: null }],
    ['startTask', 'task-1'],
    ['stopTask', 'task-1'],
    ['completeTask', 'task-1'],
    ['deleteTask', 'task-1']
  ]);
  assert.match(result.content[0].text, /"status": "paused"/);
});
