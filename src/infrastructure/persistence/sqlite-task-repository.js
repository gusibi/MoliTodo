const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;
const Task = require('../../domain/entities/task');
const TaskRepository = require('../../domain/repositories/task-repository');

/**
 * 基于 SQLite 的任务仓储实现
 */
class SqliteTaskRepository extends TaskRepository {
  constructor(dbPath = null) {
    super();
    this.db = null;
    this.dbPath = dbPath;
  }

  /**
   * 初始化数据库连接
   * @param {string} dbPath 数据库文件路径
   */
  async initialize(dbPath = null) {
    if (dbPath) {
      this.dbPath = dbPath;
    }
    
    if (!this.dbPath) {
      throw new Error('数据库路径未设置');
    }

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

    // 创建表结构
    await this.createTables();
    
    console.log(`SQLite 数据库已初始化: ${this.dbPath}`);
  }

  /**
   * 创建数据库表结构
   */
  async createTables() {
    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        reminder_time TEXT,
        completed_at TEXT
      )
    `;

    await this.db.exec(createTasksTable);

    // 检查是否需要添加新列（向后兼容）
    const tableInfo = await this.db.all("PRAGMA table_info(tasks)");
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('status')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT "todo"');
    }
    
    if (!columnNames.includes('completed_at')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN completed_at TEXT');
    }
    
    // 添加时间跟踪字段
    if (!columnNames.includes('started_at')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN started_at TEXT');
    }
    
    if (!columnNames.includes('total_duration')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN total_duration INTEGER DEFAULT 0');
    }

    // 迁移现有数据的状态字段
    await this.migrateExistingData();
  }

  /**
   * 迁移现有数据，确保状态字段正确
   */
  async migrateExistingData() {
    // 更新没有状态的任务
    await this.db.run(`
      UPDATE tasks 
      SET status = CASE 
        WHEN completed = 1 THEN 'done' 
        ELSE 'todo' 
      END 
      WHERE status IS NULL OR status = ''
    `);
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
      total_duration: task.totalDuration || 0
    };
  }

  /**
   * 将数据库行转换为任务对象
   */
  rowToTask(row) {
    // 准备时间跟踪数据
    const timeTracking = {
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      totalDuration: row.total_duration || 0
    };
    
    const task = new Task(
      row.id,
      row.content,
      row.status || (row.completed ? 'done' : 'todo'),
      new Date(row.created_at),
      row.reminder_time ? new Date(row.reminder_time) : null,
      timeTracking
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
   * @returns {Promise<Task[]>}
   */
  async findIncomplete() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE status != "done" ORDER BY created_at DESC'
    );
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 获取所有已完成的任务
   * @returns {Promise<Task[]>}
   */
  async findCompleted() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE status = "done" ORDER BY updated_at DESC'
    );
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 根据状态查找任务
   * @param {string} status 
   * @returns {Promise<Task[]>}
   */
  async findByStatus(status) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * 获取需要提醒的任务
   * @returns {Promise<Task[]>}
   */
  async findTasksToRemind() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const now = new Date().toISOString();
    const rows = await this.db.all(
      'SELECT * FROM tasks WHERE reminder_time IS NOT NULL AND reminder_time <= ? AND status != "done"',
      [now]
    );
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
          total_duration = ?
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
        row.id
      ]);
    } else {
      // 插入新任务
      await this.db.run(`
        INSERT INTO tasks (
          id, content, status, completed, created_at, updated_at, reminder_time, completed_at, started_at, total_duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        row.total_duration
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
   * @returns {Promise<number>}
   */
  async getIncompleteCount() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.get('SELECT COUNT(*) as count FROM tasks WHERE status != "done"');
    return result.count;
  }

  /**
   * 获取各状态任务数量统计
   * @returns {Promise<Object>}
   */
  async getStatusCounts() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all(`
      SELECT status, COUNT(*) as count 
      FROM tasks 
      GROUP BY status
    `);
    
    const counts = { todo: 0, doing: 0, done: 0 };
    rows.forEach(row => {
      counts[row.status] = row.count;
    });
    
    return counts;
  }

  /**
   * 清空所有任务 (用于测试或重置)
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    await this.db.run('DELETE FROM tasks');
  }

  /**
   * 导出所有任务数据
   * @returns {Promise<Object>}
   */
  async exportData() {
    const tasks = await this.findAll();
    return {
      tasks: tasks.map(task => task.toJSON()),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * 导入任务数据
   * @param {Object} data 
   * @returns {Promise<void>}
   */
  async importData(data) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    if (!data.tasks || !Array.isArray(data.tasks)) {
      throw new Error('无效的导入数据格式');
    }

    // 清空现有数据
    await this.clear();

    // 导入新数据
    for (const taskData of data.tasks) {
      const task = Task.fromJSON(taskData);
      await this.save(task);
    }
  }

  /**
   * 备份数据库文件
   * @param {string} backupPath 备份文件路径
   * @returns {Promise<void>}
   */
  async backup(backupPath) {
    if (!this.dbPath) {
      throw new Error('数据库路径未设置');
    }

    const backupDir = path.dirname(backupPath);
    try {
      await fs.access(backupDir);
    } catch (error) {
      await fs.mkdir(backupDir, { recursive: true });
    }

    await fs.copyFile(this.dbPath, backupPath);
  }

  /**
   * 获取数据库信息
   * @returns {Promise<Object>}
   */
  async getDatabaseInfo() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const taskCount = await this.db.get('SELECT COUNT(*) as count FROM tasks');
    const dbSize = this.dbPath ? (await fs.stat(this.dbPath)).size : 0;
    
    return {
      path: this.dbPath,
      taskCount: taskCount.count,
      size: dbSize,
      sizeFormatted: this.formatBytes(dbSize)
    };
  }

  /**
   * 格式化字节大小
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = SqliteTaskRepository;