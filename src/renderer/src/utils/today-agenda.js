/**
 * Today 综合视图协调规则 (Today Agenda Rules)
 *
 * 为 issue #14 的 Today 页面（Agenda + Future Calendar）提供页面级数据协调：
 * - 任务实例身份与合并：基础任务、重复系列头行、虚拟实例、物化实例按身份去重
 * - Agenda 分组：未计划 / 已逾期 / 待重新安排 / 今天 / 未来日期
 * - 日历日期点：主日期唯一计数
 * - 已加载日期范围的合并与缺口计算
 *
 * 时间语义全部来自渲染层规则 task-time-rules（#13），本模块不重新解释时间字段。
 * 纯函数，不依赖 Electron、数据库或任何运行时状态。
 *
 * 放在渲染层而非 src/domain：主进程使用 CommonJS，渲染层使用 ESM，
 * Vite 开发服务器无法直接转换 src/domain 下的 CommonJS 源码，
 * 因此渲染层页面协调逻辑统一放在 utils 下并复用 task-time-rules。
 */

import * as taskTime from './task-time-rules.js';

const VIRTUAL_ID_PREFIX = 'recurringTask_';

function isVirtualInstance(task) {
  return Boolean(
    task &&
    task.seriesId &&
    typeof task.id === 'string' &&
    task.id.startsWith(VIRTUAL_ID_PREFIX)
  );
}

/**
 * 重复系列头行：携带 recurrence 的真实任务行。
 * 头行代表系列的当前发生（保存进行状态），完成后由服务生成下一发生。
 */
function isSeriesHead(task) {
  return Boolean(task && task.recurrence && !isVirtualInstance(task));
}

/**
 * 系列归属键：实例用 seriesId，头行用 seriesId 或自身 id。
 */
function seriesKeyOf(task) {
  if (!task) return null;
  if (task.seriesId) return String(task.seriesId);
  if (isSeriesHead(task)) return String(task.id);
  return null;
}

/**
 * 头行自身发生的本地日期键：安排开始 > 截止 > occurrenceDate > 创建时间。
 * 与展开器的 baseDate（occurrenceDate || createdAt）对齐：
 * 有明确安排/截止时以业务日期为准，用于过滤早于首次发生的幻影虚拟实例。
 */
function headOccurrenceDateKey(task) {
  if (!task) return null;
  const main = taskTime.getMainDateInfo(task);
  if (main && main.date) return main.date;
  if (task.occurrenceDate) return taskTime.localDateKey(task.occurrenceDate);
  if (task.createdAt) return taskTime.localDateKey(task.createdAt);
  return null;
}

function occurrenceDateKeyOf(task) {
  if (!task || !task.occurrenceDate) return null;
  return taskTime.localDateKey(task.occurrenceDate);
}

/**
 * 实例身份键：同一实例在整个页面只保留一张卡片。
 * - 系列实例（物化或虚拟）：rec:<seriesId>:<本地发生日期>
 * - 系列头行：rec:<seriesKey>:<头行发生日期>（与其对应虚拟实例同键，头行胜出）
 * - 普通任务：task:<id>
 */
function instanceKey(task) {
  if (!task) return null;
  if (isSeriesHead(task)) {
    const dateKey = headOccurrenceDateKey(task);
    if (dateKey) return `rec:${seriesKeyOf(task)}:${dateKey}`;
    return `task:${task.id}`;
  }
  if (task.seriesId) {
    const dateKey = occurrenceDateKeyOf(task);
    if (dateKey) return `rec:${task.seriesId}:${dateKey}`;
  }
  return `task:${task.id}`;
}

/**
 * 合并页面任务世界：
 * - 基础任务（含物化实例与头行）优先；虚拟实例与基础任务同键时丢弃
 * - 同一系列 + 同一发生日期的基础行只保留一条：物化实例（有 occurrenceDate）覆盖头行
 * - 虚拟实例早于其系列头行的首次发生日期时视为幻影，丢弃
 * - status === 'deleted' 的行（删除标记）不进入世界
 *
 * @param {Object} input
 * @param {Array} input.baseTasks 全量真实任务行（含模板/头行/物化实例）
 * @param {Array} input.virtualInstances 已加载范围内的虚拟重复实例
 * @returns {{ instances: Array, droppedVirtual: number }}
 */
