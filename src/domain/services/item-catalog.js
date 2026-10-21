/**
 * 物品与奖励候选（纯数据/纯函数）。
 * V1 的物品自选共用一个档次：所有非初始物品都可能在候选池中。
 */

const ITEM_CATALOG = Object.freeze([
  { id: 'furniture-1', kind: 'furniture' },
  { id: 'furniture-2', kind: 'furniture' },
  { id: 'furniture-3', kind: 'furniture' },
  { id: 'furniture-4', kind: 'furniture' },
  { id: 'furniture-5', kind: 'furniture' },
  { id: 'furniture-6', kind: 'furniture' },
  { id: 'decor-1', kind: 'decor' },
  { id: 'decor-2', kind: 'decor' },
  { id: 'decor-3', kind: 'decor' },
  { id: 'decor-4', kind: 'decor' },
  { id: 'decor-5', kind: 'decor' },
  { id: 'decor-6', kind: 'decor' },
  { id: 'pet-1', kind: 'pet' },
  { id: 'pet-2', kind: 'pet' },
  { id: 'pet-3', kind: 'pet' },
  { id: 'pet-4', kind: 'pet' },
  { id: 'special-tree-1', kind: 'special-tree' }
].map(Object.freeze));

const INITIAL_ITEM_IDS = Object.freeze(['furniture-1', 'decor-1']);

const FALLBACK_ITEM = Object.freeze({
  id: 'garden-memorial',
  kind: 'decor',
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
  INITIAL_ITEM_IDS,
  FALLBACK_ITEM,
  CHOICE_LIMIT,
  getCatalogItem,
  getChoiceCandidates
};
