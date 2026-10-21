const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const SqliteActivityRepository = require('../src/infrastructure/persistence/sqlite-activity-repository');
const SqliteGardenRepository = require('../src/infrastructure/persistence/sqlite-garden-repository');
const SqliteReminderRepository = require('../src/infrastructure/persistence/sqlite-reminder-repository');
const ToolsUseCases = require('../src/application/tools-use-cases');
const ReminderUseCases = require('../src/application/reminder-use-cases');

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

function makeClock(startIso = '2026-10-21T00:40:00.000Z', offsetMinutes = 480) {
  let current = new Date(startIso);
  return {
    now: () => new Date(current),
    setNow(value) {
      current = new Date(value);
    },
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

async function setup(t, { withPlant = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-reminder-test-'));
  const repo = new SqliteTaskRepository(path.join(dir, 'tasks.db'));
  await repo.initialize();

  const clock = makeClock();
  const activityRepository = new SqliteActivityRepository(repo.db);
  const gardenRepository = new SqliteGardenRepository(repo.db);
  const reminderRepository = new SqliteReminderRepository(repo.db);
  const toolsUseCases = new ToolsUseCases({
    db: repo.db,
    clock,
    activityRepository,
    gardenRepository
  });
  const reminderUseCases = new ReminderUseCases({
    db: repo.db,
    clock,
    reminderRepository,
    toolsUseCases
  });

  if (withPlant) {
    await gardenRepository.ensureState('2026-10-21T00:40:00.000Z');
    const plantId = await gardenRepository.insertPlant({
      speciesId: 'species-1',
      plantedAt: '2026-10-21T00:40:00.000Z',
      localDatePlanted: '2026-10-21'
    });
    await gardenRepository.setActivePlantId(plantId, '2026-10-21T00:40:00.000Z');
  }

  t.after(async () => {
    await repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return {
    db: repo.db,
    clock,
    activityRepository,
    gardenRepository,
    reminderRepository,
    toolsUseCases,
    reminderUseCases
  };
}

function ruleInput(overrides = {}) {
  return {
    type: 'water',
    intervalMinutes: 60,
    anchorMode: 'created',
    windowStart: '09:00',
    windowEnd: '18:00',
    weekdays: [],
    ...overrides
  };
}

test('createRule computes created and hour anchors', async (t) => {
  const { reminderUseCases } = await setup(t);

  const created = await reminderUseCases.createRule(ruleInput());
  assert.equal(created.anchorMinutes, 520);
  assert.equal(created.nextRunAt, '2026-10-21T01:40:00.000Z');

  const hourly = await reminderUseCases.createRule(ruleInput({ anchorMode: 'hour' }));
  assert.equal(hourly.anchorMinutes, 480);
  assert.equal(hourly.nextRunAt, '2026-10-21T01:00:00.000Z');
});

test('tick creates a pending occurrence, advances next_run_at and does not duplicate', async (t) => {
  const { reminderUseCases, reminderRepository } = await setup(t);
  const rule = await reminderUseCases.createRule(ruleInput());

  const first = await reminderUseCases.tick(new Date('2026-10-21T01:40:10.000Z'));
  assert.equal(first.intents.length, 1);
  assert.equal(first.intents[0].occurrence.status, 'pending');
  assert.equal(first.intents[0].occurrence.scheduledAt, '2026-10-21T01:40:00.000Z');
  assert.equal(first.intents[0].occurrence.localDate, '2026-10-21');

  const advanced = await reminderRepository.findRuleById(rule.id);
  assert.equal(advanced.nextRunAt, '2026-10-21T02:40:00.000Z');

  const second = await reminderUseCases.tick(new Date('2026-10-21T01:40:20.000Z'));
  assert.equal(second.intents.length, 0);

  const occurrences = await reminderRepository.listSnoozedDue('2026-10-21T01:40:20.000Z');
  assert.equal(occurrences.length, 0);
});

test('a missed slot older than 90 seconds is skipped without creating an occurrence', async (t) => {
  const { db, reminderUseCases, reminderRepository } = await setup(t);
  const rule = await reminderUseCases.createRule(ruleInput());

  const result = await reminderUseCases.tick(new Date('2026-10-21T02:45:00.000Z'));
  assert.equal(result.intents.length, 0);

  const occurrences = await db.all('SELECT * FROM reminder_occurrences');
  assert.equal(occurrences.length, 0);

  const advanced = await reminderRepository.findRuleById(rule.id);
  assert.equal(advanced.nextRunAt, '2026-10-21T03:40:00.000Z');
});

test('the 90 second tolerance boundary is inclusive', async (t) => {
  const { reminderUseCases } = await setup(t);
  await reminderUseCases.createRule(ruleInput());

  const result = await reminderUseCases.tick(new Date('2026-10-21T01:41:30.000Z'));
  assert.equal(result.intents.length, 1);
});

test('a slot more than 90 seconds late is not shown', async (t) => {
  const { reminderUseCases } = await setup(t);
  await reminderUseCases.createRule(ruleInput());

  const result = await reminderUseCases.tick(new Date('2026-10-21T01:41:31.000Z'));
  assert.equal(result.intents.length, 0);
});

test('snooze revives after 10 minutes and rejects a third snooze', async (t) => {
  const { reminderUseCases, reminderRepository } = await setup(t, { withPlant: true });
  const rule = await reminderUseCases.createRule(ruleInput());

  const ticked = await reminderUseCases.tick(new Date('2026-10-21T01:40:10.000Z'));
  const occurrenceId = ticked.intents[0].occurrence.id;

  const firstSnooze = await reminderUseCases.respond(
    occurrenceId,
    'snooze',
    new Date('2026-10-21T01:40:10.000Z')
  );
  assert.equal(firstSnooze.occurrence.status, 'snoozed');
  assert.equal(firstSnooze.occurrence.snoozeCount, 1);
  assert.equal(firstSnooze.occurrence.snoozedUntil, '2026-10-21T01:50:10.000Z');

  const afterFirstSnooze = await reminderRepository.findRuleById(rule.id);
  assert.equal(afterFirstSnooze.nextRunAt, '2026-10-21T02:40:00.000Z');

  const revived = await reminderUseCases.tick(new Date('2026-10-21T01:50:10.000Z'));
  assert.equal(revived.intents.length, 1);
  assert.equal(revived.intents[0].occurrence.status, 'pending');

  const secondSnooze = await reminderUseCases.respond(
    occurrenceId,
    'snooze',
    new Date('2026-10-21T01:50:10.000Z')
  );
  assert.equal(secondSnooze.occurrence.snoozeCount, 2);

  await reminderUseCases.tick(new Date('2026-10-21T02:00:10.000Z'));

  await assert.rejects(
    reminderUseCases.respond(occurrenceId, 'snooze', new Date('2026-10-21T02:00:10.000Z')),
    /最多稍后两次/
  );

  const confirmed = await reminderUseCases.respond(
    occurrenceId,
    'confirm',
    new Date('2026-10-21T02:00:10.000Z')
  );
  assert.equal(confirmed.occurrence.status, 'confirmed');
  assert.equal(confirmed.activity.recorded, true);
});

test('confirm writes one activity event and a repeated confirm is idempotent', async (t) => {
  const { db, reminderUseCases } = await setup(t, { withPlant: true });
  await reminderUseCases.createRule(ruleInput());

  const ticked = await reminderUseCases.tick(new Date('2026-10-21T01:40:10.000Z'));
  const occurrenceId = ticked.intents[0].occurrence.id;

  const confirmed = await reminderUseCases.respond(
    occurrenceId,
    'confirm',
    new Date('2026-10-21T01:40:10.000Z')
  );

  assert.equal(confirmed.occurrence.status, 'confirmed');
  assert.equal(confirmed.activity.recorded, true);
  assert.equal(confirmed.activity.event.eventType, 'water');
  assert.equal(confirmed.activity.event.growthPoints, 2);
  assert.equal(confirmed.activity.event.dedupeKey, `health:${occurrenceId}:confirmed`);

  const duplicate = await reminderUseCases.respond(
    occurrenceId,
    'confirm',
    new Date('2026-10-21T01:40:11.000Z')
  );
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.activity, null);

  const events = await db.all('SELECT * FROM activity_events');
  assert.equal(events.length, 1);

  const plant = await db.get("SELECT * FROM plant_instances WHERE status = 'growing'");
  assert.equal(plant.growth_score, 2);
});

test('stand confirmations produce sunlight while eye rest produces no activity', async (t) => {
  const { db, reminderUseCases } = await setup(t, { withPlant: true });
  await reminderUseCases.createRule(ruleInput({ type: 'stand' }));
  await reminderUseCases.createRule(ruleInput({ type: 'eyes' }));

  const ticked = await reminderUseCases.tick(new Date('2026-10-21T01:40:10.000Z'));
  assert.equal(ticked.intents.length, 2);

  const standIntent = ticked.intents.find((intent) => intent.rule.type === 'stand');
  const eyesIntent = ticked.intents.find((intent) => intent.rule.type === 'eyes');

  const stand = await reminderUseCases.respond(
    standIntent.occurrence.id,
    'confirm',
    new Date('2026-10-21T01:40:10.000Z')
  );
  assert.equal(stand.activity.event.eventType, 'sun');
  assert.equal(stand.activity.event.growthPoints, 2);

  const eyes = await reminderUseCases.respond(
    eyesIntent.occurrence.id,
    'confirm',
    new Date('2026-10-21T01:40:10.000Z')
  );
  assert.equal(eyes.occurrence.status, 'confirmed');
  assert.equal(eyes.activity, null);

  const events = await db.all('SELECT * FROM activity_events');
  assert.equal(events.length, 1);
});

test('skip closes the occurrence without producing growth', async (t) => {
  const { db, reminderUseCases } = await setup(t, { withPlant: true });
  await reminderUseCases.createRule(ruleInput());

  const ticked = await reminderUseCases.tick(new Date('2026-10-21T01:40:10.000Z'));
  const skipped = await reminderUseCases.respond(
    ticked.intents[0].occurrence.id,
    'skip',
    new Date('2026-10-21T01:40:10.000Z')
  );

  assert.equal(skipped.occurrence.status, 'skipped');
  assert.ok(skipped.occurrence.respondedAt);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM activity_events')).count, 0);
  const plant = await db.get("SELECT * FROM plant_instances WHERE status = 'growing'");
  assert.equal(plant.growth_score, 0);
});

test('updateRule resets the anchor and next run when the interval changes', async (t) => {
  const { clock, reminderUseCases, reminderRepository } = await setup(t);
  const rule = await reminderUseCases.createRule(ruleInput());

  clock.setNow('2026-10-21T01:15:00.000Z');
  const updated = await reminderUseCases.updateRule(rule.id, { intervalMinutes: 30 });

  assert.equal(updated.anchorMinutes, 555);
  assert.equal(updated.nextRunAt, '2026-10-21T01:45:00.000Z');
  assert.equal((await reminderRepository.findRuleById(rule.id)).intervalMinutes, 30);
});

test('pending occurrences are restored after restart only within ten minutes', async (t) => {
  const { db, reminderUseCases } = await setup(t);
  await reminderUseCases.createRule(ruleInput());

  const ticked = await reminderUseCases.tick(new Date('2026-10-21T01:40:10.000Z'));
  const occurrenceId = ticked.intents[0].occurrence.id;

  const recent = await reminderUseCases.resumePending(new Date('2026-10-21T01:45:00.000Z'));
  assert.equal(recent.length, 1);
  assert.equal(recent[0].occurrence.id, occurrenceId);

  await db.run(
    'UPDATE reminder_occurrences SET created_at = ? WHERE id = ?',
    ['2026-10-21T01:30:00.000Z', occurrenceId]
  );
  const expired = await reminderUseCases.resumePending(new Date('2026-10-21T01:45:00.000Z'));
  assert.equal(expired.length, 0);

  const stored = await db.get('SELECT status FROM reminder_occurrences WHERE id = ?', [occurrenceId]);
  assert.equal(stored.status, 'expired');
});

test('deleting a rule removes its pending occurrences', async (t) => {
  const { db, reminderUseCases, reminderRepository } = await setup(t);
  const rule = await reminderUseCases.createRule(ruleInput());
  await reminderUseCases.tick(new Date('2026-10-21T01:40:10.000Z'));

  const deleted = await reminderUseCases.deleteRule(rule.id);

  assert.equal(deleted, true);
  assert.equal(await reminderRepository.findRuleById(rule.id), null);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM reminder_occurrences')).count, 0);
});

test('tick cleans occurrences older than 30 days', async (t) => {
  const { clock, db, reminderUseCases, reminderRepository } = await setup(t);
  const rule = await reminderUseCases.createRule(ruleInput());

  const oldOccurrence = await reminderRepository.insertOccurrence({
    ruleId: rule.id,
    scheduledAt: '2026-09-20T01:40:00.000Z',
    status: 'expired',
    localDate: '2026-09-20',
    createdAt: '2026-09-20T01:40:00.000Z'
  });

  await reminderUseCases.tick(new Date('2026-10-21T01:40:10.000Z'));

  assert.equal(await reminderRepository.findOccurrenceById(oldOccurrence.id), null);
  const recent = await db.all('SELECT * FROM reminder_occurrences');
  assert.equal(recent.length, 1);
  assert.equal(recent[0].scheduled_at, '2026-10-21T01:40:00.000Z');
  assert.equal(clock.localDate(new Date('2026-10-21T01:40:00.000Z')), '2026-10-21');
});