function mergeTaskWorld({ baseTasks = [], virtualInstances = [] }) {
  const activeBase = baseTasks.filter((task) => task && task.status !== 'deleted');

  // 基础行按实例身份去重：物化实例（有 occurrenceDate）优先于头行。
  // 不修改输入数组顺序，只在冲突时替换。
  const baseByKey = new Map();
  const baseOrder = [];
  for (const task of activeBase) {
    const key = instanceKey(task);
    if (!key) {
      baseOrder.push({ key: null, task });
      continue;
    }
    const existing = baseByKey.get(key);
    if (!existing) {
      baseByKey.set(key, task);
      baseOrder.push({ key, task });
    } else if (occurrenceDateKeyOf(task) && !occurrenceDateKeyOf(existing)) {
      // 物化实例覆盖头行：保持原位置，替换任务行
      baseByKey.set(key, task);
      const slot = baseOrder.find((entry) => entry.key === key);
      if (slot) slot.task = task;
    }
  }

  const baseKeys = new Set();
  const headFirstDate = new Map();
  for (const task of activeBase) {
    const key = instanceKey(task);
    if (key) baseKeys.add(key);
    if (isSeriesHead(task)) {
      const series = seriesKeyOf(task);
      const dateKey = headOccurrenceDateKey(task);
      if (series && dateKey) {
        const existing = headFirstDate.get(series);
        if (!existing || dateKey < existing) headFirstDate.set(series, dateKey);
      }
    }
  }

  const instances = baseOrder.map((entry) => entry.task);
  let droppedVirtual = 0;
  for (const virtual of virtualInstances) {
    if (!virtual || virtual.status === 'deleted') continue;
    const key = instanceKey(virtual);
    if (!key || baseKeys.has(key)) {
      droppedVirtual += 1;
      continue;
    }
    const series = seriesKeyOf(virtual);
    const dateKey = occurrenceDateKeyOf(virtual);
    const firstDate = series ? headFirstDate.get(series) : undefined;
    if (firstDate && dateKey && dateKey < firstDate) {
      // 早于系列首次发生的幻影实例
      droppedVirtual += 1;
      continue;
    }
    baseKeys.add(key);
    instances.push(virtual);
  }

  return { instances, droppedVirtual };
}

/**
 * 对实例做 Agenda 分组判定。
 * 优先级严格沿用 #13：截止逾期 > 过去安排 > 今天；doing 始终进入今天。
 *
 * 返回：
 * - { group: 'overdue' }
 * - { group: 'reschedule' }            过去安排未完成且未逾期
 * - { group: 'today', reason }          reason: 'mainDate' | 'deadline' | 'doing'
 * - { group: 'unscheduled' }
 * - { group: 'date', dateKey }          未来或浏览中的日期区
 * - { group: 'completed', dateKey }     已完成且有主日期
 * - { group: 'completedToday' }         已完成、无主日期、今天完成
 * - { group: 'history' }                已完成的历史任务（本页不展开）
 */
