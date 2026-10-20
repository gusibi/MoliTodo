/**
 * 在单个 SQLite 事务中执行工作单元。
 * 不支持嵌套事务；失败时回滚并保留原始错误。
 */
async function withTransaction(db, work) {
  if (typeof work !== 'function') {
    throw new TypeError('withTransaction 需要传入工作函数');
  }

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
}

module.exports = { withTransaction };
