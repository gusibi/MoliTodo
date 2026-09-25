const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SqliteTaskRepository = require('../src/infrastructure/persistence/sqlite-task-repository');
const Task = require('../src/domain/entities/task');
const TaskService = require('../src/domain/services/task-service');

// 软删除（垃圾桶）语义：
// - deleteTask 只标记 deleted_at，所有活跃查询不再返回，findDeleted 返回
// - restoreTask 清除标记后回到活跃列表
// - purgeTask 真正删除，findDeleted 也不再返回
// - 重复任务内部清理（deleteRecurringSeries 等）走仓储硬删除，不进垃圾桶

// 仓储与迁移日志静默
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
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

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molitodo-soft-delete-'));
  return path.join(dir, 'tasks.db');
}

async function setup() {
  const repo = new SqliteTaskRepository(tempDbPath());
  await repo.initialize();
  const taskService = new TaskService(repo);
  return { repo, taskService };
}

function makeTask(id, content) {
  return new Task({ id, content, status: 'todo', createdAt: new Date(2026, 8, 1, 9, 0) });
}

test('软删除后活跃查询不再返回，垃圾桶可查、可恢复', async (t) => {
  const { repo, taskService } = await setup();
  t.after(() => repo.close());

  await taskService.createTaskInList('活着的任务', 0, null, {});
  const toDelete = await taskService.createTaskInList('进垃圾桶的任务', 0, null, {});

  assert.equal((await taskService.deleteTask(toDelete.id)), true);

  // 活跃查询全部排除软删除
  const all = await repo.findAll();
  assert.deepEqual(all.map((task) => task.content), ['活着的任务']);
  assert.equal((await repo.findIncomplete()).length, 1);
  assert.equal((await repo.findCompleted()).length, 0);
  assert.equal(await repo.getIncompleteCount(), 1);
  assert.deepEqual((await repo.searchTasks('垃圾桶')).map((task) => task.id), []);

  // findById 仍可命中（恢复需要），deleted_at 已写入
  const deleted = await repo.findById(toDelete.id);
  assert.ok(deleted.deletedAt instanceof Date);

  // 垃圾桶列表按删除时间倒序
  const trash = await repo.findDeleted();
  assert.deepEqual(trash.map((task) => task.id), [toDelete.id]);

  // 恢复后回到活跃列表，标记清空
  const restored = await taskService.restoreTask(toDelete.id);
  assert.equal(restored.deletedAt, null);
  assert.equal((await repo.findAll()).length, 2);
  assert.equal((await repo.findDeleted()).length, 0);
});

test('purgeTask 彻底删除后数据不可再查', async (t) => {
  const { repo, taskService } = await setup();
  t.after(() => repo.close());

  const created = await taskService.createTaskInList('将被彻底删除', 0, null, {});
  await taskService.deleteTask(created.id);
  assert.equal((await repo.findDeleted()).length, 1);

  assert.equal(await taskService.purgeTask(created.id), true);
  assert.equal(await repo.findById(created.id), null);
  assert.equal((await repo.findDeleted()).length, 0);
  assert.equal((await repo.findAll()).length, 0);
});

test('deleteRecurringSeries 的系列清理是硬删除，不进垃圾桶', async (t) => {
  const { repo, taskService } = await setup();
  t.after(() => repo.close());

  const series = await taskService.createTaskInList('重复系列', 0, null, {
    recurrence: { type: 'daily', interval: 1 }
  });
  await taskService.deleteRecurringSeries(series.id);

  assert.equal(await repo.findById(series.id), null);
  assert.equal((await repo.findDeleted()).length, 0);
});

test('实体标记：markDeleted / restoreFromTrash 往返', () => {
  const task = makeTask('task-entity', '实体任务');
  assert.equal(task.deletedAt, null);

  task.markDeleted();
  assert.ok(task.deletedAt instanceof Date);

  task.restoreFromTrash();
  assert.equal(task.deletedAt, null);
});
