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

test('悬浮窗今天视图：未安排任务创建后立即可见', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());

  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  // 默认「今天」分类：快速添加不设置日期的任务必须立即可见（未安排分组）
  await panel.locator('.task-panel-input').fill('未安排的快速任务');
  await panel.locator('.task-panel-input').press('Enter');

  await expect(panel.locator('.task-panel-card', { hasText: '未安排的快速任务' })).toBeVisible();
  await expect(panel.locator('.task-panel-section-header', { hasText: '未安排' })).toBeVisible();

  // 数据侧：任务保持未安排（无 scheduledStartAt）
  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const tasks = await global.__moliTodoApp.taskService.getAllTasks();
      const task = tasks.find((t) => t.content === '未安排的快速任务');
      return task ? { scheduled: task.scheduledStartAt ?? null } : null;
    });
  }, { timeout: 15000 }).toEqual({ scheduled: null });
});

test('快速录入自然语言日期：chip 预览并写入安排时间', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());

  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  const expectedStart = new Date();
  expectedStart.setDate(expectedStart.getDate() + 1);
  expectedStart.setHours(15, 0, 0, 0);

  // 输入含自然语言日期的文本，出现解析 chip 预览
  await panel.locator('.task-panel-input').fill('明天下午3点写周报');
  await expect(panel.locator('.quick-entry-chip', { hasText: '明天 15:00' })).toBeVisible();

  await panel.locator('.task-panel-input').press('Enter');

  // 创建时剥离日期词，并把「明天 15:00」写入 scheduledStartAt
  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const tasks = await global.__moliTodoApp.taskService.getAllTasks();
      const task = tasks.find((t) => t.content === '写周报');
      return task ? new Date(task.scheduledStartAt).toISOString() : null;
    });
  }, { timeout: 15000 }).toBe(expectedStart.toISOString());
});

test('悬浮窗 When 气泡：行上快捷改期并持久化', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());
  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  await panel.locator('.task-panel-input').fill('要改期的任务');
  await panel.locator('.task-panel-input').press('Enter');
  await expect(panel.locator('.task-panel-card', { hasText: '要改期的任务' })).toBeVisible();

  // 点击行上「未安排」chip → When 气泡（内容 Teleport 到 body，用面板级定位）→ 今天
  const row = panel.locator('.task-panel-card', { hasText: '要改期的任务' });
  await row.locator('.task-when-chip').click();
  await expect(panel.locator('.when-option-today')).toBeVisible();
  await panel.locator('.when-option-today').click();

  const expectedStart = new Date();
  expectedStart.setHours(0, 0, 0, 0);
  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const tasks = await global.__moliTodoApp.taskService.getAllTasks();
      const task = tasks.find((t) => t.content === '要改期的任务');
      return task && task.scheduledStartAt ? new Date(task.scheduledStartAt).toISOString() : null;
    });
  }, { timeout: 15000 }).toBe(expectedStart.toISOString());

  // 改期后出现在「今天」分组（不再在未安排组）
  await expect(panel.locator('.task-panel-section-header', { hasText: '今天' })).toBeVisible();
  await expect(row.locator('.task-when-chip', { hasText: '今天' })).toBeVisible();
});

test('悬浮窗单击标题原位编辑', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());
  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  await panel.locator('.task-panel-input').fill('原标题任务');
  await panel.locator('.task-panel-input').press('Enter');
  const row = panel.locator('.task-panel-card', { hasText: '原标题任务' });
  await expect(row).toBeVisible();

  // 单击标题 → 行内输入框（进入编辑后标题在 input.value 里，需用面板级定位）→ 改名回车
  await row.locator('.task-card-text').click();
  const editInput = panel.locator('.task-card-edit-input');
  await expect(editInput).toBeVisible();
  await editInput.fill('改好的标题');
  await editInput.press('Enter');

  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const tasks = await global.__moliTodoApp.taskService.getAllTasks();
      return tasks.some((t) => t.content === '改好的标题');
    });
  }, { timeout: 15000 }).toBe(true);
  await expect(panel.locator('.task-panel-card', { hasText: '改好的标题' })).toBeVisible();
});

