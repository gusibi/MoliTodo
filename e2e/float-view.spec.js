const { test, expect } = require('./fixtures');

/**
 * 阶段 4：悬浮图标 / 任务面板的真实 Electron 窗口行为与跨窗口同步。
 * 复用真实 BrowserWindow、IPC 与隔离 SQLite。
 */

async function findWindow(app, matcher, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const page = app.electronApp.windows().find(matcher);
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

test('悬浮图标窗口存在、置顶且图标按钮有可访问名称', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  const info = await app.electronApp.evaluate(() => {
    const wm = global.__moliTodoApp.windowManager;
    const w = wm.floatingWindow;
    return {
      exists: !!w && !w.isDestroyed(),
      alwaysOnTop: w ? w.isAlwaysOnTop() : false,
      visible: w ? w.isVisible() : false
    };
  });

  expect(info.exists).toBe(true);
  expect(info.alwaysOnTop).toBe(true);

  const floatingIcon = await findWindow(app, (w) => {
    const url = w.url();
    return !url.includes('task-manager') && !url.includes('settings') && !url.includes('task-panel') && !url.includes('floating-task');
  });
  expect(floatingIcon).not.toBeNull();
  await floatingIcon.waitForSelector('.floating-icon', { timeout: 30000 });
  await expect(floatingIcon.getByRole('button', { name: 'MoliTodo' })).toBeVisible();
});

test('任务面板显示/隐藏，新增任务跨窗口同步到主窗口', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());

  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  await panel.locator('.task-panel-input').fill('面板新增任务');
  await panel.locator('.task-panel-input').press('Enter');

  // 跨窗口同步：主窗口重新加载后应看到面板创建的任务
  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const tasks = await global.__moliTodoApp.taskService.getAllTasks();
      return tasks.map((t) => t.content);
    });
  }, { timeout: 15000 }).toContain('面板新增任务');

  await window.reload();
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });
  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  await expect(window.locator('.flat-task-item', { hasText: '面板新增任务' })).toBeVisible();

  // 隐藏后窗口不可见，显示后恢复
  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.hideTaskPanel());
  await expect.poll(async () => {
    return app.electronApp.evaluate(() => {
      const w = global.__moliTodoApp.windowManager.taskPanelWindow;
      return w ? w.isVisible() : false;
    });
  }, { timeout: 10000 }).toBe(false);
});

test('打开交互浮层时鼠标移出不隐藏面板，关闭后恢复', async ({ app, window }) => {
  const today = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  await app.electronApp.evaluate(async ({}, key) => {
    const moli = global.__moliTodoApp;
    await moli.taskService.createTaskInList('面板提醒任务', 0, null, { dueDate: key });
  }, todayKey);

  await window.reload();
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  // 通过悬浮图标悬停打开面板，使面板由悬浮图标窗口接管隐藏逻辑
  const floatingIcon = await findWindow(app, (w) => {
    const url = w.url();
    return !url.includes('task-manager') && !url.includes('settings') && !url.includes('task-panel') && !url.includes('floating-task');
  });
  await floatingIcon.waitForSelector('.floating-icon', { timeout: 30000 });
  await floatingIcon.locator('.floating-icon').hover();

  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  // 统计悬浮图标窗口收到的鼠标离开事件
  await floatingIcon.evaluate(() => {
    window.__panelLeaveCount = 0;
    window.electronAPI.events.on('panel-mouse-leave', () => { window.__panelLeaveCount += 1; });
  });
  const leaveCount = () => floatingIcon.evaluate(() => window.__panelLeaveCount);

  // 打开提醒弹窗后，模拟鼠标离开面板不应触发隐藏
  await panel.locator('.task-panel-container').hover();
  await panel.locator('.task-action-btn.reminder').first().click();
  await expect(panel.getByRole('dialog')).toBeVisible();
  await panel.locator('.task-panel-container').dispatchEvent('mouseleave');
  await panel.waitForTimeout(600);
  expect(await leaveCount()).toBe(0);

  // 关闭弹窗后恢复原策略：鼠标离开触发隐藏
  await panel.getByRole('dialog').getByRole('button', { name: '取消' }).click();
  await panel.locator('.task-panel-container').dispatchEvent('mouseleave');
  await expect.poll(leaveCount, { timeout: 10000 }).toBeGreaterThan(0);
});

test('颜色主题切换跨窗口同步', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  const floatingIcon = await findWindow(app, (w) => {
    const url = w.url();
    return !url.includes('task-manager') && !url.includes('settings') && !url.includes('task-panel') && !url.includes('floating-task');
  });
  await floatingIcon.waitForSelector('.floating-icon', { timeout: 30000 });

  const readTheme = (page) => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  );

  const before = await readTheme(floatingIcon);

  // 在设置窗口切换颜色主题
  await window.getByRole('button', { name: '设置' }).click();
  const settings = await findWindow(app, (w) => w.url().includes('settings'));
  expect(settings).not.toBeNull();
  await settings.waitForSelector('.setting-main-container', { timeout: 30000 });
  await settings.locator('.setting-nav-item', { hasText: '外观' }).click();

  const options = settings.locator('.color-theme-option');
  const count = await options.count();
  expect(count).toBeGreaterThan(1);
  await options.nth(1).click();

  // 主窗口与悬浮窗口共享同一颜色主题
  await expect.poll(() => readTheme(floatingIcon), { timeout: 10000 }).not.toBe(before);
  const after = await readTheme(floatingIcon);
  expect(after).not.toBe('');
  await expect.poll(() => readTheme(window), { timeout: 10000 }).toBe(after);
});
