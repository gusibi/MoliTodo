const { test: base, expect, _electron: electron } = require('@playwright/test');
const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Electron 应用测试夹具（issue #14）。
 *
 * 使用真实渲染层、IPC、应用服务与 SQLite 持久化链路，
 * 独立用户数据目录，退出后清理测试进程与资源。
 */
const test = base.extend({
  app: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moli-e2e-'));
    let electronApp = null;

    // 启动真实 Electron 应用；若窗口未能在超时内就绪则重启一次，降低偶发竞争
    for (let attempt = 0; attempt < 2; attempt += 1) {
      electronApp = await electron.launch({
        args: ['.'],
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MOLI_E2E_USER_DATA: userDataDir
        }
      });
      const ready = await waitForTaskManagerWindow(electronApp, 30000);
      if (ready) break;
      await closeApp(electronApp);
      electronApp = null;
    }
    if (!electronApp) {
      throw new Error('Electron 应用未能在超时内启动任务管理窗口');
    }

    await use({ electronApp, userDataDir });

    await closeApp(electronApp);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  // 任务管理窗口：应用启动时自动打开（可能存在悬浮图标窗口，需按 URL 选择）
  window: async ({ app }, use) => {
    const page = await waitForTaskManagerWindow(app.electronApp, 45000);
    if (!page) throw new Error('未找到任务管理窗口');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.task-manager, .today-overview', { timeout: 45000 });
    await use(page);
  }
});

async function waitForTaskManagerWindow(electronApp, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const candidate = electronApp.windows().find((w) => w.url().includes('task-manager'));
    if (candidate) return candidate;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

async function closeApp(electronApp) {
  if (!electronApp) return;
  const closed = await Promise.race([
    electronApp.close().then(() => true).catch(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5000))
  ]);
  if (!closed) {
    const proc = electronApp.process();
    if (proc && !proc.killed) proc.kill('SIGKILL');
  }
}

/**
 * 通过主进程服务注入任务（测试夹具），
 * 不通过 mock，仍走真实 TaskService 与 SQLite。
 */
async function seedTasks(electronApp, tasks) {
  return electronApp.evaluate(async ({}, taskList) => {
    const app = global.__moliTodoApp;
    const created = [];
    for (const task of taskList) {
      const saved = await app.taskService.createTaskInList(
        task.content,
        task.listId === undefined ? 0 : task.listId,
        null,
        task
      );
      if (task.status && task.status !== saved.status) {
        await app.taskService.taskRepository.save(Object.assign(saved, { status: task.status }));
      }
      created.push(saved);
    }
    return created.map((t) => t.id);
  }, tasks);
}

module.exports = { test, expect, seedTasks };
