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
