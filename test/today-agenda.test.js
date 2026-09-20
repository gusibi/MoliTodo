const test = require('node:test');
const assert = require('node:assert/strict');
const agenda = require('../src/domain/services/today-agenda');
const taskTime = require('../src/domain/services/task-time');

/**
 * issue #14 Today 综合视图的页面协调规则：
 * - 实例身份合并：物化实例覆盖虚拟实例，头行覆盖同日虚拟实例，幻影实例丢弃
 * - 分组优先级沿用 #13：截止逾期 > 过去安排 > 今天；doing 进今天；无日期非 doing 进未计划
 * - 日历点按主日期唯一计数
 * - 日期范围合并与缺口计算
 */

const TODAY = '2026-09-19';
const TOMORROW = '2026-09-20';
const YESTERDAY = '2026-09-18';
const DAY_AFTER = '2026-09-21';

function nowAt(key, hours = 12) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hours, 0, 0, 0);
}

function plainTask(overrides = {}) {
  return {
    id: 't1',
    content: '任务',
    status: 'todo',
    createdAt: `${YESTERDAY}T09:00:00`,
    completedAt: null,
    listId: 0,
    dueDate: null,
    dueTime: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    seriesId: null,
    occurrenceDate: null,
    recurrence: null,
    ...overrides
  };
}

function virtualInstance(overrides = {}) {
  return plainTask({
    id: `recurringTask_s1_${overrides.occurrenceDate ? overrides.occurrenceDate.slice(0, 10) : TODAY}`,
    seriesId: 's1',
    ...overrides
  });
}

test('instanceKey: 物化实例与同日虚拟实例同键，头行与自身发生日虚拟实例同键', () => {
  const materialized = plainTask({ id: 'm1', seriesId: 's1', occurrenceDate: `${TOMORROW}T00:00:00` });
  const virtual = virtualInstance({ occurrenceDate: `${TOMORROW}T00:00:00` });
  assert.equal(agenda.instanceKey(materialized), agenda.instanceKey(virtual));

  const head = plainTask({ id: 's1', recurrence: { type: 'daily' }, scheduledStartAt: `${TODAY}T10:00:00` });
  const headVirtual = virtualInstance({ occurrenceDate: `${TODAY}T00:00:00`, scheduledStartAt: `${TODAY}T10:00:00` });
  assert.equal(agenda.instanceKey(head), agenda.instanceKey(headVirtual));

  assert.equal(agenda.instanceKey(plainTask({ id: 'x9' })), 'task:x9');
});

test('mergeTaskWorld: 物化实例覆盖虚拟实例，同一实例只出现一次', () => {
  const materialized = plainTask({ id: 'm1', seriesId: 's1', occurrenceDate: `${TOMORROW}T00:00:00`, status: 'done' });
  const virtual = virtualInstance({ occurrenceDate: `${TOMORROW}T00:00:00` });
  const { instances } = agenda.mergeTaskWorld({ baseTasks: [materialized], virtualInstances: [virtual] });
  const atTomorrow = instances.filter((t) => agenda.instanceKey(t) === agenda.instanceKey(materialized));
  assert.equal(atTomorrow.length, 1);
  assert.equal(atTomorrow[0].id, 'm1');
});

test('mergeTaskWorld: 头行覆盖其发生日的虚拟实例（保留进行状态）', () => {
  const head = plainTask({
    id: 's1',
    recurrence: { type: 'daily' },
    scheduledStartAt: `${TODAY}T10:00:00`,
    status: 'doing'
  });
  const headVirtual = virtualInstance({ occurrenceDate: `${TODAY}T00:00:00`, scheduledStartAt: `${TODAY}T10:00:00` });
  const futureVirtual = virtualInstance({ occurrenceDate: `${DAY_AFTER}T00:00:00`, scheduledStartAt: `${DAY_AFTER}T10:00:00` });
  const { instances } = agenda.mergeTaskWorld({ baseTasks: [head], virtualInstances: [headVirtual, futureVirtual] });
  const keys = instances.map((t) => agenda.instanceKey(t));
  assert.equal(instances.length, 2);
  assert.ok(instances.some((t) => t.id === 's1' && t.status === 'doing'));
  assert.ok(instances.some((t) => t.id === futureVirtual.id));
  assert.equal(keys.filter((k) => k === `rec:s1:${TODAY}`).length, 1);
});

