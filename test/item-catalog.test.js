const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ITEM_CATALOG,
  INITIAL_ITEM_IDS,
  FALLBACK_ITEM,
  getCatalogItem,
  getChoiceCandidates
} = require('../src/domain/services/item-catalog');

test('the item catalog has 17 items and excludes the two initial gifts from choices', () => {
  assert.equal(ITEM_CATALOG.length, 17);
  assert.deepEqual(INITIAL_ITEM_IDS, ['furniture-1', 'decor-1']);

  const counts = ITEM_CATALOG.reduce((result, item) => {
    result[item.kind] = (result[item.kind] || 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, {
    furniture: 6,
    decor: 6,
    pet: 4,
    'special-tree': 1
  });

  const { remaining, candidates } = getChoiceCandidates([]);
  assert.equal(remaining.length, 15);
  assert.deepEqual(candidates.map((item) => item.id), ['furniture-2', 'furniture-3', 'furniture-4']);
  assert.equal(remaining.some((item) => item.id === 'furniture-1'), false);
  assert.equal(remaining.some((item) => item.id === 'decor-1'), false);
});

test('owned items are filtered before building the three candidates', () => {
  const { remaining, candidates } = getChoiceCandidates(['furniture-2']);
  assert.equal(remaining.length, 14);
  assert.deepEqual(candidates.map((item) => item.id), ['furniture-3', 'furniture-4', 'furniture-5']);
});

test('the last remaining item is the only candidate and fallback is exposed when empty', () => {
  const allButOne = getChoiceCandidates([]).remaining
    .filter((item) => item.id !== 'special-tree-1')
    .map((item) => item.id);
  const last = getChoiceCandidates(allButOne);
  assert.equal(last.remaining.length, 1);
  assert.equal(last.remaining[0].id, 'special-tree-1');

  const all = getChoiceCandidates([...allButOne, 'special-tree-1']);
  assert.equal(all.remaining.length, 0);
  assert.equal(FALLBACK_ITEM.id, 'garden-memorial');
});

test('catalog lookup returns items and tolerates unknown ids', () => {
  assert.deepEqual(getCatalogItem('pet-1'), { id: 'pet-1', kind: 'pet', variant: 'cat' });
  assert.equal(getCatalogItem('missing'), null);
});
