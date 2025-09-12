const TaskStatusLog = require('../entities/task-status-log');

/**
 * 任务状态日志服务
 * 负责任务状态变化的业务逻辑处理
 */
class TaskStatusLogService {
  constructor(taskStatusLogRepository, taskRepository) {
    this.taskStatusLogRepository = taskStatusLogRepository;
    this.taskRepository = taskRepository;
  }

  // 确保时间格式为ISO字符串
  _ensureISOString(timestamp) {
    if (!timestamp) return null;
    return typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
  }

  /**
   * 记录状态变化
   * @param {string} taskId 任务ID
   * @param {string|null} fromStatus 原状态
   * @param {string} toStatus 目标状态
   * @param {string} timestamp 时间戳 (可选)
   * @returns {Promise<number|null>} 日志ID或null
   */
  async logStatusChange(taskId, fromStatus, toStatus, timestamp = null) {
    try {
      // 验证状态变化的合法性
      if (!TaskStatusLog.isValidStatusTransition(fromStatus, toStatus)) {
        console.warn(`无效的状态转换: ${fromStatus} -> ${toStatus} (任务: ${taskId})`);
        return null;
      }

      // 如果状态没有变化，不记录日志
      if (fromStatus === toStatus) {
        console.debug(`状态未变化，跳过日志记录: ${taskId} (${toStatus})`);
        return null;
      }

      const taskStatusLog = new TaskStatusLog({
        taskId,
        fromStatus,
        toStatus,
        createdAt: timestamp || new Date().toISOString(),
        metadata: {
          transition: `${fromStatus || 'null'}->${toStatus}`,
          timestamp: timestamp || new Date().toISOString(),
          source: 'status_change'
        }
      });

      const logId = await this.taskStatusLogRepository.save(taskStatusLog);
      console.log(`状态变化已记录: 任务 ${taskId} 从 ${fromStatus || 'null'} 变为 ${toStatus} (日志ID: ${logId})`);
      return logId;
    } catch (error) {
      console.error('记录状态变化失败:', error);
      // 不抛出异常，避免影响任务状态更新的主流程
      return null;
    }
  }

  /**
   * 批量记录状态变化
   * @param {Array} statusChanges 状态变化数组 [{taskId, fromStatus, toStatus, timestamp}]
   * @returns {Promise<number[]>} 日志ID数组
   */
  async batchLogStatusChanges(statusChanges) {
    if (!statusChanges || statusChanges.length === 0) {
      return [];
    }

    const validLogs = [];
    
    for (const change of statusChanges) {
      const { taskId, fromStatus, toStatus, timestamp } = change;
      
      // 验证状态变化的合法性
      if (!TaskStatusLog.isValidStatusTransition(fromStatus, toStatus)) {
        console.warn(`跳过无效的状态转换: ${fromStatus} -> ${toStatus} (任务: ${taskId})`);
        continue;
      }

      // 如果状态没有变化，跳过
      if (fromStatus === toStatus) {
        continue;
      }

      const taskStatusLog = new TaskStatusLog({
        taskId,
        fromStatus,
        toStatus,
        createdAt: timestamp || new Date().toISOString(),
        metadata: {
          transition: `${fromStatus || 'null'}->${toStatus}`,
          timestamp: timestamp || new Date().toISOString(),
          source: 'batch_change'
        }
      });

      validLogs.push(taskStatusLog);
    }

    if (validLogs.length === 0) {
      console.log('没有有效的状态变化需要记录');
      return [];
    }

    try {
      const logIds = await this.taskStatusLogRepository.batchSave(validLogs);
      console.log(`批量记录了 ${validLogs.length} 个状态变化`);
      return logIds;
    } catch (error) {
      console.error('批量记录状态变化失败:', error);
      return [];
    }
  }

  /**
   * 获取任务状态历史
   * @param {string} taskId 任务ID
   * @returns {Promise<TaskStatusLog[]>} 状态历史
   */
  async getTaskStatusHistory(taskId) {
    try {
      return await this.taskStatusLogRepository.findByTaskId(taskId);
    } catch (error) {
      console.error('获取任务状态历史失败:', error);
      return [];
    }
  }

  /**
   * 获取多个任务的状态历史
   * @param {string[]} taskIds 任务ID数组
   * @returns {Promise<Map<string, TaskStatusLog[]>>} 任务状态历史映射
   */
  async getMultipleTaskStatusHistory(taskIds) {
    try {
      return await this.taskStatusLogRepository.findByTaskIds(taskIds);
    } catch (error) {
      console.error('获取多个任务状态历史失败:', error);
      return new Map();
    }
  }

