const { test, expect, seedTasks } = require('./fixtures');

test('今日重复设置的时间输入和图标保持紧凑，时间菜单可用', async ({ app, window }) => {
  await seedTasks(app.electronApp, [{ content: '重复设置布局', dueDate: new Date().toLocaleDateString('en-CA') }]);
  await window.reload();
  await window.locator('.today-task-row', { hasText: '重复设置布局' }).locator('.today-task-title').dblclick();
  const row = window.locator('.today-task-row').filter({ has: window.getByRole('region', { name: '任务详情' }) });
  await row.getByRole('switch', { name: '重复' }).click();
  const picker = row.locator('.repeat-time-picker');
  await expect(picker).toBeVisible();
  const bounds = await picker.boundingBox();
  expect(bounds.height).toBeLessThan(60);
  const icon = await picker.locator('svg').first().boundingBox();
  expect(icon.width).toBeLessThan(45);
  expect(icon.height).toBeLessThan(45);
  await picker.locator('input').click();
  await expect(window.locator('.dp__menu')).toBeVisible();
  const timeMenu = window.locator('.dp__menu');
  const menuBounds = await timeMenu.boundingBox();
  expect(menuBounds.height).toBeLessThan(120);
  expect(menuBounds.width).toBeLessThan(190);
  const timeFontSize = await timeMenu.locator('.dp__time_display').first().evaluate((element) =>
    parseFloat(getComputedStyle(element).fontSize));
  expect(timeFontSize).toBe(14);
  await window.screenshot({ path: 'test-results/repeat-time-menu.png', animations: 'disabled' });
  await window.keyboard.press('Escape');
  await expect(window.locator('.dp__menu')).toHaveCount(0);
  await window.screenshot({ path: 'test-results/repeat-after-light.png' });
  await row.locator('.end-condition-select').selectOption('date');
  await row.locator('.repeat-date-picker input').click();
  await expect(window.locator('.dp__menu')).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.locator('.dp__menu')).toHaveCount(0);
  await window.evaluate(() => document.documentElement.classList.add('dark'));
  await window.screenshot({ path: 'test-results/repeat-after-dark.png' });
});
