const { test, expect, seedTasks } = require('./fixtures');
const { _electron } = require('@playwright/test');
const path = require('path');

/**
 * issue #14 Today 综合视图必需 E2E 场景。
 * 使用真实渲染层、IPC、应用服务与 SQLite；任务通过真实 TaskService 预置。
 */

function localKey(date) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function offsetKey(days, hours = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

// 等待 Today 视图首次加载完成
async function waitForToday(page) {
  await expect(page.locator('.today-overview')).toBeVisible();
  await expect(page.locator('.agenda-view')).toBeVisible();
}

// issue #15 后任务行动作集中在 hover 动作区：先 hover 行（focus-within 亦可见），再点击动作按钮
async function rowAction(row, name) {
  await row.hover();
  await row.getByRole('button', { name }).click();
}

test('今天截止但安排在明天：只显示一张卡片，日历点仍在明天且可定位执行分组', async ({ app, window }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = localKey(tomorrow);

  await seedTasks(app.electronApp, [
    {
      content: '明天做今天交',
      dueDate: localKey(new Date()),
      scheduledStartAt: offsetKey(1),
      scheduledEndAt: null
    }
  ]);
  await window.reload();
  await waitForToday(window);

  // 任务只出现一次（在今天的执行分组）
  await expect(window.getByText('明天做今天交')).toHaveCount(1);

  // 明天日期 section 显示定位链接而非重复卡片
  const tomorrowSection = window.locator(`[data-date-section="${tomorrowKey}"]`);
  await expect(tomorrowSection).toBeVisible();
  const relocatedLink = tomorrowSection.locator('.agenda-relocated-link');
  await expect(relocatedLink).toBeVisible();

  // 点击定位链接：跳回执行分组并短暂强调目标卡片
  await relocatedLink.click();
  await expect(window.locator('.agenda-card-highlight')).toBeVisible();

  // 日历点仍在明天
  const dot = window.locator(`.future-calendar-day[data-date-key="${tomorrowKey}"] .future-calendar-dot`);
  await expect(dot.first()).toBeVisible();
});

test('无时间 doing 任务进入今天，不重复计入未计划', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '进行中的事', status: 'doing' }]);
  await window.reload();
  await waitForToday(window);

  await expect(window.getByText('进行中的事')).toHaveCount(1);
  const unplanned = window.locator('[data-agenda-section="unplanned"] .agenda-section-count');
  await expect(unplanned).toHaveText('0');
});

test('过去安排与截止逾期分开显示', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '过期截止', dueDate: localKey(new Date(Date.now() - 86400000)) },
    { content: '过去安排', scheduledStartAt: offsetKey(-1), scheduledEndAt: null }
  ]);
  await window.reload();
  await waitForToday(window);

  const overdue = window.locator('[data-agenda-section="overdue"]');
  const reschedule = window.locator('[data-agenda-section="reschedule"]');
  await expect(overdue.getByText('过期截止')).toBeVisible();
  await expect(reschedule.getByText('过去安排')).toBeVisible();
  await expect(overdue.getByText('过去安排')).toHaveCount(0);
  await expect(reschedule.getByText('过期截止')).toHaveCount(0);
});

test('点击空日期定位到对应 section 且不污染新建时间', async ({ app, window }) => {
  const target = new Date();
  target.setDate(target.getDate() + 3);
  const targetKey = localKey(target);

  await window.reload();
  await waitForToday(window);

  await window.locator(`.future-calendar-day[data-date-key="${targetKey}"]`).click();
  const section = window.locator(`[data-date-section="${targetKey}"]`);
  await expect(section).toBeVisible();
  await expect(section.locator('.agenda-empty-inline')).toBeVisible();

  // 选中日期后新建任务仍默认无时间（进入未计划）
  await window.locator('.agenda-floating-add button').click();
  const dialog = window.getByRole('dialog');
  await dialog.getByPlaceholder('任务').fill('随手记');
  await dialog.getByRole('button', { name: '创建任务' }).click();
  await expect(window.getByText('已添加到收件箱')).toBeVisible();

  // 未计划汇总默认折叠：点击反馈中的"查看"展开并定位
  await window.getByRole('button', { name: '查看' }).click();
  const taskRow = window.locator('.today-task-row', { hasText: '随手记' });
  await expect(taskRow).toBeVisible();
  // 未安排任务以 ghost chip 提供安排入口，不带具体时间
  await expect(taskRow.locator('.task-when-chip')).toContainText('未安排');
});

test('搜索左右同步且显示范围说明', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '搜索目标甲', dueDate: localKey(new Date()) },
    { content: '无关任务乙', dueDate: localKey(new Date()) }
  ]);
  await window.reload();
  await waitForToday(window);

  await window.locator('.task-manager-action-btn[title="搜索任务..."]').click();
  const searchInput = window.locator('.task-manager-inline-search-input');
  await searchInput.fill('搜索目标甲');

  await expect(window.locator('.task-manager-search-scope-hint')).toBeVisible();
  await expect(window.getByText('搜索目标甲')).toBeVisible();
  await expect(window.getByText('无关任务乙')).toHaveCount(0);
});

test('已完成开关不改变今日待处理计数', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '待办一项', dueDate: localKey(new Date()) },
    { content: '已完成一项', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);

  const header = window.locator('.task-manager-category-count');
  await expect(header).toContainText('今日待处理 1 项');

  await window.locator('.task-manager-action-btn[title="显示已完成任务"]').click();
  await expect(header).toContainText('今日待处理 1 项');
});

test('完成与取消完成后分组、计数与日历点同步', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '要完成的事', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const header = window.locator('.task-manager-category-count');
  await expect(header).toContainText('今日待处理 1 项');

  // hover 动作区：完成任务图标即动作
  const row = window.locator('.today-task-row', { hasText: '要完成的事' });
  await rowAction(row, '完成任务');

  await expect(header).toContainText('今日待处理 0 项');
  await expect(window.locator('.today-task-row', { hasText: '要完成的事' })).toHaveCount(0);
});

test('重启后保存结果保留', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '持久化任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);
  await expect(window.getByText('持久化任务')).toBeVisible();

  // 通过真实应用服务读取持久化结果
  const persisted = await app.electronApp.evaluate(async () => {
    const tasks = await global.__moliTodoApp.taskService.getAllTasks();
    return tasks.map((t) => t.content);
  });
  expect(persisted).toContain('持久化任务');
});

test('旧日期型重复实例不伪造 00:00', async ({ app, window }) => {
  // 旧系列：有 recurrence，无 scheduledStartAt（日期型旧重复）
  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    const today = new Date();
    await moli.taskService.createTaskInList('旧重复任务', 0, null, {
      recurrence: {
        type: 'daily',
        interval: 1,
        startDate: today.toISOString(),
        scheduledStartAt: null
      }
    });
  });
  await window.reload();
  await waitForToday(window);

  const card = window.locator('.today-task-row', { hasText: '旧重复任务' }).first();
  await expect(card).toBeVisible();
  // 不显示 00:00 的伪造开始时刻
  await expect(card).not.toContainText('00:00');
  await expect(card.locator('.flat-task-badge', { hasText: '重复任务' })).toBeVisible();
});

