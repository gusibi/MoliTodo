const { test, expect, seedTasks } = require('./fixtures');

/**
 * 阶段 2：普通列表 / 看板 / Inspector 任务展示迁移后的危险操作契约。
 * 复用真实 Electron 渲染层、IPC、应用服务与隔离 SQLite。
 */

async function waitForApp(window) {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });
}

test('已完成分类批量删除：统一确认、取消无副作用、确认只删选中', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '批量甲', status: 'done' },
    { content: '批量乙', status: 'done' },
    { content: '保留任务', status: 'todo' }
  ]);
  await window.reload();
  await waitForApp(window);

  await window.getByRole('navigation').getByRole('button', { name: /已完成/ }).click();
  await expect(window.locator('.flat-task-list-container')).toBeVisible();

  const selectBtn = window.locator('.flat-task-group-select-btn').first();
  await selectBtn.click();
  await selectBtn.click();

  const deleteBtn = window.locator('.flat-task-group-delete-btn').first();
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();

  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('2');

  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.flat-task-item', { hasText: '批量甲' })).toBeVisible();

  await deleteBtn.click();
  await window.getByRole('alertdialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.flat-task-item', { hasText: '批量甲' })).toHaveCount(0);
  await expect(window.locator('.flat-task-item', { hasText: '批量乙' })).toHaveCount(0);
});

test('看板卡片删除：统一确认、取消保留、确认删除', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '看板任务', status: 'todo' }]);
  await window.reload();
  await waitForApp(window);

  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  await window.getByRole('button', { name: '看板视图' }).click();
  await expect(window.locator('.kanban-board')).toBeVisible();

  const card = window.locator('.kanban-card', { hasText: '看板任务' });
  await expect(card).toBeVisible();

  await card.click({ button: 'right' });
  await window.locator('.context-menu-item-danger').click();
  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(card).toBeVisible();

  await card.click({ button: 'right' });
  await window.locator('.context-menu-item-danger').click();
  await window.getByRole('alertdialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.kanban-card', { hasText: '看板任务' })).toHaveCount(0);
});

test('编辑器步骤删除：统一确认、取消保留、确认删除', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '带步骤任务', status: 'todo' }]);
  await window.reload();
  await waitForApp(window);

  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  await expect(window.locator('.flat-task-list-container')).toBeVisible();

  await window.locator('.flat-task-item', { hasText: '带步骤任务' }).click();
  await expect(window.locator('.task-edit-vertical')).toBeVisible();

  const stepInput = window.locator('.step-add-input');
  await stepInput.fill('第一步');
  await stepInput.press('Enter');

  const step = window.locator('.step-item', { hasText: '第一步' });
  await expect(step).toBeVisible();

  await step.locator('.step-delete-btn').click();
  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('步骤');

  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(step).toBeVisible();

  await step.locator('.step-delete-btn').click();
  await window.getByRole('alertdialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.step-item', { hasText: '第一步' })).toHaveCount(0);
});

test('列表任务行删除：统一确认、取消返回触发控件、确认删除', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '列表删除任务', status: 'done' }]);
  await window.reload();
  await waitForApp(window);

  await window.getByRole('navigation').getByRole('button', { name: /已完成/ }).click();
  const card = window.locator('.flat-task-item', { hasText: '列表删除任务' });
  const deleteBtn = card.getByRole('button', { name: '删除任务' });
  await deleteBtn.click();

  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(card).toBeVisible();
  await expect(deleteBtn).toBeFocused();

  await deleteBtn.click();
  await window.getByRole('alertdialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.flat-task-item', { hasText: '列表删除任务' })).toHaveCount(0);
});

test('编辑器任务删除：统一确认、取消返回删除按钮、确认删除', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '编辑器删除任务', status: 'todo' }]);
  await window.reload();
  await waitForApp(window);

  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  await window.locator('.flat-task-item', { hasText: '编辑器删除任务' }).click();
  await expect(window.locator('.task-edit-vertical')).toBeVisible();

  const deleteBtn = window.getByRole('button', { name: '删除任务' }).last();
  await deleteBtn.click();

  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(deleteBtn).toBeFocused();

  await deleteBtn.click();
  await window.getByRole('alertdialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.flat-task-item', { hasText: '编辑器删除任务' })).toHaveCount(0);
});

test('侧栏标题默认两行、最多六行并可滚动，编辑区无状态圆圈', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '标题高度检查', status: 'todo' }]);
  await window.reload();
  await waitForApp(window);
  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  await window.locator('.flat-task-item', { hasText: '标题高度检查' }).click();
  const title = window.getByRole('textbox', { name: '任务标题', exact: true });
  await expect(title).toBeVisible();
  await expect(window.getByRole('checkbox', { name: '任务完成状态', exact: true })).toHaveCount(0);
  const measure = () => title.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
      lineHeight: parseFloat(style.lineHeight),
      padding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    };
  });
  let size = await measure();
  expect(size.height).toBeCloseTo(size.lineHeight * 2 + size.padding, 0);
  await window.screenshot({ path: 'screenshots/inspector-title/two-lines.png' });
  await title.fill(Array.from({ length: 10 }, (_, index) => `第${index + 1}行 Long task title 中文内容`).join('\n'));
  size = await measure();
  expect(size.height).toBeCloseTo(size.lineHeight * 6 + size.padding, 0);
  expect(size.scrollHeight).toBeGreaterThan(size.height);
  await title.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await title.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await window.screenshot({ path: 'screenshots/inspector-title/six-lines-scroll.png' });
  await window.evaluate(() => {
    const channel = new BroadcastChannel('theme-sync');
    channel.postMessage({ type: 'theme-change', theme: 'dark' });
    channel.close();
  });
  await expect(window.locator('html')).toHaveClass(/dark/);
  await window.setViewportSize({ width: 1000, height: 800 });
  await expect(title).toBeVisible();
  size = await measure();
  expect(size.height).toBeCloseTo(size.lineHeight * 6 + size.padding, 0);
  await window.screenshot({ path: 'screenshots/inspector-title/dark-narrow.png' });
  await title.fill('缩短后的标题');
  size = await measure();
  expect(size.height).toBeCloseTo(size.lineHeight * 2 + size.padding, 0);
  await title.press('Tab');
  await expect(window.locator('.flat-task-item', { hasText: '缩短后的标题' })).toBeVisible();
});

test('计划中重复任务行显示重复规则与提醒时间', async ({ app, window }) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 22, 5);
  const reminder = new Date(start.getTime() - 30 * 60 * 1000);
  const [id] = await seedTasks(app.electronApp, [{
    content: '计划重复任务提醒',
    scheduledStartAt: start.toISOString(),
    recurrence: { type: 'weekly', interval: 1, daysOfWeek: [start.getDay()] }
  }]);
  await app.electronApp.evaluate(async ({}, payload) => {
    await global.__moliTodoApp.taskRepository.db.run(
      'UPDATE tasks SET reminder_time = ? WHERE id = ?',
      [payload.reminder, payload.id]
    );
  }, { reminder: reminder.toISOString(), id });
  await window.reload();
  await waitForApp(window);

  await window.getByRole('navigation').getByRole('button', { name: /计划中/ }).click();
  const row = window.locator('.flat-task-item', { hasText: '计划重复任务提醒' }).first();
  await expect(row).toBeVisible();
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][start.getDay()];
  await expect(row.locator('.flat-task-recurring-icon')).toContainText(`每周（${weekday}）`);
  await expect(row.locator('.flat-task-time-reminder')).toContainText('21:35');
  await expect(row.getByText('提醒时间')).toHaveCount(1);
});
