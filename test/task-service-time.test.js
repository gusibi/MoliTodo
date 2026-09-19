const test = require('node:test');
const assert = require('node:assert/strict');
const TaskService = require('../src/domain/services/task-service');
const TaskUseCases = require('../src/application/task-use-cases');
const Task = require('../src/domain/entities/task');

class MemoryTaskRepository {
  constructor(initial = []) {
    this.tasks = initial;
    this.saveCalls = 0;
  }
  async findById(id) {
    return this.tasks.find((task) => task.id === id) || null;
  }
  async save(task) {
    this.saveCalls += 1;
    const index = this.tasks.findIndex((candidate) => candidate.id === task.id);
    if (index >= 0) this.tasks[index] = task;
    else this.tasks.push(task);
    return task;
  }
  async findAll() {
    return [...this.tasks];
  }
  async findIncomplete() {
    return this.tasks.filter((task) => task.status !== 'done');
  }
  async findCompleted() {
    return this.tasks.filter((task) => task.status === 'done');
  }
  async getIncompleteCount() {
    return this.tasks.filter((task) => task.status !== 'done').length;
  }
}

function setup(initial = []) {
  const repo = new MemoryTaskRepository(initial);
  const notifications = [];
  const taskService = new TaskService(repo);
  const notificationService = {
    scheduleTaskReminder: (task) => notifications.push(['schedule', task.id]),
    cancelTaskReminder: (id) => notifications.push(['cancel', id])
  };
  const useCases = new TaskUseCases({
    taskService,
    listService: {
      getListById: async (id) => (id === 0 ? { id: 0 } : null),
      getAllLists: async () => [{ id: 0 }]
    },
    notificationService,
    onReminder: () => {}
  });
  return { repo, notifications, taskService, useCases };
}