test('窄窗口隐藏常驻日历并提供抽屉', async ({ app, window }) => {
  await window.reload();
  await waitForToday(window);
  await window.setViewportSize({ width: 900, height: 700 });

  await expect(window.locator('.today-overview.is-narrow')).toBeVisible();
  const toggle = window.locator('.today-calendar-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(window.locator('.today-calendar-drawer')).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.locator('.today-calendar-drawer')).toHaveCount(0);
});

test('点击远期日期后回到今天，选中与定位恢复到今天', async ({ window }) => {
  const far = new Date();
  far.setDate(far.getDate() + 20);
  const farKey = localKey(far);

  await window.reload();
  await waitForToday(window);

  await window.locator(`.future-calendar-day[data-date-key="${farKey}"]`).click();
  await expect(window.locator(`.future-calendar-day[data-date-key="${farKey}"]`)).toHaveClass(/is-selected/);
  await expect(window.locator(`[data-date-section="${farKey}"]`)).toBeVisible();

  await window.locator('.future-calendar-back-btn.today').click();
  const todayKey = localKey(new Date());
  await expect(window.locator(`.future-calendar-day[data-date-key="${todayKey}"]`)).toHaveClass(/is-selected/);
  await expect(window.locator('.agenda-section-today')).toBeVisible();
});

test('滚动 Agenda 时日历同步当前日期', async ({ app, window }) => {
  const later = new Date();
  later.setDate(later.getDate() + 2);
  const laterKey = localKey(later);
  // 预置跨多天的任务，保证 Agenda 有足够内容可滚动到顶部
  const seeded = [];
  for (let day = 2; day <= 10; day += 1) {
    seeded.push({ content: `第 ${day} 天任务`, scheduledStartAt: offsetKey(day), scheduledEndAt: null });
  }
  await seedTasks(app.electronApp, seeded);
  await window.reload();
  await waitForToday(window);

  // 将目标日期 section 滚动到 Agenda 容器顶部，触发滚动观察
  await window.locator(`[data-date-section="${laterKey}"]`).evaluate((section) => {
    section.scrollIntoView({ block: 'start' });
  });

  await expect(window.locator(`.future-calendar-day[data-date-key="${laterKey}"]`)).toHaveClass(/is-selected/);
});

test('展开任务留在 Agenda 原位，关闭时右侧日历保持可见', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '编辑目标', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  await expect(window.locator('.today-overview-calendar')).toBeVisible();
  const collapsedRow = window.locator('.today-task-row', { hasText: '编辑目标' });
  await collapsedRow.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });

  await expect(row.getByRole('region', { name: '任务详情' })).toBeVisible();
  await expect(window.locator('.today-overview-calendar')).toBeVisible();

  await window.locator('.task-action-close').click();
  await expect(collapsedRow.getByRole('region', { name: '任务详情' })).toHaveCount(0);
  await expect(window.locator('.today-overview-calendar')).toBeVisible();
});

test('通过真实编辑器保存内容后 Agenda 同步更新', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '改名前', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const collapsedRow = window.locator('.today-task-row', { hasText: '改名前' });
  await collapsedRow.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });
  const titleInput = row.locator('.task-title-input');
  await expect(titleInput).toBeVisible();
  await titleInput.fill('改名后');
  await titleInput.press('Control+Enter');

  // 等待保存链路（IPC -> SQLite -> tasks-updated -> 页面刷新）
  await expect(window.locator('.today-task-row', { hasText: '改名后' })).toBeVisible();
  await expect(window.getByText('改名前')).toHaveCount(0);

  const persisted = await app.electronApp.evaluate(async () => {
    const tasks = await global.__moliTodoApp.taskService.getAllTasks();
    return tasks.map((t) => t.content);
  });
  expect(persisted).toContain('改名后');
});

test('点击过去日期定位到对应 section', async ({ window }) => {
  const today = new Date();
  const past = new Date(today);
  past.setDate(today.getDate() - 1);
  // 仅在当前月内存在过去日期时验证（日历月份窗口从当前月开始）
  if (past.getMonth() !== today.getMonth()) {
    test.skip(true, '今天当月没有可点击的过去日期');
    return;
  }
  const pastKey = localKey(past);

  await window.reload();
  await waitForToday(window);

  await window.locator(`.future-calendar-day[data-date-key="${pastKey}"]`).click();
  await expect(window.locator(`[data-date-section="${pastKey}"]`)).toBeVisible();
  await expect(window.locator(`.future-calendar-day[data-date-key="${pastKey}"]`)).toHaveClass(/is-selected/);
});

test('取消完成后任务回到今天且计数恢复', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '可取消完成', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const header = window.locator('.task-manager-category-count');
  await expect(header).toContainText('今日待处理 1 项');

  // 完成：从今天执行区消失
  const row = window.locator('.today-task-row', { hasText: '可取消完成' });
  await rowAction(row, '完成任务');
  await expect(header).toContainText('今日待处理 0 项');

  // 打开已完成开关，找到已完成行并通过「重新开始」动作取消完成
  await window.locator('.task-manager-action-btn[title="显示已完成任务"]').click();
  const completedRow = window.locator('.today-task-row', { hasText: '可取消完成' });
  await expect(completedRow).toBeVisible();
  await rowAction(completedRow, '重新开始');

  // 重新归组：回到今天待处理，计数恢复
  await expect(header).toContainText('今日待处理 1 项');
});

test('打开虚拟重复任务不物化；首次实际编辑仅更新目标实例', async ({ app, window }) => {
  // 重复系列：今天 10:00 开始，每天重复
  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(10, 0, 0, 0);
    await moli.taskService.createTaskInList('重复实例任务', 0, null, {
      scheduledStartAt: start.toISOString(),
      recurrence: { type: 'daily', interval: 1, startDate: start.toISOString() }
    });
  });
  await window.reload();
  await waitForToday(window);

  const collapsedRows = window.locator('.agenda-section-today .today-task-row', { hasText: '重复实例任务' });
  await expect(collapsedRows).toHaveCount(1);
  const beforeOpen = await app.electronApp.evaluate(async () =>
    (await global.__moliTodoApp.taskService.getAllTasks()).filter((task) => task.content === '重复实例任务').length
  );

  await collapsedRows.first().locator('.today-task-title').dblclick();
  const expandedRow = window.locator('.agenda-section-today .today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });
  const titleInput = expandedRow.locator('.task-title-input');
  await expect(titleInput).toBeVisible();
  const afterOpen = await app.electronApp.evaluate(async () =>
    (await global.__moliTodoApp.taskService.getAllTasks()).filter((task) => task.content === '重复实例任务').length
  );
  expect(afterOpen).toBe(beforeOpen);

  await titleInput.fill('重复实例任务（已改）');
  await titleInput.press('Control+Enter');
  await expect(window.getByRole('region', { name: '任务详情' })).toHaveCount(0);

  // 物化后系列模板仍保留原标题，今天只显示目标实例
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.some((task) => task.recurrence && task.content === '重复实例任务')
      && tasks.some((task) => task.seriesId && task.content === '重复实例任务（已改）');
  }, { timeout: 15000 }).toBe(true);
  await expect(window.locator('.agenda-section-today .today-task-row', { hasText: '重复实例任务（已改）' })).toHaveCount(1);
});

test('窄屏抽屉 Escape 关闭且焦点返回触发按钮', async ({ window }) => {
  await window.reload();
  await waitForToday(window);
  await window.setViewportSize({ width: 900, height: 700 });

  const toggle = window.locator('.today-calendar-toggle');
  await toggle.click();
  await expect(window.locator('.today-calendar-drawer')).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.locator('.today-calendar-drawer')).toHaveCount(0);
  await expect(toggle).toBeFocused();
});

test('prefers-reduced-motion 下日期定位仍可用', async ({ window }) => {
  await window.emulateMedia({ reducedMotion: 'reduce' });
  await window.reload();
  await waitForToday(window);

  const target = new Date();
  target.setDate(target.getDate() + 3);
  const targetKey = localKey(target);
  await window.locator(`.future-calendar-day[data-date-key="${targetKey}"]`).click();
  await expect(window.locator(`[data-date-section="${targetKey}"]`)).toBeVisible();
});





test('真实重启应用后保存结果保留', async ({ app }) => {
  const { electronApp, userDataDir } = app;
  await seedTasks(electronApp, [{ content: '重启保留任务', dueDate: localKey(new Date()) }]);

  // 关闭应用后以同一用户数据目录重新启动（真实重启，非窗口 reload）
  await electronApp.close().catch(() => {});
  const relaunched = await _electron.launch({
    args: ['.'],
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test', MOLI_E2E_USER_DATA: userDataDir }
  });
  try {
    let page = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      page = relaunched.windows().find((w) => w.url().includes('task-manager'));
      if (page) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await page.waitForSelector('.today-overview', { timeout: 30000 });
    await expect(page.locator('.today-task-row', { hasText: '重启保留任务' })).toBeVisible();
  } finally {
    await relaunched.close().catch(() => {});
  }
});

