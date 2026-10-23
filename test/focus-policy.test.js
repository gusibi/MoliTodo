const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MIN_FOCUS_SECONDS,
  normalizePlannedSeconds,
  getFocusElapsedSeconds,
  getFocusSummary
} = require('../src/domain/services/focus-policy');

function session(overrides = {}) {
  return {
    id: 1,
    plannedSeconds: 1500,
    focusSeconds: 0,
    status: 'running',
    startedAt: '2026-10-21T01:00:00.000Z',
    endedAt: null,
    linkedTaskId: null,
    ...overrides
  };
}

test('planned focus durations must be at least 15 minutes', () => {
  assert.equal(MIN_FOCUS_SECONDS, 900);
  assert.equal(normalizePlannedSeconds(15), 900);
  assert.equal(normalizePlannedSeconds(25), 1500);
  assert.throws(() => normalizePlannedSeconds(14), /15 分钟/);
  assert.throws(() => normalizePlannedSeconds(0), /大于 0/);
});

test('elapsed time accumulates only while running', () => {
  const running = session({ focusSeconds: 60 });
  assert.equal(getFocusElapsedSeconds(running, '2026-10-21T01:00:30.000Z'), 90);

  const paused = session({ status: 'paused', focusSeconds: 60 });
  assert.equal(getFocusElapsedSeconds(paused, '2026-10-21T02:00:00.000Z'), 60);
});

test('summary exposes remaining seconds and clamps to the plan', () => {
  const running = session({ plannedSeconds: 900, focusSeconds: 0 });
  const summary = getFocusSummary(running, '2026-10-21T01:05:00.000Z');

  assert.equal(summary.elapsedSeconds, 300);
  assert.equal(summary.remainingSeconds, 600);
  assert.equal(summary.status, 'running');
  assert.equal(summary.phase, 'focus');

  const breakSummary = getFocusSummary(
    session({ phase: 'break', plannedSeconds: 300 }),
    '2026-10-21T01:01:00.000Z'
  );
  assert.equal(breakSummary.phase, 'break');
  assert.equal(breakSummary.remainingSeconds, 240);

  const finished = getFocusSummary(
    session({ status: 'completed', plannedSeconds: 900, focusSeconds: 900 }),
    '2026-10-21T01:20:00.000Z'
  );
  assert.equal(finished.remainingSeconds, 0);
});
