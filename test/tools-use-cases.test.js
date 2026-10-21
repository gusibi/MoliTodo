const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteActivityRepository = require('../src/infrastructure/persistence/sqlite-activity-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const ToolsUseCases = require('../src/application/tools-use-cases');

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

function makeClock(offsetMinutes = 480) {
  const base = new Date('2026-10-21T01:00:00.000Z');
  return {
    now: () => new Date(base),
    localDate(instant) {
      const shifted = new Date(new Date(instant).getTime() + offsetMinutes * 60 * 1000);
      return shifted.toISOString().slice(0, 10);
    },
    tzOffset() {
      return offsetMinutes;
    }
  };
}

function stageFor(score) {
  if (score >= 15) return 'mature';
  if (score >= 10) return 'sapling';
  if (score >= 5) return 'sprout';
  return 'seed';
}

async function setup(t, { withPlant = true, growthScore = 0, autoPlant = 1 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-tools-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();

  const activityRepository = new SqliteActivityRepository(repo.db);
  const gardenRepository = new SqliteGardenRepository(repo.db);
  const clock = makeClock();
  const useCases = new ToolsUseCases({
    db: repo.db,
    clock,
    activityRepository,
    gardenRepository
  });

  await gardenRepository.ensureState('2026-10-21T01:00:00.000Z');
  if (autoPlant !== 1) {
    await repo.db.run('UPDATE garden_state SET auto_plant = ? WHERE id = 1', [autoPlant]);
  }

  let plantId = null;
  if (withPlant) {
    plantId = await gardenRepository.insertPlant({
      speciesId: 'species-1',
      growthScore,
      stage: stageFor(growthScore),
      plantedAt: '2026-10-21T01:00:00.000Z',
      localDatePlanted: '2026-10-21'
    });
    await gardenRepository.setActivePlantId(plantId, '2026-10-21T01:00:00.000Z');
  }

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { db: repo.db, activityRepository, gardenRepository, useCases, plantId };
}

function occurredAt(localDate) {
  return `${localDate}T01:00:00.000Z`;
}

test('recordActivity writes the event, daily summary and plant growth in one transaction', async (t) => {
  const { db, activityRepository, useCases, plantId } = await setup(t);

  const result = await useCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:1:confirmed',
    sourceType: 'reminder',
    sourceId: '1',
    occurredAt: occurredAt('2026-10-21')
  });

  assert.equal(result.recorded, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.effects.growthPoints, 2);
  assert.equal(result.effects.appliedGrowth, 2);
  assert.equal(result.event.localDate, '2026-10-21');
  assert.equal(result.event.tzOffset, 480);
  assert.equal(result.event.growthPoints, 2);
  assert.equal(result.plant.id, plantId);
  assert.equal(result.plant.growthScore, 2);
  assert.equal(result.plant.stage, 'seed');

  const summary = await activityRepository.getDailySummary('2026-10-21');
  assert.deepEqual(
    {
      focusCount: summary.focusCount,
      waterCount: summary.waterCount,
      sunCount: summary.sunCount,
      totalGrowth: summary.totalGrowth
    },
    { focusCount: 0, waterCount: 1, sunCount: 0, totalGrowth: 2 }
  );
  assert.deepEqual(await activityRepository.listGrowthDays(), []);

  const persisted = await db.get('SELECT * FROM plant_instances WHERE id = ?', [plantId]);
  assert.equal(persisted.growth_score, 2);
});

test('recordActivity is idempotent for a repeated dedupe key', async (t) => {
  const { db, activityRepository, useCases, plantId } = await setup(t);

  const first = await useCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:1:confirmed',
    occurredAt: occurredAt('2026-10-21')
  });
  const second = await useCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:1:confirmed',
    occurredAt: occurredAt('2026-10-21')
  });

  assert.equal(first.recorded, true);
  assert.equal(second.recorded, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.event.id, first.event.id);

  const eventCount = await db.get('SELECT COUNT(*) AS count FROM activity_events');
  assert.equal(eventCount.count, 1);

  const summary = await activityRepository.getDailySummary('2026-10-21');
  assert.equal(summary.waterCount, 1);
  assert.equal(summary.totalGrowth, 2);

  const plant = await db.get('SELECT growth_score FROM plant_instances WHERE id = ?', [plantId]);
  assert.equal(plant.growth_score, 2);
});