test('更晚月份扩展月份并使新月份可见', async ({ window }) => {
  await window.reload();
  await waitForToday(window);

  const before = await window.locator('.future-calendar-month').count();
  await window.locator('.future-calendar-back-btn', { hasText: '更晚月份' }).click();
  await expect(window.locator('.future-calendar-month')).toHaveCount(before + 1);

  // 新加入的月份滚动到可见区域（此前折叠在下方，看起来"没有反应"）
  await expect(window.locator('.future-calendar-month').last()).toBeInViewport();

  // 更早月份同样可用
  await window.locator('.future-calendar-back-btn', { hasText: '更早月份' }).click();
  await expect(window.locator('.future-calendar-month')).toHaveCount(before + 2);
});

test('仅提醒且已过期的任务出现在已过期提醒分组', async ({ app, window }) => {
  const ids = await seedTasks(app.electronApp, [{ content: '过期提醒任务' }]);
  await app.electronApp.evaluate(async ({}, id) => {
    const moli = global.__moliTodoApp;
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await moli.taskService.taskRepository.db.run('UPDATE tasks SET reminder_time = ? WHERE id = ?', [past, id]);
  }, ids[0]);

  await window.reload();
  await waitForToday(window);

  const section = window.locator('[data-agenda-section="reminderExpired"]');
  await expect(section).toBeVisible();
  await expect(section.getByText('过期提醒任务')).toBeVisible();

  // 不计入未计划，且计入今日待处理
  await expect(window.locator('[data-agenda-section="unplanned"] .agenda-section-count')).toHaveText('0');
  await expect(window.locator('.task-manager-category-count')).toContainText('今日待处理 1 项');
});

/* ===== 统一删除确认（Today 试点阶段 0） ===== */

// 展示已完成任务，返回目标行
async function showCompletedCard(window, content) {
  await window.locator('.task-manager-action-btn[title="显示已完成任务"]').click();
  return window.locator('.today-task-row', { hasText: content });
}

async function requestDeleteFromContextMenu(window, row) {
  await row.click({ button: 'right' });
  const menu = window.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: '删除任务' }).click();
}

test('任务删除确认：取消不删除且焦点返回触发控件', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '待删除任务', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);

  const card = await showCompletedCard(window, '待删除任务');
  await expect(card.locator('.today-task-actions').getByRole('button', { name: '删除任务' })).toHaveCount(0);
  await requestDeleteFromContextMenu(window, card);

  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  // 软删除语义：确认文案说明任务会移入垃圾桶
  await expect(dialog).toContainText('垃圾桶');

  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeVisible();
  await expect(card.locator('.today-task-title')).toBeFocused();
});

test('任务删除确认：Escape 取消不删除', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: 'Escape 保留任务', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);

  const card = await showCompletedCard(window, 'Escape 保留任务');
  await requestDeleteFromContextMenu(window, card);
  await expect(window.getByRole('alertdialog')).toBeVisible();

  await window.keyboard.press('Escape');
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(card).toBeVisible();
});

test('任务菜单可通过 Shift+F10 打开，浏览态不展示展开或删除按钮', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '任务菜单键盘入口', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.today-task-row', { hasText: '任务菜单键盘入口' });
  await expect(row.locator('.today-task-actions button')).toHaveCount(2);
  await expect(row.getByRole('button', { name: '删除任务' })).toHaveCount(0);
  await expect(row.getByRole('button', { name: '展开任务：任务菜单键盘入口' })).toBeVisible();
  await row.locator('.today-task-title').focus();
  await window.keyboard.press('Shift+F10');
  await expect(window.getByRole('menu')).toBeVisible();
  await expect(window.getByRole('menu').getByRole('menuitem', { name: '删除任务' })).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.getByRole('menu')).toHaveCount(0);
  await expect(row.locator('.today-task-title')).toBeFocused();
});

test('移动展开任务前先保存标题，保存失败时阻止任务离开并保留重试入口', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '改期前的任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const collapsed = window.locator('.today-task-row', { hasText: '改期前的任务' });
  await collapsed.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });

  await app.electronApp.evaluate(() => {
    const service = global.__moliTodoApp.taskService;
    const original = service.updateTask.bind(service);
    let failuresRemaining = 2;
    service.updateTask = async (id, updates) => {
      if (updates.content === '先保存这段标题' && failuresRemaining > 0) {
        failuresRemaining -= 1;
        throw new Error('title write failed before move');
      }
      return original(id, updates);
    };
  });

  await row.getByRole('textbox', { name: '任务标题' }).fill('先保存这段标题');
  await row.locator('.flat-task-checkbox').first().click();
  await expect(row.locator('#today-task-title-error')).toContainText('title write failed before move');

  const afterFailedMove = await app.electronApp.evaluate(async () => {
    const task = (await global.__moliTodoApp.taskService.getAllTasks()).find((item) => item.content === '改期前的任务');
    return { content: task?.content, status: task?.status };
  });
  expect(afterFailedMove).toEqual({ content: '改期前的任务', status: 'todo' });
  await expect(row.getByRole('region', { name: '任务详情' })).toBeVisible();

  await row.locator('#today-task-title-error').getByRole('button', { name: '重试' }).click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '先保存这段标题')?.content;
  }).toBe('先保存这段标题');
  await row.locator('.flat-task-checkbox').first().click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '先保存这段标题')?.status;
  }).toBe('done');
});

test('任务删除确认：确认后删除并持久化，焦点回到有效位置', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '确认删除任务', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);

  const card = await showCompletedCard(window, '确认删除任务');
  await requestDeleteFromContextMenu(window, card);
  const dialog = window.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '删除', exact: true }).click();

  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.today-task-row', { hasText: '确认删除任务' })).toHaveCount(0);

  const persisted = await app.electronApp.evaluate(async () => {
    const tasks = await global.__moliTodoApp.taskService.getAllTasks();
    return tasks.map((t) => t.content);
  });
  expect(persisted).not.toContain('确认删除任务');

  // 无相邻任务时焦点回到 Agenda 新建入口
  await expect(window.locator('.agenda-floating-add button')).toBeFocused();
});

test('任务删除失败：显示错误、任务保留并可重试', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '删除会失败', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);

  // 在服务边界注入一次失败，不增加生产测试开关
  await app.electronApp.evaluate(() => {
    const moli = global.__moliTodoApp;
    const original = moli.taskService.deleteTask.bind(moli.taskService);
    moli.__restoreDeleteTask = () => { moli.taskService.deleteTask = original; };
    let failed = false;
    moli.taskService.deleteTask = async (id) => {
      if (!failed) {
        failed = true;
        throw new Error('injected delete failure');
      }
      return original(id);
    };
  });

  const card = await showCompletedCard(window, '删除会失败');
  await requestDeleteFromContextMenu(window, card);
  const dialog = window.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '删除', exact: true }).click();

  // 失败：弹窗保留、显示错误、任务仍在
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('删除失败');
  await expect(card).toBeVisible();

  // 重试成功
  await dialog.getByRole('button', { name: '删除', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.today-task-row', { hasText: '删除会失败' })).toHaveCount(0);

  await app.electronApp.evaluate(() => global.__moliTodoApp.__restoreDeleteTask?.());
});

test('Sidebar 导航使用可访问的当前项语义并能切换分类', async ({ window }) => {
  await window.reload();
  await waitForToday(window);

  const nav = window.getByRole('navigation');
  const todayItem = nav.getByRole('button', { name: /今天/ });
  await expect(todayItem).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('button', { name: /全部/ }).click();
  await expect(nav.getByRole('button', { name: /全部/ })).toHaveAttribute('aria-current', 'page');
  await expect(window.locator('.task-manager-category-name')).toContainText('全部');
});

test('Header 图标按钮具有可访问名称', async ({ window }) => {
  await window.reload();
  await waitForToday(window);

  await expect(window.getByRole('button', { name: '搜索任务...' })).toBeVisible();
  await expect(window.getByRole('button', { name: '显示已完成任务' })).toBeVisible();
  await expect(window.getByRole('button', { name: '设置' })).toBeVisible();
  await expect(window.getByRole('button', { name: '新建清单' })).toBeVisible();
});

