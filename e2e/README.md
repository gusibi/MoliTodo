# Today 综合视图 E2E（issue #14）

真实 Electron 端到端测试：启动应用、从 Sidebar 进入 Today、通过实际控件创建 / 排期 /
日期导航 / 搜索 / 编辑 / 完成，断言可见分组、计数、日期点与持久化结果。

## 前置

- 已完成依赖安装（`npm install`）。
- 首次运行需构建渲染层（脚本会自动执行 `npm run build:renderer`）。

## 运行

```bash
# 全量 E2E（会先构建渲染层）
npm run test:e2e

# 仅 Today 关键旅程
npm run test:e2e:today

# 单个场景
npx playwright test e2e/today-overview.spec.js -g "今天截止但安排在明天"
```

## 隔离与清理

- 每个测试使用独立临时用户数据目录与临时 SQLite 数据库
  （`MOLI_E2E_USER_DATA`，见 `e2e/fixtures.js`），不读写开发者或用户真实数据。
- 任务通过真实 `TaskService` 预置，仍走真实 IPC、领域规则与 SQLite 持久化链路。
- 测试退出时关闭 Electron 进程并清理临时目录；超时会强制结束进程。

## 失败诊断

- 失败用例在 `test-results/` 下生成截图、`error-context.md` 与 Playwright trace。
- 查看 trace：`npx playwright show-trace <trace.zip>`。
- 默认不启用无条件重试，避免掩盖不稳定用例。

## 环境说明

E2E 需要可启动 Electron 的图形环境。若 CI 无法启动 Electron，请在报告中明确说明
未验证的 E2E 及原因，不能用页面或服务单元测试替代。