  /**
   * 获取状态变化统计
   * @param {Object} dateRange 日期范围 {start, end}
   * @returns {Promise<Object[]>} 统计结果
   */
  async getStatusChangeStatistics(dateRange = null) {
    try {
      const startDate = dateRange?.start;
      const endDate = dateRange?.end;
      
      return await this.taskStatusLogRepository.getStatusChangeStatistics(startDate, endDate);
    } catch (error) {
      console.error('获取状态变化统计失败:', error);
      return [];
    }
  }

  /**
   * 获取任务完成统计
   * @param {Object} dateRange 日期范围
   * @returns {Promise<Object[]>} 完成统计
   */
  async getCompletionStatistics(dateRange = null) {
    try {
      const startDate = dateRange?.start;
      const endDate = dateRange?.end;
      
      return await this.taskStatusLogRepository.getCompletionStatistics(startDate, endDate);
    } catch (error) {
      console.error('获取完成统计失败:', error);
      return [];
    }
  }





  /**
   * 获取任务执行效率统计
   * @param {Object} dateRange 日期范围
   * @returns {Promise<Object>} 效率统计
   */
  async getTaskEfficiencyStats(dateRange = null) {
    try {
      const statistics = await this.getStatusChangeStatistics(dateRange);
      
      // 计算各种效率指标
      const stats = {
        totalTransitions: 0,
        completedTasks: 0,
        startedTasks: 0,
        pausedTasks: 0,
        reactivatedTasks: 0,
        statusTransitions: {},
        dailyStats: {},
        transitionTypes: {
          start: 0,
          complete: 0,
          pause: 0,
          resume: 0,
          reactivate: 0,
          other: 0
        }
      };

      // 处理统计数据
      for (const stat of statistics) {
        const transition = `${stat.from_status || 'start'}->${stat.to_status}`;
        const count = stat.count;
        
        stats.totalTransitions += count;
        
        // 统计转换类型
        if (!stats.statusTransitions[transition]) {
          stats.statusTransitions[transition] = 0;
        }
        stats.statusTransitions[transition] += count;
        
        // 统计特定类型的转换
        if (stat.to_status === 'done') {
          stats.completedTasks += count;
          stats.transitionTypes.complete += count;
        } else if (stat.to_status === 'doing' && (!stat.from_status || stat.from_status === 'todo')) {
          stats.startedTasks += count;
          stats.transitionTypes.start += count;
        } else if (stat.to_status === 'pause') {
          stats.pausedTasks += count;
          stats.transitionTypes.pause += count;
        } else if (stat.to_status === 'doing' && stat.from_status === 'pause') {
          stats.transitionTypes.resume += count;
        } else if (stat.to_status === 'todo' && stat.from_status === 'done') {
          stats.reactivatedTasks += count;
          stats.transitionTypes.reactivate += count;
        } else {
          stats.transitionTypes.other += count;
        }
        
        // 按日期统计
        const date = stat.date;
        if (!stats.dailyStats[date]) {
          stats.dailyStats[date] = {
            transitions: 0,
            completions: 0,
            starts: 0
          };
        }
        
        stats.dailyStats[date].transitions += count;
        if (stat.to_status === 'done') {
          stats.dailyStats[date].completions += count;
        }
        if (stat.to_status === 'doing' && (!stat.from_status || stat.from_status === 'todo')) {
          stats.dailyStats[date].starts += count;
        }
      }

      // 计算效率指标
      stats.completionRate = stats.startedTasks > 0 ? (stats.completedTasks / stats.startedTasks) : 0;
      stats.pauseRate = stats.startedTasks > 0 ? (stats.pausedTasks / stats.startedTasks) : 0;
      stats.reactivationRate = stats.completedTasks > 0 ? (stats.reactivatedTasks / stats.completedTasks) : 0;

      return stats;
    } catch (error) {
      console.error('获取任务执行效率统计失败:', error);
      return {
        totalTransitions: 0,
        completedTasks: 0,
        startedTasks: 0,
        statusTransitions: {},
        dailyStats: {},
        error: error.message
      };
    }
  }

  /**
   * 获取最近的状态变化
   * @param {number} limit 限制数量
   * @returns {Promise<TaskStatusLog[]>} 最近的状态变化
   */
  async getRecentStatusChanges(limit = 50) {
    try {
      return await this.taskStatusLogRepository.getRecentStatusChanges(limit);
    } catch (error) {
      console.error('获取最近状态变化失败:', error);
      return [];
    }
  }

