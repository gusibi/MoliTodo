const {
  GARDEN_REGION,
  PET_REGION,
  getGardenCapacity,
  getPetCapacity,
  getItemSize,
  parseSlotNumber,
  slotIdFor,
  slotFootprint
} = require('../domain/services/garden-layout');
const { withTransaction } = require('../infrastructure/persistence/with-transaction');

function regionForItem(item) {
  return item.kind === 'pet' ? PET_REGION : GARDEN_REGION;
}

function capacityForRegion(level, region) {
  return region === PET_REGION ? getPetCapacity(level) : getGardenCapacity(level);
}

function footprintFor(item, region, anchor, capacity) {
  if (region === PET_REGION) {
    if (anchor > capacity) throw new Error(`当前小院只有 ${capacity} 个宠物位`);
    return [anchor];
  }
  const size = getItemSize(item);
  return slotFootprint(anchor, size, capacity);
}

/**
 * 小院摆放：校验所有权、尺寸、槽位与容量，不删除库存记录。
 * 宠物使用独立区域，不占普通格位。
 */
class PlacementUseCases {
  constructor({ db, clock, gardenRepository, regionId = GARDEN_REGION }) {
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

    return withTransaction(this.db, async () => {
      const inventory = await this.gardenRepository.findInventoryItemById(inventoryId);
      if (!inventory || inventory.quantity <= 0) {
        throw new Error('物品不存在或数量不足');
      }

      const region = regionForItem(inventory);
      const state = await this.gardenRepository.getState();
      const level = state ? state.level : 1;
      const capacity = capacityForRegion(level, region);
      const anchor = parseSlotNumber(slotId, region);

      const existingInventoryPlacement = await this.gardenRepository.findPlacementByInventoryId(inventoryId);
      if (existingInventoryPlacement) {
        throw new Error('该物品已经摆放');
      }

      const cells = footprintFor(inventory, region, anchor, capacity);
      const placements = (await this.gardenRepository.listPlacements())
        .filter((placement) => placement.regionId === region);
      const inventoryIds = new Set(placements.map((placement) => placement.inventoryId));
      const inventoryRows = await this.gardenRepository.listInventoryItems();
      const inventoryById = new Map(inventoryRows.map((item) => [item.id, item]));
      const occupied = new Set();
      for (const placement of placements) {
        const placedItem = inventoryById.get(placement.inventoryId);
        if (!placedItem) continue;
        const placedAnchor = parseSlotNumber(placement.slotId, region);
        const placedCells = footprintFor(placedItem, region, placedAnchor, capacity);
        placedCells.forEach((cell) => occupied.add(cell));
      }

      if (cells.some((cell) => occupied.has(cell))) {
        throw new Error('该槽位已被占用');
      }
      if (inventoryIds.has(inventoryId)) {
        throw new Error('该物品已经摆放');
      }

      return this.gardenRepository.addPlacement({
        inventoryId,
        regionId: region,
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

  /**
   * 自动填槽：大件优先，只填空位，不覆盖已有物品。
   * 没有足够空间时留在收藏中。
   */
  async autoPlace({ now = this.clock.now(), inventoryIds = null } = {}) {
    const instant = now instanceof Date ? now : new Date(now);
    const allowedIds = Array.isArray(inventoryIds) ? new Set(inventoryIds) : null;
    const inventory = await this.gardenRepository.listInventoryItems();
    const placements = await this.gardenRepository.listPlacements();
    const placedIds = new Set(placements.map((placement) => placement.inventoryId));
    const candidates = inventory
      .filter((item) => item.quantity > 0 && !placedIds.has(item.id))
      .filter((item) => !allowedIds || allowedIds.has(item.id))
      .sort((a, b) => (getItemSize(b) - getItemSize(a)) || (a.id - b.id));

    const state = await this.gardenRepository.getState();
    const level = state ? state.level : 1;
    const placedNow = [];

    for (const item of candidates) {
      const region = regionForItem(item);
      const capacity = capacityForRegion(level, region);
      for (let slot = 1; slot <= capacity; slot += 1) {
        try {
          const placement = await this.placeItem({
            inventoryId: item.id,
            slotId: slotIdFor(slot, region),
            now: instant
          });
          placedNow.push(placement);
          break;
        } catch (error) {
          if (!/槽位|宠物位|宽度|已经摆放/.test(error.message)) {
            throw error;
          }
        }
      }
    }

    return placedNow;
  }
}

module.exports = PlacementUseCases;
