const {
  getExpansionLevel,
  getNextExpansion,
  EXPANSION_LEVELS
} = require('../domain/services/expansion-policy');
const {
  COLUMNS,
  getPetCapacity
} = require('../domain/services/garden-layout');
const { getFocusSummary } = require('../domain/services/focus-policy');
const { addDays } = require('../domain/services/reminder-schedule');
const { DEFAULT_CATALOG } = require('../domain/services/growth-policy');
const {
  ITEM_CATALOG,
  SPECIES_IDS,
  FALLBACK_ITEM
} = require('../domain/services/item-catalog');

/**
 * 工具域读模型。
 * ShellSnapshot 供侧栏、菜单栏和提醒弹窗共用；GardenView 供 Moli 小院页面使用。
 * 本阶段只读取，不写入。
 */
class ToolsReadModel {
  constructor({
    clock,
    activityRepository,
    gardenRepository,
    focusRepository = null,
    reminderRepository = null,
    catalog = DEFAULT_CATALOG,
    getAutoPlace = () => true
  }) {
    this.clock = clock;
    this.activityRepository = activityRepository;
    this.gardenRepository = gardenRepository;
    this.focusRepository = focusRepository;
    this.reminderRepository = reminderRepository;
    this.catalog = catalog;
    this.getAutoPlace = getAutoPlace;
  }

