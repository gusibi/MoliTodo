const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteActivityRepository = require('../src/infrastructure/persistence/sqlite-activity-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const GardenUseCases = require('../src/application/garden-use-cases');
const ToolsReadModel = require('../src/application/tools-read-model');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-garden-init-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();
  const clock = makeClock();
  const activityRepository = new SqliteActivityRepository(repo.db);
  const gardenRepository = new SqliteGardenRepository(repo.db);
  const gardenUseCases = new GardenUseCases({ db: repo.db, clock, gardenRepository });
  const readModel = new ToolsReadModel({ clock, activityRepository, gardenRepository });

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { db: repo.db, clock, gardenRepository, gardenUseCases, readModel };
}

test('initializeGarden creates the initial species, plant, items and level 1 state', async (t) => {
  const { db, gardenUseCases, readModel } = await setup(t);

  const result = await gardenUseCases.initializeGarden();

  assert.equal(result.initialized, true);
  assert.equal(result.plant.speciesId, 'species-1');
  assert.equal(result.plant.growthScore, 0);
  assert.equal(result.plant.stage, 'seed');
  assert.equal(result.plant.status, 'growing');
  assert.equal(result.state.activePlantId, result.plant.id);
  assert.equal(result.state.level, 1);
  assert.equal(result.state.autoPlant, 1);

  const species = await db.all('SELECT * FROM species_unlocks');
  assert.equal(species.length, 1);
  assert.equal(species[0].species_id, 'species-1');
  assert.equal(species[0].source, 'initial');

  const seeds = await db.get(
    'SELECT quantity FROM seed_inventory WHERE species_id = ?',
    ['species-1']
  );
  assert.equal(seeds.quantity, 0, '初始种子应已自动种下');

  const plants = await db.all('SELECT * FROM plant_instances');
  assert.equal(plants.length, 1);
  assert.equal(plants[0].local_date_planted, '2026-10-21');

  const inventory = await db.all('SELECT * FROM inventory_items ORDER BY catalog_id');
  assert.deepEqual(
    inventory.map((item) => [item.catalog_id, item.kind, item.origin_type]),
    [
      ['decor-1', 'decor', 'initial'],
      ['furniture-1', 'furniture', 'initial']
    ]
  );

  const expansions = await db.all('SELECT * FROM garden_expansions');
  assert.deepEqual(
    expansions.map((row) => [row.level, row.condition_type]),
    [[1, 'initial']]
  );

  const snapshot = await readModel.getShellSnapshot();
  assert.equal(snapshot.plant.stage, 'seed');
  assert.equal(snapshot.garden.level, 1);
  assert.equal(snapshot.garden.seedCount, 0);
});

test('initializeGarden is idempotent', async (t) => {
  const { db, gardenUseCases } = await setup(t);

  await gardenUseCases.initializeGarden();
  const second = await gardenUseCases.initializeGarden();

  assert.equal(second.initialized, false);
  assert.equal(second.plant.speciesId, 'species-1');
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM plant_instances')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM species_unlocks')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 2);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM garden_expansions')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM seed_inventory')).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM garden_state')).count, 1);
});

test('initializeGarden completes setup when garden_state already exists', async (t) => {
  const { gardenRepository, gardenUseCases } = await setup(t);
  await gardenRepository.ensureState('2026-10-20T01:00:00.000Z');

  const result = await gardenUseCases.initializeGarden();

  assert.equal(result.initialized, true);
  assert.equal(result.plant.speciesId, 'species-1');
  assert.equal(result.state.activePlantId, result.plant.id);
});

test('initializeGarden repairs a missing plant when the initial species is already unlocked', async (t) => {
  const { db, gardenRepository, gardenUseCases } = await setup(t);
  await gardenRepository.ensureState('2026-10-20T01:00:00.000Z');
  await gardenRepository.unlockSpecies({
    speciesId: 'species-1',
    unlockedAt: '2026-10-20T01:00:00.000Z',
    source: 'initial'
  });

  const result = await gardenUseCases.initializeGarden();

  assert.equal(result.initialized, false);
  assert.equal(result.repaired, true);
  assert.equal(result.plant.speciesId, 'species-1');
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM plant_instances')).count, 1);
});

test('plantSeed consumes a seed after the previous plant has matured', async (t) => {
  const { db, gardenRepository, gardenUseCases } = await setup(t);
  await gardenUseCases.initializeGarden();
  const active = await gardenRepository.getActivePlant();
  await gardenRepository.updatePlant({
    id: active.id,
    growthScore: 15,
    stage: 'mature',
    status: 'matured',
    maturedAt: '2026-10-21T02:00:00.000Z'
  });
  await gardenRepository.addSeeds('species-2', 1, '2026-10-21T02:00:00.000Z');

  const result = await gardenUseCases.plantSeed({ speciesId: 'species-2' });

  assert.equal(result.plant.speciesId, 'species-2');
  assert.equal(result.plant.status, 'growing');
  assert.equal(result.state.activePlantId, result.plant.id);
  const seeds = await db.get(
    'SELECT quantity FROM seed_inventory WHERE species_id = ?',
    ['species-2']
  );
  assert.equal(seeds.quantity, 0);
});

test('basic seed protection grants one seed only when no plant and no seeds remain', async (t) => {
  const { db, gardenRepository, gardenUseCases } = await setup(t);
  await gardenUseCases.initializeGarden();
  const active = await gardenRepository.getActivePlant();
  await gardenRepository.updatePlant({
    id: active.id,
    growthScore: 15,
    stage: 'mature',
    status: 'matured',
    maturedAt: '2026-10-21T02:00:00.000Z'
  });

  const granted = await gardenUseCases.claimBasicSeed();

  assert.deepEqual(granted.seeds.map((seed) => [seed.speciesId, seed.quantity]), [
    ['species-1', 1]
  ]);
  await assert.rejects(gardenUseCases.claimBasicSeed(), /还有可用种子/);

  const planted = await gardenUseCases.plantSeed({ speciesId: 'species-1' });
  assert.equal(planted.plant.speciesId, 'species-1');
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM plant_instances')).count, 2);
});

test('initializeGarden reuses an existing growing plant instead of creating a second one', async (t) => {
  const { db, gardenRepository, gardenUseCases } = await setup(t);
  await gardenRepository.ensureState('2026-10-20T01:00:00.000Z');
  const existingId = await gardenRepository.insertPlant({
    speciesId: 'species-1',
    plantedAt: '2026-10-20T01:00:00.000Z',
    localDatePlanted: '2026-10-20'
  });
  await gardenRepository.setActivePlantId(existingId, '2026-10-20T01:00:00.000Z');

  const result = await gardenUseCases.initializeGarden();

  assert.equal(result.initialized, true);
  assert.equal(result.plant.id, existingId);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM plant_instances')).count, 1);
  assert.equal(
    (await db.get("SELECT active_plant_id FROM garden_state WHERE id = 1")).active_plant_id,
    existingId
  );
});
