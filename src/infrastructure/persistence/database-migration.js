const fs = require('fs').promises;
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

/**
 * 数据库迁移管理类
 * 负责数据库架构的版本控制和自动升级
 */
class DatabaseMigration {
  constructor(db, dbPath) {
    this.db = db;
    this.dbPath = dbPath;
    this.currentVersion = 0;
    this.targetVersion = 8; // 工具域数据表与专注休息阶段
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
      },
      {
        version: 5,
        description: '添加任务时间模型字段',
        migrate: () => this.migration_005_add_task_time_model()
      },
      {
        version: 6,
        description: '添加软删除（垃圾桶）字段',
        migrate: () => this.migration_006_add_deleted_at()
      },
      {
        version: 7,
        description: '添加工具域数据表',
        migrate: () => this.migration_007_create_tool_tables()
      },
      {
        version: 8,
        description: '为专注会话添加休息阶段',
        migrate: () => this.migration_008_add_focus_phase()
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
   * 迁移 005: 添加任务时间模型字段（安排 / 截止 / 提醒策略）
   * 只新增字段，不批量猜测或改写旧的 Deadline / Reminder 数据。
   */
  async migration_005_add_task_time_model() {
    console.log('执行迁移: 添加任务时间模型字段');

    const tableInfo = await this.db.all("PRAGMA table_info(tasks)");
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('due_date')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN due_date TEXT');
      console.log('已添加 due_date 字段');
    }

    if (!columnNames.includes('due_time')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN due_time TEXT');
      console.log('已添加 due_time 字段');
    }

    if (!columnNames.includes('scheduled_start_at')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN scheduled_start_at TEXT');
      console.log('已添加 scheduled_start_at 字段');
    }

    if (!columnNames.includes('scheduled_end_at')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN scheduled_end_at TEXT');
      console.log('已添加 scheduled_end_at 字段');
    }

    if (!columnNames.includes('reminder_policy')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN reminder_policy TEXT');
      console.log('已添加 reminder_policy 字段');
    }

    // 调度查询需要按安排开始时间过滤
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_start_at ON tasks(scheduled_start_at)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');

    console.log('任务时间模型字段添加完成，索引已创建');
  }

  /**
   * 迁移 006: 添加软删除字段（垃圾桶）
   * deleted_at 为 NULL 表示活跃任务；非 NULL 表示已入垃圾桶，可恢复或彻底删除。
   */
  async migration_006_add_deleted_at() {
    console.log('执行迁移: 添加软删除字段');

    const tableInfo = await this.db.all("PRAGMA table_info(tasks)");
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('deleted_at')) {
      await this.db.exec('ALTER TABLE tasks ADD COLUMN deleted_at TEXT');
      console.log('已添加 deleted_at 字段');
    }

