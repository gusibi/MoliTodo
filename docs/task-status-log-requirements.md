# 任务状态日志功能需求文档

## 概述

本文档描述了为 MoliTodo 应用添加任务状态变化日志记录功能的需求和设计方案。该功能将记录每个任务的状态变化历史，为统计分析提供数据基础。

## 功能需求

### 1. 状态变化日志记录

#### 1.1 记录范围
- 仅记录任务状态发生实际变化的情况
- 不记录状态未发生变化的更新操作

#### 1.2 支持的状态变化类型
- `todo` → `doing`：开始执行任务
- `todo` → `done`：直接完成任务
- `doing` → `todo`：暂停执行，回到待办
- `doing` → `pause`：暂停执行
- `doing` → `done`：完成任务
- `done` → `todo`：重新激活已完成任务
- `pause` → `doing`：恢复执行
- `pause` → `todo`：从暂停回到待办
- `pause` → `done`：从暂停直接完成

### 2. 现有数据初始化

#### 2.1 初始化触发条件
- 应用启动时检查日志表是否为空
- 仅在日志表为空时执行初始化
- 初始化完成后不再重复执行

#### 2.2 初始化规则

**2.2.1 `todo` 状态任务**
- 不生成任何日志记录
- 理由：待办状态是任务的初始状态

**2.2.2 `doing` 状态任务**
- 生成一条 `doing` 状态的日志记录
- 创建时间使用任务的 `started_at` 字段
- 如果 `started_at` 为空，则使用 `updated_at` 字段

**2.2.3 `pause` 状态任务**
- 生成两条日志记录：
  1. `doing` 状态记录：创建时间使用 `started_at`
  2. `pause` 状态记录：创建时间使用 `updated_at`

**2.2.4 `done` 状态任务**
- 根据是否有 `started_at` 字段决定：
  - 如果有 `started_at`：生成 `doing` 和 `done` 两条记录
    - `doing` 记录：创建时间使用 `started_at`
    - `done` 记录：创建时间使用 `completed_at` 或 `updated_at`
  - 如果没有 `started_at`：仅生成 `done` 记录
    - `done` 记录：创建时间使用 `completed_at` 或 `updated_at`

## 数据库设计

### 任务状态日志表 (task_status_logs)

```sql
CREATE TABLE task_status_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 索引优化
CREATE INDEX idx_task_status_logs_task_id ON task_status_logs(task_id);
CREATE INDEX idx_task_status_logs_created_at ON task_status_logs(created_at);
CREATE INDEX idx_task_status_logs_to_status ON task_status_logs(to_status);
CREATE INDEX idx_task_status_logs_task_status ON task_status_logs(task_id, to_status);
```

### 字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | INTEGER | 主键，自增 |
| `task_id` | TEXT | 任务ID，外键关联 tasks 表 |
| `from_status` | TEXT | 变化前的状态，初始化时可为 NULL |
| `to_status` | TEXT | 变化后的状态 |
| `created_at` | TEXT | 状态变化时间 |
| `metadata` | TEXT | 扩展信息，JSON 格式 |

## 技术实现方案

### 1. 数据库迁移

- 在现有的数据库迁移系统中添加新的迁移版本
- 创建 `task_status_logs` 表
- 添加必要的索引

### 2. 日志记录服务

#### 2.1 TaskStatusLogService
```javascript
class TaskStatusLogService {
  // 记录状态变化
  async logStatusChange(taskId, fromStatus, toStatus, timestamp = null)
  
  // 获取任务状态历史
  async getTaskStatusHistory(taskId)
  
  // 获取状态变化统计
  async getStatusChangeStatistics(dateRange = null)
  
  // 初始化现有任务日志
  async initializeExistingTaskLogs()
}
```

#### 2.2 集成到任务更新流程
- 在 `TaskService.updateTaskStatus` 方法中集成日志记录
- 在 `updateTaskStatusWithTracking` 方法中添加日志记录调用

### 3. 应用启动初始化

- 在应用启动时检查日志表是否为空
- 如果为空，执行现有任务数据的初始化
- 确保初始化过程的幂等性

### 4. 统计功能增强

#### 4.1 新增统计指标
- 任务状态变化次数统计
- 任务平均执行时间
- 任务完成率趋势
- 状态变化频率分析

#### 4.2 StatisticsSettings.vue 增强
- 添加状态变化历史图表
- 添加任务执行效率分析
- 添加时间段筛选功能

## 数据完整性保证

### 1. 事务处理
- 任务状态更新和日志记录在同一事务中执行
- 确保数据一致性

### 2. 错误处理
- 日志记录失败不应影响任务状态更新
- 提供日志记录重试机制

### 3. 数据验证
- 验证状态变化的合法性
- 防止无效的状态转换

## 性能考虑

### 1. 索引优化
- 为常用查询字段添加索引
- 复合索引优化多条件查询

### 2. 数据清理
- 提供历史数据清理功能
- 支持按时间范围删除旧日志

### 3. 查询优化
- 使用分页查询处理大量历史数据
- 缓存常用统计结果

## 用户界面设计

### 1. 统计页面增强
- 状态变化时间线图表
- 任务执行效率仪表盘
- 可交互的数据筛选器

### 2. 任务详情页面
- 显示任务状态变化历史
- 状态变化时间轴

## 测试策略

### 1. 单元测试
- TaskStatusLogService 方法测试
- 数据库操作测试
- 初始化逻辑测试

### 2. 集成测试
- 任务状态更新流程测试
- 数据迁移测试
- 统计功能测试

### 3. 性能测试
- 大量数据下的查询性能
- 并发状态更新测试

## 实施计划

1. **阶段一**：数据库设计和迁移
2. **阶段二**：日志记录服务实现
3. **阶段三**：现有数据初始化
4. **阶段四**：统计功能增强
5. **阶段五**：用户界面优化
6. **阶段六**：测试和优化

## 风险评估

### 1. 数据迁移风险
- **风险**：现有数据迁移可能失败
- **缓解**：完整的备份和回滚机制

### 2. 性能影响
- **风险**：日志记录可能影响任务操作性能
- **缓解**：异步日志记录，索引优化

### 3. 存储空间
- **风险**：日志数据可能占用大量存储空间
- **缓解**：数据清理策略，压缩存储

## 总结

本功能将为 MoliTodo 应用提供强大的任务状态跟踪和统计分析能力，帮助用户更好地了解自己的工作模式和效率。通过合理的数据库设计和性能优化，确保功能的稳定性和可扩展性。