# 重复任务功能设计文档

## 概述

在现有仅支持单次任务的基础上，新增通用的重复任务能力，支持每日、每周、每月、每年四种频率，提供结束条件（永不、某日、重复 N 次）、例外日期、单次实例编辑/完成的处理，并与已有的周视图、搜索、提醒通知无缝集成。

**范围：**
- 前端：任务编辑器的 UI 与列表/周视图的展示与交互
- 任务展开逻辑：按可见时间范围展开生成虚拟实例
- 数据持久化：最小侵入式 schema 扩展
- 提醒调度：针对即将到来的实例进行计划

## 架构

### 组件结构

在现有 TaskManager/WeeklyView 基础上扩展：

```
TaskManager.vue（现有）
├── TaskEditor.vue（增强：新增重复任务配置）
│   ├── RepeatSelector.vue（新）
│   └── NextOccurrencesPreview.vue（新）
├── TaskList.vue（现有，增强：显示重复标记、完成当前实例）
└── WeeklyView.vue（参考周视图方案，复用：展示展开后的实例）
```

### 数据流

1. **TaskEditor** 负责配置并保存任务的重复规则（复用现有保存流，新增 recurrence 字段）
2. **useTaskStore** 在对外暴露 filteredTasks 时，新增 expandRecurringTasks(rangeStart, rangeEnd) 逻辑，只在当前可见时间范围内展开虚拟实例
3. **WeeklyView/List** 使用展开后的"可展示实例集合"渲染；用户对"单个实例"的完成/编辑操作会落库为例外/覆盖信息
4. **通知服务** 在应用启动/定时触发时，基于"未来一段时间窗口（如 14 天）"展开并注册提醒

## 组件与接口

### 1. RepeatSelector.vue（重复规则选择器）

**Props:**
- `value: Object | null` - 当前重复规则对象（可为空）
- `baseReminderTime: Date` - 当前任务的提醒时间（用于初始化起始日与时刻）

**Emits:**
- `update:value` - 返回新的重复规则对象或 null（表示不重复）

**UI 要点:**
- 频率：Never（默认）/ Daily / Weekly / Monthly / Yearly
- 间隔：每 1 天/周/月/年，可选 1,2,3...
- Weekly: 选择一周中的星期几（按周一至周日，与周视图一致）
- Monthly: 默认"每月 N 日"（如果起始日在 31/30/29，自动处理短月）
- Yearly: 默认"每年同月同日"
- 结束条件：永不 / 在某日结束 / 重复 N 次结束
- 例外日期（ExDates，可选，高级设置）
- 时区/时刻：默认沿用 baseReminderTime 的本地时区与时刻

### 2. NextOccurrencesPreview.vue（下次实例预览）

**Props:**
- `rule: Object` - 重复规则
- `fromDate: Date` - 开始预览日期（通常为 now 或 baseReminderTime）
- `count: Number` - 预览实例数量（默认 3-5）
- `tz: String` - 时区

**功能:**
- 根据 rule 计算接下来几次的发生时间，展示为只读预览，帮助用户确认配置合理性

### 3. TaskEditor.vue（增强）

- 内嵌 RepeatSelector 和 NextOccurrencesPreview
- 保存时将 rule 序列化写入任务记录的 recurrence 字段
- 修改重复任务时提示"仅此实例/整个系列（及以后）"的策略（MVP 可先支持"整个系列"，单实例编辑进入覆盖流程）

### 4. TaskList.vue / WeeklyView.vue（增强）

- 展示展开后的实例（虚拟或落库的覆盖实例），在卡片/行上显示重复标记
- 操作入口：
  - 完成：默认"仅此实例"，写入 occurrence 覆盖/状态（不影响系列其它实例）
  - 编辑：默认"仅此实例"（生成 override），可提供"编辑整个系列"的入口

## 数据模型

在不大幅改动现有表的前提下，采用"系列+虚拟展开+按需落库覆盖"的混合模型。

