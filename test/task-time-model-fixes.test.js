const test = require('node:test');
const assert = require('node:assert/strict');
const TaskService = require('../src/domain/services/task-service');
const TaskUseCases = require('../src/application/task-use-cases');
const Task = require('../src/domain/entities/task');
const taskTime = require('../src/domain/services/task-time');
const RecurringTaskService = require('../src/domain/services/recurring-task-service');

/**
 * 覆盖任务时间模型补齐修复的外部可观察行为：
 * - 日期型字符串按本地午夜解析
 * - 过期相对提醒不触发即时通知，旧绝对提醒恢复保持立即触发
 * - 编辑重复系列不覆盖相对提醒策略
 * - 重复实例物化保留安排 / 截止 / 提醒
 * - 展开结果与覆盖实例按系列 + 本地发生日期去重
 * - 完成 / 更新状态时取消提醒调度
 */

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
  async findRecurringTasks() {
    return this.tasks.filter((task) => task.recurrence);
  }
  async findOverrideInstances(seriesId) {
    return this.tasks.filter((task) => task.seriesId === seriesId && task.occurrenceDate);
  }
  async findOverrideInstance(seriesId, occurrenceDate) {
    return this.tasks.find((task) => task.seriesId === seriesId && String(task.occurrenceDate) === String(occurrenceDate)) || null;
  }
}

function setup(initial = []) {
  const repo = new MemoryTaskRepository(initial);
  const notifications = [];
  const taskService = new TaskService(repo);
  const notificationService = {
    scheduleTaskReminder: (task, _cb, options) => notifications.push(['schedule', task.id, options || {}]),
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

test('toDate parses date-only strings as local midnight regardless of timezone', () => {
  const parsed = taskTime.toDate('2026-09-19');
  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 8);
  assert.equal(parsed.getDate(), 19);
  assert.equal(parsed.getHours(), 0);
  assert.equal(taskTime.localDateKey(parsed), '2026-09-19');
});

test('notification service skips expired relative reminders but keeps legacy absolute restore', async () => {
  const NotificationService = require('../src/infrastructure/notification/notification-service');
  const service = new NotificationService();
  const fired = [];

  const relativeTask = new Task({
    id: 'rel',
    content: '相对提醒已过期',
    scheduledStartAt: new Date(Date.now() - 60 * 60 * 1000),
    reminderPolicy: { mode: 'relative', minutesBefore: 30 },
    reminderTime: new Date(Date.now() - 90 * 60 * 1000)
  });
  service.scheduleTaskReminder(relativeTask, (task) => fired.push(task.id));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(fired, [], '过期的相对提醒不应立即触发');
  assert.equal(service.hasScheduledReminder('rel'), false);

  const legacyTask = new Task({
    id: 'legacy',
    content: '旧绝对提醒已过期',
    reminderTime: new Date(Date.now() - 60 * 60 * 1000)
  });
  service.scheduleTaskReminder(legacyTask, (task) => fired.push(task.id));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(fired, ['legacy'], '旧绝对提醒恢复保持立即触发');

  service.clearAllSchedules();
});

test('notification service honors skipPast for virtual instance reminders', async () => {
  const NotificationService = require('../src/infrastructure/notification/notification-service');
  const service = new NotificationService();
  const fired = [];

  const virtualInstance = new Task({
    id: 'recurringTask_series_2026-09-19',
    content: '虚拟实例',
    reminderTime: new Date(Date.now() - 30 * 1000),
    reminderPolicy: { mode: 'absolute', minutesBefore: null }
  });
  service.scheduleTaskReminder(virtualInstance, (task) => fired.push(task.id), { skipPast: true });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(fired, [], 'skipPast 时过期提醒不触发');
});

test('expired relative reminder produces a missed warning instead of failing the update', async () => {
  const { useCases } = setup();
  const start = new Date(Date.now() + 5 * 60 * 1000);
  const created = await useCases.createTask({
    content: '马上开始',
    scheduledStartAt: start.toISOString(),
    reminderPolicy: { mode: 'relative', minutesBefore: 30 }
  });
  assert.match(created.timeWarning, /提醒已错过/);
  assert.ok(new Date(created.reminderTime).getTime() < Date.now(), '相对提醒时间被推导为过去');
});

test('updating a recurring series keeps the relative policy instead of overwriting it', async () => {
  const { taskService } = setup();
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);

  const created = await taskService.createTaskInList('每日晨会', 0, undefined, {
    scheduledStartAt: start,
    reminderPolicy: { mode: 'relative', minutesBefore: 10 },
    recurrence: { type: 'daily', interval: 1, reminderTime: '08:00' }
  });
  assert.equal(created.reminderPolicy.mode, 'relative');

  const updated = await taskService.updateRecurringTask(created.id, { content: '每日晨会（改）' }, {
    type: 'daily',
    interval: 1,
    reminderTime: '08:00'
  });
  assert.equal(updated.reminderPolicy.mode, 'relative', '系列提醒时间不应覆盖相对策略');
  assert.equal(updated.reminderPolicy.minutesBefore, 10);
});

