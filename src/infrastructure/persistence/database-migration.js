const fs = require('fs').promises;

/**
 * 数据库迁移管理类
 * 负责数据库架构的版本控制和自动升级
 */
class DatabaseMigration {
  constructor(db, dbPath) {
    this.db = db;
    this.dbPath = dbPath;
    this.currentVersion = 0;
    this.targetVersion = 4; // 支持重复任务功能的版本
  }

  /**
   * 检查并执行数据库迁移
   */
  async checkAndMigrate() {
    try {
      console.log('开始检查数据库版本...');
      
      // 创建版本控制表
      await this.createVersionTable();
      
      // 获取当前版本
      const currentVersion = await this.getCurrentVersion();
      console.log(`当前数据库版本: ${currentVersion}, 目标版本: ${this.targetVersion}`);
      
      if (currentVersion < this.targetVersion) {
        console.log('需要执行数据库迁移...');
        
        // 备份数据库
        const backupPath = await this.backupDatabase();
        console.log(`数据库已备份到: ${backupPath}`);
        
        try {
          // 执行迁移
          await this.runMigrations(currentVersion);
          console.log('数据库迁移完成');
        } catch (error) {
          console.error('数据库迁移失败，尝试恢复备份:', error);
          await this.restoreFromBackup(backupPath);
          throw error;
        }
      } else {
        console.log('数据库版本已是最新，无需迁移');
      }
    } catch (error) {
      console.error('数据库迁移检查失败:', error);
      throw error;
    }
  }