### 任务记录扩展（表：tasks）

**新增字段：**
- `recurrence TEXT`（JSON，可为空）：重复规则
- `series_id TEXT`（可空）：当该记录是"覆盖实例"时，指向主任务 id；主任务本身 series_id = null
- `occurrence_date TEXT`（ISO 日期，可空）：该覆盖实例对应的实例日期

**记录类型：**
- **主任务：** recurrence 有值，series_id 为空，occurrence_date 为空
- **覆盖实例：** 复制必要字段 + 指定 series_id + occurrence_date

### 重复规则 JSON（recurrence 字段）

```json
{
  "freq": "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  "interval": 1,
  "byWeekday": [1, 2, 3, 4, 5, 6, 7],
  "byMonthDay": [1, 2, 3, ..., 31],
  "startDate": "2025-01-01",
  "time": { "hour": 9, "minute": 30 },
  "tz": "local",
  "until": "2025-12-31",
  "count": 10,
  "exDates": ["2025-02-10"]
}
```

**字段说明：**
- `freq`: 重复频率
- `interval`: 间隔（>=1）
- `byWeekday`: 仅 WEEKLY 使用，1=周一...7=周日
- `byMonthDay`: 可选，MONTHLY 用，不填则默认起始日
- `startDate`: 基于提醒时间的日期部分
- `time`: 提醒时刻
- `tz`: 时区（"local" 或 IANA 时区）
- `until`: 结束日期（与 count 互斥）
- `count`: 重复次数（与 until 互斥）
- `exDates`: 例外日期（不生成实例）

## 重复实例展开策略

### 范围展开（Range-based expansion）

**入口：** `expandRecurringTasks(tasks, rangeStart, rangeEnd)`

**行为：**
1. 对每个含 recurrence 的主任务，按规则在 [rangeStart, rangeEnd] 内生成发生时间列表
2. 过滤 exDates
3. 合并覆盖实例（按 series_id+occurrence_date 去重/替换）
4. 返回"可显示实例列表"

**仅在当前视图需要时展开：**
- 周视图：一周范围
- 列表视图：可用"未来 X 天"（如 30 天）
- 通知：未来 14 天窗口（可配置）

### 生成规则（MVP 简化实现）

- **DAILY：** 从 startDate 起，每 interval 天一次
- **WEEKLY：** 以 startDate 所在周为参考，每 interval 周，落在 byWeekday 指定的星期几
- **MONTHLY：** 每 interval 月的"同一天"（若 29/30/31 碰到短月，自动回退到该月最后一天）
- **YEARLY：** 每 interval 年的同月同日（2/29 在非闰年回退到 2/28）
- **结束条件：** 直到 until 或累计 count 次或超出 rangeEnd
- **时区：** 以 tz 解释日期与时刻，合并成提醒时间戳

### 覆盖合并（单次实例编辑/完成）

- 若存在 series_id + occurrence_date 的子任务（覆盖实例），优先使用覆盖实例替换虚拟实例
- 完成某个实例：写入覆盖实例（状态=completed，occurrence_date=该天），不影响系列其他实例

## UI/交互设计

### 创建/编辑任务

- 默认"重复：无"
- 选择 Daily/Weekly/Monthly/Yearly 时显示相应子选项（间隔、星期几、结束条件等）
- 下方展示 NextOccurrencesPreview（3-5 条）帮助校验
- 保存后，任务列表/周视图立即能看到未来实例（在可见范围内）

### 列表/周视图中的实例操作

**完成按钮：** 默认"仅此实例"，立即生成覆盖实例标记为 completed

**编辑按钮：**
- 仅此实例：生成覆盖实例并打开编辑
- 整个系列：编辑主任务的 recurrence 或内容

### 视觉标识

- 任务卡/行上增加"重复"徽标（如"D/W/M/Y"小标签）
- 在周视图中，展开的实例与普通任务一致显示，仅在 hover/tooltip 中说明"来自系列：xxx"

