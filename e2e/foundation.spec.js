const { test, expect } = require('./fixtures');

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

test('五套颜色主题与明暗模式切换后基础组件仍可读', async ({ app, window }) => {
  await window.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });

  const readVars = () => window.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      primary: style.getPropertyValue('--primary').trim(),
      background: style.getPropertyValue('--background').trim(),
      foreground: style.getPropertyValue('--foreground').trim()
    };
  });

  const settings = await openSettings(app, window);
  await settings.locator('.setting-nav-item', { hasText: '外观' }).click();

  const options = settings.locator('.color-theme-option');
  const count = await options.count();
  expect(count).toBe(5);

  const primaries = new Set();
  for (let i = 0; i < count; i += 1) {
    await options.nth(i).click();
    await expect.poll(async () => (await readVars()).primary, { timeout: 10000 }).not.toBe('');
    primaries.add((await readVars()).primary);
  }
  // 不同主题提供不同主色，且都非空
  expect(primaries.size).toBeGreaterThan(1);

  // 通过真实深色开关切换，主窗口背景 token 随之变化
  const light = await readVars();
  expect(light.background).not.toBe('');
  expect(light.foreground).not.toBe('');

  await settings.getByRole('button', { name: '深色' }).click();
  await expect.poll(async () => (await readVars()).background, { timeout: 10000 }).not.toBe(light.background);

  await settings.getByRole('button', { name: '浅色' }).click();
  await expect.poll(async () => (await readVars()).background, { timeout: 10000 }).toBe(light.background);
});
