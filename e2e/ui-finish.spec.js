const { test, expect, seedTasks } = require('./fixtures');

test('报告选择支持键盘半选和嵌套模型菜单 Escape 焦点恢复', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '报告任务一' }, { content: '报告任务二' }]);
  await app.electronApp.evaluate(() => {
    global.__moliTodoApp.windowManager.configStore.set('ai.providers.openai', { apiKey: 'test-key', model: 'gpt-4o' });
  });
  await window.reload();
  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  await window.getByRole('button', { name: 'AI 报告', exact: true }).click();
  const dialog = window.getByRole('dialog', { name: '选择要生成报告的任务' });
  const task = dialog.getByRole('checkbox', { name: '报告任务一' });
  await task.focus();
  await task.press('Space');
  await expect(dialog.getByRole('checkbox', { name: '全选', exact: true })).toHaveAttribute('aria-checked', 'mixed');
  await expect(dialog).toContainText('(1/2)');
  const model = dialog.getByRole('button', { name: '选择 AI 模型' });
  await expect(model).toBeEnabled();
  await model.focus();
  await model.press('Enter');
  await window.keyboard.press('ArrowDown');
  await expect(window.getByRole('menuitemradio').first()).toBeFocused();
  await window.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(model).toBeFocused();
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('开始任务失败使用应用错误弹窗且保留任务', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '启动失败的任务' }]);
  await app.electronApp.evaluate(() => {
    global.__moliTodoApp.taskService.startTask = async () => { throw new Error('测试服务暂不可用'); };
  });
  await window.reload();
  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  const row = window.locator('.flat-task-item', { hasText: '启动失败的任务' });
  await row.hover();
  await row.getByRole('button', { name: '开始', exact: true }).click();
  const error = window.getByRole('dialog', { name: '错误', exact: true });
  await expect(error).toContainText('测试服务暂不可用');
  await error.getByRole('button', { name: '关闭', exact: true }).last().click();
  await expect(error).toHaveCount(0);
  await expect(row).toBeVisible();
  await expect.poll(() => app.electronApp.evaluate(async () => {
    const tasks = await global.__moliTodoApp.taskService.getAllTasks();
    return tasks.find(t => t.content === '启动失败的任务')?.status;
  })).toBe('todo');
});
