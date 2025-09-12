# 任务状态日志功能技术设计文档

## 概述

本文档详细描述了任务状态日志功能的技术实现方案，包括数据库设计、服务层架构、集成方案和具体的代码实现。

## 架构设计

### 1. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                        │
├─────────────────────────────────────────────────────────────┤
│  StatisticsSettings.vue  │  TaskStatusLogChart.vue         │
│  (统计页面)               │  (状态变化图表)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC Communication
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                           │
├─────────────────────────────────────────────────────────────┤
│  TaskStatusLogService    │  TaskService                    │
│  (日志记录服务)           │  (任务服务)                      │
├─────────────────────────────────────────────────────────────┤
│  SqliteTaskStatusLogRepository                              │
│  (日志数据仓储)                                              │
├─────────────────────────────────────────────────────────────┤
│  SQLite Database                                            │
│  ├── tasks (现有表)                                         │
│  └── task_status_logs (新增表)                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. 领域模型

#### 2.1 TaskStatusLog 实体

```javascript
// src/domain/entities/task-status-log.js
class TaskStatusLog {
  constructor({
    id = null,
    taskId,
    fromStatus = null,
    toStatus,
    createdAt = new Date().toISOString(),
    metadata = {}
  }) {
    this.id = id;
    this.taskId = taskId;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.createdAt = createdAt;
    this.metadata = metadata;
  }

  // 验证状态变化的合法性
  static isValidStatusTransition(fromStatus, toStatus) {
    const validTransitions = {
      'todo': ['doing', 'done'],
      'doing': ['todo', 'pause', 'done'],
      'pause': ['todo', 'doing', 'done'],
      'done': ['todo']
    };
    
    if (!fromStatus) return true; // 初始化时允许
    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  // 获取状态变化描述
  getTransitionDescription() {
    const descriptions = {
      'todo->doing': '开始执行',
      'todo->done': '直接完成',
      'doing->todo': '暂停执行',
      'doing->pause': '暂停',
      'doing->done': '完成任务',
      'done->todo': '重新激活',
      'pause->todo': '回到待办',
      'pause->doing': '恢复执行',
      'pause->done': '直接完成'
    };
    
    const key = `${this.fromStatus}->${this.toStatus}`;
    return descriptions[key] || '状态变化';
  }
}

module.exports = TaskStatusLog;
```

## 数据库设计

### 1. 数据库迁移 (Migration 004)

```javascript
// src/infrastructure/persistence/database-migration.js
// 在现有迁移中添加

/**
 * 迁移 004: 添加任务状态日志表
 */
async migration_004_add_task_status_logs() {
  console.log('执行迁移: 添加任务状态日志表');
  
  // 创建任务状态日志表
  await this.db.exec(`
    CREATE TABLE IF NOT EXISTS task_status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT DEFAULT '{}',
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_task_id ON task_status_logs(task_id)');
  await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_created_at ON task_status_logs(created_at)');
  await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_to_status ON task_status_logs(to_status)');
  await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_task_status ON task_status_logs(task_id, to_status)');
  await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_transition ON task_status_logs(from_status, to_status)');

  console.log('任务状态日志表创建完成，索引已创建');
}
```

### 2. 数据仓储实现

```javascript
// src/infrastructure/persistence/sqlite-task-status-log-repository.js
const TaskStatusLog = require('../../domain/entities/task-status-log');

class SqliteTaskStatusLogRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 保存状态日志
   */
  async save(taskStatusLog) {
    const sql = `
      INSERT INTO task_status_logs (task_id, from_status, to_status, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await this.db.run(sql, [
      taskStatusLog.taskId,
      taskStatusLog.fromStatus,
      taskStatusLog.toStatus,
      taskStatusLog.createdAt,
      JSON.stringify(taskStatusLog.metadata)
    ]);
    
    return result.lastID;
  }

  /**
   * 批量保存状态日志
   */
  async batchSave(taskStatusLogs) {
    const sql = `
      INSERT INTO task_status_logs (task_id, from_status, to_status, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const stmt = await this.db.prepare(sql);
    
    try {
      await this.db.exec('BEGIN TRANSACTION');
      
      for (const log of taskStatusLogs) {
        await stmt.run([
          log.taskId,
          log.fromStatus,
          log.toStatus,
          log.createdAt,
          JSON.stringify(log.metadata)
        ]);
      }
      
      await this.db.exec('COMMIT');
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    } finally {
      await stmt.finalize();
    }
  }

  /**
   * 获取任务状态历史
   */
  async findByTaskId(taskId) {
    const sql = `
      SELECT * FROM task_status_logs 
      WHERE task_id = ? 
      ORDER BY created_at ASC
    `;
    
    const rows = await this.db.all(sql, [taskId]);
    return rows.map(row => this.rowToTaskStatusLog(row));
  }

  /**
   * 获取状态变化统计
   */
  async getStatusChangeStatistics(startDate = null, endDate = null) {
    let sql = `
      SELECT 
        from_status,
        to_status,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM task_status_logs
    `;
    
    const params = [];
    const conditions = [];
    
    if (startDate) {
      conditions.push('created_at >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push('created_at <= ?');
      params.push(endDate);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' GROUP BY from_status, to_status, DATE(created_at) ORDER BY created_at DESC';
    
    return await this.db.all(sql, params);
  }

  /**
   * 检查日志表是否为空
   */
  async isEmpty() {
    const result = await this.db.get('SELECT COUNT(*) as count FROM task_status_logs');
    return result.count === 0;
  }

  /**
   * 获取任务执行时间统计
   */
  async getTaskExecutionTimeStats(taskId) {
    const sql = `
      SELECT 
        from_status,
        to_status,
        created_at,
        LAG(created_at) OVER (ORDER BY created_at) as prev_created_at
      FROM task_status_logs 
      WHERE task_id = ? 
      ORDER BY created_at ASC
    `;
    
    const rows = await this.db.all(sql, [taskId]);
    
    // 计算各状态的持续时间
    const durations = {
      doing: 0,
      pause: 0,
      total: 0
    };
    
    for (let i = 1; i < rows.length; i++) {
      const current = rows[i];
      const previous = rows[i - 1];
      
      if (previous.prev_created_at) {
        const duration = new Date(current.created_at) - new Date(previous.created_at);
        
        if (previous.to_status === 'doing') {
          durations.doing += duration;
        } else if (previous.to_status === 'pause') {
          durations.pause += duration;
        }
        
        durations.total += duration;
      }
    }
    
    return durations;
  }

  /**
   * 数据行转换为实体
   */
  rowToTaskStatusLog(row) {
    return new TaskStatusLog({
      id: row.id,
      taskId: row.task_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      createdAt: row.created_at,
      metadata: JSON.parse(row.metadata || '{}')
    });
  }

  /**
   * 清理历史数据
   */
  async cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const sql = 'DELETE FROM task_status_logs WHERE created_at < ?';
    const result = await this.db.run(sql, [cutoffDate.toISOString()]);
    
    return result.changes;
  }
}

module.exports = SqliteTaskStatusLogRepository;
```

## 服务层设计

### 1. TaskStatusLogService

```javascript
// src/domain/services/task-status-log-service.js
const TaskStatusLog = require('../entities/task-status-log');

class TaskStatusLogService {
  constructor(taskStatusLogRepository, taskRepository) {
    this.taskStatusLogRepository = taskStatusLogRepository;
    this.taskRepository = taskRepository;
  }

  /**
   * 记录状态变化
   */
  async logStatusChange(taskId, fromStatus, toStatus, timestamp = null) {
    // 验证状态变化的合法性
    if (!TaskStatusLog.isValidStatusTransition(fromStatus, toStatus)) {
      console.warn(`无效的状态转换: ${fromStatus} -> ${toStatus}`);
      return null;
    }

    // 如果状态没有变化，不记录日志
    if (fromStatus === toStatus) {
      return null;
    }

    const taskStatusLog = new TaskStatusLog({
      taskId,
      fromStatus,
      toStatus,
      createdAt: timestamp || new Date().toISOString(),
      metadata: {
        transition: `${fromStatus || 'null'}->${toStatus}`,
        timestamp: Date.now()
      }
    });

    try {
      const logId = await this.taskStatusLogRepository.save(taskStatusLog);
      console.log(`状态变化已记录: 任务 ${taskId} 从 ${fromStatus} 变为 ${toStatus}`);
      return logId;
    } catch (error) {
      console.error('记录状态变化失败:', error);
      // 不抛出异常，避免影响任务状态更新
      return null;
    }
  }

  /**
   * 获取任务状态历史
   */
  async getTaskStatusHistory(taskId) {
    return await this.taskStatusLogRepository.findByTaskId(taskId);
  }

  /**
   * 获取状态变化统计
   */
  async getStatusChangeStatistics(dateRange = null) {
    const startDate = dateRange?.start;
    const endDate = dateRange?.end;
    
    return await this.taskStatusLogRepository.getStatusChangeStatistics(startDate, endDate);
  }

  /**
   * 初始化现有任务日志
   */
  async initializeExistingTaskLogs() {
    // 检查日志表是否为空
    const isEmpty = await this.taskStatusLogRepository.isEmpty();
    if (!isEmpty) {
      console.log('日志表不为空，跳过初始化');
      return { initialized: false, reason: 'logs_exist' };
    }

    console.log('开始初始化现有任务日志...');
    
    // 获取所有任务
    const tasks = await this.taskRepository.findAll();
    const logsToCreate = [];

    for (const task of tasks) {
      const logs = this.generateInitialLogsForTask(task);
      logsToCreate.push(...logs);
    }

    if (logsToCreate.length > 0) {
      await this.taskStatusLogRepository.batchSave(logsToCreate);
      console.log(`初始化完成，创建了 ${logsToCreate.length} 条日志记录`);
    }

    return { 
      initialized: true, 
      logsCreated: logsToCreate.length,
      tasksProcessed: tasks.length 
    };
  }

  /**
   * 为单个任务生成初始日志
   */
  generateInitialLogsForTask(task) {
    const logs = [];
    const status = task.status;

    switch (status) {
      case 'todo':
        // todo 状态不生成日志
        break;

      case 'doing':
        // 生成 doing 状态日志
        logs.push(new TaskStatusLog({
          taskId: task.id,
          fromStatus: null,
          toStatus: 'doing',
          createdAt: task.startedAt || task.updatedAt,
          metadata: { source: 'initialization', originalStatus: 'doing' }
        }));
        break;

      case 'pause':
        // 生成 doing 和 pause 状态日志
        logs.push(new TaskStatusLog({
          taskId: task.id,
          fromStatus: null,
          toStatus: 'doing',
          createdAt: task.startedAt || task.updatedAt,
          metadata: { source: 'initialization', originalStatus: 'pause' }
        }));
        
        logs.push(new TaskStatusLog({
          taskId: task.id,
          fromStatus: 'doing',
          toStatus: 'pause',
          createdAt: task.updatedAt,
          metadata: { source: 'initialization', originalStatus: 'pause' }
        }));
        break;

      case 'done':
        // 根据是否有 startedAt 决定生成的日志
        if (task.startedAt) {
          // 生成 doing 和 done 日志
          logs.push(new TaskStatusLog({
            taskId: task.id,
            fromStatus: null,
            toStatus: 'doing',
            createdAt: task.startedAt,
            metadata: { source: 'initialization', originalStatus: 'done' }
          }));
          
          logs.push(new TaskStatusLog({
            taskId: task.id,
            fromStatus: 'doing',
            toStatus: 'done',
            createdAt: task.completedAt || task.updatedAt,
            metadata: { source: 'initialization', originalStatus: 'done' }
          }));
        } else {
          // 仅生成 done 日志
          logs.push(new TaskStatusLog({
            taskId: task.id,
            fromStatus: null,
            toStatus: 'done',
            createdAt: task.completedAt || task.updatedAt,
            metadata: { source: 'initialization', originalStatus: 'done' }
          }));
        }
        break;
    }

    return logs;
  }

  /**
   * 获取任务执行效率统计
   */
  async getTaskEfficiencyStats(dateRange = null) {
    const statistics = await this.getStatusChangeStatistics(dateRange);
    
    // 计算各种效率指标
    const stats = {
      totalTasks: 0,
      completedTasks: 0,
      averageCompletionTime: 0,
      statusTransitions: {},
      dailyStats: {}
    };

    // 处理统计数据
    for (const stat of statistics) {
      const transition = `${stat.from_status || 'start'}->${stat.to_status}`;
      
      if (!stats.statusTransitions[transition]) {
        stats.statusTransitions[transition] = 0;
      }
      stats.statusTransitions[transition] += stat.count;
      
      if (stat.to_status === 'done') {
        stats.completedTasks += stat.count;
      }
      
      if (!stats.dailyStats[stat.date]) {
        stats.dailyStats[stat.date] = {
          transitions: 0,
          completions: 0
        };
      }
      
      stats.dailyStats[stat.date].transitions += stat.count;
      if (stat.to_status === 'done') {
        stats.dailyStats[stat.date].completions += stat.count;
      }
    }

    return stats;
  }
}

module.exports = TaskStatusLogService;
```

## 集成方案

### 1. 修改 TaskService

```javascript
// src/domain/services/task-service.js
// 在现有 TaskService 中添加日志记录功能

class TaskService {
  constructor(taskRepository, listRepository, taskStatusLogService = null) {
    this.taskRepository = taskRepository;
    this.listRepository = listRepository;
    this.taskStatusLogService = taskStatusLogService;
  }

  /**
   * 更新任务状态（增强版本，包含日志记录）
   */
  async updateTaskStatusWithLogging(taskId, newStatus) {
    // 获取当前任务
    const currentTask = await this.taskRepository.findById(taskId);
    if (!currentTask) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    const oldStatus = currentTask.status;
    
    // 如果状态没有变化，直接返回
    if (oldStatus === newStatus) {
      return { success: true, task: currentTask, statusChanged: false };
    }

    try {
      // 更新任务状态
      const updatedTask = await this.updateTaskStatus(taskId, newStatus);
      
      // 记录状态变化日志
      if (this.taskStatusLogService) {
        await this.taskStatusLogService.logStatusChange(
          taskId, 
          oldStatus, 
          newStatus
        );
      }

      return { 
        success: true, 
        task: updatedTask, 
        statusChanged: true,
        fromStatus: oldStatus,
        toStatus: newStatus
      };
    } catch (error) {
      console.error('更新任务状态失败:', error);
      throw error;
    }
  }

  // ... 其他现有方法保持不变
}
```

### 2. IPC 处理器扩展

```javascript
// src/main/ipc-handlers.js
// 添加状态日志相关的 IPC 处理器

const { ipcMain } = require('electron');

// 任务状态日志相关处理器
ipcMain.handle('task-status-log:getHistory', async (event, { taskId }) => {
  try {
    const history = await taskStatusLogService.getTaskStatusHistory(taskId);
    return { success: true, data: history };
  } catch (error) {
    console.error('获取任务状态历史失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('task-status-log:getStatistics', async (event, { dateRange }) => {
  try {
    const statistics = await taskStatusLogService.getStatusChangeStatistics(dateRange);
    return { success: true, data: statistics };
  } catch (error) {
    console.error('获取状态变化统计失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('task-status-log:getEfficiencyStats', async (event, { dateRange }) => {
  try {
    const stats = await taskStatusLogService.getTaskEfficiencyStats(dateRange);
    return { success: true, data: stats };
  } catch (error) {
    console.error('获取效率统计失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('task-status-log:initialize', async (event) => {
  try {
    const result = await taskStatusLogService.initializeExistingTaskLogs();
    return { success: true, data: result };
  } catch (error) {
    console.error('初始化任务日志失败:', error);
    return { success: false, error: error.message };
  }
});
```

### 3. 应用启动初始化

```javascript
// src/main/main.js
// 在应用启动时初始化日志功能

async function initializeApplication() {
  try {
    // ... 现有初始化代码
    
    // 初始化任务状态日志
    console.log('检查任务状态日志初始化...');
    const initResult = await taskStatusLogService.initializeExistingTaskLogs();
    
    if (initResult.initialized) {
      console.log(`任务状态日志初始化完成: 处理了 ${initResult.tasksProcessed} 个任务，创建了 ${initResult.logsCreated} 条日志`);
    } else {
      console.log('任务状态日志无需初始化');
    }
    
    // ... 其他初始化代码
  } catch (error) {
    console.error('应用初始化失败:', error);
  }
}
```

## 前端集成

### 1. 状态管理扩展

```javascript
// src/renderer/src/store/taskStore.js
// 添加状态日志相关的状态管理

// 在现有 taskStore 中添加
const taskStatusLogHistory = ref([])
const statusChangeStatistics = ref(null)
const taskEfficiencyStats = ref(null)

// 获取任务状态历史
const getTaskStatusHistory = async (taskId) => {
  try {
    const result = await window.electronAPI.invoke('task-status-log:getHistory', { taskId })
    if (result.success) {
      taskStatusLogHistory.value = result.data
    }
    return result
  } catch (error) {
    console.error('获取任务状态历史失败:', error)
    return { success: false, error: error.message }
  }
}

// 获取状态变化统计
const getStatusChangeStatistics = async (dateRange = null) => {
  try {
    const result = await window.electronAPI.invoke('task-status-log:getStatistics', { dateRange })
    if (result.success) {
      statusChangeStatistics.value = result.data
    }
    return result
  } catch (error) {
    console.error('获取状态变化统计失败:', error)
    return { success: false, error: error.message }
  }
}

// 获取效率统计
const getTaskEfficiencyStats = async (dateRange = null) => {
  try {
    const result = await window.electronAPI.invoke('task-status-log:getEfficiencyStats', { dateRange })
    if (result.success) {
      taskEfficiencyStats.value = result.data
    }
    return result
  } catch (error) {
    console.error('获取效率统计失败:', error)
    return { success: false, error: error.message }
  }
}

// 导出新增的状态和方法
return {
  // ... 现有导出
  taskStatusLogHistory: readonly(taskStatusLogHistory),
  statusChangeStatistics: readonly(statusChangeStatistics),
  taskEfficiencyStats: readonly(taskEfficiencyStats),
  getTaskStatusHistory,
  getStatusChangeStatistics,
  getTaskEfficiencyStats
}
```

## 性能优化

### 1. 数据库优化

- **索引策略**: 为常用查询字段创建复合索引
- **分页查询**: 大量历史数据使用分页加载
- **数据清理**: 定期清理过期的日志数据

### 2. 内存优化

- **延迟加载**: 统计数据按需加载
- **缓存策略**: 缓存常用的统计结果
- **批量操作**: 初始化时使用批量插入

### 3. 异步处理

- **非阻塞日志**: 日志记录不阻塞任务状态更新
- **后台统计**: 复杂统计计算在后台进行

## 错误处理

### 1. 数据完整性

- **事务处理**: 状态更新和日志记录在同一事务中
- **回滚机制**: 失败时自动回滚
- **数据验证**: 状态转换合法性验证

### 2. 容错机制

- **日志失败不影响主流程**: 日志记录失败不阻止任务操作
- **重试机制**: 网络或临时错误时自动重试
- **降级处理**: 关键功能失败时的降级方案

## 测试策略

### 1. 单元测试

```javascript
// 测试用例示例
describe('TaskStatusLogService', () => {
  test('应该正确记录状态变化', async () => {
    const logId = await taskStatusLogService.logStatusChange('task1', 'todo', 'doing');
    expect(logId).toBeDefined();
  });
  
  test('应该拒绝无效的状态转换', async () => {
    const result = await taskStatusLogService.logStatusChange('task1', 'done', 'pause');
    expect(result).toBeNull();
  });
  
  test('应该正确初始化现有任务日志', async () => {
    const result = await taskStatusLogService.initializeExistingTaskLogs();
    expect(result.initialized).toBe(true);
  });
});
```

### 2. 集成测试

- 任务状态更新流程测试
- 数据库迁移测试
- IPC 通信测试

### 3. 性能测试

- 大量数据下的查询性能
- 并发状态更新测试
- 内存使用情况监控

## 部署注意事项

### 1. 数据迁移

- 确保数据库备份
- 测试迁移脚本
- 验证数据完整性

### 2. 版本兼容性

- 向后兼容性保证
- 渐进式功能启用
- 回滚方案准备

### 3. 监控和日志

- 功能使用情况监控
- 性能指标收集
- 错误日志记录

## 总结

本技术设计文档详细描述了任务状态日志功能的完整实现方案，包括数据库设计、服务层架构、前端集成和性能优化等各个方面。通过合理的架构设计和完善的错误处理机制，确保功能的稳定性和可扩展性。