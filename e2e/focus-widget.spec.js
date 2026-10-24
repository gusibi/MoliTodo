const { test, expect } = require('./fixtures');

test('桌面专注小组件可以从主页面显示、快速开始、暂停并隐藏', async ({ app, window: page }) => {
  const sidebar = page.locator('.task-manager-sidebar');
  await sidebar.getByRole('button', { name: '番茄专注' }).click();
  await expect(page.getByRole('heading', { name: '把注意力，留给一件事' })).toBeVisible();

  const widgetPromise = app.electronApp.waitForEvent('window', {
    predicate: (candidate) => candidate.url().includes('focus-widget')
  });
  await page.getByRole('button', { name: '显示桌面小组件', exact: true }).click();
  const widget = await widgetPromise;
  await widget.waitForLoadState('domcontentloaded');
  await expect(widget.getByText('Moli 专注')).toBeVisible();
  await expect(widget.getByRole('button', { name: '开始 25 分钟', exact: true })).toBeVisible();
  await widget.getByRole('button', { name: '开始 25 分钟', exact: true }).click();
  await expect(widget.getByText('专注中', { exact: true })).toBeVisible();
  await expect(widget.getByRole('button', { name: '暂停', exact: true })).toBeVisible();

  await widget.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(widget.getByText('已暂停', { exact: true })).toBeVisible();
  await widget.getByRole('button', { name: '继续', exact: true }).click();
  await expect(widget.getByText('专注中', { exact: true })).toBeVisible();

  await expect.poll(async () => {
    const state = await app.electronApp.evaluate(async () => {
      const moli = global.__moliTodoApp;
      return moli.toolsRuntime.getFocusState();
    });
    return state.active?.status;
  }).toBe('running');

  await widget.getByRole('button', { name: '隐藏专注小组件', exact: true }).click();
  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const moli = global.__moliTodoApp;
      return moli.windowManager.focusWidgetWindow?.isVisible();
    });
  }).toBe(false);
  await expect(page.getByRole('button', { name: '显示桌面小组件', exact: true })).toBeVisible();

  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    await moli.toolsRuntime.cancelFocus();
  });
});