test('materializing a recurring instance preserves schedule, deadline and reminder policy', async () => {
  const { taskService } = setup();
  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const due = new Date(start);
  due.setDate(due.getDate() + 1);
  const dueDate = taskTime.localDateKey(due);

  const template = await taskService.createTaskInList('跨天任务', 0, undefined, {
    scheduledStartAt: start,
    scheduledEndAt: end,
    dueDate,
    dueTime: '18:00',
    reminderPolicy: { mode: 'relative', minutesBefore: 15 },
    recurrence: { type: 'daily', interval: 1 }
  });

  const occurrence = taskTime.localDateKey(start);
  const result = await taskService.updateRecurringInstance(template.id, occurrence, {
    content: '跨天任务（改内容）'
  });

  const instance = result.task;
  assert.equal(instance.seriesId, template.id);
  assert.equal(instance.content, '跨天任务（改内容）');
  assert.equal(taskTime.localDateKey(instance.scheduledStartAt), occurrence);
  assert.equal(instance.scheduledStartAt.getHours(), 10);
  assert.equal(instance.scheduledEndAt.getHours(), 11);
  assert.equal(instance.dueDate, dueDate);
  assert.equal(instance.dueTime, '18:00');
  assert.equal(instance.reminderPolicy.mode, 'relative');
  assert.equal(instance.reminderPolicy.minutesBefore, 15);
});

test('completing a virtual instance materializes it with time fields intact', async () => {
  const { taskService } = setup();
  const start = new Date();
  start.setDate(start.getDate() + 3);
  start.setHours(8, 30, 0, 0);

  const template = await taskService.createTaskInList('晨跑', 0, undefined, {
    scheduledStartAt: start,
    recurrence: { type: 'daily', interval: 1 }
  });

  // 与渲染层一致：从展开结果中取该实例的 occurrenceDate 传回
  const rangeStart = new Date(start);
  rangeStart.setDate(rangeStart.getDate() - 1);
  const rangeEnd = new Date(start);
  rangeEnd.setDate(rangeEnd.getDate() + 1);
  const instances = await taskService.expandRecurringTasks(rangeStart, rangeEnd, null);
  const target = instances.find((instance) => taskTime.localDateKey(instance.occurrenceDate) === taskTime.localDateKey(start));
  assert.ok(target, '展开结果中应包含目标实例');

  await taskService.completeRecurringInstance(template.id, target.occurrenceDate);

  const override = await taskService.taskRepository.findOverrideInstance(template.id, target.occurrenceDate);
  assert.ok(override, '应生成覆盖实例');
  assert.equal(override.status, 'done');
  assert.equal(override.scheduledStartAt.getHours(), 8);
  assert.equal(override.scheduledStartAt.getMinutes(), 30);
});

test('expansion suppresses virtual instances that already have overrides', async () => {
  const { taskService } = setup();
  const start = new Date();
  start.setDate(start.getDate() + 4);
  start.setHours(10, 0, 0, 0);

  const template = await taskService.createTaskInList('周报', 0, undefined, {
    scheduledStartAt: start,
    recurrence: { type: 'daily', interval: 1 }
  });

  const rangeStart = new Date(start);
  rangeStart.setDate(rangeStart.getDate() - 1);
  const rangeEnd = new Date(start);
  rangeEnd.setDate(rangeEnd.getDate() + 5);

  const before = await taskService.expandRecurringTasks(rangeStart, rangeEnd, null);
  const occurrence = taskTime.localDateKey(start);
  assert.ok(before.some((instance) => taskTime.localDateKey(instance.occurrenceDate) === occurrence));

  await taskService.completeRecurringInstance(template.id, occurrence);

  const after = await taskService.expandRecurringTasks(rangeStart, rangeEnd, null);
  assert.ok(
    !after.some((instance) => taskTime.localDateKey(instance.occurrenceDate) === occurrence),
    '已物化的发生日期不应再返回虚拟实例'
  );
});

