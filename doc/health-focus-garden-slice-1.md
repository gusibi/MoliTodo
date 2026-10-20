# 健康提醒 / 专注 / 小院 · 第一条垂直切片

| 项目 | 内容 |
| --- | --- |
| 版本 | v0.1 |
| 日期 | 2026-10-20 |
| 状态 | 待实现 |
| 父文档 | [设计定稿](./health-focus-garden-spec.md) · [ADR-0001](../docs/adr/0001-tools-module-boundaries.md) |
| 切片名称 | 水 → 植物 → 种子 → shell |

## 1. 目标

用一条最小闭环验证架构接缝，而不是先铺满所有界面：

> 创建一条喝水规则 → 到点弹窗 → 确认 → 写入行为事件 → 植物获得成长值 → 15 分成熟 → 产出种子并自动种植 → 成长日 → 里程碑解锁 → 侧栏/菜单栏角标更新。

这条切片跑通后，再接入番茄专注、奖励领取 UI、收藏/图鉴、小院场景和扩建。

## 2. 范围

### 包含

- v7 迁移：15 张新表全部建立，不修改 `tasks`。
- `clock`：主进程唯一时间源，支持假时钟测试。
- `activity_events` 追加账本、`activity_daily_summary`、`growth_days`。
- `withTransaction` 与 `tools-use-cases` 的跨表事务边界。
- `growth-policy`：每日上限、阶段、成长日、种子产出、里程碑资格。
- `garden.recordActivity`、当前植物、种子、成熟树入库、自动种植。
- 一条喝水规则：创建时刻 / 整点锚点、10 分钟粒度、有效窗口、星期。
- `reminder` 的 `tick` / `respond`；`ReminderPopupPresenter` 弹窗。
- `getShellSnapshot`：今日水滴数、植物阶段、待领取数。
- 侧栏“工具”分组与“Moli 小院”角标、菜单栏下拉的待领取数字。
- 用种子数据验证“补水起步”里程碑解锁，不实现领取界面。

### 不包含

- 番茄专注 UI 与计时（`focus_sessions` 表先建好，暂不使用）。
- 奖励领取界面、候选池 UI。
- 收藏/图鉴、小院场景、摆放、扩建。
- 护眼提醒。
- data-port 的导出/导入/清空 UI（发布前必须补齐，但不阻塞本切片）。
- 本地 API / MCP 暴露新工具数据。

## 3. 数据表

v7 建立以下表，均使用新表名，不改 `tasks`：

`reminder_rules`、`reminder_occurrences`、`focus_sessions`、`activity_events`、`activity_daily_summary`、`plant_instances`、`seed_inventory`、`species_unlocks`、`growth_days`、`garden_state`、`garden_expansions`、`milestone_unlocks`、`reward_claims`、`inventory_items`、`garden_placements`。

关键约束：

- `activity_events.dedupe_key` 唯一。
- `reminder_occurrences (rule_id, scheduled_at)` 唯一。
- `daily_plants` 不再使用；植物生长记录为 `plant_instances`。
- `inventory_items` 是唯一所有权记录；成熟树用 `origin_type='plant_instance'`。
- `garden_placements.inventory_id` 唯一。
- `growth_days.local_date` 唯一。

## 4. 验收场景

