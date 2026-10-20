const { test, expect } = require('./fixtures');

/**
 * 阶段 3：设置与清单危险操作的统一确认契约。
 * 复用真实 Electron 窗口、IPC 与隔离 SQLite。
 */

async function openSettings(app, window) {
  await window.getByRole('button', { name: '设置' }).click();
  let page = null;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    page = app.electronApp.windows().find((w) => w.url().includes('settings'));
    if (page) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!page) throw new Error('未找到设置窗口');
  await page.waitForSelector('.setting-main-container', { timeout: 30000 });
  return page;
}

test('恢复默认设置：统一确认、取消无副作用、确认关闭', async ({ app, window }) => {
  const settings = await openSettings(app, window);

  const resetBtn = settings.getByRole('button', { name: '恢复默认设置' });
  await resetBtn.click();

  const dialog = settings.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('确定要恢复默认设置吗');

  // 初始焦点在取消；遮罩点击不确认
  const cancelBtn = dialog.getByRole('button', { name: '取消' });
  await expect(cancelBtn).toBeFocused();
  await settings.mouse.click(5, 5);
  await expect(dialog).toBeVisible();

  await cancelBtn.click();
  await expect(settings.getByRole('alertdialog')).toHaveCount(0);
  await expect(resetBtn).toBeFocused();

  await resetBtn.click();
  await settings.getByRole('alertdialog').getByRole('button', { name: '恢复默认设置' }).click();
  await expect(settings.getByRole('alertdialog')).toHaveCount(0);
});

test('清除所有数据：统一确认、取消不重启且焦点返回触发控件', async ({ app, window }) => {
  const settings = await openSettings(app, window);

  await settings.locator('.setting-nav-item', { hasText: '数据管理' }).click();

  const clearBtn = settings.getByRole('button', { name: '清除所有数据' });
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();

  const dialog = settings.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('无法恢复');
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused();

  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(settings.getByRole('alertdialog')).toHaveCount(0);
  await expect(clearBtn).toBeFocused();
});

test('应用图标：C 系列可选且选择持久化', async ({ app, window }) => {
  const settings = await openSettings(app, window);

  await settings.locator('.setting-nav-item', { hasText: '外观' }).click();

  const options = settings.locator('.logo-option');
  await expect(options).toHaveCount(19);

  // A/B 系列 8 个 + C 系列 11 个，第 11 个是 C3 珐琅徽章
  await options.nth(10).click();

  const selectedLogo = await app.electronApp.evaluate(() =>
    global.__moliTodoApp.windowManager.configStore.get('selectedLogo')
  );
  expect(selectedLogo).toBe('c3');
  await expect(settings.locator('.logo-preview-name')).toHaveText('C3 珐琅徽章');
});

test('删除清单：统一确认、取消保留清单、确认删除', async ({ app, window }) => {
  await app.electronApp.evaluate(async () => {
    const moli = global.__moliTodoApp;
    await moli.listService.createList('旅行清单', '#007AFF', 'star');
  });
  await window.reload();
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  const listItem = window.locator('.nav-item', { hasText: '旅行清单' });
  await expect(listItem).toBeVisible();

  await listItem.click({ button: 'right' });
  await window.locator('.nav-context-item.danger').click();

  const dialog = window.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('旅行清单');

  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(listItem).toBeVisible();

  await listItem.click({ button: 'right' });
  await window.locator('.nav-context-item.danger').click();
  await window.getByRole('alertdialog').getByRole('button', { name: '删除清单' }).click();
  await expect(window.getByRole('alertdialog')).toHaveCount(0);
  await expect(window.locator('.nav-item', { hasText: '旅行清单' })).toHaveCount(0);
});
