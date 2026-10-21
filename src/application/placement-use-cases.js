const { getExpansionLevel } = require('../domain/services/expansion-policy');
const { withTransaction } = require('../infrastructure/persistence/with-transaction');

function parseSlotNumber(slotId) {
  const match = /^slot-(\d+)$/.exec(slotId || '');
  if (!match) throw new Error('槽位格式无效');
  return Number(match[1]);
}

/**
 * 小院摆放：只校验所有权、槽位和容量，不删除库存记录。
 */
class PlacementUseCases {
  constructor({ db, clock, gardenRepository, regionId = 'garden' }) {
    this.db = db;
    this.clock = clock;
    this.gardenRepository = gardenRepository;
    this.regionId = regionId;
  }

  async placeItem({ inventoryId, slotId, now = this.clock.now() } = {}) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }
    const nowIso = instant.toISOString();
    const slotNumber = parseSlotNumber(slotId);

    return withTransaction(this.db, async () => {
      const state = await this.gardenRepository.getState();
      const level = state ? state.level : 1;
      const expansion = getExpansionLevel(level) || getExpansionLevel(1);
      if (slotNumber < 1 || slotNumber > expansion.capacity) {
        throw new Error(`当前小院只有 ${expansion.capacity} 个槽位`);
      }

      const inventory = await this.gardenRepository.findInventoryItemById(inventoryId);
      if (!inventory || inventory.quantity <= 0) {
        throw new Error('物品不存在或数量不足');
      }

      const existingInventoryPlacement = await this.gardenRepository.findPlacementByInventoryId(inventoryId);
      if (existingInventoryPlacement) {
        throw new Error('该物品已经摆放');
      }

      const existingSlot = await this.gardenRepository.findPlacementBySlot(this.regionId, slotId);
      if (existingSlot) {
        throw new Error('该槽位已被占用');
      }

      return this.gardenRepository.addPlacement({
        inventoryId,
        regionId: this.regionId,
        slotId,
        visible: 1,
        placedAt: nowIso
      });
    });
  }

  async removeItem(inventoryId) {
    return withTransaction(this.db, async () => {
      const placement = await this.gardenRepository.findPlacementByInventoryId(inventoryId);
      if (!placement) {
        throw new Error('该物品没有摆放');
      }
      await this.gardenRepository.removePlacement(inventoryId);
      return placement;
    });
  }
}

module.exports = PlacementUseCases;
