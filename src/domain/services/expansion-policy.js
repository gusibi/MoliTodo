/**
 * 小院扩建与连续成长日（纯函数）。
 * 只在写入新的成长日时惰性结算，不依赖午夜定时任务。
 */

const EXPANSION_LEVELS = Object.freeze([
  {
    level: 1,
    regionId: 'initial-garden',
    capacity: 4,
    streakDays: 0,
    totalGrowthDays: 0
  },
  {
    level: 2,
    regionId: 'right-flower-bed',
    capacity: 10,
    streakDays: 10,
    totalGrowthDays: 15
  },
  {
    level: 3,
    regionId: 'back-woodland',
    capacity: 16,
    streakDays: 30,
    totalGrowthDays: 45
  },
  {
    level: 4,
    regionId: 'lawn-fence',
    capacity: 24,
    streakDays: 90,
    totalGrowthDays: 120
  },
  {
    level: 5,
    regionId: 'pond-plaza',
    capacity: 32,
    streakDays: 180,
    totalGrowthDays: 270
  }
].map(Object.freeze));

function parseLocalDate(localDate) {
  const [year, month, day] = localDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function shiftLocalDate(localDate, days) {
  const date = new Date(parseLocalDate(localDate) + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function getExpansionLevel(level) {
  return EXPANSION_LEVELS.find((entry) => entry.level === level) || null;
}

function getNextExpansion(currentLevel) {
  return EXPANSION_LEVELS.find((entry) => entry.level > currentLevel) || null;
}

/**
 * 新成长日到达时的连续天数推进。
 * 最后成长日是昨天则 +1；是今天则不变；更早则从 1 重新开始。
 */
function advanceGrowthStreak({
  currentStreak = 0,
  longestStreak = 0,
  totalGrowthDays = 0,
  lastGrowthDate = null,
  localDate
}) {
  let nextStreak;
  if (lastGrowthDate === localDate) {
    nextStreak = currentStreak || 1;
  } else if (lastGrowthDate === shiftLocalDate(localDate, -1)) {
    nextStreak = (currentStreak || 0) + 1;
  } else {
    nextStreak = 1;
  }

  return {
    currentStreak: nextStreak,
    longestStreak: Math.max(longestStreak || 0, nextStreak),
    totalGrowthDays: (totalGrowthDays || 0) + (lastGrowthDate === localDate ? 0 : 1)
  };
}

/**
 * 返回本次成长日之后满足条件、尚未解锁的等级。
 * 连续天数或累计成长日任一满足即可，conditionType 记录实际命中的通道。
 */
function evaluateExpansionUnlocks({ currentLevel = 1, currentStreak = 0, totalGrowthDays = 0 }) {
  return EXPANSION_LEVELS
    .filter((entry) => (
      entry.level > currentLevel
      && (currentStreak >= entry.streakDays || totalGrowthDays >= entry.totalGrowthDays)
    ))
    .map((entry) => ({
      ...entry,
      conditionType: currentStreak >= entry.streakDays ? 'streak' : 'total'
    }));
}

module.exports = {
  EXPANSION_LEVELS,
  shiftLocalDate,
  getExpansionLevel,
  getNextExpansion,
  advanceGrowthStreak,
  evaluateExpansionUnlocks
};
