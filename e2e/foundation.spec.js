const { test, expect, seedTasks } = require('./fixtures');

/**
 * 阶段 5：离线冷启动与五套主题的可读性回归。
 * 复用真实 Electron 渲染层与隔离 SQLite。
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

test('离线冷启动：无 Font Awesome CDN，核心图标本地渲染', async ({ app, window }) => {
  const externalRequests = [];
  window.on('request', (request) => {
    const url = request.url();
    if (/^https?:/i.test(url)) externalRequests.push(url);
  });
  await window.route('**', (route) => {
    const url = route.request().url();
    if (/^https?:/i.test(url)) return route.abort();
    return route.continue();
  });

  // 清空缓存后冷启动，确保离线显示不依赖浏览器缓存
  await app.electronApp.evaluate(({ session }) => session.defaultSession.clearCache());
  await window.reload();
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  // 不再引用远程字体图标样式，也没有字体图标元素
  const remoteIconLinks = await window.evaluate(() =>
    document.querySelectorAll('link[href*="font-awesome"], link[href*="cdnjs"]').length
  );
  expect(remoteIconLinks).toBe(0);
  expect(externalRequests.some((u) => /cdnjs|font-awesome/i.test(u))).toBe(false);

  const iconState = await window.evaluate(() => ({
    faElements: document.querySelectorAll('i[class*="fa-"], i[class*="fas"]').length,
    lucideSvgs: document.querySelectorAll('svg.lucide, svg[class*="lucide"]').length
  }));
  expect(iconState.faElements).toBe(0);
  // 核心入口图标为本地 Lucide SVG，离线仍可见
  expect(iconState.lucideSvgs).toBeGreaterThan(5);
  await expect(window.getByRole('button', { name: '搜索任务...' })).toBeVisible();
});

test('五套主题明暗模式：正文对比度、报告表单与主窗布局', async ({ app, window }, testInfo) => {
  await seedTasks(app.electronApp, [
    { content: '主题验收：长中文任务正文不会遮挡现有操作' },
    { content: 'Review long English task content and keyboard accessibility without adding features' }
  ]);
  await window.reload();
  await window.getByRole('navigation').getByRole('button', { name: /全部/ }).click();
  const settings = await openSettings(app, window);
  await settings.locator('.setting-nav-item', { hasText: '外观' }).click();
  const options = settings.locator('.color-theme-option');
  await expect(options).toHaveCount(5);

  const settleMotion = () => window.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
  });
  const textContrast = (locator) => locator.evaluate(el => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = values => values.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ancestors = [];
    for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) ancestors.unshift(ancestor);
    let surface = [255, 255, 255];
    for (const ancestor of ancestors) {
      const color = getComputedStyle(ancestor).backgroundColor.match(/[\d.]+/g).map(Number);
      const alpha = color[3] === undefined ? 1 : color[3];
      surface = surface.map((value, i) => color[i] * alpha + value * (1 - alpha));
    }
    const foreground = luminance(rgb(getComputedStyle(el).color));
    const background = luminance(surface);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });

  for (let i = 0; i < 5; i += 1) {
    await options.nth(i).click();
    const theme = await options.nth(i).innerText();
    for (const mode of ['浅色', '深色']) {
      await settings.getByRole('button', { name: mode, exact: true }).click();
      await expect.poll(() => window.evaluate(() => document.documentElement.dataset.theme)).toBe(mode === '浅色' ? 'light' : 'dark');
      const title = window.locator('.flat-task-item').first().locator('.flat-task-title');
      await expect(title).toBeVisible();
      await expect.poll(() => textContrast(title), { message: `${theme}/${mode} 任务正文对比度` }).toBeGreaterThanOrEqual(4.5);
      await settleMotion();
      await window.screenshot({ path: testInfo.outputPath(`theme-${i}-${mode}-main.png`) });
      await window.getByRole('button', { name: 'AI 报告', exact: true }).click();
      const dialog = window.getByRole('dialog', { name: '选择要生成报告的任务' });
      await expect(dialog).toBeVisible();
      await expect.poll(() => textContrast(dialog.locator('.task-content').first())).toBeGreaterThanOrEqual(4.5);
      await dialog.getByRole('checkbox', { name: /主题验收/ }).focus();
      await settleMotion();
      await window.screenshot({ path: testInfo.outputPath(`theme-${i}-${mode}-report.png`) });
      await window.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  }
  // 原生窗口尺寸回归：窄窗口仍可使用列表与报告表单。
  await app.electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('task-manager'));
    win.setSize(800, 700);
  });
  await expect.poll(() => window.evaluate(() => window.innerWidth)).toBeLessThanOrEqual(1000);
  await window.getByRole('button', { name: 'AI 报告', exact: true }).click();
  await expect(window.getByRole('combobox', { name: '报告类型' })).toBeVisible();
  await settleMotion();
  await window.screenshot({ path: testInfo.outputPath('narrow-report.png') });
});
