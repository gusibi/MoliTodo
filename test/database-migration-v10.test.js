const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const DatabaseMigration = require('../src/infrastructure/persistence/database-migration');

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

async function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-migration-v10-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { dir, dbPath: path.join(dir, 'tasks.db'), repo };
}

async function downgradeToVersion9(db) {
  await db.run('DELETE FROM schema_version');
  await db.run(
    "INSERT INTO schema_version (version, description) VALUES (9, 'v9 fixture')"
  );
  // 模拟历史版本：物理上移除 v10 的唯一索引，只改版本号拦不住插入
  await db.run('DROP INDEX IF EXISTS idx_tasks_series_occurrence');
}

function insertInstance(db, { id, seriesId, occurrenceDate, createdAt, status = 'todo' }) {
  return db.run(
    `INSERT INTO tasks (
      id, content, status, completed, created_at, updated_at,
      series_id, occurrence_date, list_id, metadata
    ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, 0, '{}')`,
    [id, '循环实例', status, createdAt, createdAt, seriesId, occurrenceDate]
  );
}

test('v10 dedupes recurring instances and creates the unique index', async (t) => {
  const { dbPath, repo } = await setup(t);

  // 先降回 v9（还没有唯一索引），再模拟历史版本遗留的重复物化实例
  await downgradeToVersion9(repo.db);
  await insertInstance(repo.db, {
    id: 'task-keep',
    seriesId: 'task-keep',
    occurrenceDate: '2026-10-21T00:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z'
  });
  await insertInstance(repo.db, {
    id: 'task-dup',
    seriesId: 'task-keep',
    occurrenceDate: '2026-10-21T00:00:00.000Z',
    createdAt: '2026-10-20T06:00:00.000Z'
  });
  // 不同日期的实例不受影响
  await insertInstance(repo.db, {
    id: 'task-next',
    seriesId: 'task-keep',
    occurrenceDate: '2026-10-22T00:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z'
  });

  const migration = new DatabaseMigration(repo.db, dbPath);
  await migration.checkAndMigrate();

  const rows = await repo.db.all(
    "SELECT id FROM tasks WHERE series_id = 'task-keep' ORDER BY occurrence_date ASC"
  );
  assert.deepEqual(rows.map((row) => row.id), ['task-keep', 'task-next']);

  // 唯一索引生效：再插入同键实例会被拒绝
  await assert.rejects(
    insertInstance(repo.db, {
      id: 'task-dup-2',
      seriesId: 'task-keep',
      occurrenceDate: '2026-10-21T00:00:00.000Z',
      createdAt: '2026-10-21T00:00:00.000Z'
    }),
    /UNIQUE/
  );
});

test('v10 migration is idempotent when no duplicates exist', async (t) => {
  const { dbPath, repo } = await setup(t);

  await insertInstance(repo.db, {
    id: 'task-solo',
    seriesId: 'task-solo',
    occurrenceDate: '2026-10-21T00:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z'
  });

  await downgradeToVersion9(repo.db);
  const migration = new DatabaseMigration(repo.db, dbPath);
  await migration.checkAndMigrate();

  const rows = await repo.db.all("SELECT id FROM tasks WHERE series_id = 'task-solo'");
  assert.equal(rows.length, 1);

  const index = await repo.db.get(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_series_occurrence'"
  );
  assert.ok(index);
});
