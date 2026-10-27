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
const FocusUseCases = require('../src/application/focus-use-cases');

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

function makeClock(startIso = '2026-10-21T01:00:00.000Z') {
  let current = new Date(startIso);
  return {
    now: () => new Date(current),
    setNow(value) {
      current = new Date(value);
    },
    advanceSeconds(seconds) {
      current = new Date(current.getTime() + seconds * 1000);
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-focus-test-'));
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
  const focusUseCases = new FocusUseCases({
    db: repo.db,
    clock,
    focusRepository,
    toolsUseCases
  });

  await gardenRepository.ensureState(clock.now().toISOString());
  const plantId = await gardenRepository.insertPlant({
    speciesId: 'species-1',
    plantedAt: clock.now().toISOString(),
    localDatePlanted: '2026-10-21'
  });
  await gardenRepository.setActivePlantId(plantId, clock.now().toISOString());

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { db: repo.db, clock, gardenRepository, focusRepository, focusUseCases };
}

test('pause stops the clock, resume continues and completion writes focus growth', async (t) => {
  const { db, clock, focusUseCases } = await setup(t);

  await focusUseCases.start({ plannedMinutes: 15 });
  clock.advanceSeconds(100);
  const paused = await focusUseCases.pause();
  assert.equal(paused.active.status, 'paused');
  assert.equal(paused.active.remainingSeconds, 800);

  clock.advanceSeconds(500);
  const stillPaused = await focusUseCases.getState();
  assert.equal(stillPaused.active.remainingSeconds, 800);

  await focusUseCases.resume();
  clock.advanceSeconds(800);
  const completed = await focusUseCases.tick();

  assert.equal(completed.completed, true);
  assert.equal(completed.breakStarted, true);
  assert.equal(completed.state.active.phase, 'break');
  assert.equal(completed.state.active.remainingSeconds, 300);
  assert.equal(completed.state.active.status, 'running');
  assert.equal(completed.state.recent[0].status, 'completed');

  const events = await db.all('SELECT * FROM activity_events');
  assert.equal(events.length, 1);
  assert.equal(events[0].event_type, 'focus');
  assert.equal(events[0].growth_points, 1);

  const plant = await db.get("SELECT * FROM plant_instances WHERE status = 'growing'");
  assert.equal(plant.growth_score, 1);
});

test('a completed focus starts a five-minute break without writing extra growth', async (t) => {
  const { db, clock, focusUseCases } = await setup(t);

  await focusUseCases.start({ plannedMinutes: 15 });
  clock.advanceSeconds(15 * 60);
  const completed = await focusUseCases.tick();

  assert.equal(completed.breakStarted, true);
  assert.equal(completed.completedSession.plannedSeconds, 15 * 60);
  assert.equal(completed.state.active.phase, 'break');
  assert.equal(completed.state.active.plannedSeconds, 300);
  assert.equal(completed.state.active.remainingSeconds, 300);

  clock.advanceSeconds(300);
  const breakCompleted = await focusUseCases.tick();

  assert.equal(breakCompleted.completed, false);
  assert.equal(breakCompleted.breakCompleted, true);
  assert.equal(breakCompleted.state.active, null);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 1);
});

test('a break can be skipped, and starting a new focus also ends it', async (t) => {
  const { db, clock, focusUseCases } = await setup(t);

  await focusUseCases.start({ plannedMinutes: 15 });
  clock.advanceSeconds(15 * 60);
  await focusUseCases.tick();

  const skipped = await focusUseCases.skipBreak();
  assert.equal(skipped.active, null);
  assert.equal(skipped.recent.length, 1);
  assert.equal(skipped.recent[0].phase, 'focus');

  await focusUseCases.start({ plannedMinutes: 15 });
  clock.advanceSeconds(15 * 60);
  await focusUseCases.tick();
  const next = await focusUseCases.start({ plannedMinutes: 25 });

  assert.equal(next.active.phase, 'focus');
  assert.equal(next.active.plannedSeconds, 1500);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM focus_sessions')).count, 5);
});

test('early cancellation keeps history but writes no growth', async (t) => {
  const { db, clock, focusUseCases } = await setup(t);

  await focusUseCases.start({ plannedMinutes: 25 });
  clock.advanceSeconds(60);
  const cancelled = await focusUseCases.cancel();

  assert.equal(cancelled.active, null);
  assert.equal(cancelled.recent[0].status, 'cancelled');
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 0);
});

test('only one active focus session is allowed', async (t) => {
  const { focusUseCases } = await setup(t);

  await focusUseCases.start({ plannedMinutes: 15 });
  await assert.rejects(
    focusUseCases.start({ plannedMinutes: 15 }),
    /已有进行中的专注/
  );
});

test('active sessions left by a previous process are interrupted without reward', async (t) => {
  const { db, clock, focusUseCases } = await setup(t);

  await focusUseCases.start({ plannedMinutes: 15 });
  clock.advanceSeconds(60);
  const changed = await focusUseCases.interruptActive();

  assert.equal(changed, 1);
  const state = await focusUseCases.getState();
  assert.equal(state.active, null);
  assert.equal(state.recent[0].status, 'interrupted');
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 0);
});

test('focus can be linked to a task without changing the task', async (t) => {
  const { db, focusUseCases } = await setup(t);

  const state = await focusUseCases.start({ plannedMinutes: 15, linkedTaskId: 'task-1' });
  assert.equal(state.active.linkedTaskId, 'task-1');

  const row = await db.get('SELECT linked_task_id FROM focus_sessions WHERE id = ?', [state.active.id]);
  assert.equal(row.linked_task_id, 'task-1');
});

test('the 11th completed focus of the day is recorded with 0 growth', async (t) => {
  const { db, clock, focusUseCases } = await setup(t);

  for (let index = 0; index < 11; index += 1) {
    await focusUseCases.start({ plannedMinutes: 15 });
    clock.advanceSeconds(15 * 60);
    const result = await focusUseCases.tick();
    assert.equal(result.completed, true);
  }

  const events = await db.all(
    'SELECT growth_points FROM activity_events ORDER BY id ASC'
  );
  assert.deepEqual(
    events.map((event) => event.growth_points),
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]
  );
});