test('the fourth water confirmation is recorded with 0 growth', async (t) => {
  const { db, activityRepository, useCases, plantId } = await setup(t);

  const results = [];
  for (let index = 0; index < 4; index += 1) {
    results.push(await useCases.recordActivity({
      type: 'water',
      dedupeKey: `health:${index}:confirmed`,
      occurredAt: occurredAt('2026-10-21')
    }));
  }

  assert.deepEqual(
    results.map((result) => result.effects.growthPoints),
    [2, 2, 2, 0]
  );
  assert.equal(results[3].event.growthPoints, 0);

  const summary = await activityRepository.getDailySummary('2026-10-21');
  assert.equal(summary.waterCount, 4);
  assert.equal(summary.totalGrowth, 6);

  const plant = await db.get('SELECT growth_score FROM plant_instances WHERE id = ?', [plantId]);
  assert.equal(plant.growth_score, 6);

  const growthDay = await db.get('SELECT * FROM growth_days WHERE local_date = ?', ['2026-10-21']);
  assert.equal(growthDay.growth_score, 6);
});

test('one health confirmation is not a growth day, the second one is, and one focus is enough', async (t) => {
  const { db, activityRepository, useCases } = await setup(t);

  await useCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:1:confirmed',
    occurredAt: occurredAt('2026-10-21')
  });
  assert.deepEqual(await activityRepository.listGrowthDays(), []);

  await useCases.recordActivity({
    type: 'sun',
    dedupeKey: 'health:2:confirmed',
    occurredAt: occurredAt('2026-10-21')
  });
  assert.deepEqual(await activityRepository.listGrowthDays(), ['2026-10-21']);

  await useCases.recordActivity({
    type: 'focus',
    dedupeKey: 'focus:1:completed',
    occurredAt: occurredAt('2026-10-22')
  });
  assert.deepEqual(await activityRepository.listGrowthDays(), ['2026-10-21', '2026-10-22']);

  const focusedDay = await db.get('SELECT * FROM growth_days WHERE local_date = ?', ['2026-10-22']);
  assert.equal(focusedDay.growth_score, 1);
});

test('maturity creates a tree, yields a seed and auto-plants when enabled', async (t) => {
  const { db, useCases, plantId } = await setup(t, { growthScore: 14 });

  const result = await useCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:1:confirmed',
    occurredAt: occurredAt('2026-10-21')
  });

  assert.equal(result.effects.matured, true);
  assert.equal(result.effects.seedYield.quantity, 1);
  assert.equal(result.plant.id, plantId);
  assert.equal(result.plant.growthScore, 15);
  assert.equal(result.plant.status, 'matured');
  assert.ok(result.plant.maturedAt);

  const inventory = await db.all('SELECT * FROM inventory_items');
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].id, result.inventoryItemId);
  assert.equal(inventory[0].catalog_id, 'species-1');
  assert.equal(inventory[0].kind, 'tree');
  assert.equal(inventory[0].origin_type, 'plant_instance');
  assert.equal(inventory[0].origin_id, String(plantId));

  const seeds = await db.get('SELECT quantity FROM seed_inventory WHERE species_id = ?', ['species-1']);
  assert.equal(seeds.quantity, 0, '产出的种子应被自动种植消耗');

  const growing = await db.all("SELECT * FROM plant_instances WHERE status = 'growing'");
  assert.equal(growing.length, 1);
  assert.equal(growing[0].id, result.autoPlantedPlantId);
  assert.notEqual(growing[0].id, plantId);
  assert.equal(growing[0].growth_score, 0);
  assert.equal(growing[0].stage, 'seed');

  const state = await db.get('SELECT active_plant_id FROM garden_state WHERE id = 1');
  assert.equal(state.active_plant_id, result.autoPlantedPlantId);
});