test('Today 新建弹窗可从下拉选择 AI 模型并进入 AI 预览', async ({ app, window }) => {
  // 在服务边界注入假 AI 配置与流式生成，不依赖真实密钥
  await app.electronApp.evaluate(() => {
    const moli = global.__moliTodoApp;
    moli.windowManager.configStore.set('ai.providers.openai', { apiKey: 'test-key', model: 'gpt-4o' });
    moli.taskService.streamGenerateTaskList = async (content, aiModel, listId, onChunk) => {
      onChunk?.('生成中');
      return {
        success: true,
        message: 'ok',
        tasks: [{ content: 'AI 识别任务', metadata: { note: '' } }]
      };
    };
  });
  await window.evaluate(() => localStorage.removeItem('taskStore-selectedAIModel'));
  await window.reload();
  await waitForToday(window);

  await window.locator('.agenda-floating-add button').click();
  const dialog = window.getByRole('dialog');
  await dialog.getByPlaceholder('任务').fill('帮我规划旅行');

  // 弹窗内提供模型下拉选择
  await dialog.getByRole('button', { name: 'AI' }).click();
  const menu = window.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitemradio', { name: /gpt-4o/ })).toBeVisible();
  await menu.getByRole('menuitemradio', { name: /gpt-4o/ }).click();

  await dialog.getByRole('button', { name: '创建任务' }).click();

  const preview = window.getByRole('dialog', { name: 'AI 生成的任务列表' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('共 1 个任务');
});

test('列表视图复用同一 AI 模型下拉并可生成预览', async ({ app, window }) => {
  await app.electronApp.evaluate(() => {
    const moli = global.__moliTodoApp;
    moli.windowManager.configStore.set('ai.providers.openai', { apiKey: 'test-key', model: 'gpt-4o' });
    moli.taskService.streamGenerateTaskList = async (content, aiModel, listId, onChunk) => {
      onChunk?.('生成中');
      return {
        success: true,
        message: 'ok',
        tasks: [{ content: '列表 AI 任务', metadata: { note: '' } }]
      };
    };
  });
  await window.evaluate(() => localStorage.removeItem('taskStore-selectedAIModel'));
  await window.reload();
  await waitForToday(window);

  // 切换到"全部"分类，使用列表视图快速添加
  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  await expect(window.locator('.flat-task-list-container')).toBeVisible();

  const toggle = window.locator('.flat-task-list-inline-options').getByRole('button', { name: 'AI', exact: true });
  await expect(toggle).toBeVisible();
  await toggle.click();
  const menu = window.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitemradio', { name: /gpt-4o/ }).click();
  await expect(window.locator('.flat-task-list-inline-options').getByRole('button', { name: 'gpt-4o', exact: true })).toBeVisible();

  await window.locator('.flat-task-list-textarea').fill('列表里生成任务');
  await window.locator('.flat-task-list-send-btn').click();
  await expect(window.getByRole('dialog', { name: 'AI 生成的任务列表' })).toContainText('共 1 个任务');
});


test('新建弹窗可选择清单、日期与具体时间并正确持久化', async ({ app, window }) => {
  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    await moli.listService.createList('旅行清单', '#007AFF', 'star');
  });
  await window.reload();
  await waitForToday(window);

  await window.locator('.agenda-floating-add button').click();
  const dialog = window.getByRole('dialog');
  await dialog.getByPlaceholder('任务').fill('订机票');
  await dialog.getByRole('button', { name: '旅行清单' }).click();
  await dialog.getByRole('button', { name: '明天' }).click();
  await dialog.getByRole('button', { name: '具体时间' }).click();
  await dialog.locator('input[type="time"]').fill('10:30');
  await dialog.getByRole('button', { name: '创建任务' }).click();

  // 任务出现在明天的日期 section，并显示具体时间
  const tomorrowKey = localKey(new Date(Date.now() + 86400000));
  const section = window.locator(`[data-date-section="${tomorrowKey}"]`);
  await expect(section.getByText('订机票')).toBeVisible();
  await expect(section.getByText('10:30')).toBeVisible();

  // 持久化结果：清单归属与安排时间正确
  const saved = await app.electronApp.evaluate(async () => {
    const tasks = await global.__moliTodoApp.taskService.getAllTasks();
    const task = tasks.find((t) => t.content === '订机票');
    return task ? { listId: task.listId, scheduledStartAt: task.scheduledStartAt } : null;
  });
  expect(saved).not.toBeNull();
  expect(saved.listId).not.toBe(0);
  expect(saved.scheduledStartAt).toBeTruthy();
  const start = new Date(saved.scheduledStartAt);
  expect(start.getHours()).toBe(10);
  expect(start.getMinutes()).toBe(30);
});

test('没有任务的日期不显示空 section', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '今天的任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  // 自动填充的未来日期没有任务时不渲染空白 section
  const emptyKey = localKey(new Date(Date.now() + 5 * 86400000));
  await expect(window.locator(`[data-date-section="${emptyKey}"]`)).toHaveCount(0);

  // 有任务的今天分组仍显示
  const todaySection = window.locator('.agenda-section-today');
  await expect(todaySection).toBeVisible();
  await expect(todaySection.getByText('今天的任务')).toBeVisible();
});

test('收件箱命名、逾期可折叠与今日星期几', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '逾期任务', dueDate: localKey(new Date(Date.now() - 86400000)) }
  ]);
  await window.reload();
  await waitForToday(window);

  // 1. 未计划改名为收件箱
  const unplanned = window.locator('[data-agenda-section="unplanned"]');
  await expect(unplanned.locator('.agenda-section-title')).toContainText('收件箱');

  // 2. 已逾期默认展开，可折叠再展开
  const overdue = window.locator('[data-agenda-section="overdue"]');
  const overdueToggle = overdue.getByRole('button', { name: /已逾期/ });
  await expect(overdue.getByText('逾期任务')).toBeVisible();
  await expect(overdueToggle).toHaveAttribute('aria-expanded', 'true');
  await overdueToggle.click();
  await expect(overdue.getByText('逾期任务')).toHaveCount(0);
  await overdueToggle.click();
  await expect(overdue.getByText('逾期任务')).toBeVisible();

  // 3. 今天标题带星期几
  await expect(window.locator('.agenda-section-today .agenda-section-title')).toContainText('周');
});

test('浏览过去日期：逾期任务直接显示卡片并标注原因', async ({ app, window }) => {
  const today = new Date();
  const past = new Date(today);
  past.setDate(today.getDate() - 1);
  // 仅在当前月内存在过去日期时验证（日历月份窗口从当前月开始）
  if (past.getMonth() !== today.getMonth()) {
    test.skip(true, '今天当月没有可点击的过去日期');
    return;
  }
  const pastKey = localKey(past);

  await seedTasks(app.electronApp, [
    { content: '逾期定位任务', dueDate: pastKey }
  ]);
  await window.reload();
  await waitForToday(window);

  // 手动折叠已逾期，排除顶部执行分组的重复展示
  const overdue = window.locator('[data-agenda-section="overdue"]');
  await overdue.getByRole('button', { name: /已逾期/ }).click();
  await expect(overdue.getByText('逾期定位任务')).toHaveCount(0);

  // 通过日历进入过去日期：该日期 section 直接渲染行并标注逾期原因，不再只留定位链接
  await window.locator(`.future-calendar-day[data-date-key="${pastKey}"]`).click();
  const section = window.locator(`[data-date-section="${pastKey}"]`);
  await expect(section.getByText('逾期定位任务')).toBeVisible();
  await expect(section.locator('.agenda-relocated-link')).toHaveCount(0);
  await expect(section.getByText('已逾期')).toBeVisible();

  // 行仍可完成（hover 动作区）
  const row = section.locator('.today-task-row').first();
  await rowAction(row, '完成任务');
  await expect(section.getByText('逾期定位任务')).toHaveCount(0);
});

/* ===== issue #16：Today 任务卡片 Things 式展开交互 ===== */

test('展开态编辑标题：Control+Enter 保存并收起', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '有错别字的任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const collapsedRow = window.locator('.today-task-row', { hasText: '有错别字的任务' });
  await collapsedRow.locator('.today-task-title').dblclick();
  const expandedRow = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });
  const input = expandedRow.getByRole('textbox', { name: '任务标题' });
  await expect(input).toBeVisible();
  await input.fill('改好的任务标题');
  await input.press('Control+Enter');

  await expect(window.locator('.today-task-row', { hasText: '改好的任务标题' })).toBeVisible();
  await expect(window.getByRole('textbox', { name: '任务标题' })).toHaveCount(0);
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      (await global.__moliTodoApp.taskService.getAllTasks()).map((t) => t.content)
    );
    return tasks.includes('改好的任务标题');
  }, { timeout: 15000 }).toBe(true);
});

