/**
 * 在单个 SQLite 事务中执行工作单元。
 * 不支持嵌套事务；同一连接上的并发调用会依次排队，
 * 避免健康提醒心跳与专注心跳同时开启事务时触发
 * “cannot start a transaction within a transaction”。
 */

const transactionQueues = new WeakMap();

async function withTransaction(db, work) {
  if (typeof work !== 'function') {
    throw new TypeError('withTransaction 需要传入工作函数');
  }

  const previous = transactionQueues.get(db) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  transactionQueues.set(db, queued);

  await previous;

  try {
    await db.exec('BEGIN IMMEDIATE');

    try {
      const result = await work();
      await db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        await db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('事务回滚失败:', rollbackError);
      }
      throw error;
    }
  } finally {
    release();
    if (transactionQueues.get(db) === queued) {
      transactionQueues.delete(db);
    }
  }
}

module.exports = { withTransaction };
