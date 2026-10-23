/**
 * 专注计时纯函数。
 * 计时基于已累计专注秒数 + 本段 started_at，不依赖每秒累加。
 */

const MIN_FOCUS_SECONDS = 15 * 60;
const BREAK_SECONDS = 5 * 60;
const FOCUS_PHASE = 'focus';
const BREAK_PHASE = 'break';

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('专注时间不是有效时间');
  }
  return date;
}

function normalizePlannedSeconds(plannedMinutes) {
  const minutes = Number(plannedMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error('专注时长必须大于 0');
  }
  const seconds = Math.round(minutes * 60);
  if (seconds < MIN_FOCUS_SECONDS) {
    throw new Error('有效专注时长不能少于 15 分钟');
  }
  return seconds;
}

function getFocusElapsedSeconds(session, now) {
  if (!session) return 0;
  const accumulated = Number(session.focusSeconds) || 0;
  if (session.status !== 'running') return accumulated;
  const startedAt = toDate(session.startedAt);
  const elapsed = (toDate(now).getTime() - startedAt.getTime()) / 1000;
  return accumulated + Math.max(0, Math.floor(elapsed));
}

function getFocusSummary(session, now) {
  if (!session) return null;
  const plannedSeconds = Number(session.plannedSeconds) || 0;
  const elapsedSeconds = Math.min(
    plannedSeconds,
    getFocusElapsedSeconds(session, now)
  );
  return {
    id: session.id,
    phase: session.phase || FOCUS_PHASE,
    status: session.status,
    plannedSeconds,
    elapsedSeconds,
    remainingSeconds: Math.max(0, plannedSeconds - elapsedSeconds),
    linkedTaskId: session.linkedTaskId || null,
    startedAt: session.startedAt,
    endedAt: session.endedAt || null
  };
}

module.exports = {
  MIN_FOCUS_SECONDS,
  BREAK_SECONDS,
  FOCUS_PHASE,
  BREAK_PHASE,
  normalizePlannedSeconds,
  getFocusElapsedSeconds,
  getFocusSummary
};
