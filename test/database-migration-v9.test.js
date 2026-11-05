const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-migration-v9-test-'));
  const dbPath = path.join(dir, 'tasks.db');
  const repo = new SqliteTaskRepository(dbPath);
  await repo.initialize();
  const gardenRepository = new SqliteGardenRepository(repo.db);

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { dir, dbPath, repo, gardenRepository };
}

async function downgradeToVersion8(db) {
  await db.run('DELETE FROM schema_version');
  await db.run(
    "INSERT INTO schema_version (version, description) VALUES (8, 'v8 fixture')"
  );
}

test('v9 moves tree placements to the orchard region and keeps furniture in the yard', async (t) => {
  const { dbPath, repo, gardenRepository } = await setup(t);

  const treeId = await gardenRepository.addInventoryItem({
    catalogId: 'species-1',
    kind: 'tree',
    quantity: 1,
    originType: 'plant_instance',
    originId: 'plant-1',
    acquiredAt: '2026-10-21T01:00:00.000Z'
  });
  const chairId = await gardenRepository.addInventoryItem({
    catalogId: 'furniture-1',
    kind: 'furniture',
    quantity: 1,
    originType: 'test',
    originId: 'chair',
    acquiredAt: '2026-10-21T01:00:00.000Z'
  });
  const treePlacement = await gardenRepository.addPlacement({
    inventoryId: treeId,
    regionId: 'garden',
    slotId: '@1.50,-0.80',
    visible: 1,
    placedAt: '2026-10-21T01:00:00.000Z'
  });
  const chairPlacement = await gardenRepository.addPlacement({
    inventoryId: chairId,
    regionId: 'garden',
    slotId: '@-2.00,2.00',
    visible: 1,
    placedAt: '2026-10-21T01:00:00.000Z'
  });

  await downgradeToVersion8(repo.db);
  const migration = new DatabaseMigration(repo.db, dbPath);
  await migration.checkAndMigrate();

  const version = await repo.db.get(
    'SELECT version FROM schema_version ORDER BY id DESC LIMIT 1'
  );
  assert.equal(version.version, 10);

  const movedTree = await gardenRepository.findPlacementByInventoryId(treeId);
  assert.equal(movedTree.regionId, 'orchard');
  assert.equal(movedTree.slotId, treePlacement.slotId);

  const keptChair = await gardenRepository.findPlacementByInventoryId(chairId);
  assert.equal(keptChair.regionId, 'garden');
  assert.equal(keptChair.slotId, chairPlacement.slotId);
});

test('v9 migration is idempotent when no tree placements remain in the yard', async (t) => {
  const { dbPath, repo, gardenRepository } = await setup(t);

  const treeId = await gardenRepository.addInventoryItem({
    catalogId: 'species-2',
    kind: 'tree',
    quantity: 1,
    originType: 'plant_instance',
    originId: 'plant-2',
    acquiredAt: '2026-10-21T01:00:00.000Z'
  });
  await gardenRepository.addPlacement({
    inventoryId: treeId,
    regionId: 'orchard',
    slotId: '@1.20,0.60',
    visible: 1,
    placedAt: '2026-10-21T01:00:00.000Z'
  });

  await downgradeToVersion8(repo.db);
  const migration = new DatabaseMigration(repo.db, dbPath);
  await migration.checkAndMigrate();

  const version = await repo.db.get(
    'SELECT version FROM schema_version ORDER BY id DESC LIMIT 1'
  );
  assert.equal(version.version, 10);
  const placement = await gardenRepository.findPlacementByInventoryId(treeId);
  assert.equal(placement.regionId, 'orchard');
});

test('fresh databases reach version 10 through the normal initialize path', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-migration-v9-fresh-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();
  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const version = await repo.db.get(
    'SELECT version FROM schema_version ORDER BY id DESC LIMIT 1'
  );
  assert.equal(version.version, 10);
});
