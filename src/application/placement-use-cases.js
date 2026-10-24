const {
  GARDEN_REGION,
  PET_REGION,
  getGardenCapacity,
  getPetCapacity,
  getItemSize
} = require('../domain/services/garden-layout');
const {
  GARDEN_BOUNDS,
  positionForPlacement,
  positionToken,
  normalizePosition,
  clampToBounds,
  findFreePosition,
  rectsOverlap
} = require('../domain/services/garden-template');
const { withTransaction } = require('../infrastructure/persistence/with-transaction');

function regionForItem(item) {
  return item.kind === 'pet' ? PET_REGION : GARDEN_REGION;
}

function capacityForRegion(level, region) {
  return region === PET_REGION ? getPetCapacity(level) : getGardenCapacity(level);
}

function sizeForItem(item) {
  return Math.max(1, getItemSize(item));
}

function occupiedFromPlacements(placements, inventoryById) {
  const occupied = [];
  for (const placement of placements) {
    const item = inventoryById.get(placement.inventoryId);
    if (!item) continue;
    const position = positionForPlacement(placement);
    occupied.push({
      x: position.x,
      z: position.z,
      size: sizeForItem(item),
      inventoryId: placement.inventoryId,
      regionId: placement.regionId
    });
  }
  return occupied;
}

function overlapsOthers(position, size, occupied, excludeInventoryId = null) {
  return occupied.some((entry) => {
    if (excludeInventoryId && entry.inventoryId === excludeInventoryId) return false;
    return rectsOverlap(position, size, entry, entry.size);
  });
}

/**
 * 小院自由摆放：容量按件数计算，尺寸用于边界与碰撞。
 * slot_id 保存为 @x,z，兼容旧的 slot-N 数据。
 */
class PlacementUseCases {
  constructor({ db, clock, gardenRepository, regionId = GARDEN_REGION }) {
    this.db = db;
    this.clock = clock;
    this.gardenRepository = gardenRepository;
    this.regionId = regionId;
  }

  async placeItem({ inventoryId, slotId = null, position = null, now = this.clock.now() } = {}) {
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
      const placements = await this.gardenRepository.listPlacements();
      const regionPlacements = placements.filter((placement) => placement.regionId === region);
      if (regionPlacements.length >= capacity) {
        throw new Error(region === PET_REGION ? '宠物位已经放满' : '小院已经放满');
      }

      const existing = await this.gardenRepository.findPlacementByInventoryId(inventoryId);
      if (existing) throw new Error('该物品已经摆放');

      const inventoryRows = await this.gardenRepository.listInventoryItems();
      const inventoryById = new Map(inventoryRows.map((item) => [item.id, item]));
      const occupied = occupiedFromPlacements(placements, inventoryById);
      const size = sizeForItem(inventory);

      let nextPosition = normalizePosition(position);
      if (!nextPosition && slotId) {
        nextPosition = positionForPlacement({ slotId, regionId: region });
      }
      if (!nextPosition) {
        nextPosition = findFreePosition({
          catalogId: inventory.catalogId,
          size,
          occupied,
          bounds: GARDEN_BOUNDS
        });
      }
      if (!nextPosition) throw new Error('没有足够的空地摆放这件物品');

      const clamped = clampToBounds(nextPosition, size, GARDEN_BOUNDS);
      if (overlapsOthers(clamped, size, occupied)) {
        throw new Error('这个位置已经被其他物品占用');
      }

      return this.gardenRepository.addPlacement({
        inventoryId,
        regionId: region,
        slotId: positionToken(clamped.x, clamped.z),
        visible: 1,
        placedAt: nowIso
      });
    });
  }

  async moveItem({ inventoryId, position, now = this.clock.now() } = {}) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }

    return withTransaction(this.db, async () => {
      const placement = await this.gardenRepository.findPlacementByInventoryId(inventoryId);
      if (!placement) throw new Error('该物品没有摆放');
      const inventory = await this.gardenRepository.findInventoryItemById(inventoryId);
      if (!inventory) throw new Error('物品不存在或数量不足');
      const next = normalizePosition(position);
      if (!next) throw new Error('摆放位置无效');
      const size = sizeForItem(inventory);
      const clamped = clampToBounds(next, size, GARDEN_BOUNDS);

      const placements = await this.gardenRepository.listPlacements();
      const inventoryRows = await this.gardenRepository.listInventoryItems();
      const inventoryById = new Map(inventoryRows.map((item) => [item.id, item]));
      const occupied = occupiedFromPlacements(placements, inventoryById);
      if (overlapsOthers(clamped, size, occupied, inventoryId)) {
        throw new Error('这个位置已经被其他物品占用');
      }

      return this.gardenRepository.updatePlacementSlot({
        inventoryId,
        slotId: positionToken(clamped.x, clamped.z)
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
   * 自动摆放：优先使用模板位置；位置被占用时寻找最近的空位。
   * 容量按件数计算，放不下时留在收藏中。
   */
  async autoPlace({ now = this.clock.now(), inventoryIds = null } = {}) {
    const instant = now instanceof Date ? now : new Date(now);
    const allowedIds = Array.isArray(inventoryIds) ? new Set(inventoryIds) : null;
    const inventory = await this.gardenRepository.listInventoryItems();
    const placements = await this.gardenRepository.listPlacements();
    const placedIds = new Set(placements.map((placement) => placement.inventoryId));
    const state = await this.gardenRepository.getState();
    const level = state ? state.level : 1;
    const placedNow = [];

    const candidates = inventory
      .filter((item) => item.quantity > 0 && !placedIds.has(item.id))
      .filter((item) => !allowedIds || allowedIds.has(item.id))
      .sort((a, b) => (sizeForItem(b) - sizeForItem(a)) || (a.id - b.id));

    for (const item of candidates) {
      const region = regionForItem(item);
      const capacity = capacityForRegion(level, region);
      const current = await this.gardenRepository.listPlacements();
      if (current.filter((placement) => placement.regionId === region).length >= capacity) {
        continue;
      }
      try {
        const placement = await this.placeItem({
          inventoryId: item.id,
          now: instant
        });
        placedNow.push(placement);
      } catch (error) {
        if (!/空地|占用|放满|已经摆放/.test(error.message)) {
          throw error;
        }
      }
    }

    return placedNow;
  }
}

module.exports = PlacementUseCases;
