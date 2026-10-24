/**
 * 小院自由摆放模板。
 * 地块是连续平面，容量按“已摆放件数”计算；尺寸只用于边界与碰撞。
 */

const GARDEN_BOUNDS = Object.freeze({
  minX: -4.5,
  maxX: 4.5,
  minZ: -4.5,
  maxZ: 4.5
});

const TEMPLATE_POSITIONS = Object.freeze({
  'furniture-1': { x: -2.0, z: 2.0 },
  'furniture-2': { x: 0, z: 2.2 },
  'furniture-3': { x: 2.8, z: 2.2 },
  'furniture-4': { x: -4.0, z: -0.2 },
  'furniture-5': { x: -4.0, z: 3.0 },
  'furniture-6': { x: -1.2, z: 4.0 },
  'decor-1': { x: 3.8, z: -0.4 },
  'decor-2': { x: -2.8, z: -0.5 },
  'decor-3': { x: 0, z: -3.0 },
  'decor-4': { x: -3.9, z: 0.8 },
  'decor-5': { x: -3.9, z: 1.8 },
  'decor-6': { x: -3.0, z: -3.0 },
  'pet-1': { x: -4.0, z: 4.1 },
  'pet-2': { x: -2.9, z: 4.1 },
  'pet-3': { x: 2.6, z: 4.1 },
  'pet-4': { x: 4.0, z: 4.1 },
  'special-tree-1': { x: 3.0, z: -3.0 },
  'species-1': { x: 1.5, z: -0.8 },
  'species-2': { x: -1.6, z: -0.8 },
  'species-3': { x: 1.2, z: 0.6 },
  'species-4': { x: -1.6, z: 0.6 },
  'species-5': { x: 2.6, z: 0.6 },
  'species-6': { x: -2.8, z: 3.8 },
  'garden-memorial': { x: -1.2, z: -3.9 }
});

const POSITION_TOKEN = /^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

function parsePositionToken(slotId) {
  const match = POSITION_TOKEN.exec(String(slotId || ''));
  if (!match) return null;
  return {
    x: Number(match[1]),
    z: Number(match[2])
  };
}

function positionToken(x, z) {
  return `@${Number(x).toFixed(2)},${Number(z).toFixed(2)}`;
}

function legacySlotPosition(slotNumber, region = 'garden') {
  const index = Math.max(0, Number(slotNumber) - 1);
  if (region === 'pet') {
    return { x: 3.2, z: -1.4 + index * 0.8 };
  }
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: -2.4 + column * 1.6,
    z: -1.2 + row * 1.6
  };
}

function positionForPlacement(placement) {
  if (!placement) return { x: 0, z: 0 };
  const parsed = parsePositionToken(placement.slotId);
  if (parsed) return parsed;
  const match = /^(?:slot|pet)-(\d+)$/.exec(String(placement.slotId || ''));
  if (match) {
    return legacySlotPosition(Number(match[1]), placement.regionId || 'garden');
  }
  return { x: 0, z: 0 };
}

function templatePositionFor(catalogId) {
  return TEMPLATE_POSITIONS[catalogId] || null;
}

function normalizePosition(position) {
  const x = Number(position?.x);
  const z = Number(position?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z };
}

function isWithinBounds(position, size, bounds = GARDEN_BOUNDS) {
  const half = Math.max(0.5, Number(size) || 1) / 2;
  return position.x - half >= bounds.minX
    && position.x + half <= bounds.maxX
    && position.z - half >= bounds.minZ
    && position.z + half <= bounds.maxZ;
}

function clampToBounds(position, size, bounds = GARDEN_BOUNDS) {
  const half = Math.max(0.5, Number(size) || 1) / 2;
  return {
    x: Math.min(bounds.maxX - half, Math.max(bounds.minX + half, position.x)),
    z: Math.min(bounds.maxZ - half, Math.max(bounds.minZ + half, position.z))
  };
}

function rectsOverlap(a, aSize, b, bSize, margin = 0.08) {
  const aHalf = Math.max(0.5, Number(aSize) || 1) / 2;
  const bHalf = Math.max(0.5, Number(bSize) || 1) / 2;
  return Math.abs(a.x - b.x) < aHalf + bHalf + margin
    && Math.abs(a.z - b.z) < aHalf + bHalf + margin;
}

function overlapsAny(position, size, occupied) {
  return occupied.some((entry) => rectsOverlap(position, size, entry, entry.size));
}

function buildCandidates(bounds) {
  const candidates = [];
  const step = 0.25;
  for (let x = bounds.minX + 0.5; x <= bounds.maxX - 0.5; x += step) {
    for (let z = bounds.minZ + 0.5; z <= bounds.maxZ - 0.5; z += step) {
      candidates.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
    }
  }
  return candidates.sort((a, b) => (
    (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z)
  ));
}

function findFreePosition({
  catalogId,
  size = 1,
  occupied = [],
  bounds = GARDEN_BOUNDS
} = {}) {
  const preferred = templatePositionFor(catalogId);
  if (preferred && isWithinBounds(preferred, size, bounds) && !overlapsAny(preferred, size, occupied)) {
    return { ...preferred };
  }
  const candidates = buildCandidates(bounds);
  const sorted = preferred
    ? [...candidates].sort((a, b) => {
        const da = (a.x - preferred.x) ** 2 + (a.z - preferred.z) ** 2;
        const db = (b.x - preferred.x) ** 2 + (b.z - preferred.z) ** 2;
        return da - db;
      })
    : candidates;
  for (const candidate of sorted) {
    if (isWithinBounds(candidate, size, bounds) && !overlapsAny(candidate, size, occupied)) {
      return candidate;
    }
  }
  return null;
}

module.exports = {
  GARDEN_BOUNDS,
  TEMPLATE_POSITIONS,
  parsePositionToken,
  positionToken,
  legacySlotPosition,
  positionForPlacement,
  templatePositionFor,
  normalizePosition,
  isWithinBounds,
  clampToBounds,
  rectsOverlap,
  findFreePosition
};
