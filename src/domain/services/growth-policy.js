/**
 * 成长策略（纯函数）。
 * 不依赖 Electron、SQLite 或渲染层；时间与数值规则由调用方注入。
 */

const DEFAULT_GROWTH_POLICY = Object.freeze({
  events: {
    focus: {
      growthPoints: 1,
      dailyLimit: 10,
      dailyCounter: 'focusCount',
      totalCounter: 'focusCount'
    },
    water: {
      growthPoints: 2,
      dailyLimit: 3,
      dailyCounter: 'waterCount',
      totalCounter: 'healthCount'
    },
    sun: {
      growthPoints: 2,
      dailyLimit: 3,
      dailyCounter: 'sunCount',
      totalCounter: 'healthCount'
    }
  },
  growthDay: {
    focusCount: 1,
    healthConfirmations: 2
  },
  stages: [
    { minScore: 15, stage: 'mature' },
    { minScore: 10, stage: 'sapling' },
    { minScore: 5, stage: 'sprout' },
    { minScore: 0, stage: 'seed' }
  ],
  maturityScore: 15,
  matureSeedYield: 1
});

const DEFAULT_MILESTONES = Object.freeze([
  { id: 'first-sprout', metric: 'focusCount', threshold: 1 },
  { id: 'seven-day-garden', metric: 'growthDayCount', threshold: 7 },
  { id: 'hydration-start', metric: 'healthCount', threshold: 30 },
  { id: 'garden-begins', metric: 'growthDayCount', threshold: 30 },
  { id: 'half-month-streak', metric: 'healthCount', threshold: 150 },
  { id: 'focus-apprentice', metric: 'focusCount', threshold: 60 },
  { id: 'season-garden', metric: 'growthDayCount', threshold: 60 },
  { id: 'healthy-life', metric: 'healthCount', threshold: 300 },
  { id: 'hundred-day-garden', metric: 'growthDayCount', threshold: 100 },
  { id: 'focus-advanced', metric: 'focusCount', threshold: 120 },
  { id: 'half-year-garden', metric: 'growthDayCount', threshold: 150 },
  { id: 'focus-expert', metric: 'focusCount', threshold: 180 },
  { id: 'hydration-master', metric: 'healthCount', threshold: 600 },
  { id: 'deep-gardener', metric: 'growthDayCount', threshold: 210 },
  { id: 'focus-master', metric: 'focusCount', threshold: 240 },
  { id: 'annual-gardener', metric: 'growthDayCount', threshold: 300 }
]);

const DEFAULT_CATALOG = Object.freeze({ version: 1, milestones: DEFAULT_MILESTONES });

function createInitialState() {
  return {
    plant: null,
    daily: {
      localDate: null,
      focusCount: 0,
      waterCount: 0,
      sunCount: 0,
      totalGrowth: 0
    },
    totals: {
      focusCount: 0,
      healthCount: 0
    },
    growthDays: [],
    unlockedMilestones: []
  };
}

function getStage(growthScore, policy = DEFAULT_GROWTH_POLICY) {
  const score = Math.max(0, Number(growthScore) || 0);
  for (const entry of policy.stages) {
    if (score >= entry.minScore) return entry.stage;
  }
  return policy.stages[policy.stages.length - 1].stage;
}

function isGrowthDay(daily, policy = DEFAULT_GROWTH_POLICY) {
  const healthCount = (daily.waterCount || 0) + (daily.sunCount || 0);
  return (daily.focusCount || 0) >= policy.growthDay.focusCount
    || healthCount >= policy.growthDay.healthConfirmations;
}

function applyActivityEvent({
  state,
  event,
  policy = DEFAULT_GROWTH_POLICY,
  catalog = DEFAULT_CATALOG
} = {}) {
  if (!state) {
    throw new TypeError('applyActivityEvent 需要当前状态');
  }
  if (!event || !event.localDate) {
    throw new TypeError('活动事件需要 localDate');
  }

  const eventType = event.type || event.eventType;
  const rule = policy.events[eventType];
  if (!rule) {
    throw new Error(`未知活动类型: ${eventType}`);
  }

  const sameDay = state.daily.localDate === event.localDate;
  const daily = sameDay
    ? { ...state.daily }
    : {
        localDate: event.localDate,
        focusCount: 0,
        waterCount: 0,
        sunCount: 0,
        totalGrowth: 0
      };

  daily[rule.dailyCounter] += 1;
  const withinDailyLimit = daily[rule.dailyCounter] <= rule.dailyLimit;
  const growthPoints = withinDailyLimit ? rule.growthPoints : 0;
  daily.totalGrowth += growthPoints;

  const totals = {
    ...state.totals,
    [rule.totalCounter]: state.totals[rule.totalCounter] + 1
  };

  const alreadyGrowthDay = state.growthDays.includes(event.localDate);
  const growthDayEarned = !alreadyGrowthDay && isGrowthDay(daily, policy);
  const growthDays = growthDayEarned
    ? [...state.growthDays, event.localDate]
    : state.growthDays;

  const plant = state.plant ? { ...state.plant } : null;
  let appliedGrowth = 0;
  let matured = false;
  let seedYield = null;

  if (plant && plant.status === 'growing') {
    const previousScore = plant.growthScore || 0;
    const nextScore = Math.min(previousScore + growthPoints, policy.maturityScore);
    appliedGrowth = nextScore - previousScore;
    plant.growthScore = nextScore;
    plant.stage = getStage(nextScore, policy);

    if (nextScore >= policy.maturityScore) {
      plant.status = 'matured';
      plant.maturedAt = event.occurredAt || null;
      matured = true;
      seedYield = {
        speciesId: plant.speciesId,
        quantity: policy.matureSeedYield
      };
    }
  } else if (plant) {
    plant.stage = getStage(plant.growthScore, policy);
  }

  const metrics = {
    focusCount: totals.focusCount,
    healthCount: totals.healthCount,
    growthDayCount: growthDays.length
  };
  const unlocked = new Set(state.unlockedMilestones || []);
  const eligibleMilestones = [];
  for (const definition of catalog.milestones || []) {
    if (unlocked.has(definition.id)) continue;
    if ((metrics[definition.metric] || 0) >= definition.threshold) {
      unlocked.add(definition.id);
      eligibleMilestones.push(definition.id);
    }
  }

  return {
    state: {
      ...state,
      plant,
      daily,
      totals,
      growthDays,
      unlockedMilestones: [...unlocked]
    },
    effects: {
      growthPoints,
      appliedGrowth,
      stage: plant ? plant.stage : null,
      matured,
      seedYield,
      growthDayEarned,
      eligibleMilestones
    }
  };
}

module.exports = {
  DEFAULT_GROWTH_POLICY,
  DEFAULT_CATALOG,
  createInitialState,
  getStage,
  isGrowthDay,
  applyActivityEvent
};
