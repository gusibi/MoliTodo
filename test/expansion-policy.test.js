const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPANSION_LEVELS,
  shiftLocalDate,
  getNextExpansion,
  advanceGrowthStreak,
  evaluateExpansionUnlocks
} = require('../src/domain/services/expansion-policy');

test('expansion levels expose the five documented capacities', () => {
  assert.deepEqual(
    EXPANSION_LEVELS.map((entry) => [entry.level, entry.capacity, entry.streakDays, entry.totalGrowthDays]),
    [
      [1, 4, 0, 0],
      [2, 10, 10, 15],
      [3, 16, 30, 45],
      [4, 24, 90, 120],
      [5, 32, 180, 270]
    ]
  );
  assert.equal(getNextExpansion(1).level, 2);
  assert.equal(getNextExpansion(5), null);
});

test('streak advances on consecutive days and resets after a gap', () => {
  assert.deepEqual(
    advanceGrowthStreak({ localDate: '2026-10-21' }),
    { currentStreak: 1, longestStreak: 1, totalGrowthDays: 1 }
  );

  assert.deepEqual(
    advanceGrowthStreak({
      currentStreak: 9,
      longestStreak: 9,
      totalGrowthDays: 9,
      lastGrowthDate: '2026-10-20',
      localDate: '2026-10-21'
    }),
    { currentStreak: 10, longestStreak: 10, totalGrowthDays: 10 }
  );

  assert.deepEqual(
    advanceGrowthStreak({
      currentStreak: 9,
      longestStreak: 12,
      totalGrowthDays: 20,
      lastGrowthDate: '2026-10-18',
      localDate: '2026-10-21'
    }),
    { currentStreak: 1, longestStreak: 12, totalGrowthDays: 21 }
  );

  assert.deepEqual(
    advanceGrowthStreak({
      currentStreak: 5,
      longestStreak: 5,
      totalGrowthDays: 5,
      lastGrowthDate: '2026-10-21',
      localDate: '2026-10-21'
    }),
    { currentStreak: 5, longestStreak: 5, totalGrowthDays: 5 }
  );
});

test('the streak channel unlocks the next level once', () => {
  const unlocks = evaluateExpansionUnlocks({
    currentLevel: 1,
    currentStreak: 10,
    totalGrowthDays: 10
  });

  assert.equal(unlocks.length, 1);
  assert.equal(unlocks[0].level, 2);
  assert.equal(unlocks[0].conditionType, 'streak');
});

test('the cumulative channel can unlock instead of the streak channel', () => {
  const unlocks = evaluateExpansionUnlocks({
    currentLevel: 1,
    currentStreak: 1,
    totalGrowthDays: 15
  });

  assert.equal(unlocks.length, 1);
  assert.equal(unlocks[0].level, 2);
  assert.equal(unlocks[0].conditionType, 'total');
});

test('already unlocked levels are not returned again', () => {
  const unlocks = evaluateExpansionUnlocks({
    currentLevel: 3,
    currentStreak: 30,
    totalGrowthDays: 45
  });

  assert.deepEqual(unlocks, []);
});

test('multiple levels can unlock in one settlement', () => {
  const unlocks = evaluateExpansionUnlocks({
    currentLevel: 1,
    currentStreak: 180,
    totalGrowthDays: 270
  });

  assert.deepEqual(
    unlocks.map((entry) => [entry.level, entry.conditionType]),
    [[2, 'streak'], [3, 'streak'], [4, 'streak'], [5, 'streak']]
  );
});

test('date shifting stays on local calendar dates', () => {
  assert.equal(shiftLocalDate('2026-10-21', -1), '2026-10-20');
  assert.equal(shiftLocalDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftLocalDate('2026-12-31', 1), '2027-01-01');
});
