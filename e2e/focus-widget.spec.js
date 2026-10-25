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
  await expect(widget.getByText('MOLI')).toBeVisible();
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

test('专注完成时抖动桌面专注小组件并进入休息', async ({ app, window: page }) => {
  const sidebar = page.locator('.task-manager-sidebar');
  await sidebar.getByRole('button', { name: '番茄专注' }).click();

  const widgetPromise = app.electronApp.waitForEvent('window', {
    predicate: (candidate) => candidate.url().includes('focus-widget')
  });
  await page.getByRole('button', { name: '显示桌面小组件', exact: true }).click();
  const widget = await widgetPromise;
  await widget.waitForLoadState('domcontentloaded');
  await widget.getByRole('button', { name: '开始 25 分钟', exact: true }).click();
  await expect(widget.getByText('专注中', { exact: true })).toBeVisible();

  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    await moli.toolsRuntime.tickFocus(new Date(Date.now() + 26 * 60 * 1000));
  });

  await expect(widget.locator('.focus-widget-card')).toHaveClass(/focus-widget-card--shake/);
  await expect(widget.getByText('专注完成', { exact: true })).toBeVisible();
  await expect(widget.getByText('休息 5 分钟，起身活动一下')).toBeVisible();
  await expect(widget.locator('.focus-widget-card')).not.toHaveClass(/focus-widget-card--shake/, { timeout: 3000 });
  await expect(widget.getByText('休息中', { exact: true })).toBeVisible({ timeout: 8000 });

  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    await moli.toolsRuntime.skipFocusBreak();
  });
});

async function findFloatingIcon(app, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const page = app.electronApp.windows().find((candidate) => {
      const url = candidate.url();
      return !url.includes('task-manager') && !url.includes('settings') &&
        !url.includes('task-panel') && !url.includes('floating-task') &&
        !url.includes('focus-widget') && !url.includes('reminder-popup') &&
        !url.includes('menubar');
    });
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

test('专注小组件隐藏时由悬浮图标抖动提醒', async ({ app }) => {
  const floatingIcon = await findFloatingIcon(app);
  expect(floatingIcon).not.toBeNull();
  await floatingIcon.waitForSelector('.floating-icon', { timeout: 30000 });

  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    await moli.toolsRuntime.startFocus({ plannedMinutes: 15 });
    await moli.toolsRuntime.tickFocus(new Date(Date.now() + 16 * 60 * 1000));
  });

  await expect(floatingIcon.locator('.floating-icon')).toHaveClass(/floating-icon--shake/);

  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    await moli.toolsRuntime.skipFocusBreak();
  });
});