  /**
   * 获取任务执行时间统计
   * @param {string} taskId 任务ID
   * @returns {Promise<Object>} 执行时间统计
   */
  async getTaskExecutionTimeStats(taskId) {
    try {
      return await this.taskStatusLogRepository.getTaskExecutionTimeStats(taskId);
    } catch (error) {
      console.error('获取任务执行时间统计失败:', error);
      return { doing: 0, pause: 0, total: 0 };
    }
  }

  /**
   * 初始化现有任务的状态日志
   * 为数据库中已存在但没有状态日志的任务创建初始日志记录
   * @param {boolean} force 是否强制重新初始化所有任务
   * @returns {Promise<{initialized: number, skipped: number, errors: number}>}
   */
  async initializeExistingTasksLogs(force = false) {
    try {
      console.log('开始初始化现有任务的状态日志...');
      
      // 如果是强制初始化，先清理所有现有日志
      if (force) {
        console.log('强制初始化模式：清理所有现有日志数据...');
        const deletedCount = await this.deleteAllLogs();
        console.log(`已清理 ${deletedCount} 条现有日志记录`);
      } else {
        // 非强制模式下，检查是否已有任何日志记录，如果有就直接返回
        const totalLogCount = await this.taskStatusLogRepository.getLogCount();
        if (totalLogCount > 0) {
          console.log(`已存在 ${totalLogCount} 条日志记录，跳过初始化`);
          return { initialized: 0, skipped: totalLogCount, errors: 0 };
        }
      }
      
      // 获取所有任务
      const allTasks = await this.taskRepository.findAll();
      console.log(`找到 ${allTasks.length} 个任务`);
      
      let initialized = 0;
      let skipped = 0;
      let errors = 0;
      const allLogs = []; // 收集所有日志，最后一次性批量保存
      
      for (const task of allTasks) {
        try {
          const logs = [];
          
          // 0. 每条任务都生成一个创建记录（from为空，to为todo）
          const createdLog = new TaskStatusLog({
            taskId: task.id,
            fromStatus: null,
            toStatus: 'todo',
            createdAt: this._ensureISOString(task.createdAt) || new Date().toISOString(),
            metadata: {
              transition: 'null->todo',
              timestamp: this._ensureISOString(task.createdAt) || new Date().toISOString(),
              source: 'task_creation',
              taskCreatedAt: task.createdAt
            }
          });
          logs.push(createdLog);
          
          // 根据任务当前状态生成相应的状态变迁记录
          if (task.status === 'todo') {
            // 1. todo状态：只需要创建记录，不需要额外生成
          } else if (task.status === 'doing') {
            // 2. doing状态：生成doing状态记录
            const doingTime = this._ensureISOString(task.startedAt) || this._ensureISOString(task.updatedAt) || new Date().toISOString();
            const doingLog = new TaskStatusLog({
              taskId: task.id,
              fromStatus: 'todo',
              toStatus: 'doing',
              createdAt: doingTime,
              metadata: {
                transition: 'todo->doing',
                timestamp: doingTime,
                source: 'initialization_doing',
                taskStartedAt: task.startedAt
              }
            });
            logs.push(doingLog);
          } else if (task.status === 'pause') {
            // 3. pause状态：生成doing和pause记录
            const doingTime = this._ensureISOString(task.startedAt) || this._ensureISOString(task.updatedAt) || new Date().toISOString();
            const doingLog = new TaskStatusLog({
              taskId: task.id,
              fromStatus: 'todo',
              toStatus: 'doing',
              createdAt: doingTime,
              metadata: {
                transition: 'todo->doing',
                timestamp: doingTime,
                source: 'initialization_doing',
                taskStartedAt: task.startedAt
              }
            });
            logs.push(doingLog);
            
            const pauseTime = this._ensureISOString(task.updatedAt) || new Date().toISOString();
            const pauseLog = new TaskStatusLog({
              taskId: task.id,
              fromStatus: 'doing',
              toStatus: 'pause',
              createdAt: pauseTime,
              metadata: {
                transition: 'doing->pause',
                timestamp: pauseTime,
                source: 'initialization_pause',
                taskUpdatedAt: task.updatedAt
              }
            });
            logs.push(pauseLog);
          } else if (task.status === 'done') {
            // 4. done状态：如果有startedAt则生成doing记录，然后生成done记录
            if (task.startedAt) {
              const doingLog = new TaskStatusLog({
                taskId: task.id,
                fromStatus: 'todo',
                toStatus: 'doing',
                createdAt: this._ensureISOString(task.startedAt),
                metadata: {
                  transition: 'todo->doing',
                  timestamp: this._ensureISOString(task.startedAt),
                  source: 'initialization_doing',
                  taskStartedAt: task.startedAt
                }
              });
              logs.push(doingLog);
            }
            
            const doneTime = this._ensureISOString(task.completedAt) || this._ensureISOString(task.updatedAt) || new Date().toISOString();
            const doneLog = new TaskStatusLog({
              taskId: task.id,
              fromStatus: task.startedAt ? 'doing' : 'todo',
              toStatus: 'done',
              createdAt: doneTime,
              metadata: {
                transition: task.startedAt ? 'doing->done' : 'todo->done',
                timestamp: doneTime,
                source: 'initialization_done',
                taskCompletedAt: task.completedAt
              }
            });
            logs.push(doneLog);
          }
          
          // 将当前任务的日志添加到总集合中
          allLogs.push(...logs);
          initialized += logs.length;
          
        } catch (error) {
          console.error(`初始化任务 ${task.id} 的日志失败:`, error);
          errors++;
        }
      }
      
      // 一次性批量保存所有日志
      if (allLogs.length > 0) {
        console.log('一次性批量保存所有日志数量:', allLogs.length);
        await this.taskStatusLogRepository.batchSave(allLogs);
      }
      
      const result = { initialized, skipped, errors };
      console.log('任务状态日志初始化完成:', result);
      return result;
      
    } catch (error) {
      console.error('初始化现有任务日志失败:', error);
      throw error;
    }
  }

