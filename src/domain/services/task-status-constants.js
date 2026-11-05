/**
 * 任务状态词汇表（单一来源）。
 * 任务实体、状态日志、统计与渲染层共用这一份定义；
 * 历史数据中出现过 'pause'，读取时通过别名归一化为 'paused'。
 */

const TASK_STATUSES = Object.freeze({
  TODO: 'todo',
  DOING: 'doing',
  PAUSED: 'paused',
  DONE: 'done'
});

const VALID_TASK_STATUSES = Object.freeze(Object.values(TASK_STATUSES));

// 历史版本曾用 'pause' 表示暂停状态，读取旧数据时归一化
const LEGACY_STATUS_ALIASES = Object.freeze({
  pause: TASK_STATUSES.PAUSED
});

function normalizeTaskStatus(status) {
  if (status === null || status === undefined) return status;
  return LEGACY_STATUS_ALIASES[status] || status;
}

module.exports = {
  TASK_STATUSES,
  VALID_TASK_STATUSES,
  LEGACY_STATUS_ALIASES,
  normalizeTaskStatus
};
