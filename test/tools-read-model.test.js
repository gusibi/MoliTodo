const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteActivityRepository = require('../src/infrastructure/persistence/sqlite-activity-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const SqliteFocusRepository = require('../src/infrastructure/persistence/sqlite-focus-repository');
const ToolsUseCases = require('../src/application/tools-use-cases');
const ToolsReadModel = require('../src/application/tools-read-model');
const GardenUseCases = require('../src/application/garden-use-cases');
const RewardUseCases = require('../src/application/reward-use-cases');

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
  const focusRepository = new SqliteFocusRepository(repo.db);
  const toolsUseCases = new ToolsUseCases({
    db: repo.db,
    clock,
    activityRepository,
    gardenRepository
  });
  const readModel = new ToolsReadModel({ clock, activityRepository, gardenRepository, focusRepository });
  const gardenUseCases = new GardenUseCases({ db: repo.db, clock, gardenRepository });
  const rewardUseCases = new RewardUseCases({ db: repo.db, clock, gardenRepository });

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

  return { db: repo.db, clock, activityRepository, gardenRepository, focusRepository, toolsUseCases, readModel, gardenUseCases, rewardUseCases };
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
  const unlock = await gardenRepository.unlockMilestone({
    definitionId: 'hydration-start',
    unlockedAt: '2026-10-21T01:00:00.000Z',
    claimStatus: 'pending',
    definitionVersion: '1'
  });
  await gardenRepository.createRewardClaim({
    unlockId: unlock.id,
    createdAt: '2026-10-21T01:00:00.000Z'
  });

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

test('the shell snapshot includes an active focus summary', async (t) => {
  const { focusRepository, readModel } = await setup(t);

  const session = await focusRepository.createSession({
    plannedSeconds: 900,
    startedAt: '2026-10-21T01:00:00.000Z',
    createdAt: '2026-10-21T01:00:00.000Z'
  });
  const snapshot = await readModel.getShellSnapshot(new Date('2026-10-21T01:05:00.000Z'));

  assert.equal(snapshot.focus.id, session.id);
  assert.equal(snapshot.focus.status, 'running');
  assert.equal(snapshot.focus.elapsedSeconds, 300);
  assert.equal(snapshot.focus.remainingSeconds, 600);
});

test('an empty garden view returns defaults without writing state', async (t) => {
  const { db, readModel } = await setup(t);

  const view = await readModel.getGardenView(new Date('2026-10-21T01:00:00.000Z'));

  assert.equal(view.localDate, '2026-10-21');
  assert.deepEqual(view.garden, {
    level: 1,
    capacity: 6,
    currentStreak: 0,
    longestStreak: 0,
    totalGrowthDays: 0,
    activePlantId: null,
    autoPlant: true,
    canClaimBasicSeed: true,
    nextExpansion: {
      level: 2,
      capacity: 10,
      streakDays: 10,
      totalGrowthDays: 15
    }
  });
  assert.equal(view.badges.pendingRewards, 0);
  assert.equal(view.badges.total, 20);
  assert.equal(view.badges.unlocked, 0);
  assert.equal(view.badges.items.length, 20);
  assert.equal(view.plantHistory.length, 0);
  assert.equal(view.collection.length, 24);
  assert.equal(view.collection.filter((entry) => entry.owned || entry.unlocked).length, 0);
  assert.equal(view.plant, null);
  assert.deepEqual(view.seeds, []);
  assert.deepEqual(view.species, []);
  assert.deepEqual(view.inventory, []);
  assert.deepEqual(view.placements, []);
  assert.deepEqual(view.milestones, []);
  assert.deepEqual(view.expansions, []);
  assert.deepEqual(view.rewardClaims, []);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM garden_state')).count, 0);
});

test('the garden view reflects initialization, seeds, rewards and placements', async (t) => {
  const { db, gardenRepository, gardenUseCases, rewardUseCases, readModel } = await setup(t);
  const nowIso = '2026-10-21T01:00:00.000Z';

  await gardenUseCases.initializeGarden();
  await gardenRepository.addSeeds('species-2', 1, nowIso);

  const unlock = await gardenRepository.unlockMilestone({
    definitionId: 'hydration-start',
    unlockedAt: nowIso,
    claimStatus: 'pending',
    definitionVersion: '1'
  });
  const claim = await gardenRepository.createRewardClaim({
    unlockId: unlock.id,
    createdAt: nowIso
  });

  const inventoryBefore = await gardenRepository.listInventoryItems();
  const initialFurniture = inventoryBefore.find((item) => item.catalogId === 'furniture-1');
  await db.run(
    `INSERT INTO garden_placements (inventory_id, region_id, slot_id, placed_at)
     VALUES (?, 'garden', 'slot-1', ?)`,
    [initialFurniture.id, nowIso]
  );

  const before = await readModel.getGardenView(new Date(nowIso));
  assert.equal(before.plant.speciesId, 'species-1');
  assert.equal(before.garden.activePlantId, before.plant.id);
  assert.deepEqual(before.seeds.map((seed) => [seed.speciesId, seed.quantity]), [['species-2', 1]]);
  assert.deepEqual(before.species.map((entry) => entry.speciesId), ['species-1']);
  assert.equal(before.inventory.length, 2);
  assert.deepEqual(before.placements.map((entry) => [entry.regionId, entry.slotId, entry.visible]), [
    ['garden', 'slot-1', true]
  ]);
  assert.equal(before.milestones.length, 1);
  assert.equal(before.milestones[0].claimStatus, 'pending');
  assert.equal(before.rewardClaims.length, 1);
  assert.equal(before.rewardClaims[0].claimedAt, null);
  assert.equal(before.badges.pendingRewards, 1);
  assert.equal(before.badges.unlocked, 1);
  assert.equal(
    before.badges.items.find((item) => item.definitionId === 'hydration-start').claimStatus,
    'pending'
  );
  assert.equal(before.plantHistory.length, 1);
  assert.equal(before.collection.length, 24);
  assert.equal(
    before.collection.filter((entry) => entry.owned || entry.unlocked).length,
    3
  );
  assert.deepEqual(before.expansions.map((entry) => [entry.level, entry.conditionType]), [
    [1, 'initial']
  ]);

  await rewardUseCases.claimReward(
    claim.id,
    { selectedItemId: 'furniture-3' },
    new Date('2026-10-21T02:00:00.000Z')
  );

  const after = await readModel.getGardenView(new Date('2026-10-21T02:00:00.000Z'));
  assert.equal(after.badges.pendingRewards, 0);
  assert.equal(
    after.badges.items.find((item) => item.definitionId === 'hydration-start').claimStatus,
    'claimed'
  );
  assert.equal(after.milestones[0].claimStatus, 'claimed');
  assert.equal(after.rewardClaims[0].claimedAt, '2026-10-21T02:00:00.000Z');
  assert.equal(after.rewardClaims[0].selectedItemId, 'furniture-3');
  assert.equal(after.inventory.length, 3);
  assert.equal(after.inventory.some((item) => item.catalogId === 'furniture-3'), true);
  assert.equal(after.placements.length, 1);
});
