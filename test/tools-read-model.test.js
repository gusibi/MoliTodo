const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteActivityRepository = require('../src/infrastructure/persistence/sqlite-activity-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const ToolsUseCases = require('../src/application/tools-use-cases');
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

function makeClock(offsetMinutes = 480) {
  return {
    now: () => new Date('2026-10-21T01:00:00.000Z'),
    localDate(instant) {
      return new Date(new Date(instant).getTime() + offsetMinutes * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    },
    tzOffset() {
      return offsetMinutes;
    }
  };
}

async function setup(t, { withPlant = false, growthScore = 0 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-read-model-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();

  const clock = makeClock();
  const activityRepository = new SqliteActivityRepository(repo.db);
  const gardenRepository = new SqliteGardenRepository(repo.db);
  const toolsUseCases = new ToolsUseCases({
    db: repo.db,
    clock,
    activityRepository,
    gardenRepository
  });
  const readModel = new ToolsReadModel({ clock, activityRepository, gardenRepository });

  if (withPlant) {
    await gardenRepository.ensureState('2026-10-21T01:00:00.000Z');
    const stage = growthScore >= 15 ? 'mature'
      : growthScore >= 10 ? 'sapling'
        : growthScore >= 5 ? 'sprout' : 'seed';
    const plantId = await gardenRepository.insertPlant({
      speciesId: 'species-1',
      growthScore,
      stage,
      plantedAt: '2026-10-21T01:00:00.000Z',
      localDatePlanted: '2026-10-21'
    });
    await gardenRepository.setActivePlantId(plantId, '2026-10-21T01:00:00.000Z');
  }

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { db: repo.db, clock, activityRepository, gardenRepository, toolsUseCases, readModel };
}

test('an empty garden returns zero resources and does not create state', async (t) => {
  const { db, readModel } = await setup(t);

  const snapshot = await readModel.getShellSnapshot(new Date('2026-10-21T01:00:00.000Z'));

  assert.deepEqual(snapshot, {
    generatedAt: '2026-10-21T01:00:00.000Z',
    localDate: '2026-10-21',
    badges: { pendingRewards: 0 },
    focus: null,
    today: { focusCount: 0, waterCount: 0, sunCount: 0, totalGrowth: 0 },
    plant: null,
    garden: { level: 1, seedCount: 0, autoPlant: true }
  });

  const stateCount = await db.get('SELECT COUNT(*) AS count FROM garden_state');
  assert.equal(stateCount.count, 0, '读取快照不应写入 garden_state');
});

test('the shell snapshot reflects today resources, plant stage, seeds and pending rewards', async (t) => {
  const { gardenRepository, toolsUseCases, readModel } = await setup(t, {
    withPlant: true,
    growthScore: 4
  });

  await toolsUseCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:1:confirmed',
    occurredAt: '2026-10-21T01:00:00.000Z'
  });
  await gardenRepository.addSeeds('species-1', 2, '2026-10-21T01:00:00.000Z');
  await gardenRepository.unlockMilestones(
    ['hydration-start'],
    '2026-10-21T01:00:00.000Z',
    '1'
  );

  const snapshot = await readModel.getShellSnapshot(new Date('2026-10-21T01:05:00.000Z'));

  assert.deepEqual(snapshot.today, {
    focusCount: 0,
    waterCount: 1,
    sunCount: 0,
    totalGrowth: 2
  });
  assert.equal(snapshot.plant.speciesId, 'species-1');
  assert.equal(snapshot.plant.growthScore, 6);
  assert.equal(snapshot.plant.stage, 'sprout');
  assert.equal(snapshot.garden.seedCount, 2);
  assert.equal(snapshot.badges.pendingRewards, 1);
});

test('the snapshot uses the local date and does not mix yesterday resources', async (t) => {
  const { toolsUseCases, readModel } = await setup(t);

  await toolsUseCases.recordActivity({
    type: 'water',
    dedupeKey: 'health:yesterday',
    occurredAt: '2026-10-20T01:00:00.000Z'
  });
  await toolsUseCases.recordActivity({
    type: 'sun',
    dedupeKey: 'health:today',
    occurredAt: '2026-10-21T01:00:00.000Z'
  });

  const today = await readModel.getShellSnapshot(new Date('2026-10-21T02:00:00.000Z'));
  assert.deepEqual(today.today, {
    focusCount: 0,
    waterCount: 0,
    sunCount: 1,
    totalGrowth: 2
  });

  const yesterday = await readModel.getShellSnapshot(new Date('2026-10-20T02:00:00.000Z'));
  assert.deepEqual(yesterday.today, {
    focusCount: 0,
    waterCount: 1,
    sunCount: 0,
    totalGrowth: 2
  });
});
