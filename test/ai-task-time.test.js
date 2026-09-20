const test = require('node:test');
const assert = require('node:assert/strict');
const { AIService } = require('../src/infrastructure/ai/ai-service');

test('AI post-processing maps occurrence phrases to schedule', () => {
  const [task] = AIService.normalizeGeneratedTasks([
    { content: '明天10点写周报', scheduledStartAt: '2026-09-20T10:00:00+08:00' }
  ]);
  assert.equal(task.content, '明天10点写周报');
  assert.equal(task.scheduledStartAt, new Date('2026-09-20T10:00:00+08:00').toISOString());
  assert.equal(task.dueDate, null);
  assert.equal(task.reminderPolicy, null);
});

test('AI post-processing keeps schedule ranges', () => {
  const [task] = AIService.normalizeGeneratedTasks([
    {
      content: '10到11点开会',
      scheduledStartAt: '2026-09-20T10:00:00+08:00',
      scheduledEndAt: '2026-09-20T11:00:00+08:00'
    }
  ]);
  assert.equal(task.scheduledEndAt, new Date('2026-09-20T11:00:00+08:00').toISOString());
});

test('AI post-processing maps "before X" phrases to a date-only deadline', () => {
  const [task] = AIService.normalizeGeneratedTasks([
    { content: '周五前提交', dueDate: '2026-09-25' }
  ]);
  assert.equal(task.dueDate, '2026-09-25');
  assert.equal(task.dueTime, null);
  assert.equal(task.scheduledStartAt, null);
  assert.equal(task.reminderPolicy, null);
});

test('AI post-processing maps an explicit reminder to a relative policy', () => {
  const [task] = AIService.normalizeGeneratedTasks([
    {
      content: '10点开会，提前10分钟提醒',
      scheduledStartAt: '2026-09-20T10:00:00+08:00',
      reminderPolicy: { mode: 'relative', minutesBefore: 10 }
    }
  ]);
  assert.deepEqual(task.reminderPolicy, { mode: 'relative', minutesBefore: 10 });
});

test('AI post-processing does not turn a deadline into a reminder', () => {
  const [task] = AIService.normalizeGeneratedTasks([
    { content: '有截止也有提醒', dueDate: '2026-09-25', reminderTime: '2026-09-25T08:00:00+08:00' }
  ]);
  assert.equal(task.dueDate, '2026-09-25');
  assert.equal(task.dueTime, null);
  assert.deepEqual(task.reminderPolicy, { mode: 'absolute', minutesBefore: null });
  assert.equal(task.reminderTime, '2026-09-25T08:00:00+08:00');
});

test('AI post-processing leaves an unscheduled task without invented time', () => {
  const [task] = AIService.normalizeGeneratedTasks([{ content: '明天做' }]);
  assert.equal(task.scheduledStartAt, null);
  assert.equal(task.scheduledEndAt, null);
  assert.equal(task.dueDate, null);
  assert.equal(task.dueTime, null);
  assert.equal(task.reminderPolicy, null);
});

test('AI post-processing normalizes a legacy ISO deadline', () => {
  const legacy = new Date(2026, 8, 25, 23, 59).toISOString();
  const [task] = AIService.normalizeGeneratedTasks([{ content: '旧截止', dueDate: legacy }]);
  assert.equal(task.dueDate, '2026-09-25');
  assert.equal(task.dueTime, '23:59');
});

test('AI post-processing drops a relative policy that also carries an absolute time', () => {
  const [task] = AIService.normalizeGeneratedTasks([{
    content: '开会',
    scheduledStartAt: '2026-09-20T10:00:00+08:00',
    reminderPolicy: { mode: 'relative', minutesBefore: 10 },
    reminderTime: '2026-09-20T09:00:00+08:00'
  }]);
  assert.deepEqual(task.reminderPolicy, { mode: 'relative', minutesBefore: 10 });
  assert.equal(task.reminderTime, undefined, '相对策略不携带绝对提醒时间');
});

test('AI post-processing drops an absolute policy without a reminder time', () => {
  const [task] = AIService.normalizeGeneratedTasks([{
    content: '绝对提醒缺时间',
    reminderPolicy: { mode: 'absolute', minutesBefore: null }
  }]);
  assert.equal(task.reminderPolicy, null);
  assert.equal(task.reminderTime, undefined);
});

test('AI post-processing keeps only the start when the end precedes it', () => {
  const [task] = AIService.normalizeGeneratedTasks([{
    content: '区间非法',
    scheduledStartAt: '2026-09-20T15:00:00+08:00',
    scheduledEndAt: '2026-09-20T14:00:00+08:00'
  }]);
  assert.ok(task.scheduledStartAt);
  assert.equal(task.scheduledEndAt, null);
});

test('AI post-processing drops a reminder time that is already in the past', () => {
  const [task] = AIService.normalizeGeneratedTasks([{
    content: '过期提醒',
    reminderTime: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  }]);
  assert.equal(task.reminderPolicy, null);
  assert.equal(task.reminderTime, undefined);
});
