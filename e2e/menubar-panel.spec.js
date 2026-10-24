const { test, expect } = require('./fixtures');

/**
 * 菜单栏下拉面板：托盘点击弹出的日历 + 常用入口。
 * 覆盖日历当前月份展示、上月/下月切换、今日默认选中、
 * 菜单入口跳转、Escape 与失焦收起。
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

async function isPanelVisible(app) {
  return app.electronApp.evaluate(() => {
    const wm = global.__moliTodoApp.windowManager;
    return !!(wm.menuBarPanelWindow && !wm.menuBarPanelWindow.isDestroyed() && wm.menuBarPanelWindow.isVisible());
  });
}

// 与 reka-ui zh-CN CalendarHeading 的 fullMonthAndYear 输出一致
function zhMonthTitle(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

test('菜单栏面板显示当前月份日历，支持上月/下月切换', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.toggleMenuBarPanel());
  await expect.poll(() => isPanelVisible(app)).toBe(true);

  const panel = await findWindow(app, (w) => w.url().includes('menubar-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.menubar-panel-container', { timeout: 30000 });

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // 默认显示当前月份（exact 匹配，避免命中网格的 aria heading）
  await expect(panel.getByText(zhMonthTitle(now), { exact: true })).toBeVisible();

  // 今日默认选中
  await expect(panel.locator('[data-today]')).toHaveCount(1);
  await expect(panel.locator('[data-today]')).toHaveAttribute('data-selected', 'true');

  // 下月按钮：标题切换到下个月
  await panel.getByTitle('下一个').click();
  await expect(panel.getByText(zhMonthTitle(nextMonth), { exact: true })).toBeVisible();

  // 上月按钮：回到当前月，再切到上个月
  await panel.getByTitle('上一个').click();
  await expect(panel.getByText(zhMonthTitle(now), { exact: true })).toBeVisible();
  await panel.getByTitle('上一个').click();
  await expect(panel.getByText(zhMonthTitle(prevMonth), { exact: true })).toBeVisible();

  // 回到当前月，留档默认外观截图
  await panel.getByTitle('下一个').click();
  await expect(panel.getByText(zhMonthTitle(now), { exact: true })).toBeVisible();
  await panel.screenshot({ path: 'screenshots/menubar-panel-calendar.png' });
});

test('菜单栏面板提供常用入口，点击设置后打开设置窗口并收起', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.toggleMenuBarPanel());
  const panel = await findWindow(app, (w) => w.url().includes('menubar-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.menubar-panel-menu', { timeout: 30000 });

  // 四个入口均可见
  await expect(panel.getByRole('button', { name: '隐藏悬浮图标' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '任务管理' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '设置' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '退出 MoliTodo' })).toBeVisible();

  // 点击设置：面板收起且设置窗口打开
  await panel.getByRole('button', { name: '设置' }).click();
  expect(await isPanelVisible(app)).toBe(false);

  const settings = await findWindow(app, (w) => w.url().includes('settings'));
  expect(settings).not.toBeNull();
});

test('菜单栏面板退出入口触发主进程退出流程', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.toggleMenuBarPanel());
  const panel = await findWindow(app, (w) => w.url().includes('menubar-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.menubar-panel-menu', { timeout: 30000 });

  // 替换主进程 quit，避免测试应用真的退出，同时验证入口确实走到了退出流程
  await app.electronApp.evaluate(() => {
    const wm = global.__moliTodoApp.windowManager;
    global.__quitCalled = false;
    wm.__origQuit = wm.quit.bind(wm);
    wm.quit = () => { global.__quitCalled = true; };
  });

  await panel.getByRole('button', { name: '退出 MoliTodo' }).click();
  await expect.poll(() => app.electronApp.evaluate(() => global.__quitCalled)).toBe(true);

  await app.electronApp.evaluate(() => {
    const wm = global.__moliTodoApp.windowManager;
    if (wm.__origQuit) {
      wm.quit = wm.__origQuit;
      delete wm.__origQuit;
    }
  });
});

test('菜单栏面板 Escape 与失焦自动收起', async ({ app, window }) => {
  await app.electronApp.evaluate(({ app: electronApp }) => electronApp.focus({ steal: true }));
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.toggleMenuBarPanel());
  await expect.poll(() => isPanelVisible(app)).toBe(true);

  const panel = await findWindow(app, (w) => w.url().includes('menubar-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.menubar-panel-container', { timeout: 30000 });

  // Escape 收起
  await panel.keyboard.press('Escape');
  expect(await isPanelVisible(app)).toBe(false);

  // 重新打开后，把焦点交给任务管理窗口，面板失焦自动收起
  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createMenuBarPanel());
  await expect.poll(() => isPanelVisible(app)).toBe(true);
  await app.electronApp.evaluate(() => {
    global.__moliTodoApp.windowManager.menuBarPanelWindow.focus();
  });
  await app.electronApp.evaluate(() => {
    const wm = global.__moliTodoApp.windowManager;
    if (wm.taskManagerWindow && !wm.taskManagerWindow.isDestroyed()) {
      wm.taskManagerWindow.focus();
    }
    // 某些无头/失焦环境下 BrowserWindow.focus() 不一定产生 blur，显式触发一次以验证收起契约。
    wm.menuBarPanelWindow.emit('blur');
  });
  await expect.poll(() => isPanelVisible(app)).toBe(false);
});

test('菜单栏面板可切换悬浮图标显示状态', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  const before = await app.electronApp.evaluate(() => ({
    visible: global.__moliTodoApp.windowManager.floatingWindow.isVisible(),
    config: global.__moliTodoApp.windowManager.getConfig().floatingIcon.visible
  }));

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.toggleMenuBarPanel());
  const panel = await findWindow(app, (w) => w.url().includes('menubar-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.menubar-panel-menu', { timeout: 30000 });

  // 入口文案反映当前状态；点击后配置与悬浮窗可见性翻转
  const nameBefore = before.visible ? '隐藏悬浮图标' : '显示悬浮图标';
  await panel.getByRole('button', { name: nameBefore }).click();

  await expect.poll(() => app.electronApp.evaluate(() => ({
    visible: global.__moliTodoApp.windowManager.floatingWindow.isVisible(),
    config: global.__moliTodoApp.windowManager.getConfig().floatingIcon.visible
  }))).toEqual({ visible: !before.visible, config: !before.config });

  // 面板文案随状态更新
  const nameAfter = before.visible ? '显示悬浮图标' : '隐藏悬浮图标';
  await expect(panel.getByRole('button', { name: nameAfter })).toBeVisible();

  // 还原现场，避免影响同目录其他用例共享的配置语义
  await panel.getByRole('button', { name: nameAfter }).click();
});
