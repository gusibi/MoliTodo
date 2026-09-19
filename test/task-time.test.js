const test = require('node:test');
const assert = require('node:assert/strict');
const time = require('../src/domain/services/task-time');

function localIso(year, month, day, hours = 0, minutes = 0, seconds = 0) {
  return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
}

test('normalizeDeadline keeps date-only deadlines without a fake time', () => {
  assert.deepEqual(time.normalizeDeadline('2026-08-01', null), {
    dueDate: '2026-08-01',
    dueTime: null
  });
  assert.deepEqual(time.normalizeDeadline('2026-08-01', '18:30'), {
    dueDate: '2026-08-01',
    dueTime: '18:30'
  });
  assert.deepEqual(time.normalizeDeadline('2026-08-01', '9:05'), {
    dueDate: '2026-08-01',
    dueTime: '09:05'
  });
});

test('normalizeDeadline extracts local date and keeps the expressed time from legacy ISO', () => {
  const legacy = localIso(2026, 8, 1, 23, 59);
  const result = time.normalizeDeadline(legacy, null);
  assert.equal(result.dueDate, '2026-08-01');
  assert.equal(result.dueTime, '23:59');
  assert.equal(result.legacy, true);
});

test('normalizeDeadline prefers an explicit time over the legacy ISO time', () => {
  const legacy = localIso(2026, 8, 1, 23, 59);
  const result = time.normalizeDeadline(legacy, '09:00');
  assert.equal(result.dueDate, '2026-08-01');
  assert.equal(result.dueTime, '09:00');
});

test('normalizeDeadline rejects a time without a date and invalid values', () => {
  assert.throws(() => time.normalizeDeadline(null, '10:00'), /截止时间必须搭配截止日期/);
  assert.throws(() => time.normalizeDeadline('2026/08/01', null), /截止日期格式无效/);
  assert.throws(() => time.normalizeDeadline('2026-08-01', '25:00'), /截止时间格式无效/);
});

test('deadlineBoundary uses the next local midnight for a date-only deadline', () => {
  const boundary = time.deadlineBoundary('2026-08-01', null);
  assert.equal(boundary.getFullYear(), 2026);
  assert.equal(boundary.getMonth(), 7);
  assert.equal(boundary.getDate(), 2);
  assert.equal(boundary.getHours(), 0);
  assert.equal(boundary.getMinutes(), 0);
});

test('deadlineBoundary uses the exact instant for a timed deadline', () => {
  const boundary = time.deadlineBoundary('2026-08-01', '18:30');
  assert.equal(boundary.getFullYear(), 2026);
  assert.equal(boundary.getMonth(), 7);
  assert.equal(boundary.getDate(), 1);
  assert.equal(boundary.getHours(), 18);
  assert.equal(boundary.getMinutes(), 30);
});

test('isOverdue only triggers after the deadline boundary and ignores completed tasks', () => {
  const dateOnly = { status: 'todo', dueDate: '2026-08-01', dueTime: null };
  assert.equal(time.isOverdue(dateOnly, new Date(2026, 7, 1, 23, 59)), false);
  assert.equal(time.isOverdue(dateOnly, new Date(2026, 7, 2, 0, 0)), true);

  const timed = { status: 'todo', dueDate: '2026-08-01', dueTime: '18:30' };
  assert.equal(time.isOverdue(timed, new Date(2026, 7, 1, 18, 29)), false);
  assert.equal(time.isOverdue(timed, new Date(2026, 7, 1, 18, 30)), true);

  const done = { status: 'done', dueDate: '2020-01-01', dueTime: null };
  assert.equal(time.isOverdue(done, new Date(2026, 7, 2)), false);
});

test('normalizeSchedule enforces a valid range and requires a concrete time', () => {
  const normalized = time.normalizeSchedule(localIso(2026, 8, 1, 10), localIso(2026, 8, 1, 11));
  assert.equal(normalized.scheduledStartAt.getHours(), 10);
  assert.equal(normalized.scheduledEndAt.getHours(), 11);

  assert.throws(() => time.normalizeSchedule(null, localIso(2026, 8, 1, 11)), /必须先设置计划开始时间/);
  assert.throws(
    () => time.normalizeSchedule(localIso(2026, 8, 1, 11), localIso(2026, 8, 1, 10)),
    /计划结束时间不能早于计划开始时间/
  );
  assert.throws(() => time.normalizeSchedule('2026-08-01', null), /必须包含具体时刻/);
});

test('normalizeReminderPolicy validates each mode', () => {
  assert.deepEqual(time.normalizeReminderPolicy({ mode: 'disabled' }, null, null), {
    mode: 'disabled',
    minutesBefore: null
  });
  assert.deepEqual(time.normalizeReminderPolicy({ mode: 'default' }, null, null), {
    mode: 'default',
    minutesBefore: null
  });

  const start = localIso(2026, 8, 1, 10);
  assert.deepEqual(time.normalizeReminderPolicy({ mode: 'relative', minutesBefore: 10 }, null, start), {
    mode: 'relative',
    minutesBefore: 10
  });

  assert.throws(
    () => time.normalizeReminderPolicy({ mode: 'relative', minutesBefore: 10 }, null, null),
    /相对提醒需要先设置计划开始时间/
  );
  assert.throws(
    () => time.normalizeReminderPolicy({ mode: 'relative', minutesBefore: 10 }, localIso(2026, 8, 1, 9), start),
    /不能同时传入绝对提醒时间/
  );
  assert.throws(
    () => time.normalizeReminderPolicy({ mode: 'absolute' }, null, start),
    /绝对提醒需要提供提醒时间/
  );
  assert.throws(() => time.normalizeReminderPolicy({ mode: 'nope' }, null, null), /未知的提醒策略/);
});

