const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const PlacementUseCases = require('../src/application/placement-use-cases');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-placement-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();
  const clock = makeClock();
  const gardenRepository = new SqliteGardenRepository(repo.db);
  const placementUseCases = new PlacementUseCases({
    db: repo.db,
    clock,
    gardenRepository
  });

  await gardenRepository.ensureState('2026-10-21T01:00:00.000Z');
  const itemA = await gardenRepository.addInventoryItem({
    catalogId: 'furniture-1',
    kind: 'furniture',
    quantity: 1,
    originType: 'test',
    originId: 'a',
    acquiredAt: '2026-10-21T01:00:00.000Z'
  });
  const itemB = await gardenRepository.addInventoryItem({
    catalogId: 'decor-1',
    kind: 'decor',
    quantity: 1,
    originType: 'test',
    originId: 'b',
    acquiredAt: '2026-10-21T01:00:00.000Z'
  });

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { db: repo.db, gardenRepository, placementUseCases, itemA, itemB };
}

async function addItem(gardenRepository, catalogId, kind, originId) {
  return gardenRepository.addInventoryItem({
    catalogId,
    kind,
    quantity: 1,
    originType: 'test',
    originId,
    acquiredAt: '2026-10-21T01:00:00.000Z'
  });
}

test('placing and removing an item keeps ownership and a free position', async (t) => {
  const { db, gardenRepository, placementUseCases, itemA } = await setup(t);

  const placement = await placementUseCases.placeItem({ inventoryId: itemA });
  assert.match(placement.slotId, /^@-?\d+\.\d{2},-?\d+\.\d{2}$/);
  assert.equal(placement.x, -2);
  assert.equal(placement.z, 2);

  const placements = await gardenRepository.listPlacements();
  assert.equal(placements.length, 1);
  assert.equal(placements[0].inventoryId, itemA);

  await placementUseCases.removeItem(itemA);
  assert.equal((await gardenRepository.listPlacements()).length, 0);
  assert.ok(await gardenRepository.findInventoryItemById(itemA), '收起后仍保留所有权');
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 2);
});

test('an occupied area and an inventory item cannot be placed twice', async (t) => {
  const { placementUseCases, itemA, itemB } = await setup(t);

  await placementUseCases.placeItem({ inventoryId: itemA, position: { x: 0, z: 0 } });
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: itemB, position: { x: 0.2, z: 0.2 } }),
    /占用/
  );
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: itemA, position: { x: 2, z: 2 } }),
    /已经摆放/
  );
});

test('capacity follows the current expansion level and is a count of items', async (t) => {
  const { db, gardenRepository, placementUseCases } = await setup(t);
  for (let index = 0; index < 5; index += 1) {
    await addItem(gardenRepository, 'furniture-6', 'furniture', `stool-${index}`);
  }

  const first = await placementUseCases.autoPlace();
  assert.equal(first.length, 4);
  assert.equal((await gardenRepository.listPlacements()).length, 4);

  await db.run('UPDATE garden_state SET level = 2 WHERE id = 1');
  const second = await placementUseCases.autoPlace();
  assert.equal(second.length, 3);
  assert.equal((await gardenRepository.listPlacements()).length, 7);
});

test('multi-cell items reserve their footprint in the continuous plot', async (t) => {
  const { gardenRepository, placementUseCases, itemA } = await setup(t);
  const table = await addItem(gardenRepository, 'furniture-2', 'furniture', 'table');

  await placementUseCases.placeItem({ inventoryId: table, position: { x: 0, z: 0 } });
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: itemA, position: { x: 0.8, z: 0 } }),
    /占用/
  );
  const placed = await placementUseCases.placeItem({
    inventoryId: itemA,
    position: { x: 2.2, z: 2.2 }
  });
  assert.equal(placed.x, 2.2);
  assert.equal(placed.z, 2.2);
});

test('items can be moved freely and still respect collision and bounds', async (t) => {
  const { placementUseCases, itemA, itemB } = await setup(t);

  await placementUseCases.placeItem({ inventoryId: itemA, position: { x: 0, z: 0 } });
  await placementUseCases.placeItem({ inventoryId: itemB, position: { x: 2, z: 2 } });

  const moved = await placementUseCases.moveItem({
    inventoryId: itemA,
    position: { x: -1.5, z: 1.25 }
  });
  assert.equal(moved.x, -1.5);
  assert.equal(moved.z, 1.25);

  await assert.rejects(
    placementUseCases.moveItem({ inventoryId: itemA, position: { x: 2, z: 2 } }),
    /占用/
  );

  const clamped = await placementUseCases.moveItem({
    inventoryId: itemA,
    position: { x: 99, z: -99 }
  });
  assert.equal(clamped.x, 4);
  assert.equal(clamped.z, -4);
});

test('pets use independent capacity and are placed at their template spots', async (t) => {
  const { db, gardenRepository, placementUseCases } = await setup(t);
  const pet1 = await addItem(gardenRepository, 'pet-1', 'pet', 'pet-1');
  const pet2 = await addItem(gardenRepository, 'pet-2', 'pet', 'pet-2');
  const pet3 = await addItem(gardenRepository, 'pet-3', 'pet', 'pet-3');

  const first = await placementUseCases.placeItem({ inventoryId: pet1 });
  const second = await placementUseCases.placeItem({ inventoryId: pet2 });
  assert.equal(first.regionId, 'pet');
  assert.equal(second.regionId, 'pet');
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: pet3 }),
    /宠物位已经放满/
  );

  await db.run('UPDATE garden_state SET level = 4 WHERE id = 1');
  const third = await placementUseCases.placeItem({ inventoryId: pet3 });
  assert.equal(third.regionId, 'pet');
  assert.equal((await gardenRepository.listPlacements()).filter((entry) => entry.regionId === 'pet').length, 3);
});

test('autoPlace fills the template, prioritizes larger items and keeps pets separate', async (t) => {
  const { gardenRepository, placementUseCases } = await setup(t);
  await addItem(gardenRepository, 'furniture-2', 'furniture', 'table');
  await addItem(gardenRepository, 'pet-1', 'pet', 'pet');

  const placements = await placementUseCases.autoPlace();

  assert.equal(placements.length, 4);
  const table = placements.find((placement) => placement.regionId === 'garden' && placement.slotId.startsWith('@'));
  assert.ok(table, '家具应使用模板位置');
  const pet = placements.find((placement) => placement.regionId === 'pet');
  assert.ok(pet);
  assert.equal((await gardenRepository.listPlacements()).length, 4);
});

test('missing inventory is rejected and removing an unplaced item fails', async (t) => {
  const { placementUseCases, itemA } = await setup(t);

  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: 9999 }),
    /物品不存在/
  );
  await assert.rejects(
    placementUseCases.removeItem(itemA),
    /没有摆放/
  );
});
