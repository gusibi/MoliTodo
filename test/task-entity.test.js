const test = require('node:test');
const assert = require('node:assert/strict');
const Task = require('../src/domain/entities/task');

function makeTask(overrides = {}) {
  return new Task({
    id: 'task-1',
    content: '测试任务',
    status: 'todo',
    createdAt: new Date(2026, 6, 30, 9, 0),
    timeTracking: {},
    listId: 0,
    metadata: {},
    ...overrides
  });
}

test('Task normalizes a legacy ISO deadline into date + time', () => {
  const legacy = new Date(2026, 7, 1, 23, 59).toISOString();
  const task = makeTask({ dueDate: legacy });
  assert.equal(task.dueDate, '2026-08-01');
  assert.equal(task.dueTime, '23:59');
  assert.equal(task.deadlineInvalid, false);
});

test('Task keeps an invalid legacy deadline without blocking load', () => {
  const task = makeTask({ dueDate: 'not-a-date' });
  assert.equal(task.dueDate, 'not-a-date');
  assert.equal(task.deadlineInvalid, true);
});

test('setSchedule enforces range and clearSchedule removes both ends', () => {
  const task = makeTask();
  task.setSchedule(new Date(2026, 7, 1, 10, 0), new Date(2026, 7, 1, 11, 0));
  assert.equal(task.scheduledStartAt.getHours(), 10);
  assert.equal(task.scheduledEndAt.getHours(), 11);

  assert.throws(() => task.setSchedule(null, new Date(2026, 7, 1, 11, 0)), /必须先设置计划开始时间/);

  task.clearSchedule();
  assert.equal(task.scheduledStartAt, null);
  assert.equal(task.scheduledEndAt, null);
});

test('relative reminder recomputes when the schedule changes and disables on clear', () => {
  const task = makeTask();
  task.setSchedule(new Date(2026, 7, 1, 10, 0));
  task.setReminderPolicy({ mode: 'relative', minutesBefore: 10 });
  assert.equal(task.reminderTime.getTime(), new Date(2026, 7, 1, 9, 50).getTime());

  task.setSchedule(new Date(2026, 7, 1, 14, 0));
  assert.equal(task.reminderTime.getTime(), new Date(2026, 7, 1, 13, 50).getTime());

  task.clearSchedule();
  assert.equal(task.reminderPolicy.mode, 'disabled');
  assert.equal(task.reminderTime, null);
});

test('setDeadline and clearDeadline manage the date/time pair', () => {
  const task = makeTask();
  task.setDeadline('2026-08-03', '18:00');
  assert.equal(task.dueDate, '2026-08-03');
  assert.equal(task.dueTime, '18:00');

  task.setDeadline('2026-08-03', null);
  assert.equal(task.dueTime, null);

  task.clearDeadline();
  assert.equal(task.dueDate, null);
  assert.equal(task.dueTime, null);
});

test('Task serialization round-trips all time fields', () => {
  const task = makeTask({
    dueDate: '2026-08-03',
    dueTime: '18:00',
    scheduledStartAt: new Date(2026, 7, 1, 10, 0),
    scheduledEndAt: new Date(2026, 7, 1, 11, 30),
    reminderPolicy: { mode: 'relative', minutesBefore: 5 },
    reminderTime: new Date(2026, 7, 1, 9, 55)
  });

  const restored = Task.fromJSON(task.toJSON());
  assert.equal(restored.dueDate, '2026-08-03');
  assert.equal(restored.dueTime, '18:00');
  assert.equal(restored.scheduledStartAt.toISOString(), task.scheduledStartAt.toISOString());
  assert.equal(restored.scheduledEndAt.toISOString(), task.scheduledEndAt.toISOString());
  assert.deepEqual(restored.reminderPolicy, { mode: 'relative', minutesBefore: 5 });
  assert.equal(restored.reminderTime.toISOString(), task.reminderTime.toISOString());
});

test('a reminder-only task is still an inbox task but not planned', () => {
  const task = makeTask({ reminderTime: new Date(2026, 7, 1, 9, 0) });
  assert.equal(task.isInboxTask(), true);
  assert.equal(task.isPlannedTask(), false);
  assert.equal(task.isUnscheduledTask(), true);
});

test('createInstance generates schedule, deadline and relative reminder from the template', () => {
  const template = makeTask({
    scheduledStartAt: new Date(2026, 7, 1, 10, 0),
    scheduledEndAt: new Date(2026, 7, 1, 11, 30),
    dueDate: '2026-08-02',
    dueTime: '18:00',
    reminderPolicy: { mode: 'relative', minutesBefore: 10 }
  });
  template.recurrence = { type: 'daily', interval: 1 };

  const instance = template.createInstance(new Date(2026, 7, 5), 'instance-1');
  assert.equal(instance.scheduledStartAt.getFullYear(), 2026);
  assert.equal(instance.scheduledStartAt.getMonth(), 7);
  assert.equal(instance.scheduledStartAt.getDate(), 5);
  assert.equal(instance.scheduledStartAt.getHours(), 10);
  assert.equal(instance.scheduledEndAt.getDate(), 5);
  assert.equal(instance.scheduledEndAt.getHours(), 11);
  assert.equal(instance.dueDate, '2026-08-06');
  assert.equal(instance.dueTime, '18:00');
  assert.deepEqual(instance.reminderPolicy, { mode: 'relative', minutesBefore: 10 });
  assert.equal(instance.reminderTime.getHours(), 9);
  assert.equal(instance.reminderTime.getMinutes(), 50);
});

test('createInstance does not invent a deadline for a legacy date-only series', () => {
  const template = makeTask({ reminderTime: new Date(2026, 7, 1, 9, 0) });
  template.recurrence = { type: 'daily', interval: 1, reminderTime: '09:00' };

  const instance = template.createInstance(new Date(2026, 7, 5), 'instance-2');
  assert.equal(instance.scheduledStartAt, null);
  assert.equal(instance.dueDate, null);
  assert.equal(instance.occurrenceDate.toISOString(), new Date(2026, 7, 5).toISOString());
  assert.equal(instance.reminderTime.getHours(), 9);
  assert.equal(instance.reminderTime.getMinutes(), 0);
});

test('createInstance of a legacy series never invents a deadline even when the template has one', () => {
  const template = makeTask({ dueDate: '2026-08-01', dueTime: '18:00' });
  template.recurrence = { type: 'daily', interval: 1 };

  const instance = template.createInstance(new Date(2026, 7, 5), 'instance-3');
  assert.equal(instance.scheduledStartAt, null);
  assert.equal(instance.dueDate, null);
  assert.equal(instance.dueTime, null);
});
