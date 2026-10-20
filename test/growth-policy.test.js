const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_GROWTH_POLICY,
  createInitialState,
  getStage,
  applyActivityEvent
} = require('../src/domain/services/growth-policy');

function runningPlant(overrides = {}) {
  return {
    speciesId: 'species-1',
    growthScore: 0,
    stage: 'seed',
    status: 'growing',
    ...overrides
  };
}

function activity(type, localDate, occurredAt = `${localDate}T09:00:00.000Z`) {
  return { type, localDate, occurredAt };
}

function apply(state, event, options = {}) {
  return applyActivityEvent({ state, event, ...options });
}

test('focus awards at most 10 growth points per day while still recording the 11th event', () => {
  let state = {
    ...createInitialState(),
    plant: runningPlant()
  };
  const points = [];

  for (let index = 0; index < 11; index += 1) {
    const result = apply(state, activity('focus', '2026-10-21'));
    state = result.state;
    points.push(result.effects.growthPoints);
  }

  assert.deepEqual(points, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  assert.equal(state.daily.focusCount, 11);
  assert.equal(state.daily.totalGrowth, 10);
  assert.equal(state.totals.focusCount, 11);
  assert.equal(state.plant.growthScore, 10);
  assert.deepEqual(state.growthDays, ['2026-10-21']);
});

test('water awards 2 points for the first 3 confirmations and 0 afterwards', () => {
  let state = {
    ...createInitialState(),
    plant: runningPlant()
  };
  const points = [];

  for (let index = 0; index < 4; index += 1) {
    const result = apply(state, activity('water', '2026-10-21'));
    state = result.state;
    points.push(result.effects.growthPoints);
  }

  assert.deepEqual(points, [2, 2, 2, 0]);
  assert.equal(state.daily.waterCount, 4);
  assert.equal(state.daily.totalGrowth, 6);
  assert.equal(state.plant.growthScore, 6);
});

test('sun awards 2 points for the first 3 confirmations and 0 afterwards', () => {
  let state = {
    ...createInitialState(),
    plant: runningPlant()
  };
  const points = [];

  for (let index = 0; index < 4; index += 1) {
    const result = apply(state, activity('sun', '2026-10-21'));
    state = result.state;
    points.push(result.effects.growthPoints);
  }

  assert.deepEqual(points, [2, 2, 2, 0]);
  assert.equal(state.daily.sunCount, 4);
  assert.equal(state.daily.totalGrowth, 6);
  assert.equal(state.plant.growthScore, 6);
});

test('an over-limit event still increments counters and history with 0 growth', () => {
  let state = {
    ...createInitialState(),
    plant: runningPlant({ growthScore: 6, stage: 'sprout' })
  };
  for (let index = 0; index < 3; index += 1) {
    state = apply(state, activity('water', '2026-10-21')).state;
  }

  const result = apply(state, activity('water', '2026-10-21'));

  assert.equal(result.effects.growthPoints, 0);
  assert.equal(result.effects.appliedGrowth, 0);
  assert.equal(result.state.daily.waterCount, 4);
  assert.equal(result.state.daily.totalGrowth, 6);
  assert.equal(result.state.totals.healthCount, 4);
  assert.equal(result.state.plant.growthScore, 12);
});

test('one valid focus makes the local date a growth day only once', () => {
  const first = apply(createInitialState(), activity('focus', '2026-10-21'));
  const second = apply(first.state, activity('focus', '2026-10-21'));

  assert.equal(first.effects.growthDayEarned, true);
  assert.equal(second.effects.growthDayEarned, false);
  assert.deepEqual(second.state.growthDays, ['2026-10-21']);
});

test('one health confirmation is not a growth day, the second one is', () => {
  const first = apply(createInitialState(), activity('water', '2026-10-21'));
  const second = apply(first.state, activity('sun', '2026-10-21'));

  assert.equal(first.effects.growthDayEarned, false);
  assert.deepEqual(first.state.growthDays, []);
  assert.equal(second.effects.growthDayEarned, true);
  assert.deepEqual(second.state.growthDays, ['2026-10-21']);
});

test('stage boundaries follow 0/5/10/15', () => {
  const cases = [
    [0, 'seed'],
    [4, 'seed'],
    [5, 'sprout'],
    [9, 'sprout'],
    [10, 'sapling'],
    [14, 'sapling'],
    [15, 'mature']
  ];

  for (const [score, stage] of cases) {
    assert.equal(getStage(score), stage, `成长值 ${score} 应为 ${stage}`);
  }
});

test('maturity yields one seed of the same species and does not carry extra score', () => {
  let state = {
    ...createInitialState(),
    plant: runningPlant({ growthScore: 14, stage: 'sapling' })
  };

  const matured = apply(state, activity('water', '2026-10-21'));
  state = matured.state;

  assert.equal(matured.effects.growthPoints, 2);
  assert.equal(matured.effects.appliedGrowth, 1);
  assert.equal(matured.effects.stage, 'mature');
  assert.equal(matured.effects.matured, true);
  assert.deepEqual(matured.effects.seedYield, { speciesId: 'species-1', quantity: 1 });
  assert.equal(state.plant.growthScore, 15);
  assert.equal(state.plant.status, 'matured');

  const afterMaturity = apply(state, activity('sun', '2026-10-21'));

  assert.equal(afterMaturity.effects.growthPoints, 2);
  assert.equal(afterMaturity.effects.appliedGrowth, 0);
  assert.equal(afterMaturity.effects.matured, false);
  assert.equal(afterMaturity.effects.seedYield, null);
  assert.equal(afterMaturity.state.plant.growthScore, 15);
});

test('30 health confirmations unlock hydration-start exactly once', () => {
  let state = createInitialState();
  const dates = [
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25'
  ];

  for (const localDate of dates) {
    for (const type of ['water', 'water', 'water', 'sun', 'sun', 'sun']) {
      state = apply(state, activity(type, localDate)).state;
    }
  }

  assert.equal(state.totals.healthCount, 30);
  assert.deepEqual(
    state.unlockedMilestones.filter((id) => id === 'hydration-start'),
    ['hydration-start']
  );

  const next = apply(state, activity('water', '2026-10-26'));
  assert.equal(next.effects.eligibleMilestones.includes('hydration-start'), false);
  assert.equal(next.state.unlockedMilestones.filter((id) => id === 'hydration-start').length, 1);
});

test('policy numbers can be injected instead of being hard-coded', () => {
  const policy = {
    ...DEFAULT_GROWTH_POLICY,
    events: {
      ...DEFAULT_GROWTH_POLICY.events,
      focus: { ...DEFAULT_GROWTH_POLICY.events.focus, growthPoints: 5, dailyLimit: 1 }
    }
  };

  let state = {
    ...createInitialState(),
    plant: runningPlant()
  };
  const first = apply(state, activity('focus', '2026-10-21'), { policy });
  state = first.state;
  const second = apply(state, activity('focus', '2026-10-21'), { policy });

  assert.equal(first.effects.growthPoints, 5);
  assert.equal(second.effects.growthPoints, 0);
  assert.equal(second.state.plant.growthScore, 5);
});