  /**
   * 清理历史日志
   * @param {number} daysToKeep 保留天数
   * @returns {Promise<number>} 清理的记录数
   */
  async cleanupOldLogs(daysToKeep = 90) {
    try {
      const deletedCount = await this.taskStatusLogRepository.cleanupOldLogs(daysToKeep);
      console.log(`清理了 ${deletedCount} 条历史日志记录`);
      return deletedCount;
    } catch (error) {
      console.error('清理历史日志失败:', error);
      return 0;
    }
  }

  /**
   * 清理所有日志数据
   * @returns {Promise<number>} 清理的记录数
   */
  async deleteAllLogs() {
    try {
      const deletedCount = await this.taskStatusLogRepository.deleteAllLogs();
      console.log(`清理了所有 ${deletedCount} 条日志记录`);
      return deletedCount;
    } catch (error) {
      console.error('清理所有日志失败:', error);
      return 0;
    }
  }

  /**
   * 获取每日活跃度数据（基于日志数量）
   * @param {number} days 获取最近多少天的数据
   * @returns {Promise<Array>} 每日活跃度数据数组
   */
  async getDailyActivityData(days = 365) {
    try {
      // 计算开始日期
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days + 1);
      
      // 获取指定时间范围内的所有日志
      // 注意：created_at 是 TEXT 类型，存储 ISO 字符串格式
      const sql = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM task_status_logs 
        WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const results = await this.taskStatusLogRepository.db.all(sql, [startDateStr, endDateStr]);
      // console.log('TaskStatusLogService getDailyActivityData results', results)
      
      // 创建完整的日期范围数据
      const activityData = [];
      const currentDate = new Date(startDate);
      
      // 将查询结果转换为日期索引的对象
      const dataMap = {};
      results.forEach(row => {
        dataMap[row.date] = row.count;
      });
      
      // 生成完整的日期序列
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const count = dataMap[dateStr] || 0;
        
        activityData.push({
          date: dateStr,
          count: count
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // console.log('TaskStatusLogService getDailyActivityData result', activityData)
      return activityData;
    } catch (error) {
      console.error('获取每日活跃度数据失败:', error);
      return [];
    }
  }

  /**
   * 获取日志统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getLogStatistics() {
    try {
      const totalLogs = await this.taskStatusLogRepository.getLogCount();
      const recentChanges = await this.getRecentStatusChanges(10);
      const isEmpty = await this.taskStatusLogRepository.isEmpty();
      
      return {
        totalLogs,
        isEmpty,
        recentChangesCount: recentChanges.length,
        lastChange: recentChanges.length > 0 ? recentChanges[0].createdAt : null
      };
    } catch (error) {
      console.error('获取日志统计信息失败:', error);
      return {
        totalLogs: 0,
        isEmpty: true,
        recentChangesCount: 0,
        lastChange: null,
        error: error.message
      };
    }
  }
}

module.exports = TaskStatusLogService;