test('marking a task done through updateTask cancels its reminder', async () => {
  const { useCases, notifications } = setup();
  const created = await useCases.createTask({
    content: '待完成',
    reminderTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
  assert.ok(notifications.some(([kind]) => kind === 'schedule'));

  notifications.length = 0;
  await useCases.updateTask(created.id, { status: 'done' });
  assert.ok(notifications.some(([kind, id]) => kind === 'cancel' && id === created.id), '完成时应取消提醒');
  assert.ok(!notifications.some(([kind]) => kind === 'schedule'), '完成后不应再注册提醒');
});

test('next recurring instance registers its reminder through the scheduler hook', async () => {
  const { taskService } = setup();
  const scheduled = [];
  taskService.setNotificationScheduler((task) => scheduled.push(task.id));

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);

  const template = await taskService.createTaskInList('日报', 0, undefined, {
    scheduledStartAt: start,
    reminderPolicy: { mode: 'relative', minutesBefore: 5 },
    recurrence: { type: 'daily', interval: 1 }
  });

  await taskService.completeTask(template.id);
  assert.equal(scheduled.length, 1, '下一实例应通过钩子注册提醒');
});

test('virtual instance ids use the local date key and stay reconstructable', () => {
  const date = new Date(2026, 8, 19, 10, 0, 0, 0);
  const id = RecurringTaskService.virtualInstanceId('series1', date);
  assert.equal(id, 'recurringTask_series1_2026-09-19');

  const keyFromIso = RecurringTaskService.instanceKey('series1', date.toISOString());
  const keyFromDate = RecurringTaskService.instanceKey('series1', date);
  const keyFromDateOnly = RecurringTaskService.instanceKey('series1', '2026-09-19');
  assert.equal(keyFromIso, keyFromDate);
  assert.equal(keyFromDate, keyFromDateOnly);
});

test('weekly/monthly/yearly recurrence includes the creation day regardless of creation time', () => {
  const created = new Date(2026, 9, 13, 22, 5);
  for (const recurrence of [
    { type: 'weekly', daysOfWeek: [2] },
    { type: 'monthly', byMonthDay: [13] },
    { type: 'yearly', byMonth: [10], byMonthDay: [13] }
  ]) {
    const template = new Task({ id: 'same-day', content: '当天重复', createdAt: created, recurrence });
    const instances = RecurringTaskService.expandRecurringTask(template, new Date(2026, 9, 13), new Date(2026, 9, 13, 23, 59, 59));
    assert.equal(instances.length, 1, recurrence.type);
    assert.equal(taskTime.localDateKey(instances[0].occurrenceDate), '2026-10-13');
  }
});

test('recurring deadline time without schedule applies on each occurrence day', () => {
  const template = new Task({ id: 'deadline-only', content: '截止时刻', createdAt: new Date(2026, 9, 13, 22), recurrence: { type: 'daily', dueTime: '23:00' }, dueDate: '2026-10-13', dueTime: '23:00' });
  const next = template.createInstance(new Date(2026, 9, 20), 'next');
  assert.equal(next.dueDate, '2026-10-20');
  assert.equal(next.dueTime, '23:00');
  assert.equal(next.scheduledStartAt, null);
});

test('series time edits update future materialized occurrences and preserve completed history', async () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setHours(9);
  const dueDate = taskTime.localDateKey(today);
  const template = new Task({ id: 'series-times', content: '系列时刻', createdAt: today, scheduledStartAt: start, dueDate, dueTime: '18:00', recurrence: { type: 'daily' } });
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const future = template.createInstance(tomorrow, 'future-override');
  future.metadata = { note: '保留实例备注' };
  const completed = template.createInstance(today, 'completed-history'); completed.status = 'done';
  const { taskService, repo } = setup([template, future, completed]);
  const updatedStart = new Date(today); updatedStart.setHours(10, 30);
  await taskService.updateRecurringTask(template.id, { scheduledStartAt: updatedStart, scheduledEndAt: null, dueDate, dueTime: '20:00' }, template.recurrence);
  const updated = await repo.findById(future.id);
  assert.equal(updated.scheduledStartAt.getHours(), 10);
  assert.equal(updated.scheduledStartAt.getMinutes(), 30);
  assert.equal(taskTime.localDateKey(updated.scheduledStartAt), taskTime.localDateKey(tomorrow));
  assert.equal(updated.dueTime, '20:00');
  assert.equal(updated.metadata.note, '保留实例备注');
  assert.equal(completed.scheduledStartAt.getHours(), 9);
  assert.equal(completed.dueTime, '18:00');
});