| ID | 场景 | 预期 |
| --- | --- | --- |
| S1-01 | fresh DB 与 v6 DB 升级到 v7 | 15 张表存在；`tasks` 结构与数据不变；备份包含 WAL 内容 |
| S1-02 | 08:40 创建 60 分钟规则，窗口 09:00–18:00 | created 模式首次 09:40；hour 模式首次 09:00 |
| S1-03 | 最小 10 分钟间隔 | 10 分钟可保存；小于 10 被拒绝或归一到 10 |
| S1-04 | 时钟向前跳 4 小时 | 不补发历史弹窗；只计算下一个未来槽位 |
| S1-05 | 同一分钟两条规则到期 | 只有一个弹窗，两行确认动作 |
| S1-06 | 弹窗 45 秒无操作 | 实例标记 expired；不发成长值；不重复弹 |
| S1-07 | 重复点击“已喝水” | 只有一条 occurrence 确认、一个 activity event、一次成长值 |
| S1-08 | 当日第 4 次喝水确认 | 事件仍记录；成长值为 0；弹窗提示今日水滴已满 |
| S1-09 | 植物累计 0/5/10/15 | 阶段分别为种子/发芽/幼苗/成熟；15 分后产 1 枚同物种种子 |
| S1-10 | 自动种植开启且有种子 | 成熟树入库，种子被消耗，新植物立即开始 |
| S1-11 | 无种子且无生长中植物 | 可领取 1 枚基础种子；不产生成长值 |
| S1-12 | 当天 1 次喝水 / 2 次喝水 | 1 次不算成长日；2 次算成长日 |
| S1-13 | 预置 30 次健康确认 | “补水起步”里程碑只解锁一次；待领取数为 1 |
| S1-14 | 确认后查看侧栏/菜单栏 | 今日水滴数、植物阶段、待领取数一致；重启后仍一致 |
| S1-15 | 写入过程中模拟数据库失败 | 事务回滚；occurrence 与成长值都不落库；重试成功且不重复 |
| S1-16 | 任务列表与托盘 | 任务数量、今日列表、任务统计不变 |
| S1-17 | 深色/浅色、减少动效、窄窗口 | 弹窗和角标可读、可操作；动画可关闭 |
| S1-18 | 现有任务提醒 E2E | 既有任务提醒行为不回归 |

## 5. 测试方式

### 单元测试

- `clock`：本地日期、时区偏移、DST 边界。
- 提醒槽位：created/hour 锚点、10 分钟粒度、窗口边界、跨天。
- `growth-policy`：+2 水滴、10 次专注上限、阶段 0/5/10/15、成长日、种子产出、里程碑资格。
- 奖励资格：重复事件、重复里程碑、待领取只创建一次。

### 集成测试

- 临时 SQLite：v6 fixture 升级到 v7；fresh DB 直接到 v7。
- `tools-use-cases` + 假时钟：确认喝水、重复确认、上限、成熟、成长日、里程碑。
- `withTransaction` 回滚：在写 occurrence 后抛错，断言无残留。
- 数据量：30 天 occurrence 清理不影响植物与收藏。

### E2E

- 复用 `e2e/fixtures.js` 的独立用户目录与临时数据库。
- 仅在 `MOLI_E2E_USER_DATA` 下暴露测试时钟推进方法，不进入生产路径。
- 场景：创建规则 → 推进到下一次触发 → 弹窗 → 确认 → 侧栏角标 → 重启 → 不重复。
- 回归：`today-overview.spec.js`、`float-view.spec.js`、`settings.spec.js`。

## 6. 实现顺序

| 步骤 | 内容 |
| --- | --- |
| 1 | `clock`、v7 迁移、WAL 备份修复 |
| 2 | `activity_events` / `activity_daily_summary` / `growth_days`、`withTransaction` |
| 3 | `growth-policy`、`garden.recordActivity`、植物/种子、里程碑资格 |
| 4 | `reminder` tick/respond、`ReminderPopupPresenter` |
| 5 | `tools-use-cases`、`getShellSnapshot`、侧栏/菜单栏角标 |
| 6 | 单元/集成/E2E、现有回归 |

## 7. 退出标准

- S1-01 至 S1-18 全部通过。
- `npm test` 通过；相关 Electron E2E 通过。
- `tasks` 表没有新增字段，任务提醒行为无回归。
- 导出/清空尚未覆盖新表的问题已记录，并在发布前由 data-port 切片关闭。
- 文档中的数值、表名、接口与实现一致；如偏离，先更新本文和 ADR。
