const { getExpansionLevel } = require('./expansion-policy');
const { getCatalogItem } = require('./item-catalog');

const COLUMNS = 4;
const GARDEN_REGION = 'garden';
const PET_REGION = 'pet';

function getGardenCapacity(level) {
  return (getExpansionLevel(level) || getExpansionLevel(1)).capacity;
}

function getPetCapacity(level) {
  return level >= 4 ? 3 : 2;
}

function getItemSize(item) {
  if (!item) return 1;
  if (item.kind === 'tree' || item.kind === 'species-tree') return 1;
  if (item.size) return item.size;
  const catalog = getCatalogItem(item.catalogId || item.id);
  return catalog ? catalog.size || 1 : 1;
}

function parseSlotNumber(slotId, region = GARDEN_REGION) {
  const prefix = region === PET_REGION ? 'pet-' : 'slot-';
  if (typeof slotId !== 'string' || !slotId.startsWith(prefix)) {
    throw new Error('槽位格式无效');
  }
  const number = Number(slotId.slice(prefix.length));
  if (!Number.isInteger(number) || number < 1) {
    throw new Error('槽位格式无效');
  }
  return number;
}

function slotIdFor(number, region = GARDEN_REGION) {
  return `${region === PET_REGION ? 'pet' : 'slot'}-${number}`;
}

function slotPosition(slotNumber, columns = COLUMNS) {
  const index = slotNumber - 1;
  return {
    row: Math.floor(index / columns),
    column: index % columns
  };
}

function slotFootprint(anchorSlot, size, capacity, columns = COLUMNS) {
  const { row, column } = slotPosition(anchorSlot, columns);
  if (column + size > columns) {
    throw new Error('物品超出小院网格宽度');
  }
  const cells = [];
  for (let rowOffset = 0; rowOffset < size; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < size; columnOffset += 1) {
      const cellSlot = (row + rowOffset) * columns + column + columnOffset + 1;
      if (cellSlot > capacity) {
        throw new Error(`当前小院只有 ${capacity} 个槽位`);
      }
      cells.push(cellSlot);
    }
  }
  return cells;
}

module.exports = {
  COLUMNS,
  GARDEN_REGION,
  PET_REGION,
  getGardenCapacity,
  getPetCapacity,
  getItemSize,
  parseSlotNumber,
  slotIdFor,
  slotPosition,
  slotFootprint
};
