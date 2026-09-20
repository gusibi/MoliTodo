const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// 清单图标映射为纯 ESM 模块，通过动态 import 验证旧名称兼容与未知回退。
const moduleUrl = pathToFileURL(
  path.join(__dirname, '..', 'src', 'renderer', 'src', 'components', 'ui', 'list-icons.js')
).href

test('list icon mapping keeps all persisted legacy names resolvable', async () => {
  const { LIST_ICONS, LIST_ICON_NAMES, resolveListIcon } = await import(moduleUrl)

  const legacyNames = [
    'list', 'inbox', 'star', 'heart', 'bookmark', 'flag',
    'folder', 'briefcase', 'home', 'user', 'calendar',
    'clock', 'target', 'trophy', 'book', 'music'
  ]

  assert.deepEqual(LIST_ICON_NAMES.sort(), [...legacyNames].sort())
  for (const name of legacyNames) {
    assert.equal(resolveListIcon(name), LIST_ICONS[name], `${name} 应映射到自身图标`)
  }
})

test('unknown list icon names fall back to the default icon without throwing', async () => {
  const { LIST_ICONS, resolveListIcon } = await import(moduleUrl)

  assert.equal(resolveListIcon('mystery-icon'), LIST_ICONS.list)
  assert.equal(resolveListIcon(undefined), LIST_ICONS.list)
  assert.equal(resolveListIcon(''), LIST_ICONS.list)
})
