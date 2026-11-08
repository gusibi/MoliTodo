const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const PlacementUseCases = require('../src/application/placement-use-cases');
const { ORCHARD_CAPACITY, getItemSize } = require('../src/domain/services/garden-layout');
const { ITEM_CATALOG } = require('../src/domain/services/item-catalog');
const {
  PLANT_BED,
  TEMPLATE_POSITIONS,
  positionForPlacement,
  positionToken,
  rectsOverlap
} = require('../src/domain/services/garden-template');

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

test('trees go to the orchard region and bypass garden capacity', async (t) => {
  const { gardenRepository, placementUseCases } = await setup(t);
  for (let index = 0; index < 4; index += 1) {
    const itemId = await addItem(gardenRepository, 'furniture-6', 'furniture', `stool-${index}`);
    await placementUseCases.placeItem({ inventoryId: itemId });
  }
  assert.equal((await gardenRepository.listPlacements()).length, 4);

  for (let index = 0; index < 6; index += 1) {
    const treeId = await addItem(gardenRepository, 'species-1', 'tree', `tree-${index}`);
    const placement = await placementUseCases.placeItem({ inventoryId: treeId });
    assert.equal(placement.regionId, 'orchard');
  }

  const placements = await gardenRepository.listPlacements();
  assert.equal(placements.filter((entry) => entry.regionId === 'orchard').length, 6);
  assert.equal(placements.filter((entry) => entry.regionId === 'garden').length, 4);
});

test('orchard collision stays global with the yard', async (t) => {
  const { gardenRepository, placementUseCases, itemA } = await setup(t);
  const treeId = await addItem(gardenRepository, 'species-1', 'tree', 'tree-x');

  await placementUseCases.placeItem({ inventoryId: itemA, position: { x: 0, z: 0 } });
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: treeId, position: { x: 0.2, z: 0 } }),
    /占用/
  );
});

