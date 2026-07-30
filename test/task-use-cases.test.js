const test = require('node:test');
const assert = require('node:assert/strict');
const TaskUseCases = require('../src/application/task-use-cases');

function makeTask(overrides = {}) {
  return {
    id: 'task-1',
    content: '测试任务',
    status: 'todo',
    completed: false,
    createdAt: new Date('2026-07-30T00:00:00Z'),
    updatedAt: new Date('2026-07-30T00:00:00Z'),
    reminderTime: null,
    startedAt: null,
    completedAt: null,
    totalDuration: 0,
    listId: 0,
    metadata: {},
    recurrence: null,
    seriesId: null,
    occurrenceDate: null,
    dueDate: null,
    dueTime: null,
    ...overrides
  };
}

function setup(overrides = {}) {
  const calls = [];
  const taskService = {
    createTaskInList: async (...args) => {
      calls.push(['createTaskInList', ...args]);
      return makeTask({ reminderTime: args[2], listId: args[1] });
    },
    updateTask: async (id, updates) => {
      calls.push(['updateTask', id, updates]);
      return makeTask({ id, ...updates });
    },
    completeTask: async (id) => makeTask({ id, status: 'done', completed: true }),
    startTask: async (id) => makeTask({ id, status: 'doing' }),
    pauseTask: async (id) => makeTask({ id, status: 'paused' }),
    deleteTask: async () => true,
    getTaskById: async (id) => makeTask({ id }),
    ...overrides.taskService
  };
  const listService = {
    getListById: async (id) => id === 7 ? { id } : null,
    getAllLists: async () => [{ id: 0 }],
    ...overrides.listService
  };
  const notificationService = {
    scheduleTaskReminder: (task) => calls.push(['schedule', task.id]),
    cancelTaskReminder: (id) => calls.push(['cancel', id])
  };
  return {
    calls,
    useCases: new TaskUseCases({ taskService, listService, notificationService, onReminder: () => {} })
  };
}

test('createTask validates the project and schedules a reminder', async () => {
  const { useCases, calls } = setup();
  const task = await useCases.createTask({
    content: '测试任务',
    listId: 7,
    reminderTime: '2026-08-01T09:00:00+08:00'
  });
  assert.equal(task.listId, 7);
  assert.equal(task.reminderTime, '2026-08-01T01:00:00.000Z');
  assert.equal(calls.at(-1)[0], 'schedule');
});

test('createTask rejects a missing project', async () => {
  const { useCases } = setup();
  await assert.rejects(
    useCases.createTask({ content: '测试任务', listId: 99 }),
    /项目不存在/
  );
});

test('createTask initializes and accepts the default project', async () => {
  const { useCases } = setup();
  const task = await useCases.createTask({ content: '默认项目任务' });
  assert.equal(task.listId, 0);
});

test('updateTask can edit due fields and clear a reminder', async () => {
  const { useCases, calls } = setup();
  const task = await useCases.updateTask('task-1', {
    dueDate: '2026-08-01',
    dueTime: '18:30',
    reminderTime: null
  });
  assert.equal(task.dueDate, '2026-08-01');
  assert.equal(task.dueTime, '18:30');
  assert.deepEqual(calls.at(-1), ['cancel', 'task-1']);
});

test('stopTask maps to the existing pause transition', async () => {
  const { useCases } = setup();
  const task = await useCases.stopTask('task-1');
  assert.equal(task.status, 'paused');
});
