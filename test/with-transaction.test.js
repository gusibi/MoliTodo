const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { withTransaction } = require('../src/infrastructure/persistence/with-transaction');

async function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-tx-test-'));
  const db = await open({ filename: path.join(dir, 'tasks.db'), driver: sqlite3.Database });
  await db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
  t.after(async () => {
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return db;
}

test('withTransaction commits when the work succeeds', async (t) => {
  const db = await setup(t);

  const result = await withTransaction(db, async () => {
    await db.run("INSERT INTO items (name) VALUES ('a')");
    await db.run("INSERT INTO items (name) VALUES ('b')");
    return 'done';
  });

  assert.equal(result, 'done');
  const rows = await db.all('SELECT name FROM items ORDER BY id');
  assert.deepEqual(rows, [{ name: 'a' }, { name: 'b' }]);
});

test('withTransaction rolls back every write and preserves the original error', async (t) => {
  const db = await setup(t);
  const originalError = new Error('boom');

  await assert.rejects(
    withTransaction(db, async () => {
      await db.run("INSERT INTO items (name) VALUES ('rolled-back')");
      throw originalError;
    }),
    (error) => error === originalError
  );

  const rows = await db.all('SELECT name FROM items');
  assert.deepEqual(rows, []);
});

test('withTransaction leaves the connection usable after a rollback', async (t) => {
  const db = await setup(t);

  await assert.rejects(
    withTransaction(db, async () => {
      await db.run("INSERT INTO items (name) VALUES ('rolled-back')");
      throw new Error('boom');
    })
  );

  await withTransaction(db, async () => {
    await db.run("INSERT INTO items (name) VALUES ('after-rollback')");
  });

  const rows = await db.all('SELECT name FROM items');
  assert.deepEqual(rows, [{ name: 'after-rollback' }]);
});
