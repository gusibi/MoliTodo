const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const RewardUseCases = require('../src/application/reward-use-cases');
const { ITEM_CATALOG } = require('../src/domain/services/item-catalog');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-reward-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();
  const clock = makeClock();
  const gardenRepository = new SqliteGardenRepository(repo.db);
  const rewardUseCases = new RewardUseCases({
    db: repo.db,
    clock,
    gardenRepository
  });

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { db: repo.db, clock, gardenRepository, rewardUseCases };
}

async function createPendingClaim(gardenRepository, definitionId) {
  const unlock = await gardenRepository.unlockMilestone({
    definitionId,
    unlockedAt: '2026-10-21T01:00:00.000Z',
    claimStatus: 'pending',
    definitionVersion: '1'
  });
  return gardenRepository.createRewardClaim({
    unlockId: unlock.id,
    createdAt: '2026-10-21T01:00:00.000Z'
  });
}

test('a claim exposes three candidates from unowned items', async (t) => {
  const { gardenRepository, rewardUseCases } = await setup(t);
  const claim = await createPendingClaim(gardenRepository, 'hydration-start');

  const options = await rewardUseCases.getClaimOptions(claim.id);

  assert.equal(options.remainingCount, 15);
  assert.deepEqual(
    options.candidates.map((item) => item.id),
    ['furniture-2', 'furniture-3', 'furniture-4']
  );
  assert.equal(options.directItem, null);
  assert.equal(options.fallbackItem, null);
});

test('claiming a selected item records ownership and closes the claim exactly once', async (t) => {
  const { db, gardenRepository, rewardUseCases } = await setup(t);
  const claim = await createPendingClaim(gardenRepository, 'hydration-start');

  const result = await rewardUseCases.claimReward(
    claim.id,
    { selectedItemId: 'furniture-3' },
    new Date('2026-10-21T02:00:00.000Z')
  );

  assert.equal(result.claimed, true);
  assert.equal(result.fallback, false);
  assert.equal(result.item.id, 'furniture-3');
  assert.equal(result.claim.selectedItemId, 'furniture-3');
  assert.equal(result.claim.claimedAt, '2026-10-21T02:00:00.000Z');

  const inventory = await db.all('SELECT * FROM inventory_items');
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].catalog_id, 'furniture-3');
  assert.equal(inventory[0].kind, 'furniture');
  assert.equal(inventory[0].origin_type, 'reward_claim');
  assert.equal(inventory[0].origin_id, String(claim.id));

  const milestone = await db.get(
    'SELECT claim_status FROM milestone_unlocks WHERE id = ?',
    [claim.unlockId]
  );
  assert.equal(milestone.claim_status, 'claimed');
  assert.equal(await gardenRepository.countPendingRewards(), 0);

  const duplicate = await rewardUseCases.claimReward(
    claim.id,
    { selectedItemId: 'furniture-4' },
    new Date('2026-10-21T02:01:00.000Z')
  );
  assert.equal(duplicate.claimed, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 1);
});

test('a later claim re-filters items already owned by an earlier claim', async (t) => {
  const { gardenRepository, rewardUseCases } = await setup(t);
  const first = await createPendingClaim(gardenRepository, 'hydration-start');
  const second = await createPendingClaim(gardenRepository, 'first-sprout');

  await rewardUseCases.claimReward(first.id, { selectedItemId: 'furniture-2' });
  const options = await rewardUseCases.getClaimOptions(second.id);

  assert.equal(options.remainingCount, 14);
  assert.deepEqual(
    options.candidates.map((item) => item.id),
    ['furniture-3', 'furniture-4', 'furniture-5']
  );
});

test('the last remaining item is granted without a selection', async (t) => {
  const { db, gardenRepository, rewardUseCases } = await setup(t);
  const pool = ITEM_CATALOG
    .filter((item) => !['furniture-1', 'decor-1'].includes(item.id))
    .filter((item) => item.id !== 'special-tree-1');

  for (const item of pool) {
    await gardenRepository.addInventoryItem({
      catalogId: item.id,
      kind: item.kind,
      quantity: 1,
      originType: 'test',
      originId: item.id,
      acquiredAt: '2026-10-21T01:00:00.000Z'
    });
  }
  const claim = await createPendingClaim(gardenRepository, 'hydration-start');

  const options = await rewardUseCases.getClaimOptions(claim.id);
  assert.equal(options.remainingCount, 1);
  assert.equal(options.directItem.id, 'special-tree-1');

  const result = await rewardUseCases.claimReward(claim.id);
  assert.equal(result.claimed, true);
  assert.equal(result.item.id, 'special-tree-1');

  const owned = await db.get(
    "SELECT * FROM inventory_items WHERE catalog_id = 'special-tree-1'"
  );
  assert.equal(owned.origin_type, 'reward_claim');
});

test('all items owned falls back to stackable garden memorials', async (t) => {
  const { db, gardenRepository, rewardUseCases } = await setup(t);
  const pool = ITEM_CATALOG.filter(
    (item) => !['furniture-1', 'decor-1'].includes(item.id)
  );

  for (const item of pool) {
    await gardenRepository.addInventoryItem({
      catalogId: item.id,
      kind: item.kind,
      quantity: 1,
      originType: 'test',
      originId: item.id,
      acquiredAt: '2026-10-21T01:00:00.000Z'
    });
  }

  const first = await createPendingClaim(gardenRepository, 'hydration-start');
  const second = await createPendingClaim(gardenRepository, 'first-sprout');

  const firstClaim = await rewardUseCases.claimReward(first.id);
  assert.equal(firstClaim.fallback, true);
  assert.equal(firstClaim.item.id, 'garden-memorial');

  await rewardUseCases.claimReward(second.id);

  const memorials = await db.all(
    "SELECT * FROM inventory_items WHERE catalog_id = 'garden-memorial'"
  );
  assert.equal(memorials.length, 1);
  assert.equal(memorials[0].quantity, 2);
  assert.equal(memorials[0].origin_type, 'fallback');
  assert.equal(memorials[0].origin_id, 'garden-memorial');
});

test('a selected item outside the current candidates is rejected without side effects', async (t) => {
  const { db, gardenRepository, rewardUseCases } = await setup(t);
  const claim = await createPendingClaim(gardenRepository, 'hydration-start');

  await assert.rejects(
    rewardUseCases.claimReward(claim.id, { selectedItemId: 'pet-1' }),
    /候选/
  );
  await assert.rejects(
    rewardUseCases.claimReward(claim.id),
    /候选/
  );

  const stored = await gardenRepository.findRewardClaimById(claim.id);
  assert.equal(stored.claimedAt, null);
  assert.equal(stored.selectedItemId, null);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM inventory_items')).count, 0);
});
