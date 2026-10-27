const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeVersion,
  compareVersions,
  parseUpdateFiles,
  selectMacAsset,
  buildDownloadUrl
} = require('../src/main/update-release')

const LATEST_MAC_YML = `version: 1.5.4
files:
  - url: MoliTodo-1.5.4.dmg
    sha512: x64sha512==
    size: 212282332
  - url: MoliTodo-1.5.4-arm64.dmg
    sha512: arm64sha512==
    size: 207103660
path: MoliTodo-1.5.4.dmg
sha512: x64sha512==
releaseDate: '2026-10-25T16:15:11.142Z'
`

test('normalizeVersion strips the leading v', () => {
  assert.equal(normalizeVersion('v1.5.4'), '1.5.4')
  assert.equal(normalizeVersion(' 1.5.4 '), '1.5.4')
  assert.equal(normalizeVersion(undefined), '')
})

test('compareVersions orders release versions', () => {
  assert.equal(compareVersions('1.5.5', '1.5.4'), 1)
  assert.equal(compareVersions('1.5.4', '1.5.4'), 0)
  assert.equal(compareVersions('1.5.0', '1.5.4'), -1)
  assert.equal(compareVersions('v1.10.0', '1.9.9'), 1)
  assert.equal(compareVersions('2.0', '2.0.0'), 0)
  assert.equal(compareVersions('1.6.0-beta.1', '1.6.0'), -1)
})

test('parseUpdateFiles reads url, sha512 and size from latest-mac.yml', () => {
  const files = parseUpdateFiles(LATEST_MAC_YML)

  assert.deepEqual(files, [
    { url: 'MoliTodo-1.5.4.dmg', sha512: 'x64sha512==', size: 212282332 },
    { url: 'MoliTodo-1.5.4-arm64.dmg', sha512: 'arm64sha512==', size: 207103660 }
  ])
})

test('selectMacAsset picks the dmg matching the running architecture', () => {
  const files = parseUpdateFiles(LATEST_MAC_YML)

  assert.equal(selectMacAsset(files, 'arm64').url, 'MoliTodo-1.5.4-arm64.dmg')
  assert.equal(selectMacAsset(files, 'x64').url, 'MoliTodo-1.5.4.dmg')
})

test('selectMacAsset ignores non-dmg entries and falls back to the first candidate', () => {
  const files = [
    { url: 'MoliTodo-1.5.4-arm64-mac.zip', sha512: 'zip==', size: 1 },
    { url: 'MoliTodo-1.5.4.dmg', sha512: 'dmg==', size: 2 }
  ]

  assert.equal(selectMacAsset(files, 'arm64').url, 'MoliTodo-1.5.4.dmg')
  assert.equal(selectMacAsset([], 'arm64'), null)
})

test('buildDownloadUrl points at the release asset', () => {
  assert.equal(
    buildDownloadUrl('v1.5.4', 'MoliTodo-1.5.4-arm64.dmg'),
    'https://github.com/gusibi/MoliTodo/releases/download/v1.5.4/MoliTodo-1.5.4-arm64.dmg'
  )
})
