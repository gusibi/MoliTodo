const {
  getExpansionLevel,
  getNextExpansion,
  EXPANSION_LEVELS
} = require('../domain/services/expansion-policy');
const { getFocusSummary } = require('../domain/services/focus-policy');
const { DEFAULT_CATALOG } = require('../domain/services/growth-policy');

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
    catalog = DEFAULT_CATALOG
  }) {
    this.clock = clock;
    this.activityRepository = activityRepository;
    this.gardenRepository = gardenRepository;
    this.focusRepository = focusRepository;
    this.catalog = catalog;
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
      placements,
      milestones,
      expansions,
      rewardClaims,
      plantHistory
    };
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