  async getShellSnapshot(now = this.clock.now()) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }

    const localDate = this.clock.localDate(instant);
    const [daily, plant, gardenState, seedCount, pendingRewards, activeFocus] = await Promise.all([
      this.activityRepository.getDailySummary(localDate),
      this.gardenRepository.getActivePlant(),
      this.gardenRepository.getState(),
      this.gardenRepository.getSeedTotal(),
      this.gardenRepository.countPendingRewards(),
      this.focusRepository ? this.focusRepository.findActiveSession() : null
    ]);

    return {
      generatedAt: instant.toISOString(),
      localDate,
      badges: {
        pendingRewards
      },
      // 专注模块未运行时返回 null；运行中则提供轻量摘要。
      focus: activeFocus ? getFocusSummary(activeFocus, instant) : null,
      today: {
        focusCount: daily ? daily.focusCount : 0,
        waterCount: daily ? daily.waterCount : 0,
        sunCount: daily ? daily.sunCount : 0,
        totalGrowth: daily ? daily.totalGrowth : 0
      },
      plant: plant
        ? {
            id: plant.id,
            speciesId: plant.speciesId,
            stage: plant.stage,
            growthScore: plant.growthScore,
            status: plant.status
          }
        : null,
      garden: {
        level: gardenState ? gardenState.level : 1,
        seedCount,
        autoPlant: gardenState ? gardenState.autoPlant === 1 : true
      }
    };
  }

  async getHealthView(now = this.clock.now()) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }

    const localDate = this.clock.localDate(instant);
    const [daily, summaries, rules, occurrences] = await Promise.all([
      this.activityRepository.getDailySummary(localDate),
      this.activityRepository.listRecentDailySummaries(14),
      this.reminderRepository ? this.reminderRepository.listRules() : [],
      this.reminderRepository ? this.reminderRepository.listRecentOccurrences(12) : []
    ]);
    const summaryByDate = new Map(summaries.map((entry) => [entry.localDate, entry]));
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = addDays(localDate, -offset);
      const summary = summaryByDate.get(date);
      days.push({
        localDate: date,
        focusCount: summary ? summary.focusCount : 0,
        waterCount: summary ? summary.waterCount : 0,
        sunCount: summary ? summary.sunCount : 0,
        totalGrowth: summary ? summary.totalGrowth : 0
      });
    }

    const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
    const enabledRules = rules.filter((rule) => rule.enabled === 1);
    const upcoming = enabledRules
      .filter((rule) => rule.nextRunAt)
      .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());
    const nextRule = upcoming[0] || null;

    return {
      generatedAt: instant.toISOString(),
      localDate,
      today: {
        focusCount: daily ? daily.focusCount : 0,
        waterCount: daily ? daily.waterCount : 0,
        sunCount: daily ? daily.sunCount : 0,
        totalGrowth: daily ? daily.totalGrowth : 0
      },
      days,
      rules,
      nextReminder: nextRule
        ? {
            ruleId: nextRule.id,
            type: nextRule.type,
            nextRunAt: nextRule.nextRunAt,
            windowStart: nextRule.windowStart,
            windowEnd: nextRule.windowEnd,
            intervalMinutes: nextRule.intervalMinutes
          }
        : null,
      recentOccurrences: occurrences.map((occurrence) => ({
        ...occurrence,
        ruleType: rulesById.get(occurrence.ruleId)?.type || null
      }))
    };
  }

  async getGardenView(now = this.clock.now()) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }

    const localDate = this.clock.localDate(instant);
    const [
      plant,
      gardenState,
      seeds,
      species,
      inventory,
      placements,
      milestones,
      expansions,
      rewardClaims,
      pendingRewards,
      plantHistory
    ] = await Promise.all([
      this.gardenRepository.getActivePlant(),
      this.gardenRepository.getState(),
      this.gardenRepository.listSeeds(),
      this.gardenRepository.listSpeciesUnlocks(),
      this.gardenRepository.listInventoryItems(),
      this.gardenRepository.listPlacements(),
      this.gardenRepository.listMilestoneUnlocks(),
      this.gardenRepository.listExpansions(),
      this.gardenRepository.listRewardClaims(),
      this.gardenRepository.countPendingRewards(),
      this.gardenRepository.listPlantInstances(10)
    ]);

    const level = gardenState ? gardenState.level : 1;
    const currentExpansion = getExpansionLevel(level) || getExpansionLevel(1);
    const nextExpansion = getNextExpansion(level);
    const seedTotal = seeds.reduce((total, seed) => total + seed.quantity, 0);

    return {
      generatedAt: instant.toISOString(),
      localDate,
      badges: this.buildBadges(milestones, expansions, pendingRewards),
      garden: {
        level,
        capacity: currentExpansion.capacity,
        columns: COLUMNS,
        petCapacity: getPetCapacity(level),
        autoPlace: Boolean(this.getAutoPlace()),
        currentStreak: gardenState ? gardenState.currentStreak : 0,
        longestStreak: gardenState ? gardenState.longestStreak : 0,
        totalGrowthDays: gardenState ? gardenState.totalGrowthDays : 0,
        activePlantId: gardenState ? gardenState.activePlantId : null,
        autoPlant: gardenState ? gardenState.autoPlant === 1 : true,
        canClaimBasicSeed: !plant && seedTotal === 0,
        nextExpansion: nextExpansion
          ? {
              level: nextExpansion.level,
              capacity: nextExpansion.capacity,
              streakDays: nextExpansion.streakDays,
              totalGrowthDays: nextExpansion.totalGrowthDays
            }
          : null
      },
      plant: plant
        ? {
            id: plant.id,
            speciesId: plant.speciesId,
            stage: plant.stage,
            growthScore: plant.growthScore,
            status: plant.status,
            plantedAt: plant.plantedAt,
            maturedAt: plant.maturedAt,
            localDatePlanted: plant.localDatePlanted
          }
        : null,
      seeds,
      species,
      inventory,
      collection: this.buildCollection(inventory, species),
      placements,
      milestones,
      expansions,
      rewardClaims,
      plantHistory
    };
  }

  buildCollection(inventory, species) {
    const ownedMap = new Map();
    for (const item of inventory) {
      if (item.quantity > 0) {
        ownedMap.set(item.catalogId, (ownedMap.get(item.catalogId) || 0) + item.quantity);
      }
    }
    const unlockedSpecies = new Set(species.map((entry) => entry.speciesId));

    const items = ITEM_CATALOG.map((item) => ({
      id: item.id,
      kind: item.kind,
      variant: item.variant,
      size: item.size || 1,
      category: 'item',
      owned: ownedMap.has(item.id),
      unlocked: ownedMap.has(item.id),
      quantity: ownedMap.get(item.id) || 0
    }));

    const trees = SPECIES_IDS.map((speciesId) => {
      const matureCount = inventory
        .filter((item) => item.kind === 'tree' && item.catalogId === speciesId)
        .reduce((total, item) => total + item.quantity, 0);
      const unlocked = unlockedSpecies.has(speciesId);
      return {
        id: `species-tree:${speciesId}`,
        kind: 'species-tree',
        variant: 'tree',
        size: 1,
        category: 'species',
        speciesId,
        owned: matureCount > 0,
        unlocked,
        quantity: matureCount
      };
    });

    const fallback = {
      id: FALLBACK_ITEM.id,
      kind: FALLBACK_ITEM.kind,
      variant: 'memorial',
      size: 1,
      category: 'fallback',
      owned: ownedMap.has(FALLBACK_ITEM.id),
      unlocked: ownedMap.has(FALLBACK_ITEM.id),
      quantity: ownedMap.get(FALLBACK_ITEM.id) || 0
    };

    return [...items, ...trees, fallback];
  }

  buildBadges(milestones, expansions, pendingRewards) {
    const milestoneById = new Map(milestones.map((entry) => [entry.definitionId, entry]));
    const expansionLevels = new Set(expansions.map((entry) => entry.level));
    const items = [];

    for (const definition of this.catalog.milestones || []) {
      const unlocked = milestoneById.get(definition.id);
      items.push({
        id: `milestone:${definition.id}`,
        kind: 'milestone',
        definitionId: definition.id,
        unlocked: Boolean(unlocked),
        unlockedAt: unlocked ? unlocked.unlockedAt : null,
        claimStatus: unlocked ? unlocked.claimStatus : null
      });
    }

    for (const expansion of EXPANSION_LEVELS.filter((entry) => entry.level > 1)) {
      const definitionId = `expansion-lv${expansion.level}`;
      const unlocked = milestoneById.get(definitionId);
      items.push({
        id: `expansion:${expansion.level}`,
        kind: 'expansion',
        definitionId,
        unlocked: expansionLevels.has(expansion.level) || Boolean(unlocked),
        unlockedAt: unlocked ? unlocked.unlockedAt : null,
        claimStatus: unlocked ? unlocked.claimStatus : null
      });
    }

    return {
      pendingRewards,
      total: items.length,
      unlocked: items.filter((item) => item.unlocked).length,
      items
    };
  }
}

module.exports = ToolsReadModel;
