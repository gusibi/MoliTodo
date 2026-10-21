const { withTransaction } = require('../infrastructure/persistence/with-transaction');

/**
 * 工具域数据导出/导入/清空。
 * 使用显式 allowlist，不自动发现 sqlite_master。
 */

const TOOL_TABLES = Object.freeze([
  'reminder_rules',
  'reminder_occurrences',
  'focus_sessions',
  'activity_events',
  'activity_daily_summary',
  'plant_instances',
  'seed_inventory',
  'species_unlocks',
  'growth_days',
  'garden_state',
  'garden_expansions',
  'milestone_unlocks',
  'reward_claims',
  'inventory_items',
  'garden_placements'
]);

const DELETE_ORDER = Object.freeze([...TOOL_TABLES].reverse());

const INSERT_ORDER = Object.freeze([
  'species_unlocks',
  'seed_inventory',
  'plant_instances',
  'reminder_rules',
  'reminder_occurrences',
  'focus_sessions',
  'activity_events',
  'activity_daily_summary',
  'growth_days',
  'garden_state',
  'garden_expansions',
  'milestone_unlocks',
  'reward_claims',
  'inventory_items',
  'garden_placements'
]);

const IDENTIFIER = /^[a-z_]+$/;

class ToolsDataPort {
  constructor({ db, clock, gardenUseCases, catalogVersion = '1' }) {
    this.db = db;
    this.clock = clock;
    this.gardenUseCases = gardenUseCases;
    this.catalogVersion = catalogVersion;
  }

  async exportToolsData() {
    const tables = {};
    for (const table of TOOL_TABLES) {
      tables[table] = await this.db.all(`SELECT * FROM ${table}`);
    }
    return {
      version: '1',
      schemaVersion: 7,
      catalogVersion: this.catalogVersion,
      tables
    };
  }

  async clearToolsData() {
    await withTransaction(this.db, async () => {
      for (const table of DELETE_ORDER) {
        await this.db.run(`DELETE FROM ${table}`);
      }
    });
    await this.gardenUseCases.initializeGarden(this.clock.now());
  }

  async importToolsData(snapshot) {
    const tables = snapshot && snapshot.tables ? snapshot.tables : {};
    await withTransaction(this.db, async () => {
      for (const table of DELETE_ORDER) {
        await this.db.run(`DELETE FROM ${table}`);
      }

      for (const table of INSERT_ORDER) {
        const rows = Array.isArray(tables[table]) ? tables[table] : [];
        for (const row of rows) {
          await this.insertRow(table, row);
        }
      }
    });

    // 旧备份没有工具域数据时，按新用户初始化，避免空壳状态。
    await this.gardenUseCases.initializeGarden(this.clock.now());
    return this.exportToolsData();
  }

  async insertRow(table, row) {
    if (!row || typeof row !== 'object') return;
    const columns = Object.keys(row).filter((column) => IDENTIFIER.test(column));
    if (columns.length === 0) return;
    const placeholders = columns.map(() => '?').join(', ');
    await this.db.run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      columns.map((column) => row[column])
    );
  }
}

module.exports = ToolsDataPort;
module.exports.TOOL_TABLES = TOOL_TABLES;