test('maturity keeps the seed unplanted when auto-plant is disabled', async (t) => {
  const { db, useCases, plantId } = await setup(t, { growthScore: 14, autoPlant: 0 });

  const result = await useCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:1:confirmed',
    occurredAt: occurredAt('2026-10-21')
  });

  assert.equal(result.effects.matured, true);
  assert.equal(result.autoPlantedPlantId, null);

  const seeds = await db.get('SELECT quantity FROM seed_inventory WHERE species_id = ?', ['species-1']);
  assert.equal(seeds.quantity, 1);

  const growing = await db.all("SELECT * FROM plant_instances WHERE status = 'growing'");
  assert.equal(growing.length, 0);

  const state = await db.get('SELECT active_plant_id FROM garden_state WHERE id = 1');
  assert.equal(state.active_plant_id, null);

  const matured = await db.get('SELECT * FROM plant_instances WHERE id = ?', [plantId]);
  assert.equal(matured.growth_score, 15);
  assert.equal(matured.status, 'matured');
});

test('30 health confirmations unlock hydration-start only once', async (t) => {
  const { db, activityRepository, useCases } = await setup(t, { withPlant: false });
  const dates = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  let lastKey = null;

  for (const localDate of dates) {
    const types = ['water', 'water', 'water', 'sun', 'sun', 'sun'];
    for (let index = 0; index < types.length; index += 1) {
      lastKey = `health:${localDate}:${index}`;
      await useCases.recordActivity({
        type: types[index],
        dedupeKey: lastKey,
        occurredAt: occurredAt(localDate)
      });
    }
  }

  const milestones = await db.all('SELECT * FROM milestone_unlocks');
  assert.equal(milestones.length, 1);
  assert.equal(milestones[0].definition_id, 'hydration-start');
  assert.equal(milestones[0].claim_status, 'pending');
  assert.equal(milestones[0].definition_version, '1');

  const totals = await activityRepository.getTotals();
  assert.deepEqual(totals, { focusCount: 0, healthCount: 30 });
  assert.deepEqual(await activityRepository.listGrowthDays(), dates);

  const duplicate = await useCases.recordActivity({
    type: 'sun',
    dedupeKey: lastKey,
    occurredAt: occurredAt('2026-10-25')
  });
  assert.equal(duplicate.recorded, false);

  await useCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:2026-10-26:0',
    occurredAt: occurredAt('2026-10-26')
  });

  const after = await db.get('SELECT COUNT(*) AS count FROM milestone_unlocks');
  assert.equal(after.count, 1);
});

test('recordActivity rolls back every write when a later step fails, then retries cleanly', async (t) => {
  const { db, gardenRepository, useCases, plantId } = await setup(t, { growthScore: 14 });
  const originalAddInventoryItem = gardenRepository.addInventoryItem;

  gardenRepository.addInventoryItem = async () => {
    throw new Error('simulated write failure');
  };

  await assert.rejects(
    useCases.recordActivity({
      type: 'water',
      dedupeKey: 'health:rollback:confirmed',
      occurredAt: occurredAt('2026-10-21')
    }),
    /simulated write failure/
  );

  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_daily_summary')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM growth_days')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM seed_inventory')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 0);

  const plant = await db.get('SELECT * FROM plant_instances WHERE id = ?', [plantId]);
  assert.equal(plant.growth_score, 14);
  assert.equal(plant.status, 'growing');
  assert.equal(plant.matured_at, null);

  gardenRepository.addInventoryItem = originalAddInventoryItem;

  const retried = await useCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:rollback:confirmed',
    occurredAt: occurredAt('2026-10-21')
  });

  assert.equal(retried.recorded, true);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 1);
});