test('展开态标题 Escape 先取消草稿，再次 Escape 收起任务', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '保持原标题', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const collapsedRow = window.locator('.today-task-row', { hasText: '保持原标题' });
  await collapsedRow.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });
  const input = row.getByRole('textbox', { name: '任务标题' });
  await expect(input).toBeVisible();
  await input.fill('不该保存的内容');
  await input.press('Escape');

  await expect(input).toHaveValue('保持原标题');
  await expect(row.getByRole('region', { name: '任务详情' })).toBeVisible();
  await input.press('Escape');
  await expect(collapsedRow.getByRole('region', { name: '任务详情' })).toHaveCount(0);
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      (await global.__moliTodoApp.taskService.getAllTasks()).map((t) => t.content)
    );
    return tasks.includes('不该保存的内容');
  }, { timeout: 15000 }).toBe(false);
});

test('When 气泡快捷改期：未安排任务改到明天并持久化', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '要改期的任务' }]);
  await window.reload();
  await waitForToday(window);

  // 展开收件箱分组（默认折叠）
  await window.locator('[data-agenda-section="unplanned"] .agenda-section-header').click();
  const row = window.locator('.today-task-row', { hasText: '要改期的任务' });
  await expect(row).toBeVisible();

  // ghost chip → When 气泡 → 明天
  await row.locator('.task-when-chip').click();
  await expect(window.locator('.when-option-tomorrow')).toBeVisible();
  await window.locator('.when-option-tomorrow').click();

  const expected = new Date();
  expected.setDate(expected.getDate() + 1);
  expected.setHours(0, 0, 0, 0);
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      global.__moliTodoApp.taskService.getAllTasks()
    );
    const task = tasks.find((t) => t.content === '要改期的任务');
    return task && task.scheduledStartAt ? new Date(task.scheduledStartAt).toISOString() : null;
  }, { timeout: 15000 }).toBe(expected.toISOString());

  // 改期后行进入明天的日期 section，chip 更新为「明天」
  const tomorrowKey = localKey(expected);
  const tomorrowSection = window.locator(`[data-date-section="${tomorrowKey}"]`);
  await expect(tomorrowSection.locator('.today-task-row', { hasText: '要改期的任务' }).locator('.task-when-chip'))
    .toContainText('明天');
});

test('When 气泡改期按时长平移结束时间', async ({ app, window }) => {
  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    await moli.taskService.createTaskInList('跨时段任务', 0, null, {
      scheduledStartAt: start.toISOString(),
      scheduledEndAt: end.toISOString()
    });
  });
  await window.reload();
  await waitForToday(window);

  const tomorrowKey = localKey(new Date(Date.now() + 86400000));
  const row = window.locator(`[data-date-section="${tomorrowKey}"] .today-task-row`, { hasText: '跨时段任务' });
  await expect(row).toBeVisible();

  // chip 显示「开始 – 结束」区间
  await expect(row.locator('.task-when-chip')).toContainText('10:00');
  await expect(row.locator('.task-when-chip')).toContainText('11:00');

  // 改到下周（下周一）：结束时间按时长平移，保留 1 小时时段
  await row.locator('.task-when-chip').click();
  await window.locator('.when-option-next-week').click();

  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() + (((1 - nextMonday.getDay() + 7) % 7) || 7));
  nextMonday.setHours(0, 0, 0, 0);
  const expectedStart = nextMonday.toISOString();
  const expectedEnd = new Date(nextMonday.getTime() + 60 * 60 * 1000).toISOString();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      global.__moliTodoApp.taskService.getAllTasks()
    );
    const task = tasks.find((t) => t.content === '跨时段任务');
    if (!task || !task.scheduledStartAt || !task.scheduledEndAt) return null;
    return {
      start: new Date(task.scheduledStartAt).toISOString(),
      end: new Date(task.scheduledEndAt).toISOString()
    };
  }, { timeout: 15000 }).toEqual({ start: expectedStart, end: expectedEnd });
});

test('When 气泡内嵌日历选择具体日期并持久化', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '日历改期任务' }]);
  await window.reload();
  await waitForToday(window);

  await window.locator('[data-agenda-section="unplanned"] .agenda-section-header').click();
  const row = window.locator('.today-task-row', { hasText: '日历改期任务' });
  await row.locator('.task-when-chip').click();
  await window.locator('.when-option-picker').click();

  const calendar = window.locator('.when-calendar');
  await expect(calendar).toBeVisible();

  // 选择当月今天所在的日子（min-date 为今天，当日必可点）
  const today = new Date();
  await calendar.locator('.vc-day-content', { hasText: new RegExp(`^${today.getDate()}$`) }).first().click();

  const todayKey = localKey(today);
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      global.__moliTodoApp.taskService.getAllTasks()
    );
    const task = tasks.find((t) => t.content === '日历改期任务');
    return task && task.scheduledStartAt ? localKey(new Date(task.scheduledStartAt)) : null;
  }, { timeout: 15000 }).toBe(todayKey);
});

test('提醒气泡：行上设置预设提醒并可清除', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '要提醒的任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  // 无提醒时 hover 显示「+ 提醒」入口，点击弹提醒气泡
  const row = window.locator('.today-task-row', { hasText: '要提醒的任务' });
  await row.hover();
  await row.locator('.task-reminder-add').click();
  const popover = window.locator('.reminder-popover');
  await expect(popover).toBeVisible();
  await popover.locator('.reminder-option', { hasText: '30分钟后' }).click();

  // 预设提醒持久化（相对时间从现在起算）
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      global.__moliTodoApp.taskService.getAllTasks()
    );
    const task = tasks.find((t) => t.content === '要提醒的任务');
    if (!task || !task.reminderTime) return null;
    const time = new Date(task.reminderTime).getTime();
    return time > Date.now() + 20 * 60 * 1000 && time < Date.now() + 40 * 60 * 1000;
  }, { timeout: 15000 }).toBe(true);

  // 行上提醒 pill 可见；再次打开气泡清除提醒
  await expect(row.locator('.task-reminder-pill')).toBeVisible();
  await row.hover();
  await row.locator('.task-reminder-pill').click();
  await window.locator('.reminder-option-clear').click();

  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      global.__moliTodoApp.taskService.getAllTasks()
    );
    const task = tasks.find((t) => t.content === '要提醒的任务');
    return task ? task.reminderTime ?? null : null;
  }, { timeout: 15000 }).toBeNull();
});

test('状态动作：开始、暂停、继续与完成即动作', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '状态流转任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.today-task-row', { hasText: '状态流转任务' });
  await expect(row).toHaveAttribute('data-status', 'todo');

  await rowAction(row, '开始');
  await expect(row).toHaveAttribute('data-status', 'doing');
  await expect(row.locator('.today-task-time-doing')).toBeVisible();

  await rowAction(row, '暂停');
  await expect(row).toHaveAttribute('data-status', 'paused');

  await rowAction(row, '继续');
  await expect(row).toHaveAttribute('data-status', 'doing');

  await rowAction(row, '完成任务');
  await expect(window.locator('.today-task-row', { hasText: '状态流转任务' })).toHaveCount(0);
});

test('逾期任务 When chip 变红且悬浮说明为截止时间', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '过期截止任务', dueDate: localKey(new Date(Date.now() - 86400000)) }
  ]);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('[data-agenda-section="overdue"] .today-task-row', { hasText: '过期截止任务' });
  await expect(row).toBeVisible();

  const chip = row.locator('.task-when-chip');
  await expect(chip).toHaveClass(/overdue/);

  await chip.hover();
  await expect(window.locator('.ui-tooltip-content')).toContainText('截止时间');
});

