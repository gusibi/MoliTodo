const { test, expect } = require('./fixtures');

async function openGarden(window) {
  await window.locator('.task-manager-sidebar').getByRole('button', { name: 'Moli 小院' }).click();
  await expect(window.getByText('已摆放 2/4 件')).toBeVisible();
}

async function openPlacementTray(window) {
  await window.getByRole('button', { name: '添加物品', exact: true }).click();
  const dialog = window.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '添加物品' })).toBeVisible();
  return dialog;
}

// 只写库存、不走自动摆放，模拟收藏已到手但还没摆上去
async function grantItems(app, items) {
  await app.electronApp.evaluate(async ({}, entries) => {
    const runtime = global.__moliTodoApp.toolsRuntime;
    for (const [index, { catalogId, kind }] of entries.entries()) {
      await runtime.gardenRepository.addInventoryItem({
        catalogId,
        kind,
        quantity: 1,
        originType: 'e2e',
        originId: `e2e-${catalogId}-${index}-${Date.now()}`,
        acquiredAt: new Date().toISOString()
      });
    }
    runtime.broadcastToolsUpdated();
  }, items);
}

test('收藏全部摆好时不提示放满，院落真的放满才提示', async ({ app, window }) => {
  await openGarden(window);

  const empty = await openPlacementTray(window);
  await expect(empty.getByText('没有可摆放的物品')).toBeVisible();
  await expect(empty.getByText(/院落已经放满/)).toHaveCount(0);
  await window.keyboard.press('Escape');
  await expect(window.getByRole('dialog')).toHaveCount(0);

  await grantItems(app, [
    { catalogId: 'furniture-4', kind: 'furniture' },
    { catalogId: 'furniture-5', kind: 'furniture' },
    { catalogId: 'furniture-6', kind: 'furniture' }
  ]);
  await (await openPlacementTray(window)).getByRole('button', { name: /^书架/ }).click();
  await expect(window.getByText('已摆放 3/4 件')).toBeVisible();
  await (await openPlacementTray(window)).getByRole('button', { name: /^落地灯/ }).click();
  await expect(window.getByText('已摆放 4/4 件')).toBeVisible();

  const full = await openPlacementTray(window);
  await expect(full.getByText(/院落已经放满/)).toBeVisible();
});

test('林间满员后多出的树留在背景树林，收起一棵可以换上，家具仍可摆放', async ({ app, window }) => {
  await openGarden(window);
  await grantItems(app, Array.from({ length: 18 }, (_, index) => ({
    catalogId: `species-${(index % 6) + 1}`,
    kind: 'tree'
  })));

  const placeTrees = await app.electronApp.evaluate(async () => {
    const runtime = global.__moliTodoApp.toolsRuntime;
    const placed = await runtime.placementUseCases.autoPlace();
    runtime.broadcastToolsUpdated();
    return placed.length;
  });
  expect(placeTrees).toBe(16);
  await expect(window.getByText('林间 · 18 棵')).toBeVisible();

  await grantItems(app, [{ catalogId: 'furniture-2', kind: 'furniture' }]);
  const tray = await openPlacementTray(window);
  await expect(tray.getByText(/林间已种满 16 棵/)).toBeVisible();
  await expect(tray.getByRole('button', { name: /1×1/ })).toHaveCount(0);
  await tray.getByRole('button', { name: /^小桌/ }).click();
  await expect(window.getByText('已摆放 3/4 件')).toBeVisible();

  // 只剩树林里的树：院落没满，只说明林间已满
  const onlyTrees = await openPlacementTray(window);
  await expect(onlyTrees.getByText('没有可摆放的物品')).toBeVisible();
  await expect(onlyTrees.getByText(/林间已种满 16 棵/)).toBeVisible();
  await expect(onlyTrees.getByText(/院落已经放满/)).toHaveCount(0);
  await window.keyboard.press('Escape');
  await expect(window.getByRole('dialog')).toHaveCount(0);

  // 收起一棵树腾出位置后，树林里的树出现在托盘，摆上后林间总数不变
  await app.electronApp.evaluate(async () => {
    const runtime = global.__moliTodoApp.toolsRuntime;
    const placements = await runtime.gardenRepository.listPlacements();
    const tree = placements.find((placement) => placement.regionId === 'orchard');
    await runtime.removePlacement(tree.inventoryId);
  });
  const refilled = await openPlacementTray(window);
  await expect(refilled.getByText(/林间已种满/)).toHaveCount(0);
  await refilled.getByRole('button', { name: /1×1/ }).first().click();
  await expect(window.getByText('林间 · 18 棵')).toBeVisible();
  const orchardPlaced = await app.electronApp.evaluate(async () => {
    const placements = await global.__moliTodoApp.toolsRuntime.gardenRepository.listPlacements();
    return placements.filter((placement) => placement.regionId === 'orchard').length;
  });
  expect(orchardPlaced).toBe(16);
});