function classifyForAgenda(task, todayKey, now = new Date()) {
  if (!task) return { group: 'history' };

  if (taskTime.isCompleted(task)) {
    const main = taskTime.getMainDateInfo(task);
    if (main && main.date) return { group: 'completed', dateKey: main.date };
    const completedKey = task.completedAt ? taskTime.localDateKey(task.completedAt) : null;
    if (completedKey === todayKey) return { group: 'completedToday' };
    return { group: 'history' };
  }

  const planned = taskTime.hasSchedule(task) || taskTime.hasDeadline(task);
  if (!planned) {
    if (task.status === 'doing') return { group: 'today', reason: 'doing' };
    return { group: 'unscheduled' };
  }

  if (taskTime.isOverdue(task, now)) return { group: 'overdue' };

  if (taskTime.isPastScheduled(task, now)) return { group: 'reschedule' };

  const main = taskTime.getMainDateInfo(task);
  if (main && main.date === todayKey) return { group: 'today', reason: 'mainDate' };
  if (task.dueDate) {
    const dueKey = taskTime.isDateOnly(task.dueDate) ? task.dueDate.trim() : taskTime.localDateKey(task.dueDate);
    if (dueKey === todayKey) return { group: 'today', reason: 'deadline' };
  }
  if (task.status === 'doing') return { group: 'today', reason: 'doing' };

  if (main && main.date) return { group: 'date', dateKey: main.date };
  return { group: 'unscheduled' };
}

function compareExecTasks(a, b) {
  // 进行中的任务置顶（沿用现有 Today 视图行为），其余按 #13 日期内稳定排序
  const doingRank = (task) => (task.status === 'doing' ? 0 : 1);
  const doingDiff = doingRank(a) - doingRank(b);
  if (doingDiff !== 0) return doingDiff;
  return taskTime.compareTasksForDate(a, b);
}

/**
 * 构建 Agenda 模型。
 *
 * @param {Object} input
 * @param {Array} input.instances 合并后的任务实例（已按搜索/开关过滤）
 * @param {string} input.todayKey 本地日期键 YYYY-MM-DD
 * @param {string[]} input.browsingDates Agenda 已加载并应展示的日期键（升序，可含过去日期）
 * @param {boolean} input.showCompleted 是否展示已完成
 * @param {Date} [input.now] 评估用时钟（默认当前时间；测试与跨午夜刷新可注入）
 * @returns {Object} Agenda 分组与计数
 */