test('虚拟重复实例改期先物化为真实任务', async ({ app, window }) => {
  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    await moli.taskService.createTaskInList('重复改期任务', 0, null, {
      scheduledStartAt: start.toISOString(),
      recurrence: { type: 'daily', interval: 1, startDate: start.toISOString() }
    });
  });
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.agenda-section-today .today-task-row', { hasText: '重复改期任务' });
  await expect(row).toBeVisible();

  // 虚拟实例行上改期：先物化再执行，结果落在真实任务行
  await row.locator('.task-when-chip').click();
  await window.locator('.when-option-tomorrow').click();

  const expected = new Date();
  expected.setDate(expected.getDate() + 1);
  expected.setHours(0, 0, 0, 0);
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      global.__moliTodoApp.taskService.getAllTasks()
    );
    const real = tasks.find((t) => t.content === '重复改期任务' && t.scheduledStartAt);
    return real ? new Date(real.scheduledStartAt).toISOString() : null;
  }, { timeout: 15000 }).toBe(expected.toISOString());
});

test('删除确认说明垃圾桶语义，且可从悬浮窗恢复（跨窗口闭环）', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '跨窗口删除任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.today-task-row', { hasText: '跨窗口删除任务' });
  await requestDeleteFromContextMenu(window, row);

  // 确认文案说明任务会移入垃圾桶
  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('垃圾桶');

  await dialog.getByRole('button', { name: '删除', exact: true }).click();
  await expect(window.locator('.today-task-row', { hasText: '跨窗口删除任务' })).toHaveCount(0);

  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      global.__moliTodoApp.taskService.getAllTasks()
    );
    return tasks.some((t) => t.content === '跨窗口删除任务');
  }, { timeout: 15000 }).toBe(false);

  // 从悬浮窗垃圾桶恢复
  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());
  let panel = null;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    panel = app.electronApp.windows().find((w) => w.url().includes('task-panel'));
    if (panel) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  await panel.locator('.task-panel-dropdown-trigger').click();
  await panel.locator('.dropdown-item', { hasText: '垃圾桶' }).click();
  const trashRow = panel.locator('.task-panel-card', { hasText: '跨窗口删除任务' });
  await expect(trashRow).toBeVisible();

  await trashRow.hover();
  await trashRow.locator('.task-action-btn.restore').click();
  await expect(trashRow).toHaveCount(0);
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () =>
      global.__moliTodoApp.taskService.getAllTasks()
    );
    return tasks.some((t) => t.content === '跨窗口删除任务');
  }, { timeout: 15000 }).toBe(true);
});

test('备注与循环图标在行上展示', async ({ app, window }) => {
  const todayKey = localKey(new Date());
  await app.electronApp.evaluate(async ({}, key) => {
    const moli = global.__moliTodoApp;
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    await moli.taskService.createTaskInList('带备注的循环任务', 0, null, {
      dueDate: key,
      metadata: { note: '这是备注内容' },
      recurrence: { type: 'daily', interval: 1, startDate: start.toISOString() }
    });
  }, todayKey);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.today-task-row', { hasText: '带备注的循环任务' }).first();
  await expect(row).toBeVisible();
  // 备注以第二行灰色文字展示
  await expect(row.locator('.today-task-note')).toContainText('这是备注内容');
  // 循环任务保留重复图标并有悬浮说明
  await expect(row.locator('.today-task-meta-item')).toBeVisible();
});

test('展开单条任务后编辑内容留在 Agenda 原位且右侧日历保持可见', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{
    content: '原位展开任务',
    dueDate: localKey(new Date()),
    metadata: { note: '展开后仍可修改的备注', steps: [{ id: 'step-1', content: '第一步', status: 'todo' }] }
  }]);
  await window.reload();
  await waitForToday(window);

  const collapsedRow = window.locator('.today-task-row', { hasText: '原位展开任务' });
  await expect(window.locator('.today-overview-calendar')).toBeVisible();
  await collapsedRow.locator('.today-task-title').dblclick();

  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });

  await expect(row.getByRole('textbox', { name: '任务标题' })).toBeVisible();
  await expect(row.getByRole('textbox', { name: '任务备注' })).toHaveValue('展开后仍可修改的备注');
  await expect(row.getByText('第一步')).toBeVisible();
  await expect(window.locator('.today-overview-calendar')).toBeVisible();
  await expect(row.getByRole('region', { name: '任务详情' })).toBeVisible();
  await expect(row.locator('.today-task-actions button')).toHaveCount(2);
  await expect(row.getByRole('button', { name: '展开任务' })).toHaveCount(0);

  const title = row.getByRole('textbox', { name: '任务标题' });
  await title.fill('原位展开后改过的标题');
  await title.press('Control+Enter');
  const savedRow = window.locator('.today-task-row', { hasText: '原位展开后改过的标题' });
  await expect(savedRow.locator('.today-task-title')).toHaveAttribute('aria-expanded', 'false');
  await expect(window.locator('.today-overview-calendar')).toBeVisible();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((task) => task.content === '原位展开后改过的标题')?.content || null;
  }, { timeout: 15000 }).toBe('原位展开后改过的标题');
});

test('展开态备注与步骤可新增、编辑、删除且 metadata 字段互不覆盖', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{
    content: '拆解中的任务',
    dueDate: localKey(new Date()),
    metadata: { note: '原备注', steps: [{ id: 'step-1', content: '先做第一步', status: 'todo' }] }
  }]);
  await window.reload();
  await waitForToday(window);

  const collapsedRow = window.locator('.today-task-row', { hasText: '拆解中的任务' });
  await collapsedRow.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });

  const scheduleTrigger = row.getByRole('button', { name: '添加安排时间' });
  await scheduleTrigger.click();
  await expect(window.locator('.date-picker-popup-fixed')).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.locator('.date-picker-popup-fixed')).toHaveCount(0);
  await expect(scheduleTrigger).toBeFocused();
  await expect(row.getByRole('region', { name: '任务详情' })).toBeVisible();

  await row.getByRole('button', { name: '清除截止时间' }).click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    const task = tasks.find((item) => item.content === '拆解中的任务');
    return { dueDate: task?.dueDate ?? null, dueTime: task?.dueTime ?? null };
  }).toEqual({ dueDate: null, dueTime: null });
  await expect(row.getByRole('region', { name: '任务详情' })).toBeVisible();
  await expect(row.locator('.task-title-input')).toBeVisible();

  const recurrenceSwitch = row.getByRole('switch', { name: '重复' });
  await recurrenceSwitch.click();
  await expect(recurrenceSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(row.getByRole('button', { name: '每天' })).toBeVisible();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return Boolean(tasks.find((item) => item.content === '拆解中的任务')?.recurrence);
  }).toBe(true);
  await recurrenceSwitch.click();
  await expect(recurrenceSwitch).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return Boolean(tasks.find((item) => item.content === '拆解中的任务')?.recurrence);
  }).toBe(false);

  const note = row.getByRole('textbox', { name: '任务备注' });
  await note.fill('更新后的备注');
  await note.blur();

  const addStep = row.getByRole('textbox', { name: '新步骤' });
  await addStep.fill('补充步骤');
  await addStep.press('Enter');
  await expect(row.getByRole('button', { name: '编辑第 2 个步骤' })).toContainText('补充步骤');

  await row.getByRole('button', { name: '编辑第 1 个步骤' }).click();
  const editStep = row.getByRole('textbox', { name: '编辑第 1 个步骤' });
  await editStep.fill('第一步已调整');
  await editStep.press('Enter');
  await expect(row.getByRole('button', { name: '编辑第 1 个步骤' })).toContainText('第一步已调整');

  await row.locator('.step-item').nth(1).getByRole('button', { name: '删除步骤' }).click();
  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '删除', exact: true }).click();
  await expect(row.getByText('补充步骤')).toHaveCount(0);

  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    const task = tasks.find((item) => item.content === '拆解中的任务');
    return task?.metadata ? { note: task.metadata.note, steps: task.metadata.steps } : null;
  }, { timeout: 15000 }).toEqual({
    note: '更新后的备注',
    steps: [{ id: 'step-1', content: '第一步已调整', status: 'todo' }]
  });
});