test('autoPlace still places trees when the yard is at capacity', async (t) => {
  const { gardenRepository, placementUseCases } = await setup(t);
  for (let index = 0; index < 4; index += 1) {
    const item = await addItem(gardenRepository, 'furniture-6', 'furniture', `stool-${index}`);
    await placementUseCases.placeItem({ inventoryId: item });
  }

  const treeId = await addItem(gardenRepository, 'species-2', 'tree', 'tree-auto');
  const placed = await placementUseCases.autoPlace({ inventoryIds: [treeId] });
  assert.equal(placed.length, 1);
  assert.equal(placed[0].regionId, 'orchard');
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

async function addTrees(gardenRepository, count, prefix = 'tree') {
  const forms = ['', '-canopy', '-legend'];
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    const catalogId = `species-${(index % 6) + 1}${forms[index % 3]}`;
    ids.push(await addItem(gardenRepository, catalogId, 'tree', `${prefix}-${index}`));
  }
  return ids;
}

test('the orchard is capped so extra trees stay owned and never crowd out the yard', async (t) => {
  const { gardenRepository, placementUseCases, itemA } = await setup(t);
  const treeIds = await addTrees(gardenRepository, ORCHARD_CAPACITY + 24);

  const placed = await placementUseCases.autoPlace({ inventoryIds: treeIds });

  assert.equal(placed.length, ORCHARD_CAPACITY);
  const owned = await gardenRepository.listInventoryItems();
  assert.equal(owned.filter((item) => item.kind === 'tree').length, ORCHARD_CAPACITY + 24, '超出的树仍保留所有权');

  const chair = await placementUseCases.placeItem({ inventoryId: itemA });
  assert.equal(chair.regionId, 'garden');
});

test('every catalog item still fits once the orchard is full because trees step aside', async (t) => {
  const { db, gardenRepository, placementUseCases } = await setup(t);
  await db.run('UPDATE garden_state SET level = 5 WHERE id = 1');
  const treeIds = await addTrees(gardenRepository, ORCHARD_CAPACITY);
  await placementUseCases.autoPlace({ inventoryIds: treeIds });

  const collectibles = ITEM_CATALOG.filter((entry) => entry.id !== 'pet-4');
  for (const item of collectibles) {
    const inventoryId = await addItem(gardenRepository, item.id, item.kind, `catalog-${item.id}`);
    await placementUseCases.placeItem({ inventoryId });
  }

  const placements = await gardenRepository.listPlacements();
  assert.equal(placements.filter((entry) => entry.regionId !== 'orchard').length, collectibles.length);
  const inventory = await gardenRepository.listInventoryItems();
  assert.equal(inventory.filter((item) => item.kind === 'tree').length, ORCHARD_CAPACITY, '树仍保留所有权');
});

test('auto placed collectibles keep their template spot and trees there step aside', async (t) => {
  const { gardenRepository, placementUseCases } = await setup(t);
  const [nearTree, farTree] = await addTrees(gardenRepository, 2);
  const template = TEMPLATE_POSITIONS['furniture-2'];
  await placementUseCases.placeItem({ inventoryId: nearTree, position: template });
  await placementUseCases.placeItem({ inventoryId: farTree, position: { x: 4, z: -4 } });

  // 指定位置不会挤走树，仍按占用拒绝
  const lamp = await addItem(gardenRepository, 'furniture-5', 'furniture', 'lamp');
  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: lamp, position: template }),
    /占用/
  );
  assert.ok(await gardenRepository.findPlacementByInventoryId(nearTree));

  const table = await addItem(gardenRepository, 'furniture-2', 'furniture', 'table');
  const placed = await placementUseCases.placeItem({ inventoryId: table });

  assert.equal(placed.x, template.x);
  assert.equal(placed.z, template.z);
  const moved = await gardenRepository.findPlacementByInventoryId(nearTree);
  assert.equal(rectsOverlap(moved, 1, placed, 2), false, '压到的树挪到空位');
  const untouched = await gardenRepository.findPlacementByInventoryId(farTree);
  assert.equal(untouched.x, 4, '没压到的树不动');
  assert.equal(untouched.z, -4);
});

test('covered trees return to the woods only when the island has no free spot', async (t) => {
  const { db, gardenRepository, placementUseCases } = await setup(t);
  await db.run('UPDATE garden_state SET level = 5 WHERE id = 1');
  const treeIds = await addTrees(gardenRepository, ORCHARD_CAPACITY);
  await placementUseCases.autoPlace({ inventoryIds: treeIds });
  for (let index = 0; index < 31; index += 1) {
    const stool = await addItem(gardenRepository, 'furniture-6', 'furniture', `stool-${index}`);
    await placementUseCases.placeItem({ inventoryId: stool });
  }
  const orchardBefore = (await gardenRepository.listPlacements())
    .filter((entry) => entry.regionId === 'orchard').length;
  const table = await addItem(gardenRepository, 'furniture-2', 'furniture', 'table');

  await placementUseCases.placeItem({ inventoryId: table });

  const placements = await gardenRepository.listPlacements();
  assert.equal(placements.filter((entry) => entry.regionId === 'garden').length, 32);
  assert.ok(placements.filter((entry) => entry.regionId === 'orchard').length < orchardBefore);
  const inventory = await gardenRepository.listInventoryItems();
  assert.equal(inventory.filter((item) => item.kind === 'tree').length, ORCHARD_CAPACITY, '收起的树仍保留所有权');
  const byId = new Map(inventory.map((item) => [item.id, item]));
  for (const [index, a] of placements.entries()) {
    for (const b of placements.slice(index + 1)) {
      const overlapped = rectsOverlap(a, getItemSize(byId.get(a.inventoryId)), b, getItemSize(byId.get(b.inventoryId)), 0);
      assert.equal(overlapped, false, `${a.slotId} 与 ${b.slotId} 重叠`);
    }
  }
});

