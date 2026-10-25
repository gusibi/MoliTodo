const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeIntervalMinutes,
  computeNextRunAt,
  getAnchorMinutes
} = require('../src/domain/services/reminder-schedule');

function makeClock(offsetMinutes = 480) {
  return {
    now: () => new Date('2026-10-21T00:40:00.000Z'),
    localDate(instant) {
      return new Date(instant.getTime() + offsetMinutes * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    },
    tzOffset() {
      return offsetMinutes;
    }
  };
}

function rule(overrides = {}) {
  return {
    intervalMinutes: 60,
    anchorMode: 'created',
    anchorMinutes: 520,
    weekdays: [],
    windowStart: '09:00',
    windowEnd: '18:00',
    pauseUntil: null,
    ...overrides
  };
}

test('created anchor first fires one interval after creation', () => {
  const clock = makeClock();
  const after = new Date('2026-10-21T00:40:00.000Z');

  const next = computeNextRunAt(
    rule({ anchorMinutes: getAnchorMinutes('created', after, clock) }),
    after,
    clock
  );

  assert.equal(next.toISOString(), '2026-10-21T01:40:00.000Z');
});

test('hour anchor aligns to the next whole hour', () => {
  const clock = makeClock();
  const after = new Date('2026-10-21T00:40:00.000Z');

  const next = computeNextRunAt(
    rule({ anchorMinutes: getAnchorMinutes('hour', after, clock) }),
    after,
    clock
  );

  assert.equal(next.toISOString(), '2026-10-21T01:00:00.000Z');
});

test('created and hour anchors follow the 10:20 example', () => {
  const clock = makeClock();
  const after = new Date('2026-10-21T02:20:00.000Z');

  const created = computeNextRunAt(
    rule({ anchorMinutes: getAnchorMinutes('created', after, clock) }),
    after,
    clock
  );
  const hour = computeNextRunAt(
    rule({ anchorMinutes: getAnchorMinutes('hour', after, clock) }),
    after,
    clock
  );

  assert.equal(created.toISOString(), '2026-10-21T03:20:00.000Z');
  assert.equal(hour.toISOString(), '2026-10-21T03:00:00.000Z');
});

test('interval validation accepts presets and 10-minute steps', () => {
  for (const value of [10, 20, 30, 45, 60, 90, 100, 120]) {
    assert.equal(normalizeIntervalMinutes(value), value);
  }
  for (const value of [0, 9, 15, 25, 35, 55]) {
    assert.throws(() => normalizeIntervalMinutes(value), /间隔/);
  }
});

test('window end is exclusive and the next slot moves to the next day', () => {
  const clock = makeClock();
  const windowRule = rule({
    anchorMinutes: 480,
    intervalMinutes: 60,
    windowStart: '09:00',
    windowEnd: '10:00'
  });

  const first = computeNextRunAt(windowRule, new Date('2026-10-21T00:00:00.000Z'), clock);
  assert.equal(first.toISOString(), '2026-10-21T01:00:00.000Z');

  const second = computeNextRunAt(windowRule, first, clock);
  assert.equal(second.toISOString(), '2026-10-22T01:00:00.000Z');
});

test('slots are filtered by weekday', () => {
  const clock = makeClock();
  const fridayRule = rule({ weekdays: [5] });

  const next = computeNextRunAt(
    fridayRule,
    new Date('2026-10-21T00:40:00.000Z'),
    clock
  );

  assert.equal(next.toISOString(), '2026-10-23T01:40:00.000Z');
});

test('pauseUntil skips every slot at or before the pause end', () => {
  const clock = makeClock();
  const paused = rule({ pauseUntil: '2026-10-21T05:00:00.000Z' });

  const next = computeNextRunAt(
    paused,
    new Date('2026-10-21T00:40:00.000Z'),
    clock
  );

  assert.equal(next.toISOString(), '2026-10-21T05:40:00.000Z');
});

test('a slot exactly at window start is allowed, but the anchor itself is not a trigger', () => {
  const clock = makeClock();
  const windowRule = rule({ anchorMinutes: 480, intervalMinutes: 60 });

  const next = computeNextRunAt(windowRule, new Date('2026-10-21T00:00:00.000Z'), clock);
  assert.equal(next.toISOString(), '2026-10-21T01:00:00.000Z');
});

test('anchor after the window still schedules from the window start next day', () => {
  const clock = makeClock();
  const lateRule = rule({
    anchorMinutes: 20 * 60 + 22,
    intervalMinutes: 45,
    windowStart: '09:00',
    windowEnd: '18:00'
  });

  const next = computeNextRunAt(lateRule, new Date('2026-10-21T12:22:00.000Z'), clock);
  assert.equal(next.toISOString(), '2026-10-22T01:00:00.000Z');
});

test('anchor near the window end keeps the anchor time on later days', () => {
  const clock = makeClock();
  const lateRule = rule({
    anchorMinutes: 17 * 60 + 30,
    intervalMinutes: 45,
    windowStart: '09:00',
    windowEnd: '18:00'
  });

  const next = computeNextRunAt(lateRule, new Date('2026-10-21T09:30:00.000Z'), clock);
  assert.equal(next.toISOString(), '2026-10-22T09:30:00.000Z');
});
