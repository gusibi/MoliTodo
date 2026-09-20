const { defineConfig } = require('@playwright/test');

/**
 * Electron E2E 配置（issue #14）。
 *
 * - 串行执行：Electron 应用为单例且使用真实 SQLite 文件，不能并发共享。
 * - 每个测试用独立用户数据目录与临时数据库，绝不读写开发者或用户真实数据。
 * - 失败时保留 trace 与截图，便于诊断。
 */
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