test('collectibles never push each other off the island', async (t) => {
  const { gardenRepository, placementUseCases, itemA } = await setup(t);
  const template = TEMPLATE_POSITIONS['furniture-2'];
  await placementUseCases.placeItem({ inventoryId: itemA, position: template });

  const table = await addItem(gardenRepository, 'furniture-2', 'furniture', 'table');
  const placed = await placementUseCases.placeItem({ inventoryId: table });

  assert.notDeepEqual({ x: placed.x, z: placed.z }, template);
  assert.ok(await gardenRepository.findPlacementByInventoryId(itemA), '已摆放的收藏不会被挤走');
});

test('placing a tree into a full orchard is rejected until a spot frees up', async (t) => {
  const { gardenRepository, placementUseCases } = await setup(t);
  const treeIds = await addTrees(gardenRepository, ORCHARD_CAPACITY + 1);
  const [first] = treeIds;
  const extra = treeIds[treeIds.length - 1];
  await placementUseCases.autoPlace({ inventoryIds: treeIds.slice(0, ORCHARD_CAPACITY) });

  await assert.rejects(placementUseCases.placeItem({ inventoryId: extra }), /林间已经放满/);

  await placementUseCases.removeItem(first);
  const placed = await placementUseCases.placeItem({ inventoryId: extra });
  assert.equal(placed.regionId, 'orchard');
});

test('existing orchard placements above the cap stay put and only block new trees', async (t) => {
  const { gardenRepository, placementUseCases, itemA } = await setup(t);
  const treeIds = await addTrees(gardenRepository, ORCHARD_CAPACITY + 3);
  const legacy = treeIds.slice(0, ORCHARD_CAPACITY + 2);
  for (const [index, inventoryId] of legacy.entries()) {
    await gardenRepository.addPlacement({
      inventoryId,
      regionId: 'orchard',
      slotId: positionToken(-4 + (index % 6) * 1.25, -4 + Math.floor(index / 6) * 1.25),
      visible: 1,
      placedAt: '2026-10-21T01:00:00.000Z'
    });
  }

  await assert.rejects(
    placementUseCases.placeItem({ inventoryId: treeIds[treeIds.length - 1] }),
    /林间已经放满/
  );
  const placedTrees = await placementUseCases.autoPlace({ inventoryIds: [treeIds[treeIds.length - 1]] });
  assert.equal(placedTrees.length, 0);
  assert.equal((await gardenRepository.listPlacements()).length, legacy.length, '已有摆放不被改动');

  await placementUseCases.moveItem({ inventoryId: legacy[0], position: { x: 4, z: 4 } });
  await placementUseCases.placeItem({ inventoryId: itemA });
});

test('auto placement keeps clear of the plant bed while dragging stays free', async (t) => {
  const { gardenRepository, placementUseCases, itemA } = await setup(t);
  const treeIds = await addTrees(gardenRepository, ORCHARD_CAPACITY);

  const placed = await placementUseCases.autoPlace({ inventoryIds: treeIds });
  for (const placement of placed) {
    assert.equal(
      rectsOverlap(positionForPlacement(placement), 1, PLANT_BED, PLANT_BED.size),
      false,
      `${placement.slotId} 不应压在苗床上`
    );
  }

  await placementUseCases.placeItem({ inventoryId: itemA, position: { x: 4, z: 4 } });
  const dragged = await placementUseCases.moveItem({
    inventoryId: itemA,
    position: { x: PLANT_BED.x, z: PLANT_BED.z }
  });
  assert.equal(dragged.z, PLANT_BED.z);
});

test('template positions never sit on the plant bed', () => {
  for (const [catalogId, position] of Object.entries(TEMPLATE_POSITIONS)) {
    const size = ITEM_CATALOG.find((item) => item.id === catalogId)?.size || 1;
    assert.equal(
      rectsOverlap(position, size, PLANT_BED, PLANT_BED.size),
      false,
      `${catalogId} 的模板位置压在苗床上`
    );
  }
});
