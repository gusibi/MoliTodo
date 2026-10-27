/**
 * 更新元数据的纯函数工具。
 *
 * 这里不依赖 Electron，方便在 node:test 中直接验证版本比较与安装包选择逻辑。
 */

const REPOSITORY = 'gusibi/MoliTodo';
const RELEASE_API_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const RELEASE_PAGE_URL = `https://github.com/${REPOSITORY}/releases`;
const RELEASE_DOWNLOAD_BASE = `https://github.com/${REPOSITORY}/releases/download`;

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

/**
 * 比较两个版本号，返回 1 / 0 / -1。
 * 只处理 MoliTodo 使用的 x.y.z 形式；预发布后缀按“低于同号正式版”处理。
 */
function compareVersions(left, right) {
  const parse = (value) => {
    const [core, prerelease = ''] = normalizeVersion(value).split('-');
    const parts = core.split('.').map((part) => {
      const number = Number.parseInt(part, 10);
      return Number.isFinite(number) ? number : 0;
    });
    return { parts, prerelease };
  };

  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.parts.length, b.parts.length);

  for (let index = 0; index < length; index += 1) {
    const aPart = a.parts[index] || 0;
    const bPart = b.parts[index] || 0;
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }

  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease > b.prerelease ? 1 : -1;
}

function stripYamlValue(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * 解析 electron-builder 生成的 latest-mac.yml / latest.yml。
 * 只取 files 里的 url / sha512 / size 三个字段，避免引入 YAML 依赖。
 */
function parseUpdateFiles(yamlText) {
  const files = [];
  let current = null;

  for (const rawLine of String(yamlText || '').split('\n')) {
    const line = rawLine.replace(/\r$/, '');

    const urlMatch = line.match(/^\s*-\s*url:\s*(.+)$/);
    if (urlMatch) {
      current = { url: stripYamlValue(urlMatch[1]) };
      files.push(current);
      continue;
    }

    // 顶格的键（如 path / sha512 / releaseDate）不属于 files 列表
    if (/^\S/.test(line)) {
      current = null;
      continue;
    }

    if (!current) continue;

    const fieldMatch = line.match(/^\s*(sha512|size):\s*(.+)$/);
    if (!fieldMatch) continue;

    const [, key, rawValue] = fieldMatch;
    current[key] = key === 'size' ? Number.parseInt(stripYamlValue(rawValue), 10) || 0 : stripYamlValue(rawValue);
  }

  return files.filter((file) => file.url);
}

function isArm64File(fileName) {
  return /(arm64|aarch64)/i.test(fileName);
}

/**
 * 从安装包列表中挑出当前架构可用的 macOS DMG。
 * electron-builder 的默认命名是 MoliTodo-<version>.dmg（x64）与 MoliTodo-<version>-arm64.dmg。
 */
function selectMacAsset(files, arch) {
  const candidates = (files || []).filter((file) => /\.dmg$/i.test(file.url));
  if (candidates.length === 0) return null;

  const expectArm64 = arch === 'arm64';
  const matched = candidates.find((file) => isArm64File(file.url) === expectArm64);
  return matched || candidates[0];
}

function buildDownloadUrl(version, fileName) {
  return `${RELEASE_DOWNLOAD_BASE}/v${normalizeVersion(version)}/${encodeURIComponent(fileName)}`;
}

module.exports = {
  REPOSITORY,
  RELEASE_API_URL,
  RELEASE_PAGE_URL,
  normalizeVersion,
  compareVersions,
  parseUpdateFiles,
  selectMacAsset,
  buildDownloadUrl
};
