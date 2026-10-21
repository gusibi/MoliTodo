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
    catalogId: 'furniture-2',
    kind: 'furniture',
    quantity: 1,
    originType: 'test',
    originId: 'a',
    acquiredAt: '2026-10-21T01:00:00.000Z'
  });
  const itemB = await gardenRepository.addInventoryItem({
    catalogId: 'decor-2',
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

test('placing and removing an item keeps ownership', async (t) => {
  const { db, gardenRepository, placementUseCases, itemA } = await setup(t);

  const placement = await placementUseCases.placeItem({ inventoryId: itemA, slotId: 'slot-1' });
  assert.equal(placement.slotId, 'slot-1');

  const placements = await gardenRepository.listPlacements();
  assert.equal(placements.length, 1);
  assert.equal(placements[0].inventoryId, itemA);

  await placementUseCases.removeItem(itemA);
  assert.equal((await gardenRepository.listPlacements()).length, 0);
  assert.ok(await gardenRepository.findInventoryItemById(itemA), '收起后仍保留所有权');
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 2);
});

test('a slot and an inventory item cannot be placed twice', async (t) => {
  const { placementUseCases, itemA, itemB } = await setup(t);

  await placementUseCases.placeItem({ inventoryId: itemA, slotId: 'slot-1' });
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: itemB, slotId: 'slot-1' }),
    /槽位已被占用/
  );
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: itemA, slotId: 'slot-2' }),
    /已经摆放/
  );
});

test('capacity follows the current expansion level', async (t) => {
  const { db, placementUseCases, itemA } = await setup(t);

  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: itemA, slotId: 'slot-7' }),
    /6 个槽位/
  );

  await db.run('UPDATE garden_state SET level = 2 WHERE id = 1');
  const placement = await placementUseCases.placeItem({ inventoryId: itemA, slotId: 'slot-10' });
  assert.equal(placement.slotId, 'slot-10');

  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: itemA, slotId: 'slot-11' }),
    /10 个槽位|已经摆放/
  );
});

test('invalid slots and missing inventory are rejected', async (t) => {
  const { placementUseCases, itemA } = await setup(t);

  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: itemA, slotId: 'garden-1' }),
    /槽位格式/
  );
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: 9999, slotId: 'slot-1' }),
    /物品不存在/
  );
  await assert.rejects(
    placementUseCases.removeItem(itemA),
    /没有摆放/
  );
});
