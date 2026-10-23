const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteActivityRepository = require('../src/infrastructure/persistence/sqlite-activity-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const SqliteReminderRepository = require('../src/infrastructure/persistence/sqlite-reminder-repository');
const SqliteFocusRepository = require('../src/infrastructure/persistence/sqlite-focus-repository');
const ToolsUseCases = require('../src/application/tools-use-cases');
const GardenUseCases = require('../src/application/garden-use-cases');
const ToolsDataPort = require('../src/application/tools-data-port');
const { TOOL_TABLES } = require('../src/application/tools-data-port');

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

function makeClock() {
  return {
    now: () => new Date('2026-10-21T01:00:00.000Z'),
    localDate(instant) {
      return new Date(new Date(instant).getTime() + 480 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    },
    tzOffset() {
      return 480;
    }
  };
}

async function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-data-port-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();
  const clock = makeClock();
  const activityRepository = new SqliteActivityRepository(repo.db);
  const gardenRepository = new SqliteGardenRepository(repo.db);
  const reminderRepository = new SqliteReminderRepository(repo.db);
  const focusRepository = new SqliteFocusRepository(repo.db);
  const toolsUseCases = new ToolsUseCases({
    db: repo.db,
    clock,
    activityRepository,
    gardenRepository
  });
  const gardenUseCases = new GardenUseCases({ db: repo.db, clock, gardenRepository });
  const dataPort = new ToolsDataPort({ db: repo.db, clock, gardenUseCases });

  await gardenUseCases.initializeGarden();

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return {
    db: repo.db,
    clock,
    activityRepository,
    gardenRepository,
    reminderRepository,
    focusRepository,
    toolsUseCases,
    gardenUseCases,
    dataPort
  };
}

test('export, clear and import round-trip all fifteen tool tables', async (t) => {
  const {
    db,
    reminderRepository,
    focusRepository,
    toolsUseCases,
    gardenRepository,
    dataPort
  } = await setup(t);

  await toolsUseCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:data-port',
    occurredAt: '2026-10-21T01:00:00.000Z'
  });
  const rule = await reminderRepository.insertRule({
    type: 'water',
    intervalMinutes: 60,
    anchorMode: 'created',
    anchorMinutes: 520,
    weekdays: [],
    windowStart: '09:00',
    windowEnd: '18:00',
    enabled: 1,
    nextRunAt: '2026-10-21T01:40:00.000Z',
    createdAt: '2026-10-21T00:40:00.000Z',
    updatedAt: '2026-10-21T00:40:00.000Z'
  });
  const session = await focusRepository.createSession({
    plannedSeconds: 900,
    startedAt: '2026-10-21T01:00:00.000Z',
    createdAt: '2026-10-21T01:00:00.000Z'
  });
  const inventory = await gardenRepository.listInventoryItems();
  const furniture = inventory.find((item) => item.catalogId === 'furniture-1');
  await db.run(
    `INSERT INTO garden_placements (inventory_id, region_id, slot_id, placed_at)
     VALUES (?, 'garden', 'slot-1', '2026-10-21T01:00:00.000Z')`,
    [furniture.id]
  );

  await db.run(
    `INSERT INTO tasks (id, content, status, completed, created_at, updated_at)
     VALUES ('task-keep', '保留任务', 'todo', 0, '2026-10-21T01:00:00.000Z', '2026-10-21T01:00:00.000Z')`
  );

  const snapshot = await dataPort.exportToolsData();
  assert.equal(snapshot.schemaVersion, 8);
  assert.deepEqual(Object.keys(snapshot.tables).sort(), [...TOOL_TABLES].sort());
  assert.equal(snapshot.tables.activity_events.length, 1);
  assert.equal(snapshot.tables.reminder_rules.length, 1);
  assert.equal(snapshot.tables.focus_sessions.length, 1);
  assert.equal(snapshot.tables.garden_placements.length, 1);

  await dataPort.clearToolsData();

  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM reminder_rules')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM focus_sessions')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM garden_placements')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM garden_state')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM species_unlocks')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM plant_instances')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 2);
  assert.equal((await db.get("SELECT COUNT(*) AS count FROM tasks WHERE id = 'task-keep'")).count, 1);

  await dataPort.importToolsData(snapshot);

  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM reminder_rules')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM focus_sessions')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM garden_placements')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM tasks')).count, 1);

  const restoredRule = await reminderRepository.findRuleById(rule.id);
  assert.equal(restoredRule.type, 'water');
  const restoredSession = await focusRepository.findSessionById(session.id);
  assert.equal(restoredSession.plannedSeconds, 900);
});

test('importing an old backup without tools initializes an empty garden', async (t) => {
  const { db, gardenUseCases, dataPort } = await setup(t);

  await gardenUseCases.initializeGarden();
  await dataPort.importToolsData(null);

  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM reminder_rules')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM species_unlocks')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM plant_instances')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 2);
});
