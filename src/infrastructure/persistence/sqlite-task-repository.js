const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');
const Task = require('../../domain/entities/task');
const DatabaseMigration = require('./database-migration');

/**
 * 基于 SQLite 的任务仓储实现
 */
class SqliteTaskRepository {
  constructor(dbPath = null) {
    this.db = null;
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'tasks.db');
  }

  /**
   * 初始化数据库连接
   */
  async initialize() {
    // 确保数据库目录存在
    const dbDir = path.dirname(this.dbPath);
    try {
      await fs.access(dbDir);
    } catch (error) {
      await fs.mkdir(dbDir, { recursive: true });
    }

    // 打开数据库连接
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    // 执行数据库迁移
    const migration = new DatabaseMigration(this.db, this.dbPath);
    await migration.checkAndMigrate();

    // 创建基础表结构（向后兼容）
    await this.createTables();

    console.log(`SQLite 数据库已初始化: ${this.dbPath}`);
  }

  /**
   * 创建数据库表结构（向后兼容）
   */
  async createTables() {
    // 创建基础 tasks 表（如果不存在）
    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        reminder_time TEXT,
        completed_at TEXT,
        started_at TEXT,
        total_duration INTEGER DEFAULT 0,
        list_id INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}'
      )
    `;

    await this.db.exec(createTasksTable);

    // 检查是否需要添加新列（向后兼容，主要用于开发环境）
    const tableInfo = await this.db.all("PRAGMA table_info(tasks)");
    const columnNames = tableInfo.map(col => col.name);

    // 基础字段兼容性检查
    if (!columnNames.includes('status')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT "todo"');
    }

    if (!columnNames.includes('completed_at')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN completed_at TEXT');
    }

    if (!columnNames.includes('started_at')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN started_at TEXT');
    }

    if (!columnNames.includes('total_duration')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN total_duration INTEGER DEFAULT 0');
    }

    // 清单功能字段兼容性检查
    if (!columnNames.includes('list_id')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN list_id INTEGER DEFAULT 0');
    }

    if (!columnNames.includes('metadata')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN metadata TEXT DEFAULT "{}"');
    }

    // 到期日期字段兼容性检查
    if (!columnNames.includes('due_date')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN due_date TEXT');
    }

    if (!columnNames.includes('due_time')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN due_time TEXT');
    }

    // 重复任务字段兼容性检查
    if (!columnNames.includes('recurrence')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN recurrence TEXT');
    }

    if (!columnNames.includes('series_id')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN series_id TEXT');
    }

    if (!columnNames.includes('occurrence_date')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN occurrence_date TEXT');
    }

    // 创建重复任务相关索引
    await this.createRecurringTaskIndexes();

    // 迁移现有数据的状态字段
    await this.migrateExistingData();
  }

  /**
   * 创建重复任务相关索引
   */
  async createRecurringTaskIndexes() {
    try {
      // 为 series_id 和 occurrence_date 创建复合索引
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_series 
        ON tasks(series_id, occurrence_date)
      `);
      
      // 为 recurrence 字段创建索引（用于查找重复任务）
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_recurrence 
        ON tasks(recurrence) WHERE recurrence IS NOT NULL
      `);
    } catch (error) {
      console.warn('创建重复任务索引失败:', error);
    }
  }

  /**
   * 迁移现有数据，确保字段正确
   */
  async migrateExistingData() {
    // 迁移状态字段
    await this.db.run(`
      UPDATE tasks 
      SET status = CASE 
        WHEN completed = 1 THEN 'done' 
        ELSE 'todo' 
      END 
      WHERE status IS NULL OR status = ''
    `);

    // 确保清单关联字段有默认值
    await this.db.run('UPDATE tasks SET list_id = 0 WHERE list_id IS NULL');

    // 确保元数据字段有默认值
    await this.db.run('UPDATE tasks SET metadata = "{}" WHERE metadata IS NULL OR metadata = ""');
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * 将任务对象转换为数据库行
   */
  taskToRow(task) {
    return {
      id: task.id,
      content: task.content,
      status: task.status || (task.completed ? 'done' : 'todo'),
      completed: task.completed ? 1 : 0,
      created_at: task.createdAt.toISOString(),
      updated_at: task.updatedAt.toISOString(),
      reminder_time: task.reminderTime ? task.reminderTime.toISOString() : null,
      completed_at: task.completedAt ? task.completedAt.toISOString() : null,
      started_at: task.startedAt ? task.startedAt.toISOString() : null,
      total_duration: task.totalDuration || 0,
      list_id: task.listId || 0,
      metadata: JSON.stringify(task.metadata || {}),
      due_date: task.dueDate || null,
      due_time: task.dueTime || null,
      recurrence: task.recurrence ? JSON.stringify(task.recurrence) : null,
      series_id: task.seriesId || null,
      occurrence_date: task.occurrenceDate ? (task.occurrenceDate instanceof Date ? task.occurrenceDate.toISOString() : task.occurrenceDate) : null
    };
  }

  /**
   * 将数据库行转换为任务对象
   */
  rowToTask(row) {
    const timeTracking = {
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      totalDuration: row.total_duration || 0
    };

    // 解析元数据
    let metadata = {};
    try {
      metadata = row.metadata ? JSON.parse(row.metadata) : {};
    } catch (error) {
      console.warn('解析任务元数据失败:', error);
      metadata = {};
    }

    // 解析重复规则
    let recurrence = null;
    try {
      recurrence = row.recurrence ? JSON.parse(row.recurrence) : null;
    } catch (error) {
      console.warn('解析重复规则失败:', error);
      recurrence = null;
    }

    const task = new Task(
      row.id,
      row.content,
      row.status || (row.completed ? 'done' : 'todo'),
      new Date(row.created_at),
      row.reminder_time ? new Date(row.reminder_time) : null,
      timeTracking,
      row.list_id || 0,
      metadata,
      recurrence,
      row.series_id || null,
      row.occurrence_date ? new Date(row.occurrence_date) : null,
      row.due_date || null,
      row.due_time || null
    );

    task.updatedAt = new Date(row.updated_at);

    return task;
  }

  /**
   * 获取所有任务
   * @returns {Promise<Task[]>}
   */
  async findAll() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all('SELECT * FROM tasks ORDER BY created_at DESC');
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 根据ID查找任务
   * @param {string} id 
   * @returns {Promise<Task|null>}
   */
  async findById(id) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const row = await this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    return row ? this.rowToTask(row) : null;
  }

  /**
   * 获取所有未完成的任务
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Task[]>}
   */
  async findIncomplete(listId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    let sql = 'SELECT * FROM tasks WHERE status != "done"';
    const params = [];

    if (listId !== null) {
      sql += ' AND list_id = ?';
      params.push(listId);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 获取所有已完成的任务
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Task[]>}
   */
  async findCompleted(listId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    let sql = 'SELECT * FROM tasks WHERE status = "done"';
    const params = [];

    if (listId !== null) {
      sql += ' AND list_id = ?';
      params.push(listId);
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 保存任务
   * @param {Task} task 
   * @returns {Promise<Task>}
   */
  async save(task) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const row = this.taskToRow(task);

    // 检查任务是否已存在
    const existing = await this.findById(task.id);

    if (existing) {
      // 更新现有任务
      await this.db.run(`
        UPDATE tasks SET 
          content = ?,
          status = ?,
          completed = ?,
          updated_at = ?,
          reminder_time = ?,
          completed_at = ?,
          started_at = ?,
          total_duration = ?,
          list_id = ?,
          metadata = ?,
          due_date = ?,
          due_time = ?,
          recurrence = ?,
          series_id = ?,
          occurrence_date = ?
        WHERE id = ?
      `, [
        row.content,
        row.status,
        row.completed,
        row.updated_at,
        row.reminder_time,
        row.completed_at,
        row.started_at,
        row.total_duration,
        row.list_id,
        row.metadata,
        row.due_date,
        row.due_time,
        row.recurrence,
        row.series_id,
        row.occurrence_date,
        row.id
      ]);
    } else {
      // 插入新任务
      await this.db.run(`
        INSERT INTO tasks (
          id, content, status, completed, created_at, updated_at, reminder_time, completed_at, started_at, total_duration, list_id, metadata, due_date, due_time, recurrence, series_id, occurrence_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        row.id,
        row.content,
        row.status,
        row.completed,
        row.created_at,
        row.updated_at,
        row.reminder_time,
        row.completed_at,
        row.started_at,
        row.total_duration,
        row.list_id,
        row.metadata,
        row.due_date,
        row.due_time,
        row.recurrence,
        row.series_id,
        row.occurrence_date
      ]);
    }

    return task;
  }

  /**
   * 删除任务
   * @param {string} id 
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.run('DELETE FROM tasks WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * 获取未完成任务数量
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<number>}
   */
  async getIncompleteCount(listId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    let sql = 'SELECT COUNT(*) as count FROM tasks WHERE status != "done"';
    const params = [];

    if (listId !== null) {
      sql += ' AND list_id = ?';
      params.push(listId);
    }

    const result = await this.db.get(sql, params);
    return result.count;
  }

  /**
   * 清空所有任务
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    await this.db.run('DELETE FROM tasks');
  }

  /**
   * 根据清单ID查找任务
   * @param {number} listId 清单ID
   * @returns {Promise<Task[]>}
   */
  async findByListId(listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE list_id = ? ORDER BY created_at DESC',
      [listId]
    );
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 获取指定清单的未完成任务
   * @param {number} listId 清单ID
   * @returns {Promise<Task[]>}
   */
  async findIncompleteByListId(listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE list_id = ? AND status != "done" ORDER BY created_at DESC',
      [listId]
    );
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 获取指定清单的已完成任务
   * @param {number} listId 清单ID
   * @returns {Promise<Task[]>}
   */
  async findCompletedByListId(listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE list_id = ? AND status = "done" ORDER BY updated_at DESC',
      [listId]
    );
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 更新任务的清单关联
   * @param {string} taskId 任务ID
   * @param {number} listId 新的清单ID
   * @returns {Promise<boolean>}
   */
  async updateListId(taskId, listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.run(
      'UPDATE tasks SET list_id = ?, updated_at = ? WHERE id = ?',
      [listId, new Date().toISOString(), taskId]
    );
    return result.changes > 0;
  }

  /**
   * 批量更新任务的清单关联
   * @param {string[]} taskIds 任务ID数组
   * @param {number} listId 新的清单ID
   * @returns {Promise<number>} 更新的任务数量
   */
  async batchUpdateListId(taskIds, listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return 0;
    }

    const placeholders = taskIds.map(() => '?').join(',');
    const now = new Date().toISOString();

    const result = await this.db.run(
      `UPDATE tasks SET list_id = ?, updated_at = ? WHERE id IN (${placeholders})`,
      [listId, now, ...taskIds]
    );

    return result.changes;
  }

  /**
   * 更新任务元数据
   * @param {string} taskId 任务ID
   * @param {Object} metadata 元数据
   * @returns {Promise<boolean>}
   */
  async updateMetadata(taskId, metadata) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.run(
      'UPDATE tasks SET metadata = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(metadata), new Date().toISOString(), taskId]
    );
    return result.changes > 0;
  }

  /**
   * 删除指定清单中的所有任务
   * @param {number} listId 清单ID
   * @returns {Promise<number>} 删除的任务数量
   */
  async deleteByListId(listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.run('DELETE FROM tasks WHERE list_id = ?', [listId]);
    return result.changes;
  }

  /**
   * 将指定清单的所有任务移动到另一个清单
   * @param {number} fromListId 源清单ID
   * @param {number} toListId 目标清单ID
   * @returns {Promise<number>} 移动的任务数量
   */
  async moveTasksBetweenLists(fromListId, toListId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.run(
      'UPDATE tasks SET list_id = ?, updated_at = ? WHERE list_id = ?',
      [toListId, new Date().toISOString(), fromListId]
    );
    return result.changes;
  }

  /**
   * 获取指定清单的任务数量
   * @param {number} listId 清单ID
   * @returns {Promise<number>}
   */
  async getTaskCountByListId(listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.get(
      'SELECT COUNT(*) as count FROM tasks WHERE list_id = ?',
      [listId]
    );
    return result.count;
  }

  /**
   * 获取指定清单的未完成任务数量
   * @param {number} listId 清单ID
   * @returns {Promise<number>}
   */
  async getIncompleteCountByListId(listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.get(
      'SELECT COUNT(*) as count FROM tasks WHERE list_id = ? AND status != "done"',
      [listId]
    );
    return result.count;
  }

  /**
   * 获取所有清单的任务统计
   * @returns {Promise<Object>} 清单ID到统计信息的映射
   */
  async getTaskCountsByListId() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(`
      SELECT 
        list_id,
        status,
        COUNT(*) as count
      FROM tasks 
      GROUP BY list_id, status
    `);

    const result = {};

    rows.forEach(row => {
      if (!result[row.list_id]) {
        result[row.list_id] = {
          total: 0,
          todo: 0,
          doing: 0,
          paused: 0,
          done: 0
        };
      }

      result[row.list_id][row.status] = row.count;
      result[row.list_id].total += row.count;
    });

    return result;
  }

  /**
   * 搜索任务（支持清单过滤）
   * @param {string} query 搜索关键词
   * @param {number|null} listId 清单ID，null表示搜索所有清单
   * @returns {Promise<Task[]>}
   */
  async searchTasks(query, listId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    if (!query || query.trim().length === 0) {
      return listId !== null ? await this.findByListId(listId) : await this.findAll();
    }

    const searchTerm = `%${query.trim()}%`;
    let sql = `
      SELECT * FROM tasks 
      WHERE (content LIKE ? OR metadata LIKE ?)
    `;
    const params = [searchTerm, searchTerm];

    if (listId !== null) {
      sql += ' AND list_id = ?';
      params.push(listId);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 按分类获取任务（支持清单过滤）
   * @param {string} category 分类名称
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Task[]>}
   */
  async findByCategory(category, listId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    let sql = 'SELECT * FROM tasks WHERE ';
    const params = [];

    // 根据分类构建查询条件
    switch (category) {
      case 'inbox':
        sql += 'status = "todo" AND reminder_time IS NULL';
        break;
      case 'today':
        const today = new Date().toISOString().split('T')[0];
        sql += `(DATE(reminder_time) = ? AND status != "done") OR status = "doing"`;
        params.push(today);
        break;
      case 'doing':
        sql += 'status = "doing"';
        break;
      case 'paused':
        sql += 'status = "paused"';
        break;
      case 'planned':
        sql += 'reminder_time IS NOT NULL';
        break;
      case 'completed':
        sql += 'status = "done"';
        break;
      case 'all':
      default:
        sql += '1=1'; // 所有任务
        break;
    }

    // 添加清单过滤
    if (listId !== null) {
      sql += ' AND list_id = ?';
      params.push(listId);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 高效的清单任务统计查询（单次查询获取所有统计）
   * @returns {Promise<Object>}
   */
  async getOptimizedListTaskCounts() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(`
      SELECT 
        list_id,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'doing' THEN 1 ELSE 0 END) as doing,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status != 'done' THEN 1 ELSE 0 END) as incomplete
      FROM tasks 
      GROUP BY list_id
    `);

    const result = {};
    rows.forEach(row => {
      result[row.list_id] = {
        total: row.total,
        todo: row.todo,
        doing: row.doing,
        paused: row.paused,
        done: row.done,
        incomplete: row.incomplete
      };
    });

    return result;
  }

  /**
   * 批量获取多个清单的任务（优化版）
   * @param {number[]} listIds 清单ID数组
   * @returns {Promise<Object>} 清单ID到任务数组的映射
   */
  async findByMultipleListIds(listIds) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    if (!Array.isArray(listIds) || listIds.length === 0) {
      return {};
    }

    const placeholders = listIds.map(() => '?').join(',');
    const rows = await this.db.all(
      `SELECT * FROM tasks WHERE list_id IN (${placeholders}) ORDER BY list_id, created_at DESC`,
      listIds
    );

    const result = {};
    listIds.forEach(id => {
      result[id] = [];
    });

    rows.forEach(row => {
      const task = this.rowToTask(row);
      if (result[task.listId]) {
        result[task.listId].push(task);
      }
    });

    return result;
  }

  /**
   * 获取任务的时间统计信息（优化版）
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Object>}
   */
  async getTimeStatistics(listId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    let sql = `
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'doing' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused_tasks,
        SUM(CASE WHEN status = 'done' THEN total_duration ELSE 0 END) as total_work_time,
        AVG(CASE WHEN status = 'done' AND total_duration > 0 THEN total_duration ELSE NULL END) as avg_task_time
      FROM tasks
    `;
    const params = [];

    if (listId !== null) {
      sql += ' WHERE list_id = ?';
      params.push(listId);
    }

    const result = await this.db.get(sql, params);

    return {
      totalTasks: result.total_tasks || 0,
      completedTasks: result.completed_tasks || 0,
      inProgressTasks: result.in_progress_tasks || 0,
      pausedTasks: result.paused_tasks || 0,
      todoTasks: (result.total_tasks || 0) - (result.completed_tasks || 0) - (result.in_progress_tasks || 0) - (result.paused_tasks || 0),
      totalWorkTime: result.total_work_time || 0,
      averageTaskTime: Math.round(result.avg_task_time || 0),
      completionRate: result.total_tasks > 0 ? ((result.completed_tasks || 0) / result.total_tasks) * 100 : 0
    };
  }

  /**
   * 获取今日任务的优化查询
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Task[]>}
   */
  async findTodayTasks(listId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const today = new Date().toISOString().split('T')[0];
    let sql = `
      SELECT * FROM tasks 
      WHERE (
        (DATE(reminder_time) = ? AND status != 'done') 
        OR status = 'doing'
      )
    `;
    const params = [today];

    if (listId !== null) {
      sql += ' AND list_id = ?';
      params.push(listId);
    }

    sql += ' ORDER BY reminder_time ASC, created_at DESC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 获取逾期任务
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Task[]>}
   */
  async findOverdueTasks(listId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const now = new Date().toISOString();
    let sql = `
      SELECT * FROM tasks 
      WHERE reminder_time < ? AND status != 'done'
    `;
    const params = [now];

    if (listId !== null) {
      sql += ' AND list_id = ?';
      params.push(listId);
    }

    sql += ' ORDER BY reminder_time ASC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 执行数据库清理和优化
   * @returns {Promise<void>}
   */
  async optimize() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    try {
      // 分析查询计划
      await this.db.exec('ANALYZE');

      // 清理数据库
      await this.db.exec('VACUUM');

      console.log('数据库优化完成');
    } catch (error) {
      console.warn('数据库优化失败:', error.message);
    }
  }

  /**
   * 验证数据完整性
   * @returns {Promise<Object>}
   */
  async validateDataIntegrity() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const issues = [];

    try {
      // 检查孤立任务（引用不存在的清单）
      const orphanTasks = await this.db.all(`
        SELECT t.id, t.content, t.list_id 
        FROM tasks t 
        LEFT JOIN lists l ON t.list_id = l.id 
        WHERE t.list_id != 0 AND l.id IS NULL
      `);

      if (orphanTasks.length > 0) {
        issues.push({
          type: 'orphan_tasks',
          count: orphanTasks.length,
          description: '存在引用不存在清单的任务',
          tasks: orphanTasks
        });
      }

      // 检查无效的状态值
      const invalidStatusTasks = await this.db.all(`
        SELECT id, content, status 
        FROM tasks 
        WHERE status NOT IN ('todo', 'doing', 'paused', 'done')
      `);

      if (invalidStatusTasks.length > 0) {
        issues.push({
          type: 'invalid_status',
          count: invalidStatusTasks.length,
          description: '存在无效状态的任务',
          tasks: invalidStatusTasks
        });
      }

      // 检查元数据格式
      const invalidMetadataTasks = await this.db.all(`
        SELECT id, content, metadata 
        FROM tasks 
        WHERE metadata IS NOT NULL AND metadata != '' AND metadata NOT LIKE '{%}'
      `);

      if (invalidMetadataTasks.length > 0) {
        issues.push({
          type: 'invalid_metadata',
          count: invalidMetadataTasks.length,
          description: '存在无效元数据格式的任务',
          tasks: invalidMetadataTasks
        });
      }

      return {
        isValid: issues.length === 0,
        issues,
        checkedAt: new Date().toISOString()
      };

    } catch (error) {
      return {
        isValid: false,
        issues: [{
          type: 'validation_error',
          description: `数据完整性检查失败: ${error.message}`
        }],
        checkedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 修复数据完整性问题
   * @returns {Promise<Object>}
   */
  async repairDataIntegrity() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const repairs = [];

    try {
      await this.db.exec('BEGIN TRANSACTION');

      // 修复孤立任务（移动到默认清单）
      const orphanRepair = await this.db.run(`
        UPDATE tasks 
        SET list_id = 0, updated_at = ? 
        WHERE list_id != 0 AND list_id NOT IN (SELECT id FROM lists)
      `, [new Date().toISOString()]);

      if (orphanRepair.changes > 0) {
        repairs.push({
          type: 'orphan_tasks_fixed',
          count: orphanRepair.changes,
          description: '已将孤立任务移动到默认清单'
        });
      }

      // 修复无效状态
      const statusRepair = await this.db.run(`
        UPDATE tasks 
        SET status = 'todo', updated_at = ? 
        WHERE status NOT IN ('todo', 'doing', 'paused', 'done')
      `, [new Date().toISOString()]);

      if (statusRepair.changes > 0) {
        repairs.push({
          type: 'invalid_status_fixed',
          count: statusRepair.changes,
          description: '已修复无效状态的任务'
        });
      }

      // 修复无效元数据
      const metadataRepair = await this.db.run(`
        UPDATE tasks 
        SET metadata = '{}', updated_at = ? 
        WHERE metadata IS NOT NULL AND metadata != '' AND metadata NOT LIKE '{%}'
      `, [new Date().toISOString()]);

      if (metadataRepair.changes > 0) {
        repairs.push({
          type: 'invalid_metadata_fixed',
          count: metadataRepair.changes,
          description: '已修复无效元数据的任务'
        });
      }

      await this.db.exec('COMMIT');

      return {
        success: true,
        repairs,
        repairedAt: new Date().toISOString()
      };

    } catch (error) {
      await this.db.exec('ROLLBACK');
      return {
        success: false,
        error: error.message,
        repairedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 获取数据库统计信息
   * @returns {Promise<Object>}
   */
  async getStats() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const taskCount = await this.db.get('SELECT COUNT(*) as count FROM tasks');
    const listStats = await this.getOptimizedListTaskCounts();
    const timeStats = await this.getTimeStatistics();
    const dbSize = this.dbPath ? (await fs.stat(this.dbPath)).size : 0;

    return {
      path: this.dbPath,
      taskCount: taskCount.count,
      fileSize: dbSize,
      listStats,
      timeStats
    };
  }

  /**
   * 获取任务表的最新更新时间
   * @returns {Promise<Date|null>}
   */
  async getLastUpdatedTime() {
    try {
      const result = await this.db.get(`
        SELECT MAX(updated_at) as last_updated 
        FROM tasks 
        WHERE updated_at IS NOT NULL
      `);
      
      return result && result.last_updated ? new Date(result.last_updated) : null;
    } catch (error) {
      console.error('获取最新更新时间失败:', error);
      return null;
    }
  }

  /**
   * 查找所有重复任务（主任务）
   * @returns {Promise<Task[]>}
   */
  async findRecurringTasks() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE recurrence IS NOT NULL ORDER BY created_at DESC'
    );
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 根据系列ID查找覆盖实例
   * @param {string} seriesId 系列任务ID
   * @returns {Promise<Task[]>}
   */
  async findOverrideInstances(seriesId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE series_id = ? ORDER BY occurrence_date ASC',
      [seriesId]
    );
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 查找特定日期的覆盖实例
   * @param {string} seriesId 系列任务ID
   * @param {string} occurrenceDate 实例日期 (YYYY-MM-DD)
   * @returns {Promise<Task|null>}
   */
  async findOverrideInstance(seriesId, occurrenceDate) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const row = await this.db.get(
      'SELECT * FROM tasks WHERE series_id = ? AND occurrence_date = ?',
      [seriesId, occurrenceDate]
    );
    return row ? this.rowToTask(row) : null;
  }

  /**
   * 删除系列任务及其所有覆盖实例
   * @param {string} seriesId 系列任务ID
   * @returns {Promise<void>}
   */
  async deleteRecurringSeries(seriesId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    // 删除主任务
    await this.db.run('DELETE FROM tasks WHERE id = ?', [seriesId]);
    
    // 删除所有覆盖实例
    await this.db.run('DELETE FROM tasks WHERE series_id = ?', [seriesId]);
  }
}

module.exports = SqliteTaskRepository;