test('mergeTaskWorld: 早于系列首次发生的幻影虚拟实例被丢弃', () => {
  const head = plainTask({
    id: 's1',
    recurrence: { type: 'daily' },
    // 系列从明天开始，但创建于今天：展开器以 createdAt 为基准可能生成今天的实例
    createdAt: `${TODAY}T09:00:00`,
    scheduledStartAt: `${TOMORROW}T10:00:00`
  });
  const phantom = virtualInstance({ occurrenceDate: `${TODAY}T00:00:00`, scheduledStartAt: `${TODAY}T10:00:00` });
  const real = virtualInstance({ occurrenceDate: `${DAY_AFTER}T00:00:00`, scheduledStartAt: `${DAY_AFTER}T10:00:00` });
  const { instances, droppedVirtual } = agenda.mergeTaskWorld({ baseTasks: [head], virtualInstances: [phantom, real] });
  assert.equal(droppedVirtual, 1);
  assert.ok(!instances.some((t) => t.id === phantom.id));
  assert.ok(instances.some((t) => t.id === real.id));
});

test('mergeTaskWorld: 头行与其物化实例同键时只保留物化实例', () => {
  const head = plainTask({
    id: 's1',
    recurrence: { type: 'daily' },
    scheduledStartAt: `${TODAY}T10:00:00`,
    status: 'doing'
  });
  const materialized = plainTask({
    id: 'm2',
    seriesId: 's1',
    occurrenceDate: `${TODAY}T00:00:00`,
    scheduledStartAt: `${TODAY}T10:00:00`,
    status: 'done',
    completed: true
  });
  const { instances } = agenda.mergeTaskWorld({ baseTasks: [head, materialized], virtualInstances: [] });
  assert.equal(instances.length, 1);
  assert.equal(instances[0].id, 'm2');
  assert.equal(instances[0].status, 'done');
});

test('mergeTaskWorld: 删除标记行不进入世界', () => {
  const deleted = plainTask({ id: 'd1', seriesId: 's1', occurrenceDate: `${TOMORROW}T00:00:00`, status: 'deleted' });
  const { instances } = agenda.mergeTaskWorld({ baseTasks: [deleted], virtualInstances: [] });
  assert.equal(instances.length, 0);
});

test('分组：今天截止但安排在明天的任务进入今天，日历点仍在明天并可定位', () => {
  const task = plainTask({ id: 'a', dueDate: TODAY, scheduledStartAt: `${TOMORROW}T10:00:00` });
  const model = agenda.buildAgendaModel({
    instances: [task],
    todayKey: TODAY,
    browsingDates: [TODAY, TOMORROW],
    now: nowAt(TODAY)
  });
  assert.equal(model.today.length, 1);
  assert.equal(model.overdue.length, 0);
  assert.equal(model.todayPendingCount, 1);

  const dots = agenda.buildCalendarDots({ instances: [task], showCompleted: false });
  assert.ok(dots.has(TOMORROW));
  assert.ok(!dots.has(TODAY));

  const tomorrowSection = model.dateSections.find((s) => s.dateKey === TOMORROW);
  assert.ok(tomorrowSection);
  assert.equal(tomorrowSection.tasks.length, 0);
  assert.equal(tomorrowSection.relocated.length, 1);
});

test('分组：无日期 doing 任务进入今天且不进入未计划', () => {
  const doing = plainTask({ id: 'b', status: 'doing' });
  const model = agenda.buildAgendaModel({
    instances: [doing],
    todayKey: TODAY,
    browsingDates: [TODAY],
    now: nowAt(TODAY)
  });
  assert.equal(model.today.length, 1);
  assert.equal(model.unplanned.length, 0);
});

