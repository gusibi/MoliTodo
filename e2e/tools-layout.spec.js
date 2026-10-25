const { test, expect } = require('./fixtures');

/**
 * 工具页在中等窗口宽度下的排版回归：
 * 时长选项不能压缩到换行或相互重叠，页面不应出现横向滚动。
 */
test('工具页中等宽度下时长选项不挤压、页面无横向溢出', async ({ app, window: page }) => {
  await app.electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('task-manager'));
    win.setSize(1200, 900);
  });

  await page.locator('.task-manager-sidebar').getByRole('button', { name: '番茄专注' }).click();
  await expect(page.getByRole('heading', { name: '把注意力，留给一件事' })).toBeVisible();

  const durations = page.locator('.focus-durations > button');
  await expect(durations).toHaveCount(4);

  const boxes = await durations.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const unit = element.querySelector('.whitespace-nowrap');
    const unitRect = unit.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      unitHeight: unitRect.height,
      unitOverflow: unit.scrollWidth > unit.clientWidth + 1
    };
  }));

  for (const box of boxes) {
    expect(box.unitOverflow).toBe(false);
    expect(box.unitHeight).toBeLessThan(20);
  }

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlaps = !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      expect(overlaps).toBe(false);
    }
  }

  const horizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.locator('.task-manager-sidebar').getByRole('button', { name: 'Moli 小院' }).click();
  await expect(page.getByRole('button', { name: '重置视角' })).toBeVisible();
});