function localIso(year, month, day, hours = 0, minutes = 0) {
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

test('createTask without time produces an unscheduled inbox task with no reminder', async () => {
  const { useCases, repo, notifications } = setup();
  const task = await useCases.createTask({ content: '随手记' });
  assert.equal(task.dueDate, null);
  assert.equal(task.scheduledStartAt, null);
  assert.equal(task.reminderPolicy, null);
  assert.equal(task.reminderTime, null);
  assert.equal(notifications.length, 0);

  const stored = await repo.findById(task.id);
  assert.equal(stored.isInboxTask(), true);
  assert.equal(stored.isPlannedTask(), false);
  assert.equal(stored.isUnscheduledTask(), true);
});

test('createTask rejects an invalid schedule range without saving', async () => {
  const { useCases, repo, notifications } = setup();
  await assert.rejects(
    useCases.createTask({
      content: '无效范围',
      scheduledStartAt: localIso(2027, 1, 1, 11),
      scheduledEndAt: localIso(2027, 1, 1, 10)
    }),
    /计划结束时间不能早于计划开始时间/
  );
  assert.equal(repo.saveCalls, 0);
  assert.equal(notifications.length, 0);
});

test('clearing the schedule start also clears the end', async () => {
  const { useCases } = setup();
  const created = await useCases.createTask({
    content: '跨天安排',
    scheduledStartAt: localIso(2027, 1, 1, 22),
    scheduledEndAt: localIso(2027, 1, 2, 2)
  });
  assert.ok(created.scheduledEndAt);

  const cleared = await useCases.updateTask(created.id, { scheduledStartAt: null });
  assert.equal(cleared.scheduledStartAt, null);
  assert.equal(cleared.scheduledEndAt, null);
});

test('deadline date-only stays not overdue until the next local midnight', async () => {
  const { useCases } = setup();
  const today = new Date();
  const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const created = await useCases.createTask({ content: '今天截止', dueDate });
  assert.equal(created.dueDate, dueDate);
  assert.equal(created.dueTime, null);

  const stored = await useCases.getTask(created.id);
  assert.equal(stored.dueDate, dueDate);
});

test('relative reminder follows schedule changes and disables when the schedule is cleared', async () => {
  const { useCases, notifications } = setup();
  const created = await useCases.createTask({
    content: '提前提醒',
    scheduledStartAt: localIso(2027, 1, 1, 10),
    reminderPolicy: { mode: 'relative', minutesBefore: 10 }
  });
  assert.equal(new Date(created.reminderTime).getHours(), 9);
  assert.equal(new Date(created.reminderTime).getMinutes(), 50);
  assert.ok(notifications.some(([kind]) => kind === 'schedule'));

  const moved = await useCases.updateTask(created.id, { scheduledStartAt: localIso(2027, 1, 1, 14) });
  assert.equal(new Date(moved.reminderTime).getHours(), 13);
  assert.equal(new Date(moved.reminderTime).getMinutes(), 50);
  assert.ok(notifications.some(([kind]) => kind === 'cancel'));

  const cleared = await useCases.updateTask(created.id, { scheduledStartAt: null });
  assert.deepEqual(cleared.reminderPolicy, { mode: 'disabled', minutesBefore: null });
  assert.equal(cleared.reminderTime, null);
  assert.equal(notifications.at(-1)[0], 'cancel');
});

test('explicit absolute reminders must be in the future and can be turned off', async () => {
  const { useCases } = setup();
  await assert.rejects(
    useCases.createTask({
      content: '过去的提醒',
      reminderTime: new Date(Date.now() - 60 * 60 * 1000).toISOString()
    }),
    /提醒时间不能是过去的时间/
  );

  const created = await useCases.createTask({
    content: '稍后提醒',
    reminderTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
  assert.deepEqual(created.reminderPolicy, { mode: 'absolute', minutesBefore: null });

  const off = await useCases.updateTask(created.id, { reminderTime: null });
  assert.deepEqual(off.reminderPolicy, { mode: 'disabled', minutesBefore: null });
  assert.equal(off.reminderTime, null);
});

test('a failed schedule update does not partially mutate a stored task', async () => {
  const original = new Task({
    id: 'atomic',
    content: '原子更新',
    status: 'todo',
    createdAt: new Date(),
    timeTracking: {},
    listId: 0,
    metadata: {},
    scheduledStartAt: new Date(2027, 0, 1, 10, 0),
    scheduledEndAt: new Date(2027, 0, 1, 11, 0)
  });
  const { useCases, repo } = setup([original]);

  await assert.rejects(
    useCases.updateTask('atomic', {
      scheduledStartAt: new Date(2027, 0, 1, 12, 0).toISOString()
    }),
    /计划结束时间不能早于计划开始时间/
  );

  const stored = await repo.findById('atomic');
  assert.equal(stored.scheduledStartAt.getHours(), 10);
  assert.equal(stored.scheduledEndAt.getHours(), 11);
});

test('category listing uses schedule/deadline instead of reminder time', async () => {
  const { useCases, taskService } = setup();
  const inbox = await useCases.createTask({ content: '收件箱', reminderTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  const planned = await useCases.createTask({ content: '计划中', dueDate: '2027-01-01' });

  const inboxTasks = await taskService.getTasksByCategory('inbox');
  const plannedTasks = await taskService.getTasksByCategory('planned');
  const unscheduled = await taskService.getTasksByCategory('unscheduled');

  assert.deepEqual(inboxTasks.map((task) => task.id), [inbox.id]);
  assert.deepEqual(plannedTasks.map((task) => task.id), [planned.id]);
  assert.deepEqual(unscheduled.map((task) => task.id), [inbox.id]);
});

test('completing a recurring template creates the next instance with schedule and deadline', async () => {
  const { useCases, repo } = setup();
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(10, 0, 0, 0)

  const dueDate = new Date(start)
  dueDate.setDate(dueDate.getDate() + 1)
  const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`

  const template = await useCases.createTask({
    content: '每日站会',
    scheduledStartAt: start.toISOString(),
    dueDate: dueDateStr,
    recurrence: { type: 'daily', interval: 1 }
  });

  const completed = await useCases.completeTask(template.id)
  assert.equal(completed.status, 'done')

  const instances = await repo.findAll()
  const next = instances.find((task) => task.id !== template.id)
  assert.ok(next, '应生成下一个实例')
  assert.equal(next.scheduledStartAt.getHours(), 10)
  assert.equal(next.scheduledStartAt.getMinutes(), 0)
  assert.equal(next.scheduledStartAt.getDate(), start.getDate())
  assert.equal(next.dueDate, dueDateStr)
  assert.equal(next.seriesId, template.id)
  assert.ok(next.recurrence)
});