test('分组：截止逾期与过去安排分开，逾期优先', () => {
  const overdueOnly = plainTask({ id: 'c1', dueDate: YESTERDAY });
  const pastScheduledOnly = plainTask({ id: 'c2', scheduledStartAt: `${YESTERDAY}T10:00:00` });
  const both = plainTask({ id: 'c3', dueDate: YESTERDAY, scheduledStartAt: `${YESTERDAY}T08:00:00` });
  const model = agenda.buildAgendaModel({
    instances: [overdueOnly, pastScheduledOnly, both],
    todayKey: TODAY,
    browsingDates: [TODAY],
    now: nowAt(TODAY)
  });
  assert.equal(model.overdue.length, 2);
  assert.equal(model.reschedule.length, 1);
  assert.ok(model.overdue.some((t) => t.id === 'c3'));
});

test('分组：doing 且安排在未来的任务进入今天', () => {
  const doing = plainTask({ id: 'd1', status: 'doing', scheduledStartAt: `${TOMORROW}T10:00:00` });
  const model = agenda.buildAgendaModel({
    instances: [doing],
    todayKey: TODAY,
    browsingDates: [TODAY, TOMORROW],
    now: nowAt(TODAY)
  });
  assert.equal(model.today.length, 1);
  assert.equal(model.todayPendingCount, 1);
});

test('分组：旧日期型重复实例按发生日进入日期区，不进入未计划', () => {
  const legacy = plainTask({
    id: 'e1',
    seriesId: 's2',
    occurrenceDate: TOMORROW,
    scheduledStartAt: null,
    dueDate: null
  });
  assert.ok(taskTime.isLegacyRecurringDateInstance(legacy));
  const model = agenda.buildAgendaModel({
    instances: [legacy],
    todayKey: TODAY,
    browsingDates: [TODAY, TOMORROW],
    now: nowAt(TODAY)
  });
  assert.equal(model.unplanned.length, 0);
  const section = model.dateSections.find((s) => s.dateKey === TOMORROW);
  assert.equal(section.tasks.length, 1);
});

test('已完成：不进入执行分组与未计划，开关打开时按主日期展示', () => {
  const completedWithDate = plainTask({
    id: 'f1',
    status: 'done',
    completed: true,
    completedAt: `${TOMORROW}T09:00:00`,
    scheduledStartAt: `${TOMORROW}T10:00:00`
  });
  const completedNoDateToday = plainTask({
    id: 'f2',
    status: 'done',
    completed: true,
    completedAt: `${TODAY}T15:00:00`
  });
  const completedHistory = plainTask({
    id: 'f3',
    status: 'done',
    completed: true,
    completedAt: `${YESTERDAY}T15:00:00`
  });

  const off = agenda.buildAgendaModel({
    instances: [completedWithDate, completedNoDateToday, completedHistory],
    todayKey: TODAY,
    browsingDates: [TODAY, TOMORROW],
    showCompleted: false,
    now: nowAt(TODAY)
  });
  assert.equal(off.todayPendingCount, 0);
  assert.equal(off.unplanned.length, 0);
  assert.equal(off.todayCompleted.length, 0);
  assert.equal(off.dateSections.find((s) => s.dateKey === TOMORROW).completedTasks.length, 0);
  assert.equal(off.overdue.length + off.reschedule.length + off.today.length, 0);

  const on = agenda.buildAgendaModel({
    instances: [completedWithDate, completedNoDateToday, completedHistory],
    todayKey: TODAY,
    browsingDates: [TODAY, TOMORROW],
    showCompleted: true,
    now: nowAt(TODAY)
  });
  assert.equal(on.dateSections.find((s) => s.dateKey === TOMORROW).completedTasks.length, 1);
  assert.equal(on.todayCompleted.length, 1);
  assert.equal(on.todayPendingCount, 0);
});