test('悬浮窗面板内添加步骤', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());
  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  await panel.locator('.task-panel-input').fill('带步骤的任务');
  await panel.locator('.task-panel-input').press('Enter');
  const row = panel.locator('.task-panel-card', { hasText: '带步骤的任务' });
  await expect(row).toBeVisible();

  // hover 行后显示添加步骤输入框
  await row.hover();
  await row.locator('.task-add-step-input').fill('第一步：准备工作');
  await row.locator('.task-add-step-input').press('Enter');

  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const tasks = await global.__moliTodoApp.taskService.getAllTasks();
      const task = tasks.find((t) => t.content === '带步骤的任务');
      return task?.metadata?.steps?.map((s) => s.content) ?? [];
    });
  }, { timeout: 15000 }).toContain('第一步：准备工作');
  await expect(row.locator('.subtask-item', { hasText: '第一步：准备工作' })).toBeVisible();
});

test('悬浮窗删除任务进垃圾桶，可恢复与彻底删除', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());
  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  // 创建两个任务
  await panel.locator('.task-panel-input').fill('可恢复任务');
  await panel.locator('.task-panel-input').press('Enter');
  await panel.locator('.task-panel-input').fill('要彻底删除的任务');
  await panel.locator('.task-panel-input').press('Enter');
  await expect(panel.locator('.task-panel-card', { hasText: '可恢复任务' })).toBeVisible();

  // 右键 → 删除任务（软删除，无确认）
  const rowA = panel.locator('.task-panel-card', { hasText: '可恢复任务' });
  await rowA.click({ button: 'right' });
  await panel.locator('.context-menu-item', { hasText: '删除任务' }).click();
  await expect(rowA).toHaveCount(0);

  // 软删除后主列表不再返回该任务
  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const tasks = await global.__moliTodoApp.taskService.getAllTasks();
      return tasks.some((t) => t.content === '可恢复任务');
    });
  }, { timeout: 15000 }).toBe(false);

  const rowB = panel.locator('.task-panel-card', { hasText: '要彻底删除的任务' });
  await rowB.click({ button: 'right' });
  await panel.locator('.context-menu-item', { hasText: '删除任务' }).click();
  await expect(rowB).toHaveCount(0);

  // 切到垃圾桶分类
  await panel.locator('.task-panel-dropdown-trigger').click();
  await panel.locator('.dropdown-item', { hasText: '垃圾桶' }).click();

  const trashRowA = panel.locator('.task-panel-card', { hasText: '可恢复任务' });
  await expect(trashRowA).toBeVisible();
  const trashRowB = panel.locator('.task-panel-card', { hasText: '要彻底删除的任务' });
  await expect(trashRowB).toBeVisible();

  // 恢复后回到任务列表
  await trashRowA.hover();
  await trashRowA.locator('.task-action-btn.restore').click();
  await expect(trashRowA).toHaveCount(0);
  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const tasks = await global.__moliTodoApp.taskService.getAllTasks();
      return tasks.some((t) => t.content === '可恢复任务');
    });
  }, { timeout: 15000 }).toBe(true);

  // 彻底删除需经 AlertDialog 确认，确认后从数据库消失
  await trashRowB.hover();
  await trashRowB.locator('.task-action-btn.delete').click();
  await expect(panel.getByRole('alertdialog')).toBeVisible();
  // 先取消：无副作用
  await panel.getByRole('alertdialog').getByRole('button', { name: '取消' }).click();
  await expect(panel.getByRole('alertdialog')).toHaveCount(0);
  await expect(panel.locator('.task-panel-card', { hasText: '要彻底删除的任务' })).toBeVisible();

  await panel.locator('.task-panel-card', { hasText: '要彻底删除的任务' }).hover();
  await panel.locator('.task-panel-card', { hasText: '要彻底删除的任务' }).locator('.task-action-btn.delete').click();
  await panel.getByRole('alertdialog').getByRole('button', { name: '彻底删除' }).click();
  await expect(panel.locator('.task-panel-card', { hasText: '要彻底删除的任务' })).toHaveCount(0);
  await expect.poll(async () => {
    return app.electronApp.evaluate(async () => {
      const deleted = await global.__moliTodoApp.taskService.getDeletedTasks();
      return deleted.some((t) => t.content === '要彻底删除的任务');
    });
  }, { timeout: 15000 }).toBe(false);
});

