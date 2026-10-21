const { INITIAL_ITEM_IDS, getCatalogItem } = require('../domain/services/item-catalog');
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
        return {
          initialized: false,
          state: await this.gardenRepository.getState(),
          plant: await this.gardenRepository.getActivePlant()
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
        await this.gardenRepository.addSeeds('species-1', 1, nowIso);
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
        plant = await this.gardenRepository.getPlantById(plantId);
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
}

module.exports = GardenUseCases;