test('已完成任务不产生逾期分组', () => {
  const doneOverdue = plainTask({ id: 'g1', status: 'done', completed: true, dueDate: YESTERDAY });
  const model = agenda.buildAgendaModel({
    instances: [doneOverdue],
    todayKey: TODAY,
    browsingDates: [TODAY],
    showCompleted: true,
    now: nowAt(TODAY)
  });
  assert.equal(model.overdue.length, 0);
});

test('日历点：跨天任务只计开始日，仅提醒不产生点，按清单聚合', () => {
  const crossDay = plainTask({
    id: 'h1',
    listId: 3,
    scheduledStartAt: `${TODAY}T22:00:00`,
    scheduledEndAt: `${TOMORROW}T02:00:00`
  });
  const reminderOnly = plainTask({ id: 'h2', reminderTime: `${TOMORROW}T09:00:00` });
  const other = plainTask({ id: 'h3', listId: 3, dueDate: TOMORROW });
  const dots = agenda.buildCalendarDots({ instances: [crossDay, reminderOnly, other], showCompleted: false });
  assert.equal(dots.get(TODAY).count, 1);
  assert.ok(!dots.has(YESTERDAY));
  const tomorrow = dots.get(TOMORROW);
  assert.equal(tomorrow.count, 1);
  assert.equal(tomorrow.byList.get(3), 1);
});

test('日历点：已完成任务仅在开关打开时计点', () => {
  const done = plainTask({ id: 'i1', status: 'done', completed: true, dueDate: TOMORROW });
  const offDots = agenda.buildCalendarDots({ instances: [done], showCompleted: false });
  const onDots = agenda.buildCalendarDots({ instances: [done], showCompleted: true });
  assert.ok(!offDots.has(TOMORROW));
  assert.equal(onDots.get(TOMORROW).count, 1);
  assert.equal(onDots.get(TOMORROW).completedCount, 1);
});

test('日历点：按清单记录已完成数量，供 UI 弱化混合日期点', () => {
  const doneA = plainTask({ id: 'j1', listId: 2, status: 'done', completed: true, dueDate: TOMORROW });
  const todoA = plainTask({ id: 'j2', listId: 2, dueDate: TOMORROW });
  const doneB = plainTask({ id: 'j3', listId: 5, status: 'done', completed: true, dueDate: TOMORROW });
  const dots = agenda.buildCalendarDots({ instances: [doneA, todoA, doneB], showCompleted: true });
  const dot = dots.get(TOMORROW);
  assert.equal(dot.byList.get(2), 2);
  assert.equal(dot.completedByList.get(2), 1);
  assert.equal(dot.byList.get(5), 1);
  assert.equal(dot.completedByList.get(5), 1);
});

test('日期范围：相邻区间合并，缺口计算正确', () => {
  const merged = agenda.mergeDayRanges([
    { startKey: '2026-09-19', endKey: '2026-09-25' },
    { startKey: '2026-09-26', endKey: '2026-09-27' },
    { startKey: '2026-10-01', endKey: '2026-10-03' }
  ]);
  assert.deepEqual(
    merged.map((r) => [r.startKey, r.endKey]),
    [['2026-09-19', '2026-09-27'], ['2026-10-01', '2026-10-03']]
  );

  const spans = agenda.missingDaySpans(merged, '2026-09-20', '2026-10-02');
  assert.deepEqual(
    spans.map((s) => [s.startKey, s.endKey]),
    [['2026-09-28', '2026-09-30']]
  );

  const backfill = agenda.missingDaySpans(merged, '2026-09-15', '2026-10-05');
  assert.deepEqual(
    backfill.map((s) => [s.startKey, s.endKey]),
    [['2026-09-15', '2026-09-18'], ['2026-09-28', '2026-09-30'], ['2026-10-04', '2026-10-05']]
  );
});

test('日期范围：枚举含首尾', () => {
  assert.deepEqual(agenda.enumerateDateKeys(TODAY, TOMORROW), [TODAY, TOMORROW]);
  assert.deepEqual(agenda.enumerateDateKeys(TOMORROW, TODAY), []);
});