## Store 与服务集成

### useTaskStore

- 新增 `expandRecurringTasks(rangeStart, rangeEnd)`
- `filteredTasks` 在需要的视图逻辑中调用展开（避免全局无差别展开）

### 搜索

- 在内容搜索时匹配主任务内容；实例展示仍基于展开结果

### 通知服务

- 启动时与周期性刷新时，展开未来 N 天，注册提醒
- 提醒触发后推进窗口

### 同步/持久化

- 保存主任务带 recurrence
- 单次实例完成/编辑生成覆盖实例（series_id + occurrence_date）

## 持久化方案（SQLite 最小侵入）

### 数据库变更

**tasks 表新增列：**
```sql
ALTER TABLE tasks ADD COLUMN recurrence TEXT;
ALTER TABLE tasks ADD COLUMN series_id TEXT;
ALTER TABLE tasks ADD COLUMN occurrence_date TEXT;
```

**索引建议：**
```sql
CREATE INDEX idx_tasks_series ON tasks(series_id, occurrence_date);
```

**迁移脚本：**
- 给现有 tasks 表新增上述列（默认 null）
- 对既有数据无影响

## 提醒/通知集成

### 调度策略

- 维护未来 X 天（例如 14 天）的实例提醒计划
- 每次实例触达后刷新下一批

### 去重

- 同一 series_id + occurrence_date 在调度前做去重（覆盖实例优先）

### 应用重启恢复

- 启动时重新展开并注册

## 错误处理与边界情况

### 边界日期

- **月 29/30/31：** 短月回退到当月最后一天
- **2/29：** 非闰年回退至 2/28

### 时区与夏令时

- 规则按 tz 解释日期与时刻，生成本地时间戳
- 跨 DST 时保持"本地时刻语义"不变（例如每天 9:00）

### 数据校验

- interval >= 1
- 结束条件互斥（until 与 count 不能同时用）
- 例外日期不生成实例

### 降级

- 规则解析异常时，退回为"非重复"或提示用户修正

## 测试策略

### 单元测试

- 规则计算：Daily/Weekly/Monthly/Yearly 各种 interval、结束条件、例外日期
- 展开范围：给定 rangeStart/End 的正确过滤
- 覆盖合并：单次完成/编辑的覆盖优先
- 边界日期/DST 行为

### 集成测试

- 创建重复任务后在列表/周视图正确显示
- 完成某个实例后其他实例不受影响
- 编辑整个系列后未来实例更新
- 通知窗口调度

### 视觉测试

- 徽标、预览、选择器交互
- 周视图实例显示与对齐

## 迁移与发布

### 迁移脚本

- 添加 tasks 表新列与索引

### 渐进启用

- 功能默认启用，对既有任务无影响

### 回滚策略

- recurrence 字段与覆盖实例不影响单次任务可用性
- 如需回滚，可忽略 recurrence 并隐藏UI入口

## 性能与可维护性

- 展开按需、按范围，避免全量生成
- 规则实现分层：parseRule -> generateOccurrences -> mergeOverrides
- 预留未来扩展：每月"工作日/最后一个周五"等高级规则可在规则 JSON 中扩充

## MVP 范围建议

### 第一阶段

- 支持四类频率 + 间隔 + until/count（任选其一）+ exDates
- 单次实例：完成/编辑生成覆盖实例
- 列表/周视图：按范围展开显示
- 通知：未来 14 天窗口

### 后续迭代

- "此后实例生效/拆分系列"的高级编辑
- 更复杂的重复规则（工作日、最后一个周五等）
- 批量操作重复任务实例

## 实现计划

1. **数据模型与规则计算**（含单元测试）
2. **TaskEditor 的 RepeatSelector + 预览**
3. **列表/周视图与通知的集成**
4. **数据库迁移与持久化**
5. **集成测试与视觉测试**