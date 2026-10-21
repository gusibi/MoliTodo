const {
  DEFAULT_GROWTH_POLICY,
  DEFAULT_CATALOG,
  applyActivityEvent
} = require('../domain/services/growth-policy');
const {
  REWARD_TYPES,
  getMilestoneReward,
  getMilestoneClaimStatus
} = require('../domain/services/reward-policy');
const { withTransaction } = require('../infrastructure/persistence/with-transaction');

/**
 * 工具域应用编排。
 * 跨 activity / garden 的写入在同一个事务中完成，保证事件、成长和收藏一致。
 */
class ToolsUseCases {
  constructor({
    db,
    clock,
    activityRepository,
    gardenRepository,
    growthPolicy = DEFAULT_GROWTH_POLICY,
    catalog = DEFAULT_CATALOG
  }) {
    this.db = db;
    this.clock = clock;
    this.activityRepository = activityRepository;
    this.gardenRepository = gardenRepository;
    this.growthPolicy = growthPolicy;
    this.catalog = catalog;
  }

  async recordActivity(input = {}) {
    return withTransaction(this.db, () => this.recordActivityInTransaction(input));
  }

  /**
   * 在调用方已经开启的事务内记录活动。
   * 提醒确认需要把 occurrence 状态与成长写入放在同一个事务里。
   */
  async recordActivityInTransaction({
    type,
    dedupeKey,
    sourceType = 'manual',
    sourceId = null,
    occurredAt
  } = {}) {
    if (!type) {
      throw new TypeError('记录活动需要 type');
    }
    if (!dedupeKey) {
      throw new TypeError('记录活动需要 dedupeKey');
    }

    const instant = occurredAt ? new Date(occurredAt) : this.clock.now();
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('occurredAt 不是有效时间');
    }
    const occurredAtIso = instant.toISOString();
    const localDate = this.clock.localDate(instant);
    const tzOffset = this.clock.tzOffset(instant);

    const existing = await this.activityRepository.findByDedupeKey(dedupeKey);
    if (existing) {
      return {
        recorded: false,
        duplicate: true,
        event: existing,
        effects: null
      };
    }

    await this.gardenRepository.ensureState(occurredAtIso);

    const plantRow = await this.gardenRepository.getActivePlant();
    const dailyRow = await this.activityRepository.getDailySummary(localDate);
    const totals = await this.activityRepository.getTotals();
    const growthDays = await this.activityRepository.listGrowthDays();
    const unlockedMilestones = await this.gardenRepository.listUnlockedMilestones();
    const gardenState = await this.gardenRepository.getState();

    const { state, effects } = applyActivityEvent({
      state: {
        plant: plantRow,
        daily: dailyRow || {
          localDate,
          focusCount: 0,
          waterCount: 0,
          sunCount: 0,
          totalGrowth: 0
        },
        totals,
        growthDays,
        unlockedMilestones
      },
      event: {
        type,
        occurredAt: occurredAtIso,
        localDate
      },
      policy: this.growthPolicy,
      catalog: this.catalog
    });

    const event = await this.activityRepository.appendEvent({
      dedupeKey,
      sourceType,
      sourceId,
      eventType: type,
      growthPoints: effects.growthPoints,
      occurredAt: occurredAtIso,
      localDate,
      tzOffset,
      createdAt: occurredAtIso
    });

    await this.activityRepository.saveDailySummary({
      localDate,
      focusCount: state.daily.focusCount,
      waterCount: state.daily.waterCount,
      sunCount: state.daily.sunCount,
      totalGrowth: state.daily.totalGrowth,
      updatedAt: occurredAtIso
    });

    if (state.growthDays.includes(localDate)) {
      await this.activityRepository.addGrowthDay({
        localDate,
        growthScore: state.daily.totalGrowth,
        createdAt: occurredAtIso
      });
    }

    let updatedPlant = plantRow;
    if (plantRow && effects.appliedGrowth > 0) {
      await this.gardenRepository.updatePlant({
        id: plantRow.id,
        growthScore: state.plant.growthScore,
        stage: state.plant.stage,
        status: state.plant.status,
        maturedAt: state.plant.maturedAt || null
      });
      updatedPlant = await this.gardenRepository.getPlantById(plantRow.id);
    }

    let inventoryItemId = null;
    let autoPlantedPlantId = null;
    if (effects.matured) {
      inventoryItemId = await this.gardenRepository.addInventoryItem({
        catalogId: state.plant.speciesId,
        kind: 'tree',
        quantity: 1,
        originType: 'plant_instance',
        originId: plantRow.id,
        acquiredAt: occurredAtIso
      });
      await this.gardenRepository.addSeeds(
        state.plant.speciesId,
        effects.seedYield.quantity,
        occurredAtIso
      );

      if (gardenState.autoPlant === 1) {
        const consumed = await this.gardenRepository.consumeSeed(
          state.plant.speciesId,
          occurredAtIso
        );
        if (consumed) {
          autoPlantedPlantId = await this.gardenRepository.insertPlant({
            speciesId: state.plant.speciesId,
            plantedAt: occurredAtIso,
            localDatePlanted: localDate
          });
          await this.gardenRepository.setActivePlantId(autoPlantedPlantId, occurredAtIso);
        } else {
          await this.gardenRepository.setActivePlantId(null, occurredAtIso);
        }
      } else {
        await this.gardenRepository.setActivePlantId(null, occurredAtIso);
      }
    }

    if (effects.eligibleMilestones.length > 0) {
      const definitions = new Map(
        (this.catalog.milestones || []).map((definition) => [definition.id, definition])
      );
      const definitionVersion = this.catalog.version == null
        ? null
        : String(this.catalog.version);

      for (const definitionId of effects.eligibleMilestones) {
        const definition = definitions.get(definitionId);
        if (!definition) continue;

        const reward = getMilestoneReward(definition);
        const unlock = await this.gardenRepository.unlockMilestone({
          definitionId,
          unlockedAt: occurredAtIso,
          claimStatus: getMilestoneClaimStatus(definition),
          definitionVersion
        });

        if (reward.type === REWARD_TYPES.ITEM_CHOICE) {
          await this.gardenRepository.createRewardClaim({
            unlockId: unlock.id,
            createdAt: occurredAtIso
          });
        } else if (reward.type === REWARD_TYPES.SPECIES && unlock.created) {
          await this.gardenRepository.unlockSpecies({
            speciesId: reward.speciesId,
            unlockedAt: occurredAtIso,
            source: `milestone:${definitionId}`
          });
          await this.gardenRepository.addSeeds(
            reward.speciesId,
            reward.seeds || 1,
            occurredAtIso
          );
        }
      }
    }

    return {
      recorded: true,
      duplicate: false,
      event,
      effects,
      plant: updatedPlant,
      inventoryItemId,
      autoPlantedPlantId
    };
  }
}

module.exports = ToolsUseCases;
