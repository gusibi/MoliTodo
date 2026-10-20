const { test, expect, seedTasks } = require('./fixtures');

function localKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('当天创建的周重复任务进入今天分组', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '当天周重复', recurrence: { type: 'weekly', interval: 1, daysOfWeek: [new Date().getDay()] } }]);
  await window.reload();
  await expect(window.locator('.agenda-section-today .today-task-row', { hasText: '当天周重复' })).toBeVisible();
  await expect(window.locator('[data-agenda-section="unplanned"] .today-task-row', { hasText: '当天周重复' })).toHaveCount(0);
  const key = localKey(new Date());
  const dates = await window.evaluate(async (key) => {
    const response = await window.electronAPI.tasks.expandRecurring({ startDate: `${key}T00:00:00`, endDate: `${key}T23:59:59` });
    return response.tasks.map((task) => task.occurrenceDate);
  }, key);
  expect(dates).toHaveLength(1);
});

test('重复安排和截止仅选时刻，后续整个系列继承', async ({ app, window }) => {
  const now = new Date();
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15);
  const [id] = await seedTasks(app.electronApp, [{ content: '重复任务时间设置 Chinese English long title', scheduledStartAt: anchor.toISOString(), recurrence: { type: 'daily', interval: 1 } }]);
  await window.reload();
  const row = window.locator('.today-task-row', { hasText: '重复任务时间设置 Chinese English long title' }).first();
  await row.locator('.today-task-title').dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  await region.getByRole('button', { name: '15:00', exact: true }).click();
  const popup = window.locator('.date-picker-popup-fixed');
  await expect(popup.locator('input[type=time]')).toBeVisible();
  await expect(popup.locator('.vc-container')).toHaveCount(0);
  await window.screenshot({ path: 'test-results/recurring-time-picker-light.png', animations: 'disabled' });
  await popup.locator('input[type=time]').focus();
  await window.keyboard.press('Escape');
  await expect(popup).toBeHidden();
  await expect(region.getByRole('button', { name: '15:00', exact: true })).toBeFocused();
  await region.getByRole('button', { name: '15:00', exact: true }).click();
  await popup.locator('input[type=time]').fill('15:30');
  await expect(window.locator('.date-picker-popup-fixed')).toBeVisible();
  await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  await expect.poll(() => app.electronApp.evaluate(async ({}, id) => {
    const task = await global.__moliTodoApp.taskService.taskRepository.findById(id);
    return new Date(task.scheduledStartAt).toTimeString().slice(0, 5);
  }, id)).toBe('15:30');
  if (await popup.isVisible()) await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  if (await region.isVisible()) await region.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(region).toBeHidden();
  await row.locator('.today-task-title').dblclick();
  await region.getByRole('button', { name: /添加结束时间/ }).click();
  await popup.locator('input[type=time]').fill('16:30');
  await expect(window.locator('.date-picker-popup-fixed')).toBeVisible();
  await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  await expect.poll(() => app.electronApp.evaluate(async ({}, id) => {
    const task = await global.__moliTodoApp.taskService.taskRepository.findById(id);
    return task.scheduledEndAt?.toTimeString().slice(0, 5);
  }, id)).toBe('16:30');
  if (await popup.isVisible()) await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  if (await region.isVisible()) await region.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(region).toBeHidden();
  await row.locator('.today-task-title').dblclick();
  await region.getByRole('button', { name: '添加截止时间', exact: true }).click();
  await popup.locator('input[type=time]').fill('23:55');
  await expect.poll(() => app.electronApp.evaluate(async ({}, id) => {
    const task = await global.__moliTodoApp.taskService.taskRepository.findById(id);
    return task.dueTime;
  }, id)).toBe('23:55');
  if (await popup.isVisible()) await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  if (await region.isVisible()) await region.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(region).toBeHidden();
  await row.locator('.today-task-title').dblclick();
  await region.getByRole('button', { name: '23:55', exact: true }).click();
  await expect(popup).toBeVisible();
  await window.evaluate(() => document.documentElement.classList.add('dark'));
  await window.screenshot({ path: 'test-results/recurring-time-after-dark.png', animations: 'disabled' });
  await app.electronApp.evaluate(() => {
    const win = global.__moliTodoApp.windowManager.taskManagerWindow;
    win.setMinimumSize(700, 600);
    win.setSize(820, 800);
  });
  await window.screenshot({ path: 'test-results/recurring-time-after-narrow.png', animations: 'disabled' });
  const times = await app.electronApp.evaluate(async ({}, id) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 3); end.setHours(23, 59, 59, 999);
    const tasks = await global.__moliTodoApp.taskService.expandRecurringTasks(start, end);
    return tasks.filter((task) => task.seriesId === id).map((task) => ({ start: task.scheduledStartAt.toTimeString().slice(0, 5), end: task.scheduledEndAt.toTimeString().slice(0, 5), due: task.dueTime }));
  }, id);
  expect(times.length).toBeGreaterThan(2);
  for (const time of times) expect(time).toEqual({ start: '15:30', end: '16:30', due: '23:55' });
});

