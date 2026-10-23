const { test, expect } = require('./fixtures');

test('健康提醒、专注与小院工具切片可完成真实交互闭环', async ({ app, window: page }) => {
  const sidebar = page.locator('.task-manager-sidebar');

  // 创建一条覆盖全天的喝水提醒
  await sidebar.getByRole('button', { name: '健康提醒' }).click();
  await expect(page.getByRole('heading', { name: '创建提醒' })).toBeVisible();

  await page.locator('#reminder-interval').selectOption('10');
  await page.locator('#reminder-start').fill('00:00');
  await page.locator('#reminder-end').fill('23:59');
  await page.getByRole('button', { name: '创建提醒' }).click();
  await expect(page.getByText('下次提醒：')).toBeVisible();

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

  const snapshot = await app.electronApp.evaluate(async () => {
    const moliApp = global.__moliTodoApp;
    return moliApp.toolsRuntime.getShellSnapshot();
  });
  expect(snapshot.today.waterCount).toBe(1);
  expect(snapshot.plant.growthScore).toBe(2);

  // 小院页面展示植物成长与摆放交互
  await sidebar.getByRole('button', { name: 'Moli 小院' }).click();
  await expect(page.getByText('成长值 2/15')).toBeVisible();
  for (const label of ['椅子', '小屋', '初次萌芽']) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(1);
  }
  expect(await page.getByText('未解锁', { exact: true }).count()).toBeGreaterThan(0);

  await page.getByRole('button', { name: '布置小院', exact: true }).click();
  const firstEmptySlot = page.getByRole('button', { name: '空槽位' }).first();
  await firstEmptySlot.click();
  await expect(page.getByRole('heading', { name: '选择要摆放的物品' })).toBeVisible();
  await page.getByRole('button', { name: '椅子', exact: true }).click();
  await expect(page.getByRole('button', { name: '椅子', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '收起' }).click();
  await expect(page.getByRole('button', { name: '空槽位' }).first()).toBeVisible();

  // 专注：开始、暂停、继续、放弃
  await sidebar.getByRole('button', { name: '番茄专注' }).click();
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
  await expect(page.getByRole('button', { name: '跳过休息', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '跳过休息', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始 15 分钟', exact: true })).toBeVisible();
});
