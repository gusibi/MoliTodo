const TaskStatusLog = require('../../domain/entities/task-status-log');

/**
 * SQLite 任务状态日志仓储实现
 * 负责任务状态日志的数据持久化操作
 */
class SqliteTaskStatusLogRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 确保时间格式为ISO字符串
   * @param {string|Date} timestamp 时间戳
   * @returns {string} ISO字符串格式的时间
   */
  _ensureISOString(timestamp) {
    if (!timestamp) return new Date().toISOString();
    return typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
  }

  /**
   * 保存单个状态日志
   * @param {TaskStatusLog} taskStatusLog 状态日志实体
   * @returns {Promise<number>} 插入的记录ID
   */
  async save(taskStatusLog) {
    if (!taskStatusLog.isValid()) {
      throw new Error('Invalid TaskStatusLog entity');
    }

    const sql = `
      INSERT INTO task_status_logs (task_id, from_status, to_status, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    console.log("SqliteTaskStatusLogRepository save", taskStatusLog)
    try {
      const result = await this.db.run(sql, [
        taskStatusLog.taskId,
        taskStatusLog.fromStatus,
        taskStatusLog.toStatus,
        this._ensureISOString(taskStatusLog.createdAt),
        JSON.stringify(taskStatusLog.metadata)
      ]);
      
      return result.lastID;
    } catch (error) {
      console.error('保存任务状态日志失败:', error);
      throw error;
    }
  }

  /**
   * 批量保存状态日志
   * @param {TaskStatusLog[]} taskStatusLogs 状态日志实体数组
   * @returns {Promise<number[]>} 插入的记录ID数组
   */
  async batchSave(taskStatusLogs) {
    if (!taskStatusLogs || taskStatusLogs.length === 0) {
      return [];
    }

    // 验证所有实体的有效性
    for (const log of taskStatusLogs) {
      if (!log.isValid()) {
        throw new Error(`Invalid TaskStatusLog entity for task ${log.taskId}`);
      }
    }

    const sql = `
      INSERT INTO task_status_logs (task_id, from_status, to_status, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const stmt = await this.db.prepare(sql);
    const insertedIds = [];
    
    try {
      await this.db.exec('BEGIN TRANSACTION');
      
      for (const log of taskStatusLogs) {
        const result = await stmt.run([
          log.taskId,
          log.fromStatus,
          log.toStatus,
          this._ensureISOString(log.createdAt),
          JSON.stringify(log.metadata)
        ]);
        insertedIds.push(result.lastID);
      }
      
      await this.db.exec('COMMIT');
      console.log(`批量保存了 ${taskStatusLogs.length} 条状态日志`);
      return insertedIds;
    } catch (error) {
      await this.db.exec('ROLLBACK');
      console.error('批量保存任务状态日志失败:', error);
      throw error;
    } finally {
      await stmt.finalize();
    }
  }

  /**
   * 根据任务ID获取状态历史
   * @param {string} taskId 任务ID
   * @returns {Promise<TaskStatusLog[]>} 状态日志数组
   */
  async findByTaskId(taskId) {
    const sql = `
      SELECT * FROM task_status_logs 
      WHERE task_id = ? 
      ORDER BY created_at ASC
    `;
    
    try {
      const rows = await this.db.all(sql, [taskId]);
      return rows.map(row => this.rowToTaskStatusLog(row));
    } catch (error) {
      console.error('获取任务状态历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取多个任务的状态历史
   * @param {string[]} taskIds 任务ID数组
   * @returns {Promise<Map<string, TaskStatusLog[]>>} 任务ID到状态日志数组的映射
   */
  async findByTaskIds(taskIds) {
    if (!taskIds || taskIds.length === 0) {
      return new Map();
    }

    const placeholders = taskIds.map(() => '?').join(',');
    const sql = `
      SELECT * FROM task_status_logs 
      WHERE task_id IN (${placeholders})
      ORDER BY task_id, created_at ASC
    `;
    
    try {
      const rows = await this.db.all(sql, taskIds);
      const result = new Map();
      
      for (const row of rows) {
        const log = this.rowToTaskStatusLog(row);
        if (!result.has(log.taskId)) {
          result.set(log.taskId, []);
        }
        result.get(log.taskId).push(log);
      }
      
      return result;
    } catch (error) {
      console.error('获取多个任务状态历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取状态变化统计
   * @param {string} startDate 开始日期 (ISO string)
   * @param {string} endDate 结束日期 (ISO string)
   * @returns {Promise<Object[]>} 统计结果
   */
  async getStatusChangeStatistics(startDate = null, endDate = null) {
    let sql = `
      SELECT 
        from_status,
        to_status,
        COUNT(*) as count,
        DATE(datetime(created_at/1000, 'unixepoch')) as date
      FROM task_status_logs
    `;
    
    const params = [];
    const conditions = [];
    
    if (startDate) {
      conditions.push('created_at >= ?');
      params.push(new Date(startDate).getTime());
    }
    
    if (endDate) {
      conditions.push('created_at <= ?');
      params.push(new Date(endDate).getTime());
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' GROUP BY from_status, to_status, DATE(datetime(created_at/1000, \'unixepoch\')) ORDER BY created_at DESC';
    
    try {
      return await this.db.all(sql, params);
    } catch (error) {
      console.error('获取状态变化统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取任务完成统计
   * @param {string} startDate 开始日期
   * @param {string} endDate 结束日期
   * @returns {Promise<Object[]>} 完成统计
   */
  async getCompletionStatistics(startDate = null, endDate = null) {
    let sql = `
      SELECT 
        DATE(datetime(created_at/1000, 'unixepoch')) as date,
        COUNT(*) as completed_count
      FROM task_status_logs
      WHERE to_status = 'done'
    `;
    
    const params = [];
    
    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(new Date(startDate).getTime());
    }
    
    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(new Date(endDate).getTime());
    }
    
    sql += ' GROUP BY DATE(datetime(created_at/1000, \'unixepoch\')) ORDER BY date DESC';
    
    try {
      return await this.db.all(sql, params);
    } catch (error) {
      console.error('获取完成统计失败:', error);
      throw error;
    }
  }

  /**
   * 检查日志表是否为空
   * @returns {Promise<boolean>} 是否为空
   */
  async isEmpty() {
    try {
      const result = await this.db.get('SELECT COUNT(*) as count FROM task_status_logs');
      return result.count === 0;
    } catch (error) {
      console.error('检查日志表是否为空失败:', error);
      throw error;
    }
  }

  /**
   * 获取任务执行时间统计
   * @param {string} taskId 任务ID
   * @returns {Promise<Object>} 执行时间统计
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
    
    try {
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
    } catch (error) {
      console.error('获取任务执行时间统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取最近的状态变化
   * @param {number} limit 限制数量
   * @returns {Promise<TaskStatusLog[]>} 最近的状态变化
   */
  async getRecentStatusChanges(limit = 50) {
    const sql = `
      SELECT * FROM task_status_logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    try {
      const rows = await this.db.all(sql, [limit]);
      return rows.map(row => this.rowToTaskStatusLog(row));
    } catch (error) {
      console.error('获取最近状态变化失败:', error);
      throw error;
    }
  }

  /**
   * 根据状态获取日志
   * @param {string} status 状态
   * @param {number} limit 限制数量
   * @returns {Promise<TaskStatusLog[]>} 状态日志数组
   */
  async findByStatus(status, limit = 100) {
    const sql = `
      SELECT * FROM task_status_logs 
      WHERE to_status = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    try {
      const rows = await this.db.all(sql, [status, limit]);
      return rows.map(row => this.rowToTaskStatusLog(row));
    } catch (error) {
      console.error('根据状态获取日志失败:', error);
      throw error;
    }
  }

  /**
   * 清理历史数据
   * @param {number} daysToKeep 保留天数
   * @returns {Promise<number>} 删除的记录数
   */
  async cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const sql = 'DELETE FROM task_status_logs WHERE created_at < ?';
    
    try {
      const result = await this.db.run(sql, [cutoffDate.toISOString()]);
      console.log(`清理了 ${result.changes} 条历史日志记录`);
      return result.changes;
    } catch (error) {
      console.error('清理历史日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取日志总数
   * @returns {Promise<number>} 日志总数
   */
  async getLogCount() {
    try {
      const result = await this.db.get('SELECT COUNT(*) as count FROM task_status_logs');
      return result.count;
    } catch (error) {
      console.error('获取日志总数失败:', error);
      throw error;
    }
  }

  /**
   * 删除任务的所有日志
   * @param {string} taskId 任务ID
   * @returns {Promise<number>} 删除的记录数
   */
  async deleteByTaskId(taskId) {
    const sql = 'DELETE FROM task_status_logs WHERE task_id = ?';
    
    try {
      const result = await this.db.run(sql, [taskId]);
      return result.changes;
    } catch (error) {
      console.error('删除任务日志失败:', error);
      throw error;
    }
  }

  /**
   * 清理所有日志数据
   * @returns {Promise<number>} 删除的记录数
   */
  async deleteAllLogs() {
    const sql = 'DELETE FROM task_status_logs';
    
    try {
      const result = await this.db.run(sql);
      console.log(`清理了所有 ${result.changes} 条日志记录`);
      return result.changes;
    } catch (error) {
      console.error('清理所有日志失败:', error);
      throw error;
    }
  }

  /**
   * 数据行转换为实体
   * @param {Object} row 数据库行
   * @returns {TaskStatusLog} 状态日志实体
   */
  rowToTaskStatusLog(row) {
    try {
      return new TaskStatusLog({
        id: row.id,
        taskId: row.task_id,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        createdAt: row.created_at,
        metadata: JSON.parse(row.metadata || '{}')
      });
    } catch (error) {
      console.error('转换数据行为实体失败:', error, row);
      throw error;
    }
  }

  /**
   * 获取状态转换趋势
   * @param {number} days 天数
   * @returns {Promise<Object[]>} 趋势数据
   */
  async getStatusTransitionTrends(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const sql = `
      SELECT 
        DATE(created_at) as date,
        from_status,
        to_status,
        COUNT(*) as count
      FROM task_status_logs
      WHERE created_at >= ?
      GROUP BY DATE(created_at), from_status, to_status
      ORDER BY date DESC, count DESC
    `;
    
    try {
      return await this.db.all(sql, [startDate.toISOString()]);
    } catch (error) {
      console.error('获取状态转换趋势失败:', error);
      throw error;
    }
  }
}

module.exports = SqliteTaskStatusLogRepository;