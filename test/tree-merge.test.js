const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const GardenUseCases = require('../src/application/garden-use-cases');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-tree-merge-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();
  const clock = makeClock();
  const gardenRepository = new SqliteGardenRepository(repo.db);
  const gardenUseCases = new GardenUseCases({
    db: repo.db,
    clock,
    gardenRepository
  });

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { db: repo.db, gardenRepository, gardenUseCases };
}

async function addTree(gardenRepository, catalogId, originId) {
  return gardenRepository.addInventoryItem({
    catalogId,
    kind: 'tree',
    quantity: 1,
    originType: 'plant_instance',
    originId,
    acquiredAt: '2026-10-21T01:00:00.000Z'
  });
}

test('three same-species trees merge into a canopy form', async (t) => {
  const { gardenRepository, gardenUseCases } = await setup(t);
  for (let index = 0; index < 3; index += 1) {
    await addTree(gardenRepository, 'species-1', `base-${index}`);
  }
  // 异物种不应被消耗
  await addTree(gardenRepository, 'species-2', 'other-0');

  const result = await gardenUseCases.mergeTrees({ speciesId: 'species-1', fromTier: 1 });

  assert.equal(result.merged, true);
  assert.equal(result.consumedIds.length, 3);
  assert.equal(result.form.id, 'species-1-canopy');
  assert.equal(result.form.variant, 'canopy-tree');

  const inventory = await gardenRepository.listInventoryItems();
  const remaining = inventory.filter((item) => item.kind === 'tree');
  assert.equal(remaining.length, 2);
  assert.ok(
    remaining.some((item) => item.catalogId === 'species-2'),
    '异物种不应被消耗'
  );
  const canopy = remaining.find((item) => item.catalogId === 'species-1-canopy');
  assert.ok(canopy, '应有华盖形态入库');
  assert.equal(canopy.originType, 'tree_merge');
  assert.equal(canopy.quantity, 1);
});

test('placed trees lose their placement when consumed by a merge', async (t) => {
  const { gardenRepository, gardenUseCases } = await setup(t);
  const treeId = await addTree(gardenRepository, 'species-3', 'placed-0');
  await gardenRepository.addPlacement({
    inventoryId: treeId,
    regionId: 'orchard',
    slotId: '@1.20,0.60',
    visible: 1,
    placedAt: '2026-10-21T01:00:00.000Z'
  });
  await addTree(gardenRepository, 'species-3', 'base-1');
  await addTree(gardenRepository, 'species-3', 'base-2');

  const result = await gardenUseCases.mergeTrees({ speciesId: 'species-3', fromTier: 1 });

  assert.equal(result.merged, true);
  assert.equal(await gardenRepository.findPlacementByInventoryId(treeId), null);
  const inventory = await gardenRepository.listInventoryItems();
  assert.equal(inventory.filter((item) => item.catalogId === 'species-3').length, 0);
  assert.equal(inventory.filter((item) => item.catalogId === 'species-3-canopy').length, 1);
});

test('canopy trees merge into a legend form and legend is terminal', async (t) => {
  const { gardenRepository, gardenUseCases } = await setup(t);
  for (let index = 0; index < 3; index += 1) {
    await addTree(gardenRepository, 'species-1-canopy', `canopy-${index}`);
  }

  const result = await gardenUseCases.mergeTrees({ speciesId: 'species-1', fromTier: 2 });
  assert.equal(result.form.id, 'species-1-legend');
  assert.equal(result.form.variant, 'legend-tree');

  await assert.rejects(
    gardenUseCases.mergeTrees({ speciesId: 'species-1', fromTier: 3 }),
    /最高形态/
  );
});

test('merging requires at least three source trees', async (t) => {
  const { gardenRepository, gardenUseCases } = await setup(t);
  await addTree(gardenRepository, 'species-1', 'only-0');
  await addTree(gardenRepository, 'species-1', 'only-1');

  await assert.rejects(
    gardenUseCases.mergeTrees({ speciesId: 'species-1', fromTier: 1 }),
    /不足 3 棵/
  );
  const inventory = await gardenRepository.listInventoryItems();
  assert.equal(inventory.length, 2, '失败时不消耗任何树');
});
