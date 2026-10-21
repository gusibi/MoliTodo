const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const ToolsRuntime = require('../src/main/tools-runtime');

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

function makeClock(startIso = '2026-10-21T00:40:00.000Z') {
  let current = new Date(startIso);
  return {
    now: () => new Date(current),
    setNow(value) {
      current = new Date(value);
    },
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-runtime-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();

  const shown = [];
  const windowManager = {
    showReminderPopup(intents) {
      shown.push(intents);
    },
    closeReminderPopup() {},
    broadcastToolsUpdated() {}
  };
  const clock = makeClock();
  const runtime = new ToolsRuntime({
    db: repo.db,
    windowManager,
    clock,
    tickIntervalMs: 60 * 60 * 1000
  });

  t.after(async () => {
    runtime.dispose();
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { db: repo.db, clock, runtime, shown };
}

test('the runtime initializes the garden, ticks a rule and records a confirmation', async (t) => {
  const { clock, runtime, shown } = await setup(t);

  await runtime.initialize();
  const initial = await runtime.getShellSnapshot();
  assert.equal(initial.plant.speciesId, 'species-1');

  await runtime.createReminderRule({
    type: 'water',
    intervalMinutes: 60,
    anchorMode: 'created',
    windowStart: '09:00',
    windowEnd: '18:00',
    weekdays: []
  });

  clock.setNow('2026-10-21T01:40:10.000Z');
  const ticked = await runtime.tick();
  assert.equal(ticked.intents.length, 1);
  assert.equal(shown.length, 1);
  assert.equal(shown[0][0].ruleType, 'water');

  await runtime.respondReminder(ticked.intents[0].occurrence.id, 'confirm');

  const after = await runtime.getShellSnapshot();
  assert.equal(after.today.waterCount, 1);
  assert.equal(after.today.totalGrowth, 2);
  assert.equal(after.plant.growthScore, 2);
});