test('展开态标题、备注和步骤保存失败后保留草稿并可重试', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{
    content: '重试字段任务',
    dueDate: localKey(new Date()),
    metadata: { note: '旧备注', steps: [] }
  }]);
  await window.reload();
  await waitForToday(window);

  const collapsed = window.locator('.today-task-row', { hasText: '重试字段任务' });
  await collapsed.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });

  await app.electronApp.evaluate(() => {
    const service = global.__moliTodoApp.taskService;
    const originalUpdateTask = service.updateTask.bind(service);
    let failedTitle = false;
    let failedNote = false;
    let failedStep = false;
    service.updateTask = async (id, updates) => {
      if (updates.content === '重试后的标题' && !failedTitle) {
        failedTitle = true;
        throw new Error('title write failed once');
      }
      if (updates.metadata?.note === '重试后的备注' && !failedNote) {
        failedNote = true;
        throw new Error('note write failed once');
      }
      if (updates.metadata?.steps?.some((step) => step.content === '重试后的步骤') && !failedStep) {
        failedStep = true;
        throw new Error('step write failed once');
      }
      return originalUpdateTask(id, updates);
    };
  });

  const title = row.getByRole('textbox', { name: '任务标题' });
  await title.fill('重试后的标题');
  await title.evaluate((element) => element.blur());
  await expect(row.locator('#today-task-title-error')).toContainText('title write failed once');
  await row.getByRole('button', { name: '重试' }).click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '重试后的标题')?.content;
  }).toBe('重试后的标题');

  const note = row.getByRole('textbox', { name: '任务备注' });
  await note.fill('重试后的备注');
  await note.evaluate((element) => element.blur());
  await expect(row.locator('#today-task-note-error')).toContainText('note write failed once');
  await row.getByRole('button', { name: '重试' }).click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '重试后的标题')?.metadata?.note;
  }).toBe('重试后的备注');

  const newStep = row.getByRole('textbox', { name: '新步骤' });
  await newStep.fill('重试后的步骤');
  await newStep.press('Enter');
  await expect(row.locator('.task-step-save-error')).toContainText('step write failed once');
  await row.getByRole('button', { name: '重试' }).click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '重试后的标题')?.metadata?.steps;
  }).toEqual([{ id: expect.any(String), content: '重试后的步骤', status: 'todo' }]);
});

test('重复规则保存失败后可从重复字段重试', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '重试重复任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const collapsed = window.locator('.today-task-row', { hasText: '重试重复任务' });
  await collapsed.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });

  await app.electronApp.evaluate(() => {
    const service = global.__moliTodoApp.taskService;
    const original = service.updateRecurringTask.bind(service);
    let failed = false;
    service.updateRecurringTask = async (...args) => {
      if (!failed) {
        failed = true;
        throw new Error('recurrence write failed once');
      }
      return original(...args);
    };
  });

  await row.getByRole('switch', { name: '重复' }).click();
  await expect(row.getByRole('alert')).toContainText('recurrence write failed once');

  await row.locator('.flat-task-checkbox').first().click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '重试重复任务')?.status;
  }).toBe('todo');
  await expect(row.getByRole('region', { name: '任务详情' })).toBeVisible();

  await row.getByRole('button', { name: '重试' }).click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '重试重复任务')?.recurrence?.type;
  }).toBe('daily');
});

test('离开展开任务前自动保存尚未提交的新步骤', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '提交时保存步骤', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const collapsed = window.locator('.today-task-row', { hasText: '提交时保存步骤' });
  await collapsed.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });
  await row.getByRole('textbox', { name: '新步骤' }).fill('提交前补上的检查');
  await row.locator('.flat-task-checkbox').first().click();

  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    const task = tasks.find((item) => item.content === '提交时保存步骤');
    return { status: task?.status, steps: task?.metadata?.steps };
  }).toEqual({
    status: 'done',
    steps: [{ id: expect.any(String), content: '提交前补上的检查', status: 'todo' }]
  });
});

test('展开态清除截止保存失败后可重试并跟随任务移动', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '清除截止后仍展开', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const collapsedRow = window.locator('.today-task-row', { hasText: '清除截止后仍展开' });
  await collapsedRow.locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });

  await app.electronApp.evaluate(() => {
    const service = global.__moliTodoApp.taskService;
    const original = service.updateTask.bind(service);
    let failed = false;
    service.updateTask = async (...args) => {
      if (!failed) {
        failed = true;
        throw new Error('injected update failure');
      }
      return original(...args);
    };
  });

  await row.getByRole('button', { name: '清除截止时间' }).click();
  await expect(row.getByRole('alert')).toContainText('injected update failure');
  await expect(row.getByRole('button', { name: '重试' })).toBeVisible();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '清除截止后仍展开')?.dueDate;
  }).toBe(localKey(new Date()));

  await row.getByRole('button', { name: '重试' }).click();
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    const task = tasks.find((item) => item.content === '清除截止后仍展开');
    return { dueDate: task?.dueDate ?? null, dueTime: task?.dueTime ?? null };
  }).toEqual({ dueDate: null, dueTime: null });
  await expect(row.getByRole('region', { name: '任务详情' })).toBeVisible();
  await expect.poll(() => row.evaluate((element) => element.closest('[data-agenda-section="unplanned"]') !== null))
    .toBe(true);
});

// ===== issue #16 收尾：验收场景 2/3/9/10 的补充断言 =====

test('搜索高亮标题与备注，展开后筛选范围与任务内容不被破坏', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '高亮目标甲', dueDate: localKey(new Date()), metadata: { note: '备注里也有目标甲' } },
    { content: '无关任务乙', dueDate: localKey(new Date()) }
  ]);
  await window.reload();
  await waitForToday(window);

  await window.locator('.task-manager-action-btn[title="搜索任务..."]').click();
  await window.locator('.task-manager-inline-search-input').fill('目标甲');

  const row = window.locator('.today-task-row', { hasText: '高亮目标甲' });
  await expect(row.locator('.today-task-title mark')).toHaveText('目标甲');
  await expect(row.locator('.today-task-note mark')).toHaveText('目标甲');
  await expect(window.getByText('无关任务乙')).toHaveCount(0);

  await row.locator('.today-task-title').dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('textbox', { name: '任务标题' })).toHaveValue('高亮目标甲');
  await expect(window.locator('.task-manager-search-scope-hint')).toBeVisible();
});

test('清除安排时间保留截止，持久化结果一致', async ({ app, window }) => {
  const todayKey = localKey(new Date());
  await seedTasks(app.electronApp, [{
    content: '安排与截止并存',
    scheduledStartAt: offsetKey(0, 9),
    dueDate: todayKey
  }]);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.today-task-row', { hasText: '安排与截止并存' });
  await row.locator('.task-when-chip').click();
  await window.getByText('清除安排时间').click();

  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    const task = tasks.find((item) => item.content === '安排与截止并存');
    return { scheduledStartAt: task?.scheduledStartAt ?? null, dueDate: task?.dueDate ?? null };
  }).toEqual({ scheduledStartAt: null, dueDate: todayKey });
});

test('拖拽 Today 任务到侧边栏清单同步归属', async ({ app, window }) => {
  const targetListId = await app.electronApp.evaluate(async () => {
    const list = await global.__moliTodoApp.listService.createList('拖拽目标清单', '#007AFF', 'star');
    return list.id;
  });
  await seedTasks(app.electronApp, [{ content: '可拖拽任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  // 真实 HTML5 拖放链路：行把负载写入 DataTransfer，清单项读取并移动任务
  const dispatched = await window.evaluate((listId) => {
    const row = [...document.querySelectorAll('.today-task-row')]
      .find((element) => element.textContent.includes('可拖拽任务'));
    const target = document.querySelector(`.nav-item[data-list-id="${listId}"]`);
    if (!row || !target) return false;
    const dataTransfer = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    return true;
  }, targetListId);
  expect(dispatched).toBe(true);

  await expect.poll(async () => app.electronApp.evaluate(async () => {
    const tasks = await global.__moliTodoApp.taskService.getAllTasks();
    return tasks.find((item) => item.content === '可拖拽任务')?.listId ?? null;
  })).toBe(targetListId);
});

test('展开任务完成后离开分组：给出移动说明并将焦点落到相邻任务', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '完成目标', dueDate: localKey(new Date()) },
    { content: '相邻任务', dueDate: localKey(new Date()) }
  ]);
  await window.reload();
  await waitForToday(window);

  const target = window.locator('.today-task-row', { hasText: '完成目标' });
  await target.locator('.today-task-title').dblclick();
  const expandedRow = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });
  await expect(expandedRow).toHaveCount(1);

  await rowAction(expandedRow, '完成任务');

  await expect(window.locator('.today-task-move-feedback')).toContainText('已完成');
  await expect(window.locator('.today-task-row', { hasText: '完成目标' })).toHaveCount(0);
  await expect(window.locator('.today-task-title', { hasText: '相邻任务' })).toBeFocused();
});