test('deriveReminderTime computes relative reminders from the schedule start', () => {
  const start = localIso(2026, 8, 1, 10, 0);
  const relative = {
    scheduledStartAt: start,
    reminderPolicy: { mode: 'relative', minutesBefore: 10 }
  };
  assert.equal(time.deriveReminderTime(relative).getTime(), new Date(2026, 7, 1, 9, 50).getTime());

  const atStart = {
    scheduledStartAt: start,
    reminderPolicy: { mode: 'relative', minutesBefore: 0 }
  };
  assert.equal(time.deriveReminderTime(atStart).getTime(), new Date(2026, 7, 1, 10, 0).getTime());

  const absolute = {
    reminderTime: localIso(2026, 8, 1, 8, 0),
    reminderPolicy: { mode: 'absolute' }
  };
  assert.equal(time.deriveReminderTime(absolute).getTime(), new Date(2026, 7, 1, 8, 0).getTime());

  const legacy = { reminderTime: localIso(2026, 8, 1, 8, 0), reminderPolicy: null };
  assert.equal(time.deriveReminderTime(legacy).getTime(), new Date(2026, 7, 1, 8, 0).getTime());

  const defaults = { reminderTime: localIso(2026, 8, 1, 8, 0), reminderPolicy: { mode: 'disabled' } };
  assert.equal(time.deriveReminderTime(defaults), null);
});

test('getMainDateInfo prefers schedule over deadline and ignores reminder-only tasks', () => {
  const withSchedule = {
    scheduledStartAt: localIso(2026, 8, 1, 10),
    dueDate: '2026-08-03',
    dueTime: null
  };
  assert.deepEqual(
    { date: time.getMainDateInfo(withSchedule).date, kind: time.getMainDateInfo(withSchedule).kind },
    { date: '2026-08-01', kind: 'schedule' }
  );

  const deadlineOnly = { dueDate: '2026-08-03', dueTime: '12:00' };
  assert.deepEqual(
    { date: time.getMainDateInfo(deadlineOnly).date, kind: time.getMainDateInfo(deadlineOnly).kind },
    { date: '2026-08-03', kind: 'deadline' }
  );

  const reminderOnly = { reminderTime: localIso(2026, 8, 1, 9) };
  assert.equal(time.getMainDateInfo(reminderOnly), null);

  const legacyRecurring = {
    seriesId: 's1',
    occurrenceDate: localIso(2026, 8, 1),
    scheduledStartAt: null
  };
  assert.deepEqual(
    { date: time.getMainDateInfo(legacyRecurring).date, kind: time.getMainDateInfo(legacyRecurring).kind },
    { date: '2026-08-01', kind: 'schedule' }
  );
});

test('categories follow schedule/deadline semantics and ignore reminders', () => {
  const inbox = { status: 'todo', reminderTime: localIso(2026, 8, 1, 9) };
  assert.equal(time.isTaskInbox(inbox), true);
  assert.equal(time.isTaskPlanned(inbox), false);
  assert.equal(time.isTaskUnscheduled(inbox), true);

  const planned = { status: 'todo', dueDate: '2026-08-01', dueTime: null };
  assert.equal(time.isTaskInbox(planned), false);
  assert.equal(time.isTaskPlanned(planned), true);
  assert.equal(time.isTaskUnscheduled(planned), false);

  const pausedUnscheduled = { status: 'paused' };
  assert.equal(time.isTaskUnscheduled(pausedUnscheduled), true);
  assert.equal(time.isTaskInbox(pausedUnscheduled), false);

  const completed = { status: 'done', dueDate: '2026-08-01', dueTime: null };
  assert.equal(time.isTaskPlanned(completed), false);
  assert.equal(time.isTaskUnscheduled(completed), false);
});

test('date-only deadlines keep their local calendar date regardless of timezone', () => {
  const info = time.getMainDateInfo({ dueDate: '2026-08-01', dueTime: null });
  assert.equal(info.date, '2026-08-01');
  assert.equal(info.kind, 'deadline');
  assert.equal(readableLocalDate(info.at), '2026-08-01');
});

function readableLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('isTaskToday includes today schedule, today deadline, overdue, past schedule and doing', () => {
  const now = new Date(2026, 7, 2, 10, 0);

  assert.equal(time.isTaskToday({ status: 'todo', scheduledStartAt: localIso(2026, 8, 2, 9) }, now), true);
  assert.equal(time.isTaskToday({ status: 'todo', dueDate: '2026-08-02', dueTime: null }, now), true);
  assert.equal(time.isTaskToday({ status: 'todo', dueDate: '2026-08-01', dueTime: null }, now), true);
  assert.equal(time.isTaskToday({ status: 'todo', scheduledStartAt: localIso(2026, 8, 1, 9) }, now), true);
  assert.equal(time.isTaskToday({ status: 'doing' }, now), true);

  assert.equal(time.isTaskToday({ status: 'todo', scheduledStartAt: localIso(2026, 8, 5, 9) }, now), false);
  assert.equal(time.isTaskToday({ status: 'done', scheduledStartAt: localIso(2026, 8, 2, 9) }, now), false);
  assert.equal(time.isTaskToday({ status: 'todo', reminderTime: localIso(2026, 8, 2, 9) }, now), false);
});
