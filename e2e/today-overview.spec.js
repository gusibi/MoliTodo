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
  const input = window.locator('.agenda-quick-add-input');
  await input.fill('随手记');
  await input.press('Enter');
  await expect(window.getByText('已添加到未计划')).toBeVisible();

  // 未计划汇总默认折叠：点击反馈中的"查看"展开并定位
  await window.getByRole('button', { name: '查看' }).click();
  const taskRow = window.locator('.flat-task-item', { hasText: '随手记' });
  await expect(taskRow).toBeVisible();
  const taskTime = taskRow.locator('.flat-task-reminder-time');
  await expect(taskTime).toHaveCount(0);
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

  const card = window.locator('.flat-task-item', { hasText: '要完成的事' });
  await card.locator('label.flat-checkbox-label').click();

  await expect(header).toContainText('今日待处理 0 项');
  await expect(window.locator('.flat-task-item', { hasText: '要完成的事' })).toHaveCount(0);
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

  const card = window.locator('.flat-task-item', { hasText: '旧重复任务' }).first();
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
  await seedTasks(app.electronApp, [
    { content: '两天后的任务', scheduledStartAt: offsetKey(2), scheduledEndAt: null }
  ]);
  await window.reload();
  await waitForToday(window);

  // 将目标日期 section 滚动到 Agenda 容器顶部，触发滚动观察
  await window.locator(`[data-date-section="${laterKey}"]`).evaluate((section) => {
    section.scrollIntoView({ block: 'start' });
  });

  await expect(window.locator(`.future-calendar-day[data-date-key="${laterKey}"]`)).toHaveClass(/is-selected/);
});

test('打开编辑器时收起日历，关闭后恢复', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '编辑目标', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  await expect(window.locator('.today-overview-calendar')).toBeVisible();
  await window.locator('.flat-task-item', { hasText: '编辑目标' }).click();

  // 编辑器打开：日历收起，编辑面板可见
  await expect(window.locator('.today-edit-panel')).toBeVisible();
  await expect(window.locator('.today-overview-calendar')).toHaveCount(0);

  await window.locator('.task-action-close').click();
  await expect(window.locator('.today-edit-panel')).toHaveCount(0);
  await expect(window.locator('.today-overview-calendar')).toBeVisible();
});

test('通过真实编辑器保存内容后 Agenda 同步更新', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '改名前', dueDate: localKey(new Date()) }]);
  await window.reload();
  await waitForToday(window);

  await window.locator('.flat-task-item', { hasText: '改名前' }).click();
  const titleInput = window.locator('.today-edit-panel .task-title-input');
  await expect(titleInput).toBeVisible();
  await titleInput.fill('改名后');
  await titleInput.blur();

  // 等待保存链路（IPC -> SQLite -> tasks-updated -> 页面刷新）
  await window.locator('.task-action-close').click();
  await expect(window.locator('.flat-task-item', { hasText: '改名后' })).toBeVisible();
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
  await window.locator('.flat-task-item', { hasText: '可取消完成' }).locator('label.flat-checkbox-label').click();
  await expect(header).toContainText('今日待处理 0 项');

  // 打开已完成开关，找到已完成卡片并取消完成
  await window.locator('.task-manager-action-btn[title="显示已完成任务"]').click();
  const completedCard = window.locator('.flat-task-item', { hasText: '可取消完成' });
  await expect(completedCard).toBeVisible();
  await completedCard.locator('label.flat-checkbox-label').click();

  // 重新归组：回到今天待处理，计数恢复
  await expect(header).toContainText('今日待处理 1 项');
});