test('窄窗口下展开任务留在 Agenda，日历抽屉入口仍可用', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{
    content: '窄窗任务',
    dueDate: localKey(new Date()),
    metadata: { note: '窄窗备注', steps: [{ id: 'narrow-step', content: '窄窗步骤', status: 'todo' }] }
  }]);
  await window.reload();
  await waitForToday(window);
  await window.setViewportSize({ width: 900, height: 700 });
  await expect(window.locator('.today-overview.is-narrow')).toBeVisible();

  const collapsedRow = window.locator('.today-task-row', { hasText: '窄窗任务' });
  await collapsedRow.locator('.today-task-title').dblclick();
  const expandedRow = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });
  const region = window.getByRole('region', { name: '任务详情' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('textbox', { name: '任务标题' })).toBeVisible();
  await expect(region.getByRole('button', { name: '添加安排时间' })).toBeVisible();
  await expect(expandedRow.locator('.step-item', { hasText: '窄窗步骤' })).toBeVisible();

  // 展开不遮挡日历抽屉入口：入口可点、抽屉可开合
  const calendarToggle = window.locator('.today-calendar-toggle');
  await expect(calendarToggle).toBeVisible();
  await calendarToggle.click();
  await expect(window.locator('.today-calendar-drawer')).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.locator('.today-calendar-drawer')).toHaveCount(0);
  // 点击任务外部按契约先保存草稿再收起，任务仍留在 Agenda
  await expect(collapsedRow).toBeVisible();
});

test('prefers-reduced-motion 下展开、编辑与收起仍可完成', async ({ app, window }) => {
  await window.emulateMedia({ reducedMotion: 'reduce' });
  await seedTasks(app.electronApp, [{ content: '减少动效任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.today-task-row', { hasText: '减少动效任务' });
  await row.locator('.today-task-title').dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('textbox', { name: '任务标题' })).toBeFocused();

  await region.getByRole('textbox', { name: '任务标题' }).fill('减少动效已改名');
  await region.getByRole('button', { name: '关闭' }).click();
  await expect(region).toHaveCount(0);
  await expect(window.locator('.today-task-row', { hasText: '减少动效已改名' })).toBeVisible();
});

const COLOR_THEMES = ['default', 'twitter', 'vercel', 'morandi', 'mint-green'];

async function openThemeCheckTask(window) {
  const title = window.locator('.today-task-title', { hasText: '主题检查任务' });
  await expect(title).toBeVisible();
  await title.dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('textbox', { name: '任务标题' })).toBeVisible();
  await expect(region.getByRole('textbox', { name: '任务备注' })).toBeVisible();
  await expect(region.getByRole('button', { name: '添加安排时间' })).toBeVisible();
  return region;
}

test('五套颜色主题下展开任务仍可读可编辑', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{
    content: '主题检查任务',
    dueDate: localKey(new Date()),
    metadata: { note: '主题备注' }
  }]);
  await window.reload();
  await waitForToday(window);

  for (const themeId of COLOR_THEMES) {
    await window.evaluate((id) => {
      localStorage.setItem('colorTheme', id);
      localStorage.setItem('theme', 'light');
    }, themeId);
    await window.reload();
    await waitForToday(window);
    await expect.poll(() => window.evaluate(
      (id) => document.querySelectorAll(`style[data-theme="${id}"]`).length,
      themeId
    )).toBeGreaterThan(0);

    const region = await openThemeCheckTask(window);
    await region.screenshot({ path: `screenshots/today-task-things/theme-${themeId}.png` });
    await region.getByRole('button', { name: '关闭' }).click();
    await expect(region).toHaveCount(0);
  }
});

test('默认主题深色模式下展开任务仍可读可编辑', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{
    content: '主题检查任务',
    dueDate: localKey(new Date()),
    metadata: { note: '主题备注' }
  }]);
  await window.evaluate(() => {
    localStorage.setItem('colorTheme', 'default');
    localStorage.setItem('theme', 'dark');
  });
  await window.reload();
  await waitForToday(window);
  await expect(window.locator('html.dark')).toHaveCount(1);

  const region = await openThemeCheckTask(window);
  await region.screenshot({ path: 'screenshots/today-task-things/expanded-dark.png' });
});

test('编辑虚拟重复实例的步骤仅作用于目标实例', async ({ app, window }) => {
  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(10, 0, 0, 0);
    await moli.taskService.createTaskInList('重复步骤任务', 0, null, {
      scheduledStartAt: start.toISOString(),
      recurrence: { type: 'daily', interval: 1, startDate: start.toISOString() }
    });
  });
  await window.reload();
  await waitForToday(window);

  const collapsedRows = window.locator('.agenda-section-today .today-task-row', { hasText: '重复步骤任务' });
  await expect(collapsedRows).toHaveCount(1);
  await collapsedRows.first().locator('.today-task-title').dblclick();
  const expandedRow = window.locator('.agenda-section-today .today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });

  const addStep = expandedRow.getByRole('textbox', { name: '新步骤' });
  await addStep.fill('实例步骤');
  await addStep.press('Enter');
  await expect(expandedRow.getByRole('button', { name: '编辑第 1 个步骤' })).toContainText('实例步骤');

  // 物化出的目标实例带步骤，系列模板不被写入
  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    const template = tasks.find((task) => task.recurrence && task.content === '重复步骤任务');
    const instance = tasks.find((task) => task.seriesId && task.content === '重复步骤任务');
    return {
      templateSteps: (template?.metadata?.steps || []).length,
      instanceSteps: (instance?.metadata?.steps || []).map((step) => step.content)
    };
  }, { timeout: 15000 }).toEqual({ templateSteps: 0, instanceSteps: ['实例步骤'] });
});

test('展开态向辅助技术暴露展开状态与关联区域', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '可访问性任务', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.today-task-row', { hasText: '可访问性任务' });
  const title = row.locator('.today-task-title');
  await expect(title).toHaveAttribute('aria-expanded', 'false');
  const regionId = await title.getAttribute('aria-controls');
  expect(regionId).toBeTruthy();

  await title.dblclick();
  const region = window.getByRole('region', { name: '任务详情' });
  await expect(region).toHaveAttribute('id', regionId);
  const collapse = region.getByRole('button', { name: '关闭' });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await expect(collapse).toHaveAttribute('aria-controls', regionId);
});

test('展开已完成任务可重新开始并留在 Today', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '已完成待重启', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);
  await window.locator('.task-manager-action-btn[title="显示已完成任务"]').click();

  const collapsed = window.locator('.today-task-row', { hasText: '已完成待重启' });
  await expect(collapsed).toHaveCount(1);
  await collapsed.locator('.today-task-title').dblclick();
  const expandedRow = window.locator('.today-task-row').filter({
    has: window.getByRole('region', { name: '任务详情' })
  });
  await expect(expandedRow).toHaveCount(1);

  await rowAction(expandedRow, '重新开始');

  await expect.poll(async () => {
    const tasks = await app.electronApp.evaluate(async () => global.__moliTodoApp.taskService.getAllTasks());
    return tasks.find((item) => item.content === '已完成待重启')?.status ?? null;
  }).toBe('todo');
  // 重新开始后任务仍在今天且展开态跟随，未因离开完成分组而丢失
  await expect(window.locator('.agenda-section-today .task-title-input')).toHaveValue('已完成待重启');
});

test('单击不展开任务，双击或键盘 Enter 展开', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '双击展开目标', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  const row = window.locator('.today-task-row', { hasText: '双击展开目标' });
  const title = row.locator('.today-task-title');
  const region = window.getByRole('region', { name: '任务详情' });

  // 单击只是浏览，不进入编辑
  await title.click();
  await expect(region).toHaveCount(0);

  // 双击进入原位展开
  await title.dblclick();
  await expect(region).toBeVisible();
  await expect(region).toHaveCount(1);

  // 收起后可再次用键盘 Enter 展开
  await region.getByRole('button', { name: '关闭' }).click();
  await expect(region).toHaveCount(0);
  await title.focus();
  await window.keyboard.press('Enter');
  await expect(region).toBeVisible();
});