    // 垃圾桶列表按删除时间倒序查询
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at)');

    console.log('软删除字段添加完成，索引已创建');
  }

  /**
   * 迁移 007: 添加工具域数据表（健康提醒 / 专注 / 成长 / 小院）
   * 只新增表，不修改 tasks 表结构或任务语义。
   */
  async migration_007_create_tool_tables() {
    console.log('执行迁移: 添加工具域数据表');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS reminder_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        interval_minutes INTEGER NOT NULL,
        anchor_mode TEXT NOT NULL DEFAULT 'created',
        anchor_minutes INTEGER NOT NULL,
        weekdays TEXT NOT NULL DEFAULT '[]',
        window_start TEXT NOT NULL,
        window_end TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        pause_until TEXT,
        next_run_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reminder_occurrences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER NOT NULL,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        snoozed_until TEXT,
        snooze_count INTEGER NOT NULL DEFAULT 0,
        responded_at TEXT,
        local_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(rule_id, scheduled_at),
        FOREIGN KEY (rule_id) REFERENCES reminder_rules(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS focus_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        linked_task_id TEXT,
        planned_seconds INTEGER NOT NULL,
        focus_seconds INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        paused_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dedupe_key TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        source_id TEXT,
        event_type TEXT NOT NULL,
        growth_points INTEGER NOT NULL DEFAULT 0,
        occurred_at TEXT NOT NULL,
        local_date TEXT NOT NULL,
        tz_offset INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_daily_summary (
        local_date TEXT PRIMARY KEY,
        focus_count INTEGER NOT NULL DEFAULT 0,
        water_count INTEGER NOT NULL DEFAULT 0,
        sun_count INTEGER NOT NULL DEFAULT 0,
        total_growth INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plant_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        species_id TEXT NOT NULL,
        growth_score INTEGER NOT NULL DEFAULT 0,
        stage TEXT NOT NULL DEFAULT 'seed',
        planted_at TEXT NOT NULL,
        matured_at TEXT,
        status TEXT NOT NULL DEFAULT 'growing',
        local_date_planted TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS seed_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        species_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE(species_id)
      );

      CREATE TABLE IF NOT EXISTS species_unlocks (
        species_id TEXT PRIMARY KEY,
        unlocked_at TEXT NOT NULL,
        source TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS growth_days (
        local_date TEXT PRIMARY KEY,
        growth_score INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS garden_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        total_growth_days INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        active_plant_id INTEGER,
        auto_plant INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS garden_expansions (
        level INTEGER PRIMARY KEY,
        unlocked_at TEXT NOT NULL,
        condition_type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS milestone_unlocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        definition_id TEXT NOT NULL UNIQUE,
        unlocked_at TEXT NOT NULL,
        claim_status TEXT NOT NULL DEFAULT 'pending',
        definition_version TEXT
      );

      CREATE TABLE IF NOT EXISTS reward_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unlock_id INTEGER NOT NULL UNIQUE,
        selected_item_id TEXT,
        claimed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catalog_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        origin_type TEXT NOT NULL,
        origin_id TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        UNIQUE(origin_type, origin_id)
      );

      CREATE TABLE IF NOT EXISTS garden_placements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_id INTEGER NOT NULL UNIQUE,
        region_id TEXT NOT NULL,
        slot_id TEXT NOT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
        placed_at TEXT NOT NULL,
        UNIQUE(region_id, slot_id),
        FOREIGN KEY (inventory_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_plant_instances_single_growing
        ON plant_instances(status) WHERE status = 'growing';

      CREATE INDEX IF NOT EXISTS idx_reminder_rules_next_run_at
        ON reminder_rules(next_run_at);
      CREATE INDEX IF NOT EXISTS idx_reminder_rules_enabled_next_run
        ON reminder_rules(enabled, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_reminder_occurrences_status
        ON reminder_occurrences(status);
      CREATE INDEX IF NOT EXISTS idx_reminder_occurrences_local_date
        ON reminder_occurrences(local_date);
      CREATE INDEX IF NOT EXISTS idx_reminder_occurrences_snoozed_until
        ON reminder_occurrences(snoozed_until);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at
        ON focus_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_status
        ON focus_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_activity_events_local_date
        ON activity_events(local_date);
      CREATE INDEX IF NOT EXISTS idx_activity_events_event_type
        ON activity_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_activity_events_occurred_at
        ON activity_events(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_plant_instances_status
        ON plant_instances(status);
      CREATE INDEX IF NOT EXISTS idx_plant_instances_species_id
        ON plant_instances(species_id);
      CREATE INDEX IF NOT EXISTS idx_milestone_unlocks_claim_status
        ON milestone_unlocks(claim_status);
      CREATE INDEX IF NOT EXISTS idx_inventory_items_catalog_id
        ON inventory_items(catalog_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_items_kind
        ON inventory_items(kind);
    `);

    console.log('工具域数据表创建完成，索引已创建');
  }

  /**
   * 迁移 008: 区分专注与休息会话。
   */
  async migration_008_add_focus_phase() {
    console.log('执行迁移: 添加专注休息阶段');

    const columns = await this.db.all('PRAGMA table_info(focus_sessions)');
    if (!columns.some((column) => column.name === 'phase')) {
      await this.db.exec(
        "ALTER TABLE focus_sessions ADD COLUMN phase TEXT NOT NULL DEFAULT 'focus'"
      );
      console.log('已添加 phase 字段');
    }

    await this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_focus_sessions_phase ON focus_sessions(phase)'
    );

    console.log('专注休息阶段迁移完成');
  }

  /**
   * 备份数据库
   */
  async backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.dbPath}.backup.${timestamp}`;

    try {
      // 备份前把 WAL 内容合并回主数据库文件，避免 copyFile 漏写已提交数据。
      await this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch (error) {
      console.warn('数据库 WAL 检查点失败，备份可能不完整:', error.message);
    }

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

      // 关闭当前数据库连接，避免在打开状态下覆盖数据库文件
      if (this.db) {
        await this.db.close();
        this.db = null;
      }

      // 清理旧的 WAL / SHM 边车文件，防止用恢复后的主文件配上旧 WAL
      await fs.rm(`${this.dbPath}-wal`, { force: true });
      await fs.rm(`${this.dbPath}-shm`, { force: true });

      // 恢复备份
      await fs.copyFile(backupPath, this.dbPath);

      // 重新打开连接，保证恢复后仍可继续使用
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
      });

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