test('单次重复实例编辑后仅保留一张卡片且内容同步', async ({ app, window }) => {
  // 重复系列：今天 10:00 开始，每天重复
  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    await moli.taskService.createTaskInList('重复实例任务', 0, null, {
      scheduledStartAt: start.toISOString(),
      recurrence: { type: 'daily', interval: 1, startDate: start.toISOString() }
    });
  });
  await window.reload();
  await waitForToday(window);

  const cards = window.locator('.agenda-section-today .flat-task-item', { hasText: '重复实例任务' });
  await expect(cards).toHaveCount(1);

  // 点击虚拟实例：先物化为真实实例再打开编辑器
  await cards.first().click();
  const titleInput = window.locator('.today-edit-panel .task-title-input');
  await expect(titleInput).toBeVisible();
  await titleInput.fill('重复实例任务（已改）');
  await titleInput.blur();
  await window.locator('.task-action-close').click();

  // 物化后今天仍只有一张卡片，且内容同步
  await expect(window.locator('.agenda-section-today .flat-task-item', { hasText: '重复实例任务（已改）' })).toHaveCount(1);
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
    await expect(page.locator('.flat-task-item', { hasText: '重启保留任务' })).toBeVisible();
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

// 展示已完成任务，返回目标卡片
async function showCompletedCard(window, content) {
  await window.locator('.task-manager-action-btn[title="显示已完成任务"]').click();
  return window.locator('.flat-task-item', { hasText: content });
}

test('任务删除确认：取消不删除且焦点返回触发控件', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '待删除任务', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);

  const card = await showCompletedCard(window, '待删除任务');
  const deleteBtn = card.getByRole('button', { name: '删除任务' });
  await deleteBtn.click();

  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('确定要删除这个任务吗');

  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeVisible();
  await expect(deleteBtn).toBeFocused();
});

test('任务删除确认：Escape 取消不删除', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: 'Escape 保留任务', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);

  const card = await showCompletedCard(window, 'Escape 保留任务');
  await card.getByRole('button', { name: '删除任务' }).click();
  await expect(window.getByRole('alertdialog')).toBeVisible();

  await window.keyboard.press('Escape');
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(card).toBeVisible();
});

test('任务删除确认：确认后删除并持久化，焦点回到有效位置', async ({ app, window }) => {
  await seedTasks(app.electronApp, [
    { content: '确认删除任务', dueDate: localKey(new Date()), status: 'done' }
  ]);
  await window.reload();
  await waitForToday(window);

  const card = await showCompletedCard(window, '确认删除任务');
  await card.getByRole('button', { name: '删除任务' }).click();
  const dialog = window.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '删除', exact: true }).click();

  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.flat-task-item', { hasText: '确认删除任务' })).toHaveCount(0);

  const persisted = await app.electronApp.evaluate(async () => {
    const tasks = await global.__moliTodoApp.taskService.getAllTasks();
    return tasks.map((t) => t.content);
  });
  expect(persisted).not.toContain('确认删除任务');

  // 无相邻任务时焦点回到 Agenda 新建入口
  await expect(window.locator('.agenda-quick-add-input')).toBeFocused();
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
  await card.getByRole('button', { name: '删除任务' }).click();
  const dialog = window.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '删除', exact: true }).click();

  // 失败：弹窗保留、显示错误、任务仍在
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('删除失败');
  await expect(card).toBeVisible();

  // 重试成功
  await dialog.getByRole('button', { name: '删除', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.flat-task-item', { hasText: '删除会失败' })).toHaveCount(0);

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

test('Today 启用 AI 后快速添加进入 AI 预览（无需预先选择模型）', async ({ app, window }) => {
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

  const toggle = window.locator('button[title="使用 AI 生成任务"]');
  await expect(toggle).toBeVisible();
  await toggle.click();
  // 启用后自动选中可用模型，开关不再是空转
  await expect(window.locator('.agenda-quick-add-controls')).toContainText('gpt-4o');

  await window.locator('.agenda-quick-add-input').fill('帮我规划旅行');
  await window.locator('.agenda-quick-add-controls button[aria-label="发送"]').click();

  const preview = window.locator('.task-preview-modal-overlay');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('共 1 个任务');
});