  /**
   * 创建版本控制表
   */
  async createVersionTable() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now')),
        description TEXT
      )
    `);
  }

  /**
   * 获取当前数据库版本
   */
  async getCurrentVersion() {
    try {
      const result = await this.db.get(
        'SELECT version FROM schema_version ORDER BY id DESC LIMIT 1'
      );
      return result ? result.version : 0;
    } catch (error) {
      console.warn('获取数据库版本失败，假设为初始版本:', error.message);
      return 0;
    }
  }

  /**
   * 更新数据库版本
   */
  async updateVersion(version, description = '') {
    await this.db.run(
      'INSERT INTO schema_version (version, description) VALUES (?, ?)',
      [version, description]
    );
  }

  /**
   * 执行数据库迁移
   */
  async runMigrations(fromVersion) {
    const migrations = [
      {
        version: 1,
        description: '添加 lists 表',
        migrate: () => this.migration_001_add_lists_table()
      },
      {
        version: 2,
        description: '扩展 tasks 表字段',
        migrate: () => this.migration_002_add_task_fields()
      },
      {
        version: 3,
        description: '添加重复任务支持',
        migrate: () => this.migration_003_add_recurring_tasks()
      },
      {
        version: 4,
        description: '添加任务状态日志表',
        migrate: () => this.migration_004_add_task_status_logs()
      }
    ];

    // 开始事务
    await this.db.exec('BEGIN TRANSACTION');

    try {
      for (let i = fromVersion; i < this.targetVersion; i++) {
        const migration = migrations[i];
        if (migration) {
          console.log(`执行迁移 ${migration.version}: ${migration.description}`);
          await migration.migrate();
          await this.updateVersion(migration.version, migration.description);
        }
      }

      // 提交事务
      await this.db.exec('COMMIT');
      console.log('所有迁移执行成功');
    } catch (error) {
      // 回滚事务
      await this.db.exec('ROLLBACK');
      console.error('迁移执行失败，已回滚:', error);
      throw error;
    }
  }

  /**
   * 迁移 001: 添加 lists 表
   */
  async migration_001_add_lists_table() {
    console.log('执行迁移: 添加 lists 表');
    
    // 创建 lists 表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#007AFF',
        icon TEXT DEFAULT 'list',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        is_default INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // 插入默认清单（ID为0的特殊清单）
    await this.db.run(`
      INSERT OR IGNORE INTO lists (id, name, color, icon, is_default, sort_order) 
      VALUES (0, '默认清单', '#007AFF', 'inbox', 1, 0)
    `);

    console.log('lists 表创建完成，默认清单已插入');
  }

  /**
   * 迁移 002: 扩展 tasks 表字段
   */
  async migration_002_add_task_fields() {
    console.log('执行迁移: 扩展 tasks 表字段');

    // 检查现有字段
    const tableInfo = await this.db.all("PRAGMA table_info(tasks)");
    const columnNames = tableInfo.map(col => col.name);

    // 添加 list_id 字段
    if (!columnNames.includes('list_id')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN list_id INTEGER DEFAULT 0');
      console.log('已添加 list_id 字段');
    }

    // 添加 metadata 字段
    if (!columnNames.includes('metadata')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN metadata TEXT DEFAULT "{}"');
      console.log('已添加 metadata 字段');
    }

    // 为现有任务设置默认值
    await this.db.run('UPDATE tasks SET list_id = 0 WHERE list_id IS NULL');
    await this.db.run('UPDATE tasks SET metadata = "{}" WHERE metadata IS NULL OR metadata = ""');

    // 添加索引以提高查询性能
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_list_status ON tasks(list_id, status)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_reminder_time ON tasks(reminder_time)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at)');
    
    // 为 lists 表添加索引
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_lists_name ON lists(name)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_lists_sort_order ON lists(sort_order)');

    console.log('tasks 表字段扩展完成，索引已创建');
  }

  /**
   * 迁移 003: 添加重复任务支持
   */
  async migration_003_add_recurring_tasks() {
    console.log('执行迁移: 添加重复任务支持');

    // 检查现有字段
    const tableInfo = await this.db.all("PRAGMA table_info(tasks)");
    const columnNames = tableInfo.map(col => col.name);

    // 添加 recurrence 字段（重复规则 JSON）
    if (!columnNames.includes('recurrence')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN recurrence TEXT');
      console.log('已添加 recurrence 字段');
    }

    // 添加 series_id 字段（系列任务ID，用于覆盖实例）
    if (!columnNames.includes('series_id')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN series_id TEXT');
      console.log('已添加 series_id 字段');
    }

    // 添加 occurrence_date 字段（实例日期，用于覆盖实例）
    if (!columnNames.includes('occurrence_date')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN occurrence_date TEXT');
      console.log('已添加 occurrence_date 字段');
    }

    // 添加索引以提高重复任务查询性能
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(recurrence)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_series_id ON tasks(series_id)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_series_occurrence ON tasks(series_id, occurrence_date)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_occurrence_date ON tasks(occurrence_date)');

    console.log('重复任务字段添加完成，索引已创建');
  }

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

    // 创建索引以优化查询性能
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_task_id ON task_status_logs(task_id)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_created_at ON task_status_logs(created_at)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_to_status ON task_status_logs(to_status)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_task_status ON task_status_logs(task_id, to_status)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_task_status_logs_transition ON task_status_logs(from_status, to_status)');

    console.log('任务状态日志表创建完成，索引已创建');
  }

  /**
   * 备份数据库
   */
  async backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.dbPath}.backup.${timestamp}`;
    
    try {
      await fs.copyFile(this.dbPath, backupPath);
      console.log(`数据库已备份到: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.warn('数据库备份失败:', error.message);
      return null;
    }
  }

  /**
   * 从备份恢复数据库
   */
  async restoreFromBackup(backupPath) {
    if (!backupPath) {
      console.warn('没有可用的备份文件');
      return false;
    }

    try {
      // 检查备份文件是否存在
      await fs.access(backupPath);
      
      // 关闭当前数据库连接
      if (this.db) {
        await this.db.close();
      }
      
      // 恢复备份
      await fs.copyFile(backupPath, this.dbPath);
      console.log(`数据库已从备份恢复: ${backupPath}`);
      return true;
    } catch (error) {
      console.error('数据库恢复失败:', error);
      return false;
    }
  }

  /**
   * 验证数据库完整性
   */
  async validateDatabase() {
    try {
      // 检查关键表是否存在
      const tables = await this.db.all(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const tableNames = tables.map(t => t.name);

      const requiredTables = ['tasks', 'lists', 'schema_version'];
      for (const table of requiredTables) {
        if (!tableNames.includes(table)) {
          throw new Error(`缺少必要的表: ${table}`);
        }
      }

      // 检查数据完整性
      await this.db.get('SELECT COUNT(*) FROM tasks');
      await this.db.get('SELECT COUNT(*) FROM lists');

      console.log('数据库完整性验证通过');
      return true;
    } catch (error) {
      console.error('数据库完整性验证失败:', error);
      return false;
    }
  }

  /**
   * 获取迁移历史
   */
  async getMigrationHistory() {
    try {
      const history = await this.db.all(
        'SELECT * FROM schema_version ORDER BY id ASC'
      );
      return history;
    } catch (error) {
      console.warn('获取迁移历史失败:', error);
      return [];
    }
  }
}

module.exports = DatabaseMigration;