const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CATALOG } = require('../src/domain/services/growth-policy');
const {
  REWARD_TYPES,
  getMilestoneReward,
  getMilestoneClaimStatus
} = require('../src/domain/services/reward-policy');

test('the catalog has 11 item-choice milestones and 5 species milestones', () => {
  const rewards = DEFAULT_CATALOG.milestones.map((definition) => ({
    id: definition.id,
    reward: getMilestoneReward(definition)
  }));
  const itemChoices = rewards.filter((entry) => entry.reward.type === REWARD_TYPES.ITEM_CHOICE);
  const species = rewards.filter((entry) => entry.reward.type === REWARD_TYPES.SPECIES);

  assert.equal(itemChoices.length, 11);
  assert.equal(species.length, 5);
  assert.deepEqual(
    species.map((entry) => entry.reward.speciesId).sort(),
    ['species-2', 'species-3', 'species-4', 'species-5', 'species-6']
  );
});

test('item choices are pending and fixed rewards are granted immediately', () => {
  const itemChoice = DEFAULT_CATALOG.milestones.find((entry) => entry.id === 'hydration-start');
  const species = DEFAULT_CATALOG.milestones.find((entry) => entry.id === 'seven-day-garden');

  assert.equal(getMilestoneClaimStatus(itemChoice), 'pending');
  assert.equal(getMilestoneClaimStatus(species), 'granted');
  assert.deepEqual(getMilestoneReward(species), {
    type: 'species',
    speciesId: 'species-2',
    seeds: 1
  });
});

test('annual gardener carries the fixed skin alongside the item choice', () => {
  const annual = DEFAULT_CATALOG.milestones.find((entry) => entry.id === 'annual-gardener');

  assert.deepEqual(getMilestoneReward(annual), {
    type: 'item-choice',
    skin: 'annual-cabin'
  });
});

test('invalid reward definitions are rejected', () => {
  assert.throws(() => getMilestoneReward({ id: 'missing' }), /奖励定义/);
  assert.throws(
    () => getMilestoneReward({ id: 'unknown', reward: { type: 'badge' } }),
    /未知里程碑奖励类型/
  );
  assert.throws(
    () => getMilestoneReward({ id: 'species', reward: { type: 'species' } }),
    /speciesId/
  );
});
