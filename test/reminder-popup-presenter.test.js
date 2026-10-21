const test = require('node:test');
const assert = require('node:assert/strict');
const ReminderPopupPresenter = require('../src/main/reminder-popup-presenter');

function makeIntent(id) {
  return {
    occurrence: {
      id,
      scheduledAt: '2026-10-21T01:40:00.000Z',
      localDate: '2026-10-21',
      snoozeCount: 0
    },
    rule: { type: 'water' }
  };
}

function setup() {
  const shown = [];
  const windowManager = {
    showReminderPopup(intents) {
      shown.push(intents);
    },
    closeReminderPopup() {
      shown.push('closed');
    }
  };
  const calls = [];
  const reminderUseCases = {
    async respond(id, action) {
      calls.push(['respond', id, action]);
      return { occurrence: { id }, action };
    },
    async expireOccurrence(id) {
      calls.push(['expire', id]);
    }
  };
  let updated = 0;
  const clock = { now: () => new Date('2026-10-21T01:40:10.000Z') };
  const presenter = new ReminderPopupPresenter({
    windowManager,
    reminderUseCases,
    clock,
    expiryMs: 60 * 60 * 1000,
    onUpdated: () => { updated += 1; }
  });
  return { presenter, shown, calls, getUpdated: () => updated };
}

test('the presenter shows at most three intents and expires the oldest', async () => {
  const { presenter, shown, calls } = setup();

  await presenter.present([makeIntent(1), makeIntent(2), makeIntent(3), makeIntent(4)]);

  assert.deepEqual(calls, [['expire', 1]]);
  assert.deepEqual(
    shown.at(-1).map((intent) => intent.occurrenceId),
    [2, 3, 4]
  );

  presenter.dispose();
});

test('responding removes one row and keeps the rest visible', async () => {
  const { presenter, shown, calls, getUpdated } = setup();

  await presenter.present([makeIntent(1), makeIntent(2)]);
  await presenter.respond(2, 'confirm');

  assert.deepEqual(calls, [['respond', 2, 'confirm']]);
  assert.deepEqual(
    shown.at(-1).map((intent) => intent.occurrenceId),
    [1]
  );
  assert.equal(getUpdated(), 1);

  presenter.dispose();
});

test('expireAll expires every pending intent and closes the popup', async () => {
  const { presenter, shown, calls, getUpdated } = setup();

  await presenter.present([makeIntent(1), makeIntent(2)]);
  await presenter.expireAll();

  assert.deepEqual(calls, [['expire', 1], ['expire', 2]]);
  assert.equal(shown.at(-1), 'closed');
  assert.equal(getUpdated(), 1);

  presenter.dispose();
});
