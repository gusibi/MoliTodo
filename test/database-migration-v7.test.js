const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const DatabaseMigration = require('../src/infrastructure/persistence/database-migration');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');

const TOOL_TABLES = [
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
];

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};
test.before(() => {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
});
test.after(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-v7-test-'));
  return {
    dir,
    dbPath: path.join(dir, 'tasks.db')
  };
}

async function createV6Fixture(dbPath) {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE tasks (
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
      metadata TEXT DEFAULT '{}',
      scheduled_start_at TEXT,
      scheduled_end_at TEXT,
      reminder_policy TEXT,
      deleted_at TEXT,
      recurrence TEXT,
      series_id TEXT,
      occurrence_date TEXT,
      due_date TEXT,
      due_time TEXT
    )
  `);
  await db.exec(`
    CREATE TABLE lists (
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
  await db.exec(`
    CREATE TABLE schema_version (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    )
  `);
  await db.run('INSERT INTO schema_version (version, description) VALUES (6, \'v6 fixture\')');
  await db.run(
    `INSERT INTO tasks (
      id, content, status, completed, created_at, updated_at,
      reminder_time, list_id, metadata, scheduled_start_at, due_date, due_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'v6-task-1',
      '升级前的任务',
      'todo',
      0,
      '2026-10-01T08:00:00.000Z',
      '2026-10-01T08:00:00.000Z',
      '2026-10-02T01:00:00.000Z',
      0,
      '{"note":"keep"}',
      '2026-10-02T00:00:00.000Z',
      '2026-10-03',
      '18:00'
    ]
  );
  await db.close();
}

async function getTableNames(db) {
  const rows = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
  return rows.map((row) => row.name);
}

async function assertToolTablesExist(db) {
  const names = await getTableNames(db);
  for (const table of TOOL_TABLES) {
    assert.ok(names.includes(table), `缺少表: ${table}`);
  }
}

test('fresh database migrates from 0 to v8 with all tool tables', async (t) => {
  const { dir, dbPath } = tempDbPath();
  const repo = new SqliteTaskRepository(dbPath);
  await repo.initialize();
  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const version = await repo.db.get('SELECT version FROM schema_version ORDER BY id DESC LIMIT 1');
  assert.equal(version.version, 8);
  await assertToolTablesExist(repo.db);

  const focusColumns = await repo.db.all('PRAGMA table_info(focus_sessions)');
  assert.ok(focusColumns.some((column) => column.name === 'phase'));

  const columns = await repo.db.all('PRAGMA table_info(tasks)');
  const names = columns.map((column) => column.name);
  assert.ok(names.includes('due_date'));
  assert.ok(names.includes('scheduled_start_at'));
  assert.ok(!names.includes('growth_score'), 'tasks 不应混入工具域字段');
});

test('v6 database migrates to v8 without changing tasks schema or data', async (t) => {
  const { dir, dbPath } = tempDbPath();
  await createV6Fixture(dbPath);

  const beforeDb = await open({ filename: dbPath, driver: sqlite3.Database });
  const columnsBefore = await beforeDb.all('PRAGMA table_info(tasks)');
  const taskBefore = await beforeDb.get('SELECT * FROM tasks WHERE id = ?', ['v6-task-1']);
  await beforeDb.close();

  const repo = new SqliteTaskRepository(dbPath);
  await repo.initialize();
  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const version = await repo.db.get('SELECT version FROM schema_version ORDER BY id DESC LIMIT 1');
  assert.equal(version.version, 8);
  await assertToolTablesExist(repo.db);

  const columnsAfter = await repo.db.all('PRAGMA table_info(tasks)');
  assert.deepEqual(
    columnsAfter.map((column) => ({
      name: column.name,
      type: column.type,
      notnull: column.notnull,
      dflt_value: column.dflt_value,
      pk: column.pk
    })),
    columnsBefore.map((column) => ({
      name: column.name,
      type: column.type,
      notnull: column.notnull,
      dflt_value: column.dflt_value,
      pk: column.pk
    }))
  );

  const taskAfter = await repo.db.get('SELECT * FROM tasks WHERE id = ?', ['v6-task-1']);
  assert.deepEqual(taskAfter, taskBefore);
});

test('v7 tool tables enforce the documented uniqueness constraints', async (t) => {
  const { dir, dbPath } = tempDbPath();
  const repo = new SqliteTaskRepository(dbPath);
  await repo.initialize();
  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const db = repo.db;

  await db.run(
    `INSERT INTO reminder_rules (
      type, interval_minutes, anchor_mode, anchor_minutes, weekdays,
      window_start, window_end, enabled, next_run_at, created_at, updated_at
    ) VALUES ('water', 60, 'created', 520, '[]', '09:00', '18:00', 1,
      '2026-10-21T01:40:00.000Z', '2026-10-21T00:40:00.000Z', '2026-10-21T00:40:00.000Z')`
  );
  await db.run(
    `INSERT INTO reminder_occurrences (
      rule_id, scheduled_at, status, local_date, created_at
    ) VALUES (1, '2026-10-21T01:40:00.000Z', 'pending', '2026-10-21', '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO reminder_occurrences (
        rule_id, scheduled_at, status, local_date, created_at
      ) VALUES (1, '2026-10-21T01:40:00.000Z', 'pending', '2026-10-21', '2026-10-21T01:41:00.000Z')`
    ),
    /UNIQUE/
  );

  await db.run(
    `INSERT INTO activity_events (
      dedupe_key, source_type, source_id, event_type, growth_points,
      occurred_at, local_date, tz_offset, created_at
    ) VALUES ('health:1:confirmed', 'reminder', '1', 'water', 2,
      '2026-10-21T01:40:00.000Z', '2026-10-21', 480, '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO activity_events (
        dedupe_key, source_type, source_id, event_type, growth_points,
        occurred_at, local_date, tz_offset, created_at
      ) VALUES ('health:1:confirmed', 'reminder', '1', 'water', 2,
        '2026-10-21T01:40:00.000Z', '2026-10-21', 480, '2026-10-21T01:40:00.000Z')`
    ),
    /UNIQUE/
  );

  await db.run(
    `INSERT INTO activity_daily_summary (local_date, updated_at)
     VALUES ('2026-10-21', '2026-10-21T01:40:00.000Z')`
  );
  await db.run(
    `INSERT INTO growth_days (local_date, growth_score, created_at)
     VALUES ('2026-10-21', 2, '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO growth_days (local_date, growth_score, created_at)
       VALUES ('2026-10-21', 2, '2026-10-21T01:40:00.000Z')`
    ),
    /UNIQUE|PRIMARY/
  );

  await db.run(
    `INSERT INTO seed_inventory (species_id, quantity, updated_at)
     VALUES ('species-1', 1, '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO seed_inventory (species_id, quantity, updated_at)
       VALUES ('species-1', 2, '2026-10-21T01:40:00.000Z')`
    ),
    /UNIQUE/
  );

  await db.run(
    `INSERT INTO species_unlocks (species_id, unlocked_at, source)
     VALUES ('species-1', '2026-10-21T01:40:00.000Z', 'initial')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO species_unlocks (species_id, unlocked_at, source)
       VALUES ('species-1', '2026-10-21T01:40:00.000Z', 'initial')`
    ),
    /UNIQUE|PRIMARY/
  );

  await db.run(
    `INSERT INTO garden_expansions (level, unlocked_at, condition_type)
     VALUES (2, '2026-10-21T01:40:00.000Z', 'streak')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO garden_expansions (level, unlocked_at, condition_type)
       VALUES (2, '2026-10-21T01:40:00.000Z', 'streak')`
    ),
    /UNIQUE|PRIMARY/
  );

  await db.run(
    `INSERT INTO milestone_unlocks (definition_id, unlocked_at, claim_status)
     VALUES ('first-sprout', '2026-10-21T01:40:00.000Z', 'pending')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO milestone_unlocks (definition_id, unlocked_at, claim_status)
       VALUES ('first-sprout', '2026-10-21T01:40:00.000Z', 'pending')`
    ),
    /UNIQUE/
  );

  await db.run(
    `INSERT INTO reward_claims (unlock_id, selected_item_id, created_at)
     VALUES (1, NULL, '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO reward_claims (unlock_id, selected_item_id, created_at)
       VALUES (1, 'item-1', '2026-10-21T01:40:00.000Z')`
    ),
    /UNIQUE/
  );

  await db.run(
    `INSERT INTO inventory_items (
      catalog_id, kind, quantity, origin_type, origin_id, acquired_at
    ) VALUES ('tree-species-1', 'tree', 1, 'plant_instance', '1', '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO inventory_items (
        catalog_id, kind, quantity, origin_type, origin_id, acquired_at
      ) VALUES ('tree-species-1', 'tree', 1, 'plant_instance', '1', '2026-10-21T01:40:00.000Z')`
    ),
    /UNIQUE/
  );

  await db.run(
    `INSERT INTO garden_placements (inventory_id, region_id, slot_id, placed_at)
     VALUES (1, 'garden', 'slot-1', '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO garden_placements (inventory_id, region_id, slot_id, placed_at)
       VALUES (1, 'garden', 'slot-2', '2026-10-21T01:40:00.000Z')`
    ),
    /UNIQUE/
  );
  await db.run(
    `INSERT INTO inventory_items (
      catalog_id, kind, quantity, origin_type, origin_id, acquired_at
    ) VALUES ('chair', 'furniture', 1, 'milestone', '2', '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO garden_placements (inventory_id, region_id, slot_id, placed_at)
       VALUES (2, 'garden', 'slot-1', '2026-10-21T01:40:00.000Z')`
    ),
    /UNIQUE/
  );

  await db.run(
    `INSERT INTO garden_state (id, updated_at) VALUES (1, '2026-10-21T01:40:00.000Z')`
  );
  await assert.rejects(
    db.run(`INSERT INTO garden_state (id, updated_at) VALUES (2, '2026-10-21T01:40:00.000Z')`),
    /CHECK/
  );

  await db.run(
    `INSERT INTO plant_instances (species_id, planted_at, local_date_planted)
     VALUES ('species-1', '2026-10-21T01:40:00.000Z', '2026-10-21')`
  );
  await assert.rejects(
    db.run(
      `INSERT INTO plant_instances (species_id, planted_at, local_date_planted)
       VALUES ('species-1', '2026-10-21T01:41:00.000Z', '2026-10-21')`
    ),
    /UNIQUE/
  );
  await db.run("UPDATE plant_instances SET status = 'matured' WHERE id = 1");
  await db.run(
    `INSERT INTO plant_instances (species_id, planted_at, local_date_planted)
     VALUES ('species-2', '2026-10-21T01:42:00.000Z', '2026-10-21')`
  );
});

test('backupDatabase checkpoints WAL so the backup contains latest writes', async (t) => {
  const { dir, dbPath } = tempDbPath();
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec('PRAGMA journal_mode = WAL');
  await db.exec(`
    CREATE TABLE activity_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupe_key TEXT NOT NULL UNIQUE
    )
  `);
  await db.run("INSERT INTO activity_events (dedupe_key) VALUES ('wal-event')");

  const migration = new DatabaseMigration(db, dbPath);
  const backupPath = await migration.backupDatabase();
  assert.ok(backupPath, '备份应该成功');

  const backup = await open({ filename: backupPath, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
  const rows = await backup.all('SELECT dedupe_key FROM activity_events');
  await backup.close();
  await migration.db.close();

  assert.deepEqual(rows, [{ dedupe_key: 'wal-event' }]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('restoreFromBackup reopens a usable connection after restoring', async (t) => {
  const { dir, dbPath } = tempDbPath();
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec('PRAGMA journal_mode = WAL');
  await db.exec(`
    CREATE TABLE activity_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupe_key TEXT NOT NULL UNIQUE
    )
  `);
  await db.run("INSERT INTO activity_events (dedupe_key) VALUES ('before-backup')");

  const migration = new DatabaseMigration(db, dbPath);
  const backupPath = await migration.backupDatabase();
  assert.ok(backupPath, '备份应该成功');

  await migration.db.run("INSERT INTO activity_events (dedupe_key) VALUES ('after-backup')");
  const restored = await migration.restoreFromBackup(backupPath);
  assert.equal(restored, true);

  const rows = await migration.db.all('SELECT dedupe_key FROM activity_events ORDER BY id');
  assert.deepEqual(rows, [{ dedupe_key: 'before-backup' }]);

  await migration.db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
