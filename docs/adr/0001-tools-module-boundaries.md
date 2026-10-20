# 工具域模块边界

- Status: accepted
- Date: 2026-10-20

## Context

健康提醒、番茄专注、植物成长、奖励与 Moli 小院将同时进入 MoliTodo。它们共享行为事件、成长值和读模型，但不属于 Task；实现时必须避免把规则散进 IPC、窗口管理、渲染层 store 和各张表的调用方。

## Decision

外部只暴露四个能力模块：`reminder`、`focus`、`garden`、`data-port`。`garden` 内部包含 `growth-policy`、`rewards`、`collection` 三个可独立测试的模块；`clock` 是共享依赖，只在主进程提供最小接口；`tools-use-cases` 是应用层编排模块，拥有跨能力事务；`tools-read-model` 只提供 `ShellSnapshot` 和 `GardenView`，并通过一个 `tools-updated` 事件通知渲染层。

配套决策：

- 行为事件使用追加式 `activity_events` 账本；`activity_daily_summary` 与 `growth_days` 是可重建派生数据，植物/收藏状态以各自表为准。
- `inventory_items` 是唯一的所有权记录；`plant_instances` 只保存生长历史；种子是消耗品计数，物种解锁是永久标记。
- 专注计时由主进程 `focus` 模块持有，休眠暂停，渲染层只显示快照。
- 健康提醒由 DB 驱动的 tick 产生 `PopupIntent`，弹窗只是主进程适配器；任务提醒在 V1 保持现状。
- `data-port` 使用显式表 allowlist，不自动发现 `sqlite_master`。
- 新功能只新增表；v7 迁移是这些表的唯一 schema 来源，不修改 `tasks`。

## Considered Options

- **八个外部模块**（growth、rewards、collection 分别暴露）：调用方需要自己协调三张表和事务，IPC 会重新变成编排层，拒绝。
- **渲染层持有专注计时**：窗口关闭、重启和休眠都会丢状态，拒绝。
- **摆放同时引用库存和植物实例**：出现两套所有权真相，拒绝。
- **从 `sqlite_master` 自动导出**：会带出内部表且无法控制外键顺序，拒绝。
- **完整事件溯源**：V1 过重；只把行为事件做成账本，植物与收藏保留当前状态表。

## Consequences

- 任务提醒与健康提醒在 V1 是两条路径；只有未来任务提醒迁移时才考虑合并。
- 渲染层不再计算时间、成长日或角标；所有界面依赖读模型和 `tools-updated`。
- v7 是一次较大的迁移，需要先修复 WAL 备份，避免 `fs.copyFile` 漏掉 `-wal`。
- 测试分为纯策略 + 假时钟、临时 SQLite 集成、Electron E2E 三层；时间规则不依赖真实等待。