function buildAgendaModel({ instances = [], todayKey, browsingDates = [], showCompleted = false, now = new Date() }) {
  const unplanned = [];
  const overdue = [];
  const reschedule = [];
  const today = [];
  const byDateKey = new Map();
  const todayCompleted = [];

  for (const dateKey of browsingDates) {
    byDateKey.set(dateKey, { tasks: [], completedTasks: [], relocated: [] });
  }

  for (const task of instances) {
    const result = classifyForAgenda(task, todayKey, now);
    switch (result.group) {
      case 'unscheduled':
        unplanned.push(task);
        break;
      case 'overdue':
        overdue.push(task);
        break;
      case 'reschedule':
        reschedule.push(task);
        break;
      case 'today':
        today.push(task);
        break;
      case 'date': {
        const section = byDateKey.get(result.dateKey);
        if (section) section.tasks.push(task);
        break;
      }
      case 'completed': {
        if (!showCompleted) break;
        const section = byDateKey.get(result.dateKey);
        if (section) section.completedTasks.push(task);
        break;
      }
      case 'completedToday':
        if (showCompleted) todayCompleted.push(task);
        break;
      default:
        break;
    }
  }

  overdue.sort(compareExecTasks);
  reschedule.sort(compareExecTasks);
  today.sort(compareExecTasks);

  // 执行分组收纳的任务在日期区显示定位链接
  const relocatedGroups = [overdue, reschedule, today];
  for (const group of relocatedGroups) {
    for (const task of group) {
      const main = taskTime.getMainDateInfo(task);
      if (!main || !main.date || main.date === todayKey) continue;
      const section = byDateKey.get(main.date);
      if (section && !section.tasks.some((t) => instanceKey(t) === instanceKey(task))) {
        section.relocated.push(task);
      }
    }
  }

  const dateSections = [...byDateKey.entries()]
    .map(([dateKey, section]) => ({
      dateKey,
      tasks: [...section.tasks].sort(taskTime.compareTasksForDate),
      completedTasks: [...section.completedTasks].sort(taskTime.compareTasksForDate),
      relocated: section.relocated
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));

  return {
    unplanned,
    overdue,
    reschedule,
    today,
    todayCompleted,
    dateSections,
    todayPendingCount: overdue.length + reschedule.length + today.length
  };
}

/**
 * 构建日历日期点：每个实例只在其主日期计一个点，
 * 跨天任务只计开始日，仅提醒任务不产生日期点。
 * 已完成实例只在 showCompleted 时计入（弱化状态由 UI 表达）。
 *
 * @returns {Map<string, {count: number, completedCount: number, byList: Map<listId, number>, completedByList: Map<listId, number>}>}
 */
function buildCalendarDots({ instances = [], showCompleted = false }) {
  const dots = new Map();
  for (const task of instances) {
    const completed = taskTime.isCompleted(task);
    if (completed && !showCompleted) continue;
    const main = taskTime.getMainDateInfo(task);
    if (!main || !main.date) continue;
    let dot = dots.get(main.date);
    if (!dot) {
      dot = { count: 0, completedCount: 0, byList: new Map(), completedByList: new Map() };
      dots.set(main.date, dot);
    }
    dot.count += 1;
    if (completed) dot.completedCount += 1;
    const listId = task.listId === undefined || task.listId === null ? 0 : task.listId;
    dot.byList.set(listId, (dot.byList.get(listId) || 0) + 1);
    if (completed) {
      dot.completedByList.set(listId, (dot.completedByList.get(listId) || 0) + 1);
    }
  }
  return dots;
}

// ==================== 日期范围协调 ====================

function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToKey(date) {
  return taskTime.localDateKey(date);
}

function addDaysToKey(key, days) {
  const date = keyToDate(key);
  date.setDate(date.getDate() + days);
  return dateToKey(date);
}

/**
 * 合并日期区间为不相交的升序区间列表。
 */
function mergeDayRanges(ranges = []) {
  const valid = ranges
    .filter((r) => r && r.startKey && r.endKey && r.startKey <= r.endKey)
    .map((r) => ({ startKey: r.startKey, endKey: r.endKey }))
    .sort((a, b) => (a.startKey < b.startKey ? -1 : a.startKey > b.startKey ? 1 : 0));
  const merged = [];
  for (const range of valid) {
    const last = merged[merged.length - 1];
    if (last && range.startKey <= addDaysToKey(last.endKey, 1)) {
      if (range.endKey > last.endKey) last.endKey = range.endKey;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function isKeyCovered(mergedRanges, key) {
  return mergedRanges.some((r) => key >= r.startKey && key <= r.endKey);
}

/**
 * 计算 [fromKey, toKey] 内尚未加载、需要补齐的日期子区间。
 */
function missingDaySpans(loadedRanges = [], fromKey, toKey) {
  if (!fromKey || !toKey || fromKey > toKey) return [];
  const merged = mergeDayRanges(loadedRanges);
  const spans = [];
  let cursor = fromKey;
  while (cursor <= toKey) {
    if (isKeyCovered(merged, cursor)) {
      cursor = addDaysToKey(cursor, 1);
      continue;
    }
    const span = { startKey: cursor, endKey: cursor };
    cursor = addDaysToKey(cursor, 1);
    while (cursor <= toKey && !isKeyCovered(merged, cursor)) {
      span.endKey = cursor;
      cursor = addDaysToKey(cursor, 1);
    }
    spans.push(span);
  }
  return spans;
}

/**
 * 枚举日期键列表（含首尾）。
 */
function enumerateDateKeys(fromKey, toKey) {
  const keys = [];
  if (!fromKey || !toKey || fromKey > toKey) return keys;
  let cursor = fromKey;
  while (cursor <= toKey) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return keys;
}

export {
  VIRTUAL_ID_PREFIX,
  isVirtualInstance,
  isSeriesHead,
  seriesKeyOf,
  headOccurrenceDateKey,
  occurrenceDateKeyOf,
  instanceKey,
  mergeTaskWorld,
  classifyForAgenda,
  buildAgendaModel,
  buildCalendarDots,
  mergeDayRanges,
  missingDaySpans,
  enumerateDateKeys,
  addDaysToKey,
  keyToDate,
  dateToKey
};
