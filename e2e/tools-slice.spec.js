const { test, expect } = require('./fixtures');

test('健康提醒、专注与小院工具切片可完成真实交互闭环', async ({ app, window: page }) => {
  const sidebar = page.locator('.task-manager-sidebar');

  // 创建一条覆盖全天的喝水提醒
  await sidebar.getByRole('button', { name: '健康提醒' }).click();
  await expect(page.getByRole('heading', { name: '把照顾自己，放进今天' })).toBeVisible();

  await page.getByRole('button', { name: '新建提醒', exact: true }).first().click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByRole('heading', { name: '新建提醒' })).toBeVisible();
  await editor.getByRole('button', { name: '10 分钟', exact: true }).click();
  await editor.locator('#reminder-start').fill('00:00');
  await editor.locator('#reminder-end').fill('23:59');
  await editor.getByRole('button', { name: '创建提醒', exact: true }).click();
  await expect(page.getByText('下次提醒：')).toBeVisible();

  // 规则可以再次编辑，修改后立即按新节奏运行
  await page.getByRole('button', { name: '编辑提醒', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: '编辑提醒' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '20 分钟', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByText('每 20 分钟', { exact: true })).toBeVisible();

  // 把下一次触发时间推到当前时刻并手动执行一次 tick，避免真实等待 10 分钟
  const popupPromise = app.electronApp.waitForEvent('window', {
    predicate: (candidate) => candidate.url().includes('reminder-popup')
  });
  await app.electronApp.evaluate(async ({}, iso) => {
    const moliApp = global.__moliTodoApp;
    await moliApp.taskRepository.db.run(
      'UPDATE reminder_rules SET next_run_at = ? WHERE id = (SELECT MAX(id) FROM reminder_rules)',
      [iso]
    );
    await moliApp.toolsRuntime.tick(new Date(iso));
  }, new Date().toISOString());

  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.getByText('健康提醒')).toBeVisible();
  await popup.getByRole('button', { name: '已喝水' }).click();
  await expect.poll(async () => {
    const current = await app.electronApp.evaluate(async () => {
      const moliApp = global.__moliTodoApp;
      return moliApp.toolsRuntime.getShellSnapshot();
    });
    return current.today.waterCount;
  }).toBe(1);

  const snapshot = await app.electronApp.evaluate(async () => {
    const moliApp = global.__moliTodoApp;
    return moliApp.toolsRuntime.getShellSnapshot();
  });
  expect(snapshot.today.waterCount).toBe(1);
  expect(snapshot.plant.growthScore).toBe(2);

  // 小院页面展示植物成长与摆放交互
  await sidebar.getByRole('button', { name: 'Moli 小院' }).click();
  await expect(page.getByText('种子 · 2/15').first()).toBeVisible();
  await page.getByRole('tab', { name: /小院/ }).focus();
  await page.keyboard.press('ArrowRight');
  const collectionTab = page.getByRole('tab', { name: /收藏图鉴/ });
  await expect(collectionTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toBeVisible();
  for (const label of ['椅子', '小屋']) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(1);
  }
  await page.getByRole('tab', { name: /徽章/ }).click();
  for (const label of ['初次萌芽']) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(1);
  }
  expect(await page.getByText('未解锁', { exact: true }).count()).toBeGreaterThan(0);

  await page.getByRole('tab', { name: /小院/ }).click();
  await expect(page.getByText('已摆放 2/4 件')).toBeVisible();

  // 新收藏会自动落到模板位置；也可以从托盘手动添加
  await app.electronApp.evaluate(async () => {
    const moliApp = global.__moliTodoApp;
    await moliApp.toolsRuntime.gardenRepository.addInventoryItem({
      catalogId: 'furniture-2',
      kind: 'furniture',
      quantity: 1,
      originType: 'e2e',
      originId: `e2e-table-${Date.now()}`,
      acquiredAt: new Date().toISOString()
    });
    moliApp.toolsRuntime.broadcastToolsUpdated();
  });
  await page.getByRole('button', { name: '添加物品', exact: true }).click();
  await expect(page.getByRole('heading', { name: '添加物品' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /^小桌/ }).click();
  await expect(page.getByText('已摆放 3/4 件')).toBeVisible();

  await page.getByRole('button', { name: '整理小院', exact: true }).click();
  await expect(page.getByRole('button', { name: /^拖动椅子/ })).toBeVisible();
  const chairHandle = page.getByRole('button', { name: /^拖动椅子/ });
  const handleBox = await chairHandle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 - 90, handleBox.y + handleBox.height / 2 - 30, { steps: 10 });
  await page.mouse.up();
  const movedChair = await app.electronApp.evaluate(async () => {
    const moliApp = global.__moliTodoApp;
    const inventory = await moliApp.toolsRuntime.gardenRepository.listInventoryItems();
    const chair = inventory.find((item) => item.catalogId === 'furniture-1');
    const placements = await moliApp.toolsRuntime.gardenRepository.listPlacements();
    return placements.find((placement) => placement.inventoryId === chair.id);
  });
  expect(movedChair.x).not.toBe(-2);
  expect(movedChair.z).not.toBe(2);

  await page.getByRole('button', { name: /小桌 · 收起/ }).click();
  await expect(page.getByText('已摆放 2/4 件')).toBeVisible();
  await page.getByRole('button', { name: '完成整理', exact: true }).click();

  // 专注：开始、暂停、继续、放弃
  await sidebar.getByRole('button', { name: '番茄专注' }).click();
  await page.getByRole('button', { name: /^15/ }).click();
  await page.getByRole('button', { name: '开始 15 分钟', exact: true }).click();
  await expect(page.getByText('专注中')).toBeVisible();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const toolMain = page.locator('.task-manager-main-content');
  await expect(toolMain.getByText('已暂停', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(toolMain.getByText('专注中', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '放弃', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始 15 分钟', exact: true })).toBeVisible();

  // 专注完成后自动进入 5 分钟休息，可跳过并回到开始状态
  await page.getByRole('button', { name: '开始 15 分钟', exact: true }).click();
  await expect(page.getByText('专注中')).toBeVisible();
  await app.electronApp.evaluate(async ({}, startedAt) => {
    const moliApp = global.__moliTodoApp;
    await moliApp.taskRepository.db.run(
      `UPDATE focus_sessions SET started_at = ?
       WHERE status = 'running' AND phase = 'focus'`,
      [startedAt]
    );
    await moliApp.toolsRuntime.tickFocus(new Date());
  }, new Date(Date.now() - 16 * 60 * 1000).toISOString());

  await expect(toolMain.getByText('休息中', { exact: true })).toBeVisible();
  await expect(toolMain.getByText('一轮专注完成', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '跳过休息', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '跳过休息', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始 15 分钟', exact: true })).toBeVisible();
});