test('在未来虚拟实例编辑开始时刻，保存到系列并更新其他未来日期', async ({ app, window }) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9);
  const [id] = await seedTasks(app.electronApp, [{ content: '未来实例系列编辑', scheduledStartAt: start.toISOString(), recurrence: { type: 'daily', interval: 1 } }]);
  await window.reload();
  const row = window.locator('.today-task-row', { hasText: '未来实例系列编辑' }).nth(1);
  await row.locator('.today-task-title').dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  await region.getByRole('button', { name: '09:00', exact: true }).click();
  await window.locator('.date-picker-popup-fixed input[type=time]').fill('10:30');
  await expect(window.locator('.date-picker-popup-fixed')).toBeVisible();
  await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  await expect.poll(() => app.electronApp.evaluate(async ({}, id) => {
    const template = await global.__moliTodoApp.taskService.taskRepository.findById(id);
    return template.scheduledStartAt.toTimeString().slice(0, 5);
  }, id)).toBe('10:30');
  await expect(window.locator('.today-task-row', { hasText: '未来实例系列编辑' }).nth(2)).toContainText('10:30');
});

test('完成首个任务后，未来实例的时刻编辑仍使用当前系列而不改历史', async ({ app, window }) => {
  const today = new Date(); today.setHours(9, 0, 0, 0);
  const [id] = await seedTasks(app.electronApp, [{ content: '已完成首项的重复系列', scheduledStartAt: today.toISOString(), recurrence: { type: 'daily' } }]);
  await app.electronApp.evaluate(async ({}, id) => global.__moliTodoApp.taskService.completeTask(id), id);
  await window.reload();
  const future = window.locator('.today-task-row', { hasText: '已完成首项的重复系列' }).nth(1);
  await future.locator('.today-task-title').dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  await region.getByRole('button', { name: '09:00', exact: true }).click();
  await window.locator('.date-picker-popup-fixed input[type=time]').fill('11:00');
  await expect(window.locator('.date-picker-popup-fixed')).toBeVisible();
  await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  await expect.poll(() => app.electronApp.evaluate(async ({}, id) => {
    const service = global.__moliTodoApp.taskService;
    const history = await service.taskRepository.findById(id);
    const active = (await service.getRecurringTasks()).find((task) => task.seriesId === id);
    return { history: history.scheduledStartAt.toTimeString().slice(0, 5), active: active.scheduledStartAt.toTimeString().slice(0, 5) };
  }, id)).toEqual({ history: '09:00', active: '11:00' });
});

