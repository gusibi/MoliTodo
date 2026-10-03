const { test, expect } = require('./fixtures');
const fs = require('fs');
const path = require('path');

test('背景预设、上传、配色、持久化和移除', async ({ app, window }) => {
  await window.getByRole('button', { name: '设置' }).click();
  await expect.poll(() => app.electronApp.windows().find(w => w.url().includes('settings'))?.url()).toBeTruthy();
  const settings = app.electronApp.windows().find(w => w.url().includes('settings'));
  await settings.locator('.setting-nav-item', { hasText: '外观' }).click();
  const screenshots = path.join(__dirname, '../screenshots/background');
  fs.mkdirSync(screenshots, { recursive: true });
  await settings.screenshot({ path: path.join(screenshots, 'before.png') });
  await settings.getByRole('button', { name: '雾山', exact: true }).click();
  await expect(window.locator('html')).toHaveClass(/has-app-background/);
  await expect(settings.getByRole('button', { name: '雾山', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => window.evaluate(() => getComputedStyle(document.querySelector('body > #app')).backgroundImage)).toContain('mountains');
  await expect(window.locator('.task-manager-view-container')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(window.locator('.task-manager-view-container')).toHaveCSS('backdrop-filter', 'none');
  await window.screenshot({ animations: 'disabled', path: path.join(screenshots, 'preset-main.png') });
  // Cover the actual content layers in every main-window view, including opaque platforms.
  await window.evaluate(() => document.documentElement.classList.add('platform-opaque'));
  await expect(window.locator('.task-manager-main-content')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await window.locator('.nav-item', { hasText: '全部' }).click();
  for (const [label, container] of [['列表视图', '.flat-task-list-container'], ['看板视图', '.kanban-board'], ['月视图', '.unified-calendar']]) {
    await window.getByRole('button', { name: label, exact: true }).click();
    await expect(window.locator(container)).toBeVisible();
    await expect(window.locator(container)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    if (label === '月视图') await expect(window.locator('.monthly-view')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await window.screenshot({ animations: 'disabled', path: path.join(screenshots, `preset-${label}.png`) });
  }
  await window.evaluate(() => document.documentElement.classList.remove('platform-opaque'));
  await window.locator('.nav-item', { hasText: '今天' }).click();
  await expect.poll(() => window.evaluate(() => window.electronAPI.config.getAll().then(c => c.background.preset))).toBe('mountains');
  // Build a local PNG through the real renderer, then upload through its file input.
  const encoded = await settings.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ca7048'; ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await settings.locator('#background-upload').setInputFiles({ name: '我的暖色背景.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  await expect(settings.getByText('我的暖色背景.png', { exact: true })).toBeVisible();
  await settings.getByRole('switch', { name: '跟随图片配色' }).click();
  await expect.poll(() => window.evaluate(() => document.documentElement.style.getPropertyValue('--primary'))).toMatch(/45% 28%/);
  await window.reload();
  await expect(window.locator('html')).toHaveClass(/has-app-background/);
  await expect.poll(() => window.evaluate(() => window.electronAPI.config.getAll().then(c => c.background.image))).toMatch(/^data:image\/jpeg;base64,/);
  await settings.getByRole('button', { name: '浅色', exact: true }).click();
  await settings.getByRole('button', { name: '更换图片', exact: true }).scrollIntoViewIfNeeded();
  await settings.screenshot({ path: path.join(screenshots, 'uploaded-light.png') });
  await window.screenshot({ animations: 'disabled', path: path.join(screenshots, 'main-light.png') });
  for (const theme of ['默认蓝色', 'Twitter', 'Vercel', 'Morandi Mist', '薄荷绿']) {
    await settings.locator('.color-theme-option', { hasText: theme }).click();
    for (const mode of ['浅色', '深色']) {
      await settings.getByRole('button', { name: mode, exact: true }).click();
      await expect(settings.locator('html')).toHaveClass(mode === '深色' ? /dark/ : /light/);
      await expect.poll(() => window.evaluate(() => document.documentElement.style.getPropertyValue('--primary'))).toMatch(mode === '深色' ? /45% 72%/ : /45% 28%/);
      await window.screenshot({ animations: 'disabled', path: path.join(screenshots, `${theme}-${mode}.png`) });
    }
  }
  await settings.getByRole('button', { name: '更换图片', exact: true }).scrollIntoViewIfNeeded();
  await settings.screenshot({ path: path.join(screenshots, 'uploaded-dark.png') });
  await app.electronApp.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('task-manager'));
    main.setSize(780, 650);
  });
  await window.screenshot({ animations: 'disabled', path: path.join(screenshots, 'main-narrow.png') });
  await settings.getByRole('button', { name: '柔和波纹', exact: true }).focus();
  await settings.keyboard.press('Enter');
  await expect(settings.getByRole('button', { name: '柔和波纹', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await settings.locator('#background-upload').setInputFiles({ name: '我的暖色背景.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  await expect(settings.getByText('我的暖色背景.png', { exact: true })).toBeVisible();
  await settings.locator('#background-upload').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
  await expect(settings.getByRole('alert')).toContainText('无法读取图片');
  await expect(settings.getByText('我的暖色背景.png', { exact: true })).toBeVisible();
  await settings.getByRole('button', { name: '移除背景', exact: true }).click();
  await expect(window.locator('html')).not.toHaveClass(/has-app-background/);
  await expect.poll(() => window.evaluate(() => document.documentElement.style.getPropertyValue('--primary'))).toBe('');
});


test('预设背景可以移除，重新打开设置仍保持无背景', async ({ app, window }) => {
  await window.getByRole('button', { name: '设置' }).click();
  await expect.poll(() => app.electronApp.windows().find(w => w.url().includes('settings'))?.url()).toBeTruthy();
  const settings = app.electronApp.windows().find(w => w.url().includes('settings'));
  await settings.locator('.setting-nav-item', { hasText: '外观' }).click();
  await settings.getByRole('button', { name: '雾山', exact: true }).click();
  await settings.getByRole('button', { name: '移除背景', exact: true }).click();
  await expect(settings.locator('html')).not.toHaveClass(/has-app-background/);
  await expect(window.locator('html')).not.toHaveClass(/has-app-background/);
  await expect.poll(() => settings.evaluate(() => window.electronAPI.config.getAll().then(c => c.background))).toBeNull();
  await settings.reload();
  await settings.locator('.setting-nav-item', { hasText: '外观' }).click();
  await expect(settings.locator('html')).not.toHaveClass(/has-app-background/);
  await expect(settings.getByRole('button', { name: '雾山', exact: true })).toHaveAttribute('aria-pressed', 'false');
});
