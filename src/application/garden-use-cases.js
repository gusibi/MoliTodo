const { INITIAL_ITEM_IDS, getCatalogItem, TREE_MERGE_CHUNK, getTreeFormUpgrade, treeFormCatalogId } = require('../domain/services/item-catalog');
const { withTransaction } = require('../infrastructure/persistence/with-transaction');

/**
 * 花园初始化。
 * 初始物种 + 1 枚种子自动种下，并赠送初始家具与装饰。
 * 以 species-1 的永久解锁作为一次性初始化标记。
 */
class GardenUseCases {
  constructor({ db, clock, gardenRepository }) {
    this.db = db;
    this.clock = clock;
    this.gardenRepository = gardenRepository;
  }

  async initializeGarden(now = this.clock.now()) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }
    const nowIso = instant.toISOString();
    const localDate = this.clock.localDate(instant);

    return withTransaction(this.db, async () => {
      await this.gardenRepository.ensureState(nowIso);

      const alreadyInitialized = await this.gardenRepository.hasSpeciesUnlock('species-1');
      if (alreadyInitialized) {
        let plant = await this.gardenRepository.getActivePlant();
        const hasAnyPlant = await this.gardenRepository.hasAnyPlant();
        if (!plant && !hasAnyPlant) {
          plant = await this._createInitialPlant(nowIso, localDate);
        } else if (plant) {
          await this.gardenRepository.setActivePlantId(plant.id, nowIso);
        }
        return {
          initialized: false,
          repaired: !hasAnyPlant && Boolean(plant),
          state: await this.gardenRepository.getState(),
          plant
        };
      }

      await this.gardenRepository.unlockSpecies({
        speciesId: 'species-1',
        unlockedAt: nowIso,
        source: 'initial'
      });

      for (const itemId of INITIAL_ITEM_IDS) {
        const item = getCatalogItem(itemId);
        if (!item) {
          throw new Error(`初始物品不存在: ${itemId}`);
        }
        await this.gardenRepository.addInventoryItemIfAbsent({
          catalogId: item.id,
          kind: item.kind,
          quantity: 1,
          originType: 'initial',
          originId: item.id,
          acquiredAt: nowIso
        });
      }

      await this.gardenRepository.unlockExpansion({
        level: 1,
        unlockedAt: nowIso,
        conditionType: 'initial'
      });

      let plant = await this.gardenRepository.getActivePlant();
      if (!plant) {
        plant = await this._createInitialPlant(nowIso, localDate);
      } else {
        await this.gardenRepository.setActivePlantId(plant.id, nowIso);
      }

      return {
        initialized: true,
        state: await this.gardenRepository.getState(),
        plant
      };
    });
  }

  async _createInitialPlant(nowIso, localDate) {
    const existingSeeds = await this.gardenRepository.getSeedQuantity('species-1');
    if (existingSeeds <= 0) {
      await this.gardenRepository.addSeeds('species-1', 1, nowIso);
    }
    const consumed = await this.gardenRepository.consumeSeed('species-1', nowIso);
    if (!consumed) {
      throw new Error('初始种子发放失败');
    }
    const plantId = await this.gardenRepository.insertPlant({
      speciesId: 'species-1',
      plantedAt: nowIso,
      localDatePlanted: localDate
    });
    await this.gardenRepository.setActivePlantId(plantId, nowIso);
    return this.gardenRepository.getPlantById(plantId);
  }

  async plantSeed({ speciesId = 'species-1', now = this.clock.now() } = {}) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }
    const nowIso = instant.toISOString();
    const localDate = this.clock.localDate(instant);

    return withTransaction(this.db, async () => {
      const active = await this.gardenRepository.getActivePlant();
      if (active) {
        throw new Error('已有生长中的植物');
      }
      const quantity = await this.gardenRepository.getSeedQuantity(speciesId);
      if (quantity <= 0) {
        throw new Error('没有可用的种子');
      }
      const consumed = await this.gardenRepository.consumeSeed(speciesId, nowIso);
      if (!consumed) {
        throw new Error('种子消耗失败');
      }
      const plantId = await this.gardenRepository.insertPlant({
        speciesId,
        plantedAt: nowIso,
        localDatePlanted: localDate
      });
      await this.gardenRepository.setActivePlantId(plantId, nowIso);
      return {
        state: await this.gardenRepository.getState(),
        plant: await this.gardenRepository.getPlantById(plantId)
      };
    });
  }

  async claimBasicSeed(now = this.clock.now()) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const active = await this.gardenRepository.getActivePlant();
      if (active) {
        throw new Error('已有生长中的植物');
      }
      const total = await this.gardenRepository.getSeedTotal();
      if (total > 0) {
        throw new Error('还有可用种子');
      }
      await this.gardenRepository.addSeeds('species-1', 1, nowIso);
      return {
        state: await this.gardenRepository.getState(),
        seeds: await this.gardenRepository.listSeeds()
      };
    });
  }

  /**
   * 同种树向上合并形态：3 棵同种同形态的树 → 1 棵下一形态。
   * 被消耗的树连同摆放一起移除；新树留在库存，由调用方决定是否自动摆放。
   */
  async mergeTrees({ speciesId = 'species-1', fromTier = 1, now = this.clock.now() } = {}) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }
    const nowIso = instant.toISOString();

    const target = getTreeFormUpgrade(speciesId, fromTier);
    if (!target) {
      throw new Error('该物种已是最高形态');
    }

    return withTransaction(this.db, async () => {
      const inventory = await this.gardenRepository.listInventoryItems();
      const sourceCatalogIds = fromTier === 1
        ? [speciesId]
        : [treeFormCatalogId(speciesId, 'canopy')];
      const rows = inventory
        .filter((item) => (
          item.kind === 'tree'
          && item.quantity > 0
          && sourceCatalogIds.includes(item.catalogId)
        ))
        .sort((a, b) => a.id - b.id);

      if (rows.length < TREE_MERGE_CHUNK) {
        throw new Error(`同种树木不足 ${TREE_MERGE_CHUNK} 棵，无法合成`);
      }

      const consumed = rows.slice(0, TREE_MERGE_CHUNK);
      for (const row of consumed) {
        await this.gardenRepository.removePlacement(row.id);
        await this.gardenRepository.deleteInventoryItem(row.id);
      }

      const inventoryItemId = await this.gardenRepository.addInventoryItem({
        catalogId: target.id,
        kind: 'tree',
        quantity: 1,
        originType: 'tree_merge',
        originId: `${target.id}:${consumed.map((row) => row.id).join('-')}`,
        acquiredAt: nowIso
      });

      return {
        merged: true,
        speciesId,
        fromTier,
        form: { ...target },
        consumedIds: consumed.map((row) => row.id),
        inventoryItemId
      };
    });
  }
}

module.exports = GardenUseCases;