test('安排开始和结束：日期与时间分开设置，选日期后保持弹窗，调整时间并点击外部后保存', async ({ app, window }) => {
  const today = new Date();
  const [id] = await seedTasks(app.electronApp, [{ content: '连续选择日期和时间', dueDate: localKey(today) }]);
  await window.reload();
  await window.locator('.today-task-row', { hasText: '连续选择日期和时间' }).first().locator('.today-task-title').dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  await region.getByRole('button', { name: '添加安排时间', exact: true }).click();
  const popup = window.locator('.date-picker-popup-fixed');
  // 首次设置：先选日期（不必先选时间）
  await popup.locator('.vc-day-content', { hasText: new RegExp(`^${today.getDate()}$`) }).first().click();
  await expect(popup).toBeVisible();
  // 切到时间控件，独立调整时刻
  await popup.locator('.schedule-picker-time-field').click();
  await popup.locator('.vc-time-picker select').nth(0).selectOption('10');
  await popup.locator('.vc-time-picker select').nth(1).selectOption('30');
  await expect(popup).toBeVisible();
  expect(await app.electronApp.evaluate(async ({}, id) => (await global.__moliTodoApp.taskService.taskRepository.findById(id)).scheduledStartAt, id)).toBeNull();
  await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  await expect(popup).toBeHidden();
  await expect.poll(() => app.electronApp.evaluate(async ({}, id) => {
    const task = await global.__moliTodoApp.taskService.taskRepository.findById(id);
    return task.scheduledStartAt?.toTimeString().slice(0, 5);
  }, id)).toBe('10:30');
  // 结束：日期默认跟随开始（同一天），只需设置时刻
  await region.getByRole('button', { name: /添加结束时间/ }).click();
  await popup.locator('.schedule-picker-time-field').click();
  await popup.locator('.vc-time-picker select').nth(0).selectOption('11');
  await popup.locator('.vc-time-picker select').nth(1).selectOption('45');
  await expect(popup).toBeVisible();
  await window.screenshot({ path: 'test-results/schedule-picker-stays-open.png', animations: 'disabled' });
  await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  await expect(popup).toBeHidden();
  await expect.poll(() => app.electronApp.evaluate(async ({}, id) => {
    const task = await global.__moliTodoApp.taskService.taskRepository.findById(id);
    return task.scheduledEndAt?.toTimeString().slice(0, 5);
  }, id)).toBe('11:45');
  // 结束日期默认与开始同一天
  expect(await app.electronApp.evaluate(async ({}, id) => {
    const task = await global.__moliTodoApp.taskService.taskRepository.findById(id);
    const end = new Date(task.scheduledEndAt);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  }, id)).toBe(localKey(today));
});

test('安排：结束时刻早于开始时自动跨天到次日', async ({ app, window }) => {
  const today = new Date();
  const [id] = await seedTasks(app.electronApp, [{ content: '结束早于开始自动跨天', dueDate: localKey(today) }]);
  await window.reload();
  await window.locator('.today-task-row', { hasText: '结束早于开始自动跨天' }).first().locator('.today-task-title').dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  const popup = window.locator('.date-picker-popup-fixed');

  // 开始：12:00
  await region.getByRole('button', { name: '添加安排时间', exact: true }).click();
  await popup.locator('.vc-day-content', { hasText: new RegExp(`^${today.getDate()}$`) }).first().click();
  await popup.locator('.schedule-picker-time-field').click();
  await popup.locator('.vc-time-picker select').nth(0).selectOption('12');
  await popup.locator('.vc-time-picker select').nth(1).selectOption('00');
  await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  await expect(popup).toBeHidden();

  // 结束：11:00 早于开始，应自动落到次日 11:00
  await region.getByRole('button', { name: /添加结束时间/ }).click();
  await popup.locator('.schedule-picker-time-field').click();
  await popup.locator('.vc-time-picker select').nth(0).selectOption('11');
  await popup.locator('.vc-time-picker select').nth(1).selectOption('00');
  await window.locator('.date-picker-backdrop').click({ position: { x: 1, y: 1 } });
  await expect(popup).toBeHidden();

  const result = await app.electronApp.evaluate(async ({}, id) => {
    const task = await global.__moliTodoApp.taskService.taskRepository.findById(id);
    const start = new Date(task.scheduledStartAt);
    const end = new Date(task.scheduledEndAt);
    const dayDiff = Math.round(
      (new Date(end.getFullYear(), end.getMonth(), end.getDate()) -
        new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000
    );
    return { start: start.toTimeString().slice(0, 5), end: end.toTimeString().slice(0, 5), dayDiff };
  }, id);
  expect(result).toEqual({ start: '12:00', end: '11:00', dayDiff: 1 });
});
