const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const DatabaseMigration = require('../src/infrastructure/persistence/database-migration');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const Task = require('../src/domain/entities/task');

// 仓储与迁移在初始化时会输出大量日志，在测试进程内静默以避免干扰测试运行器。
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-test-'));
  return path.join(dir, 'tasks.db');
}

test('migration 005 adds the task time model columns to an old database', async (t) => {
  const dbPath = tempDbPath();
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
      due_date TEXT,
      due_time TEXT,
      recurrence TEXT,
      series_id TEXT,
      occurrence_date TEXT
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
  await db.run('INSERT INTO schema_version (version, description) VALUES (4, \'legacy\')');
  await db.close();

  const repo = new SqliteTaskRepository(dbPath);
  await repo.initialize();
  t.after(() => repo.close());

  const columns = await repo.db.all('PRAGMA table_info(tasks)');
  const names = columns.map((column) => column.name);
  assert.ok(names.includes('scheduled_start_at'));
  assert.ok(names.includes('scheduled_end_at'));
  assert.ok(names.includes('reminder_policy'));
  assert.ok(names.includes('deleted_at'));

  const version = await repo.db.get('SELECT version FROM schema_version ORDER BY id DESC LIMIT 1');
  assert.equal(version.version, 8);
});

test('SQLite repository round-trips schedule, deadline and reminder policy', async (t) => {
  const dbPath = tempDbPath();
  const repo = new SqliteTaskRepository(dbPath);
  await repo.initialize();
  t.after(() => repo.close());

  const task = new Task({
    id: 'task-roundtrip',
    content: '带时间的任务',
    status: 'todo',
    createdAt: new Date(2026, 6, 30, 9, 0),
    timeTracking: {},
    listId: 0,
    metadata: { note: 'hi' },
    dueDate: '2026-08-03',
    dueTime: '18:00',
    scheduledStartAt: new Date(2026, 7, 1, 10, 0),
    scheduledEndAt: new Date(2026, 7, 1, 11, 30),
    reminderPolicy: { mode: 'relative', minutesBefore: 10 },
    reminderTime: new Date(2026, 7, 1, 9, 50)
  });

  await repo.save(task);
  const loaded = await repo.findById('task-roundtrip');

  assert.equal(loaded.dueDate, '2026-08-03');
  assert.equal(loaded.dueTime, '18:00');
  assert.equal(loaded.scheduledStartAt.toISOString(), task.scheduledStartAt.toISOString());
  assert.equal(loaded.scheduledEndAt.toISOString(), task.scheduledEndAt.toISOString());
  assert.deepEqual(loaded.reminderPolicy, { mode: 'relative', minutesBefore: 10 });
  assert.equal(loaded.reminderTime.toISOString(), task.reminderTime.toISOString());
});

test('SQLite repository normalizes a legacy ISO deadline on read', async (t) => {
  const dbPath = tempDbPath();
  const repo = new SqliteTaskRepository(dbPath);
  await repo.initialize();
  t.after(() => repo.close());

  const legacyIso = new Date(2026, 7, 1, 23, 59).toISOString();
  await repo.save(new Task({
    id: 'legacy-task',
    content: '旧任务',
    status: 'todo',
    createdAt: new Date(2026, 6, 30, 9, 0),
    timeTracking: {},
    listId: 0,
    metadata: {},
    dueDate: legacyIso,
    dueTime: null
  }));

  const loaded = await repo.findById('legacy-task');
  assert.equal(loaded.dueDate, '2026-08-01');
  assert.equal(loaded.dueTime, '23:59');
});
