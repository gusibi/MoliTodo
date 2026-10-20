/**
 * 主进程时钟。
 * 只提供当前时间、本地自然日和时区偏移，业务槽位计算不放在这里。
 */
function toDate(instant) {
  if (instant instanceof Date) return instant;
  return new Date(instant);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createClock({ now = () => new Date() } = {}) {
  return {
    now() {
      return new Date(now());
    },

    localDate(instant) {
      return formatLocalDate(toDate(instant === undefined ? now() : instant));
    },

    // 返回相对 UTC 的分钟偏移，东半球为正（UTC+8 => 480）。
    tzOffset(instant) {
      return -toDate(instant === undefined ? now() : instant).getTimezoneOffset();
    }
  };
}

module.exports = { createClock, clock: createClock() };
