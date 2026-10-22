/**
 * 物品与奖励候选（纯数据/纯函数）。
 * V1 的物品自选共用一个档次：所有非初始物品都可能在候选池中。
 */

const ITEM_CATALOG = Object.freeze([
  { id: 'furniture-1', kind: 'furniture', variant: 'chair', size: 1 },
  { id: 'furniture-2', kind: 'furniture', variant: 'table', size: 2 },
  { id: 'furniture-3', kind: 'furniture', variant: 'bench', size: 2 },
  { id: 'furniture-4', kind: 'furniture', variant: 'shelf', size: 1 },
  { id: 'furniture-5', kind: 'furniture', variant: 'lamp', size: 1 },
  { id: 'furniture-6', kind: 'furniture', variant: 'stool', size: 1 },
  { id: 'decor-1', kind: 'decor', variant: 'pot', size: 1 },
  { id: 'decor-2', kind: 'decor', variant: 'lantern', size: 1 },
  { id: 'decor-3', kind: 'decor', variant: 'fountain', size: 2 },
  { id: 'decor-4', kind: 'decor', variant: 'birdhouse', size: 1 },
  { id: 'decor-5', kind: 'decor', variant: 'stone', size: 1 },
  { id: 'decor-6', kind: 'decor', variant: 'cottage', size: 3 },
  { id: 'pet-1', kind: 'pet', variant: 'cat', size: 1 },
  { id: 'pet-2', kind: 'pet', variant: 'dog', size: 1 },
  { id: 'pet-3', kind: 'pet', variant: 'bird', size: 1 },
  { id: 'pet-4', kind: 'pet', variant: 'rabbit', size: 1 },
  { id: 'special-tree-1', kind: 'special-tree', variant: 'moon-tree', size: 3 }
].map(Object.freeze));

const SPECIES_IDS = Object.freeze([
  'species-1',
  'species-2',
  'species-3',
  'species-4',
  'species-5',
  'species-6'
]);

const INITIAL_ITEM_IDS = Object.freeze(['furniture-1', 'decor-1']);

const FALLBACK_ITEM = Object.freeze({
  id: 'garden-memorial',
  kind: 'decor',
  variant: 'memorial',
  size: 1,
  stackable: true
});

const CHOICE_LIMIT = 3;

function getCatalogItem(itemId) {
  return ITEM_CATALOG.find((item) => item.id === itemId) || null;
}

function getChoiceCandidates(ownedIds, {
  limit = CHOICE_LIMIT,
  catalog = ITEM_CATALOG,
  initialItemIds = INITIAL_ITEM_IDS
} = {}) {
  const owned = new Set(ownedIds || []);
  const remaining = catalog.filter(
    (item) => !initialItemIds.includes(item.id) && !owned.has(item.id)
  );
  return {
    remaining,
    candidates: remaining.slice(0, limit)
  };
}

module.exports = {
  ITEM_CATALOG,
  SPECIES_IDS,
  INITIAL_ITEM_IDS,
  FALLBACK_ITEM,
  CHOICE_LIMIT,
  getCatalogItem,
  getChoiceCandidates
};
