/**
 * 任务时间规则 (Task Time Rules)
 *
 * 统一的任务时间模型，供应用层与渲染层共享：
 * - 安排 Schedule：可选的计划开始 / 计划结束（必须包含具体时刻）
 * - 截止 Deadline：只有日期，或日期 + 具体时刻
 * - 提醒 Reminder：附属设置，策略决定通知触发时间
 *
 * 该模块只包含纯函数，不依赖 Electron、数据库或任何运行时状态。
 */

const REMINDER_MODES = {
  DEFAULT: 'default',
  DISABLED: 'disabled',
  RELATIVE: 'relative',
  ABSOLUTE: 'absolute'
};

const RELATIVE_REMINDER_PRESETS = [0, 5, 10, 30];

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * 本地时区日期键 YYYY-MM-DD
 */
function localDateKey(value) {
  if (isDateOnly(value)) return value.trim();
  const date = toDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function localTimeKey(value) {
  const date = toDate(value);
  if (!date) return null;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isDateOnly(value) {
  return typeof value === 'string' && DATE_ONLY_PATTERN.test(value.trim());
}

/**
 * 两个时间点之间相差的本地日历天数（to 相对 from）。
 */
function localDayOffset(from, to) {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return 0;
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endMidnight.getTime() - startMidnight.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeDueTime(value) {
  if (value === null || value === undefined || value === '') return null;
  const match = TIME_PATTERN.exec(String(value).trim());
  if (!match) {
    throw new Error('截止时间格式无效，应为 HH:mm');
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error('截止时间格式无效，应为 HH:mm');
  }
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * 规范化截止日期/时间输入。
 * - 接受 YYYY-MM-DD 或完整 ISO 时间字符串（旧数据兼容）。
 * - 完整 ISO 会按本地时区提取日期；显式 dueTime 优先，否则保留 ISO 表达的时间。
 * - 不允许只有时间没有日期。
 */
function normalizeDeadline(dueDate, dueTime) {
  const hasDate = dueDate !== null && dueDate !== undefined && dueDate !== '';
  const hasTime = dueTime !== null && dueTime !== undefined && dueTime !== '';

  if (!hasDate) {
    if (hasTime) {
      throw new Error('截止时间必须搭配截止日期');
    }
    return { dueDate: null, dueTime: null };
  }

  if (isDateOnly(dueDate)) {
    return { dueDate: dueDate.trim(), dueTime: normalizeDueTime(dueTime) };
  }

  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]/.test(dueDate.trim())) {
    throw new Error('截止日期格式无效');
  }

  const parsed = toDate(dueDate);
  if (!parsed) {
    throw new Error('截止日期格式无效');
  }

  return {
    dueDate: localDateKey(parsed),
    dueTime: hasTime ? normalizeDueTime(dueTime) : localTimeKey(parsed),
    legacy: true
  };
}

/**
 * 截止时间点的逾期边界：
 * - 日期 + 时间：该时刻
 * - 只有日期：本地时区次日 00:00
 */
function deadlineBoundary(dueDate, dueTime) {
  if (!dueDate) return null;
  try {
    let dateStr = dueDate;
    let timeStr = dueTime;
    if (!isDateOnly(dateStr)) {
      const normalized = normalizeDeadline(dateStr, dueTime);
      dateStr = normalized.dueDate;
      timeStr = normalized.dueTime;
    }
    if (!dateStr) return null;

    const normalizedTime = normalizeDueTime(timeStr);
    if (normalizedTime) {
      return toDate(`${dateStr}T${normalizedTime}:00`);
    }
    const startOfDay = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(startOfDay.getTime())) return null;
    startOfDay.setDate(startOfDay.getDate() + 1);
    return startOfDay;
  } catch (error) {
    return null;
  }
}

function isCompleted(task) {
  return Boolean(task) && (task.status === 'done' || task.completed === true);
}

/**
 * 是否已逾期。已完成任务不属于逾期。
 */
function isOverdue(task, now = new Date()) {
  if (!task || isCompleted(task)) return false;
  const boundary = deadlineBoundary(task.dueDate, task.dueTime);
  if (!boundary) return false;
  return toDate(now).getTime() >= boundary.getTime();
}

function parseOptionalInstant(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  if (isDateOnly(value)) {
    throw new Error(`${fieldName} 必须包含具体时刻`);
  }
  const date = toDate(value);
  if (!date) {
    throw new Error(`${fieldName} 必须是合法的 ISO 8601 时间`);
  }
  return date;
}

/**
 * 规范化安排（开始/结束）输入。结束不得早于开始，且不能单独存在。
 */
function normalizeSchedule(scheduledStartAt, scheduledEndAt) {
  const start = parseOptionalInstant(scheduledStartAt, '计划开始时间');
  const end = parseOptionalInstant(scheduledEndAt, '计划结束时间');

  if (end && !start) {
    throw new Error('设置计划结束时间前必须先设置计划开始时间');
  }
  if (start && end && end.getTime() < start.getTime()) {
    throw new Error('计划结束时间不能早于计划开始时间');
  }

  return { scheduledStartAt: start, scheduledEndAt: end };
}

/**
 * 规范化提醒策略。
 * - null / undefined：未设置策略（默认，不自动提醒；旧数据由 reminderTime 解释为绝对提醒）
 * - default：显式默认（不自动提醒）
 * - disabled：显式关闭
 * - relative：相对开始提前 N 分钟，需要 scheduledStartAt
 * - absolute：由 reminderTime 决定
 *
 * 显式非绝对策略与非空 reminderTime 同时传入视为歧义输入。
 */
function normalizeReminderPolicy(policy, reminderTime = null, scheduledStartAt = null) {
  if (policy === null || policy === undefined) return null;

  const hasReminderTime = reminderTime !== null && reminderTime !== undefined && reminderTime !== '';
  const mode = policy.mode || policy.type;

  if (mode === REMINDER_MODES.DEFAULT) {
    if (hasReminderTime) {
      throw new Error('默认提醒策略不能携带提醒时间');
    }
    return { mode: REMINDER_MODES.DEFAULT, minutesBefore: null };
  }

  if (mode === REMINDER_MODES.DISABLED) {
    if (hasReminderTime) {
      throw new Error('关闭提醒时不能携带提醒时间');
    }
    return { mode: REMINDER_MODES.DISABLED, minutesBefore: null };
  }

  if (mode === REMINDER_MODES.RELATIVE) {
    if (hasReminderTime) {
      throw new Error('相对提醒策略不能同时传入绝对提醒时间');
    }
    const start = toDate(scheduledStartAt);
    if (!start) {
      throw new Error('相对提醒需要先设置计划开始时间');
    }
    const minutes = Number(policy.minutesBefore);
    if (!Number.isInteger(minutes) || minutes < 0) {
      throw new Error('相对提醒分钟数必须是非负整数');
    }
    return { mode: REMINDER_MODES.RELATIVE, minutesBefore: minutes };
  }

  if (mode === REMINDER_MODES.ABSOLUTE) {
    if (!hasReminderTime) {
      throw new Error('绝对提醒需要提供提醒时间');
    }
    return { mode: REMINDER_MODES.ABSOLUTE, minutesBefore: null };
  }

  throw new Error('未知的提醒策略');
}

/**
 * 计算提醒触发时间。返回 Date 或 null。
 */
function deriveReminderTime(task) {
  if (!task) return null;
  const policy = task.reminderPolicy;

  if (policy && policy.mode === REMINDER_MODES.ABSOLUTE) {
    return toDate(task.reminderTime);
  }

  if (policy && policy.mode === REMINDER_MODES.RELATIVE) {
    const start = toDate(task.scheduledStartAt);
    if (!start) return null;
    const minutes = Number(policy.minutesBefore) || 0;
    return new Date(start.getTime() - minutes * 60 * 1000);
  }

  if (policy) {
    return null;
  }

  // 无策略时，reminderTime 按绝对提醒解释（旧数据兼容）
  return toDate(task.reminderTime);
}

function isLegacyRecurringDateInstance(task) {
  return Boolean(task && task.seriesId && task.occurrenceDate && !toDate(task.scheduledStartAt));
}

function hasSchedule(task) {
  if (!task) return false;
  if (toDate(task.scheduledStartAt)) return true;
  return isLegacyRecurringDateInstance(task);
}

function hasDeadline(task) {
  return Boolean(task && task.dueDate);
}

/**
 * 主日期：优先安排开始日期；没有安排时使用截止日期；旧日期型重复实例使用 occurrenceDate。
 * 只有提醒不产生主日期。
 */
function getMainDateInfo(task) {
  if (!task) return null;

  const start = toDate(task.scheduledStartAt);
  if (start) {
    return { date: localDateKey(start), kind: 'schedule', at: start };
  }

  if (isLegacyRecurringDateInstance(task)) {
    const occurrence = toDate(task.occurrenceDate);
    return { date: localDateKey(occurrence), kind: 'schedule', at: occurrence, legacyRecurrence: true };
  }

  if (task.dueDate) {
    const dateKey = isDateOnly(task.dueDate) ? task.dueDate.trim() : localDateKey(task.dueDate);
    const due = dateKey ? toDate(`${dateKey}T00:00:00`) : null;
    if (due) {
      return { date: dateKey, kind: 'deadline', at: due };
    }
  }

  return null;
}

function isTaskPlanned(task) {
  if (!task || isCompleted(task)) return false;
  return hasSchedule(task) || hasDeadline(task);
}

function isTaskInbox(task) {
  if (!task) return false;
  return task.status === 'todo' && !hasSchedule(task) && !hasDeadline(task);
}

function isTaskUnscheduled(task) {
  if (!task || isCompleted(task)) return false;
  return !hasSchedule(task) && !hasDeadline(task);
}

function scheduleStartDate(task) {
  const start = toDate(task && task.scheduledStartAt);
  if (start) return start;
  if (isLegacyRecurringDateInstance(task)) return toDate(task.occurrenceDate);
  return null;
}

/**
 * 过去日期仍未完成的安排。
 */
function isPastScheduled(task, now = new Date()) {
  if (!task || isCompleted(task)) return false;
  const start = scheduleStartDate(task);
  if (!start) return false;
  return localDateKey(start) < localDateKey(now);
}

/**
 * 今日任务：今天有安排、今天有截止、截止已逾期、过去安排未完成，或正在进行中。
 */
function isTaskToday(task, now = new Date()) {
  if (!task || isCompleted(task)) return false;

  const todayKey = localDateKey(now);
  const main = getMainDateInfo(task);
  if (main && main.date === todayKey) return true;

  if (hasDeadline(task) && localDateKey(task.dueDate) === todayKey) return true;
  if (isOverdue(task, now)) return true;
  if (isPastScheduled(task, now)) return true;
  if (task.status === 'doing') return true;

  return false;
}

function belongsToCategory(task, category) {
  switch (category) {
    case 'all':
      return true;
    case 'inbox':
      return isTaskInbox(task);
    case 'today':
      return isTaskToday(task);
    case 'doing':
      return Boolean(task) && task.status === 'doing';
    case 'paused':
      return Boolean(task) && task.status === 'paused';
    case 'planned':
      return isTaskPlanned(task);
    case 'unscheduled':
      return isTaskUnscheduled(task);
    case 'completed':
      return isCompleted(task);
    default:
      return false;
  }
}

/**
 * 同一日期内的稳定排序：有安排的按开始时间升序；只有截止的排在其后，
 * 有具体时刻的按时间升序，无时刻的随后；并列使用创建时间与 ID 兜底。
 */
function compareTasksForDate(a, b) {
  const rank = (task) => (hasSchedule(task) ? 0 : 1);

  const rankDiff = rank(a) - rank(b);
  if (rankDiff !== 0) return rankDiff;

  const sortValue = (task) => {
    if (hasSchedule(task)) {
      const start = scheduleStartDate(task);
      return start ? start.getTime() : Number.MAX_SAFE_INTEGER;
    }
    if (task.dueDate) {
      const boundary = deadlineBoundary(task.dueDate, task.dueTime);
      if (task.dueTime && boundary) {
        return boundary.getTime() - 24 * 60 * 60 * 1000;
      }
      return Number.MAX_SAFE_INTEGER;
    }
    return Number.MAX_SAFE_INTEGER;
  };

  const valueDiff = sortValue(a) - sortValue(b);
  if (valueDiff !== 0) return valueDiff;

  const createdA = toDate(a.createdAt);
  const createdB = toDate(b.createdAt);
  if (createdA && createdB && createdA.getTime() !== createdB.getTime()) {
    return createdA.getTime() - createdB.getTime();
  }

  return String(a.id).localeCompare(String(b.id));
}

module.exports = {
  REMINDER_MODES,
  RELATIVE_REMINDER_PRESETS,
  toDate,
  toIso,
  localDateKey,
  localTimeKey,
  isDateOnly,
  localDayOffset,
  normalizeDueTime,
  normalizeDeadline,
  deadlineBoundary,
  isOverdue,
  normalizeSchedule,
  normalizeReminderPolicy,
  deriveReminderTime,
  hasSchedule,
  hasDeadline,
  isLegacyRecurringDateInstance,
  getMainDateInfo,
  isTaskPlanned,
  isTaskInbox,
  isTaskUnscheduled,
  isPastScheduled,
  isTaskToday,
  belongsToCategory,
  compareTasksForDate,
  isCompleted
};