test('清单筛选 chip：选中清单后仅显示该清单任务，新任务归入该清单', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  await app.electronApp.evaluate(() => global.__moliTodoApp.windowManager.createTaskPanel());
  const panel = await findWindow(app, (w) => w.url().includes('task-panel'));
  expect(panel).not.toBeNull();
  await panel.waitForSelector('.task-panel-container', { timeout: 30000 });

  // 创建清单与两个清单各一个任务
  const targetListId = await panel.evaluate(async () => {
    await window.electronAPI.invoke('list:create', { name: '筛选测试清单' });
    const all = await window.electronAPI.invoke('list:getAll');
    const found = (all.lists || []).find((l) => l.name === '筛选测试清单');
    return found ? found.id : null;
  });
  expect(targetListId).not.toBeNull();

  await app.electronApp.evaluate(async ({}, listId) => {
    const moli = global.__moliTodoApp;
    await moli.taskService.createTaskInList('默认清单任务', 0, null, {});
    await moli.taskService.createTaskInList('测试清单任务', listId, null, {});
  }, targetListId);

  // 触发面板重载（切到「全部」分类）
  await panel.locator('.task-panel-dropdown-trigger').click();
  await panel.locator('.dropdown-item', { hasText: '全部' }).first().click();
  await expect(panel.locator('.task-panel-card', { hasText: '默认清单任务' })).toBeVisible();

  // chip 选择「筛选测试清单」→ 只显示该清单任务
  await panel.locator('.quick-entry-chip-muted').click();
  await panel.locator('.dropdown-item', { hasText: '筛选测试清单' }).click();

  await expect(panel.locator('.task-panel-card', { hasText: '测试清单任务' })).toBeVisible();
  await expect(panel.locator('.task-panel-card', { hasText: '默认清单任务' })).toHaveCount(0);

  // 新建任务归入所选清单
  await panel.locator('.task-panel-input').fill('新归入任务');
  await panel.locator('.task-panel-input').press('Enter');
  await expect.poll(async () => {
    return app.electronApp.evaluate(async ({}, listId) => {
      const tasks = await global.__moliTodoApp.taskService.getTasksByListId(listId);
      return tasks.some((t) => t.content === '新归入任务');
    }, targetListId);
  }, { timeout: 15000 }).toBe(true);
  await expect(panel.locator('.task-panel-card', { hasText: '新归入任务' })).toBeVisible();
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

  // 打开提醒气泡后，模拟鼠标离开面板不应触发隐藏
  // 提醒入口在任务行元信息区：hover 行后点「+ 提醒」
  await panel.locator('.task-panel-container').hover();
  const firstRow = panel.locator('.task-panel-card').first();
  await firstRow.hover();
  await firstRow.locator('.task-reminder-add').click();
  await expect(panel.locator('.reminder-popover')).toBeVisible();
  await panel.locator('.task-panel-container').dispatchEvent('mouseleave');
  await panel.waitForTimeout(600);
  expect(await leaveCount()).toBe(0);

  // 关闭气泡后恢复原策略：鼠标离开触发隐藏
  await panel.keyboard.press('Escape');
  await expect(panel.locator('.reminder-popover')).toHaveCount(0);
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
