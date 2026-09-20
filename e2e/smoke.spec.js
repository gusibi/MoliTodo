const { test, expect } = require('./fixtures');

/**
 * 基础冒烟：真实 Electron 应用启动后，Today 入口显示 Agenda 与 Future Calendar，
 * 且 Header 显示"今日待处理"计数。
 */
test('Today 入口显示 Agenda 与 Future Calendar', async ({ window }) => {
  await expect(window.locator('.today-overview')).toBeVisible();
  await expect(window.locator('.agenda-view')).toBeVisible();
  await expect(window.locator('.future-calendar')).toBeVisible();

  // Header 显示今日待处理计数
  await expect(window.locator('.task-manager-category-count')).toContainText('今日待处理');
});
