const test = require('node:test');
const assert = require('node:assert/strict');
const { createClock } = require('../src/main/clock');

test('clock.now returns the injected instant as a new Date', () => {
  const fixed = new Date('2026-10-21T04:00:00.000Z');
  const clock = createClock({ now: () => fixed });

  const now = clock.now();
  assert.equal(now.toISOString(), '2026-10-21T04:00:00.000Z');
  assert.notEqual(now, fixed, '应返回副本，避免调用方改动时钟内部时间');
});

test('clock.localDate uses the local calendar day', () => {
  const clock = createClock();
  const local = new Date(2026, 9, 21, 23, 30, 0);

  assert.equal(clock.localDate(local), '2026-10-21');
  assert.equal(clock.localDate(local.toISOString()), '2026-10-21');
  assert.equal(clock.localDate(new Date(2026, 9, 22, 0, 15, 0)), '2026-10-22');
});

test('clock.tzOffset returns minutes east of UTC', () => {
  const clock = createClock();
  const instant = new Date('2026-10-21T04:00:00.000Z');

  assert.equal(clock.tzOffset(instant), -instant.getTimezoneOffset());
});

test('clock uses now when localDate and tzOffset receive no instant', () => {
  const fixed = new Date(2026, 9, 21, 12, 0, 0);
  const clock = createClock({ now: () => fixed });

  assert.equal(clock.localDate(), '2026-10-21');
  assert.equal(clock.tzOffset(), -fixed.getTimezoneOffset());
});
