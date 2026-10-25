/**
 * 健康提醒槽位计算（纯函数）。
 * 时间来自注入的 clock，不依赖 Electron、SQLite 或进程内定时器。
 */

const PRESET_INTERVALS = Object.freeze([10, 20, 30, 45, 60, 90]);

function normalizeIntervalMinutes(value) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 10) {
    throw new Error('提醒间隔不能小于 10 分钟');
  }
  if (!PRESET_INTERVALS.includes(minutes) && minutes % 10 !== 0) {
    throw new Error('提醒间隔必须是 10 分钟步进或预设值');
  }
  return minutes;
}

function parseTimeOfDay(value, fieldName = '时间') {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`${fieldName} 必须是 HH:MM`);
  }
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    throw new Error(`${fieldName} 超出范围`);
  }
  return hours * 60 + minutes;
}

function normalizeWeekdays(value) {
  if (value === null || value === undefined || value === '' || value === '[]') {
    return [];
  }
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch (error) {
      throw new Error('weekdays 必须是 JSON 数组');
    }
  }
  if (!Array.isArray(list)) {
    throw new Error('weekdays 必须是数组');
  }
  const days = [...new Set(list.map(Number))].sort((a, b) => a - b);
  for (const day of days) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new Error('weekdays 只能包含 0-6');
    }
  }
  return days;
}

function localDateParts(localDate) {
  const [year, month, day] = localDate.split('-').map(Number);
  return { year, month, day };
}

function addDays(localDate, days) {
  const { year, month, day } = localDateParts(localDate);
  const date = new Date(Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(localDate) {
  const { year, month, day } = localDateParts(localDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function localInstant(localDate, minutesOfDay, clock) {
  const { year, month, day } = localDateParts(localDate);
  const base = Date.UTC(
    year,
    month - 1,
    day,
    Math.floor(minutesOfDay / 60),
    minutesOfDay % 60
  );
  const firstOffset = clock.tzOffset(new Date(base));
  let instant = new Date(base - firstOffset * 60 * 1000);
  const correctedOffset = clock.tzOffset(instant);
  if (correctedOffset !== firstOffset) {
    instant = new Date(base - correctedOffset * 60 * 1000);
  }
  return instant;
}

/**
 * 返回严格晚于 after（且晚于 pauseUntil）的第一个槽位。
 * 每天从 anchorMinutes 重新排槽，窗口按 [start, end) 处理。
 */
function computeNextRunAt(rule, after, clock) {
  if (!(after instanceof Date) || Number.isNaN(after.getTime())) {
    throw new TypeError('computeNextRunAt 需要有效的 after');
  }

  const interval = normalizeIntervalMinutes(rule.intervalMinutes);
  const anchorMinutes = Number(rule.anchorMinutes);
  if (!Number.isInteger(anchorMinutes) || anchorMinutes < 0 || anchorMinutes > 1439) {
    throw new Error('anchorMinutes 必须在 0-1439');
  }

  const windowStart = parseTimeOfDay(rule.windowStart, 'windowStart');
  const windowEnd = parseTimeOfDay(rule.windowEnd, 'windowEnd');
  if (windowStart >= windowEnd) {
    throw new Error('提醒窗口必须 start < end');
  }

  const weekdays = normalizeWeekdays(rule.weekdays);
  let pauseUntilMs = Number.NEGATIVE_INFINITY;
  if (rule.pauseUntil) {
    const pauseUntil = new Date(rule.pauseUntil);
    if (Number.isNaN(pauseUntil.getTime())) {
      throw new Error('pauseUntil 不是有效时间');
    }
    pauseUntilMs = pauseUntil.getTime();
  }

  const afterMs = Math.max(after.getTime(), pauseUntilMs);
  const firstDate = clock.localDate(new Date(afterMs));

  for (let dayOffset = 0; dayOffset < 370; dayOffset += 1) {
    const localDate = addDays(firstDate, dayOffset);
    if (weekdays.length > 0 && !weekdays.includes(weekdayOf(localDate))) {
      continue;
    }

    // 锚点落在窗口结束之后（例如傍晚才创建 09:00–18:00 的规则）时，
    // 若继续从锚点向后排槽，每天都会排到窗口之外，导致 nextRunAt 永远为空。
    // 这种情况下把槽位重排到窗口起点；其余情况从锚点本身开始，
    // 保证跨天后锚点时刻也能再次触发。
    const slotBase = anchorMinutes < windowEnd ? anchorMinutes : windowStart;

    for (let minute = slotBase; minute < windowEnd; minute += interval) {
      if (minute < windowStart) continue;
      const instant = localInstant(localDate, minute, clock);
      if (instant.getTime() > afterMs) {
        return instant;
      }
    }
  }

  return null;
}

/**
 * 计算创建/修改规则时的锚点分钟数。
 * created：当前时刻；hour：当前整点向下取整。
 */
function getAnchorMinutes(anchorMode, instant, clock) {
  if (anchorMode !== 'created' && anchorMode !== 'hour') {
    throw new Error('anchorMode 只能是 created 或 hour');
  }
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new TypeError('getAnchorMinutes 需要有效的 instant');
  }
  const local = new Date(instant.getTime() + clock.tzOffset(instant) * 60 * 1000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return anchorMode === 'hour' ? Math.floor(minutes / 60) * 60 : minutes;
}

module.exports = {
  PRESET_INTERVALS,
  normalizeIntervalMinutes,
  parseTimeOfDay,
  normalizeWeekdays,
  addDays,
  weekdayOf,
  computeNextRunAt,
  getAnchorMinutes
};
