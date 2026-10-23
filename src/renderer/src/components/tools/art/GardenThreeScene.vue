<template>
  <div ref="host" class="absolute inset-0 overflow-hidden bg-[#bfe3ff]">
    <div class="scene-sky pointer-events-none absolute inset-0" />
    <div class="scene-cloud scene-cloud-a" />
    <div class="scene-cloud scene-cloud-b" />
    <div class="scene-cloud scene-cloud-c" />
    <div class="pointer-events-none absolute right-[8%] top-[8%] h-16 w-16 rounded-full bg-amber-200/70 blur-[1px]" />
    <div class="pointer-events-none absolute right-[6%] top-[5%] h-24 w-24 rounded-full bg-amber-100/30 blur-xl" />

    <canvas
      v-show="!failed"
      ref="canvas"
      class="absolute inset-0 block h-full w-full"
      :aria-label="$t('tools.sceneLabel')"
    />

    <GardenScene v-if="failed" :level="props.level" class="absolute inset-0" />
    <p v-if="failed" class="absolute inset-x-0 bottom-20 text-center text-xs text-muted-foreground">
      {{ $t('tools.sceneFallback') }}
    </p>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background/90 via-background/25 to-transparent" />

    <IconButton
      v-if="!failed"
      class="absolute left-3 top-3 z-30 border border-border/40 bg-background/75 shadow-sm backdrop-blur"
      size="icon-sm"
      :label="$t('tools.resetView')"
      @click="resetView"
    >
      <RotateCcw class="h-3.5 w-3.5" />
    </IconButton>

    <div
      v-if="plantLabel.visible && props.plant"
      class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border border-white/60 bg-background/80 px-2.5 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur"
      :style="{ left: `${plantLabel.x}px`, top: `${plantLabel.y}px` }"
    >
      {{ $t(`tools.stage.${props.plant.stage}`) }} · {{ props.plant.growthScore }}/15
    </div>

    <template v-if="!failed">
      <button
        v-for="marker in markers"
        :key="marker.key"
        v-show="marker.visible && markerShown(marker)"
        type="button"
        class="absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring"
        :class="markerClass(marker)"
        :style="{ left: `${marker.x}px`, top: `${marker.y}px` }"
        :aria-label="markerLabel(marker)"
        @click.stop="activateMarker(marker)"
      >
        <X v-if="!marker.empty" class="h-3.5 w-3.5" aria-hidden="true" />
        <Plus v-else class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </template>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Plus, RotateCcw, X } from '@lucide/vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import GardenScene from './GardenScene.vue'

const props = defineProps({
  level: { type: Number, default: 1 },
  plant: { type: Object, default: null },
  maturedPlant: { type: Object, default: null },
  plots: { type: Array, default: () => [] },
  petPlots: { type: Array, default: () => [] },
  layoutMode: { type: Boolean, default: false }
})

const emit = defineEmits(['open-plot', 'remove-placement'])
const { t } = useI18n()

const host = ref(null)
const canvas = ref(null)
const failed = ref(false)
const markers = ref([])
const plantLabel = ref({ visible: false, x: 0, y: 0 })

let renderer = null
let scene = null
let camera = null
let controls = null
let frame = null
let resizeObserver = null
let lastMarkerUpdate = 0
let elapsed = 0
let lastTime = 0
let plantGroup = null
let maturedGroup = null
let plotGroup = null
let levelGroup = null
let progressRing = null
let animatedItems = []
let intro = null
let plantGrow = null
let reducedMotion = false

const GROUND_Y = 0.29
const ISLAND_WIDTH = 9.6
const ISLAND_DEPTH = 8.6
const GRID_COLUMNS = 4
const GRID_X = -1.55
const GRID_Z = -0.18
const GRID_GAP_X = 1.06
const GRID_GAP_Z = 0.64
const PLANT_POSITION = new THREE.Vector3(0.68, GROUND_Y, -1.46)
const MATURED_POSITION = new THREE.Vector3(3.05, GROUND_Y, -2.45)

const palette = {
  grass: 0x7fbd56,
  grassLight: 0x94cf6a,
  grassDark: 0x5f9c41,
  dirt: 0x8a5a3b,
  dirtDark: 0x6d442c,
  stone: 0x9a9a9a,
  stoneDark: 0x777777,
  wood: 0x9a6a43,
  woodDark: 0x6d442c,
  woodLight: 0xc08a5a,
  cream: 0xecd6a9,
  creamDark: 0xd3ba8a,
  roof: 0x8a4a34,
  roofDark: 0x683526,
  leaf: 0x5fa84a,
  leafLight: 0x86ce63,
  leafDark: 0x407d35,
  water: 0x64b5d6,
  glow: 0xffd87a,
  cushion: 0x6aa9d9
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.9,
    metalness: options.metalness ?? 0,
    flatShading: options.flatShading !== false,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1
  })
}

function addMesh(parent, geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, mat)
  object.position.set(...position)
  object.rotation.set(...rotation)
  object.castShadow = true
  object.receiveShadow = true
  parent.add(object)
  return object
}

function addBox(parent, width, height, depth, color, x, y, z, options = {}) {
  return addMesh(
    parent,
    new THREE.BoxGeometry(width, height, depth),
    material(color, options),
    [x, y, z],
    options.rotation || [0, 0, 0]
  )
}

function addRoundedBox(parent, width, height, depth, radius, color, x, y, z, options = {}) {
  return addMesh(
    parent,
    new RoundedBoxGeometry(width, height, depth, 3, radius),
    material(color, options),
    [x, y, z],
    options.rotation || [0, 0, 0]
  )
}

function addCylinder(parent, radiusTop, radiusBottom, height, segments, color, x, y, z, options = {}) {
  return addMesh(
    parent,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material(color, options),
    [x, y, z],
    options.rotation || [0, 0, 0]
  )
}

function addSphere(parent, radius, color, x, y, z, segments = 8, options = {}) {
  return addMesh(
    parent,
    new THREE.SphereGeometry(radius, segments, Math.max(4, Math.floor(segments * 0.7))),
    material(color, options),
    [x, y, z],
    options.rotation || [0, 0, 0]
  )
}

function addIco(parent, radius, color, x, y, z, options = {}) {
  return addMesh(
    parent,
    new THREE.IcosahedronGeometry(radius, 0),
    material(color, options),
    [x, y, z],
    options.rotation || [0, 0, 0]
  )
}

function disposeObject(object) {
  if (!object) return
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of materials) {
        if (mat.map) mat.map.dispose()
        mat.dispose()
      }
    }
  })
}

function clearGroup(group) {
  if (!group) return
  while (group.children.length) {
    const child = group.children.pop()
    disposeObject(child)
  }
}

function slotWorld(slotNumber) {
  const index = Math.max(0, Number(slotNumber) - 1)
  const column = index % GRID_COLUMNS
  const row = Math.floor(index / GRID_COLUMNS)
  return new THREE.Vector3(
    GRID_X + column * GRID_GAP_X,
    GROUND_Y,
    GRID_Z + row * GRID_GAP_Z
  )
}

function petWorld(index) {
  return new THREE.Vector3(2.75, GROUND_Y, -1.55 + index * 0.78)
}

function markerClass(marker) {
  if (!marker.empty) {
    return 'border-rose-200/80 bg-rose-500/90 text-white shadow-md hover:bg-rose-600'
  }
  if (marker.region === 'pet') {
    return props.layoutMode
      ? 'border-emerald-200 bg-emerald-300/95 text-emerald-950 shadow-[0_0_0_4px_rgba(127,189,86,.25)] hover:bg-emerald-200'
      : 'border-white/80 bg-white/55 text-emerald-800 backdrop-blur-sm hover:bg-white/85'
  }
  return props.layoutMode
    ? 'border-amber-200 bg-amber-300/95 text-amber-950 shadow-[0_0_0_4px_rgba(255,216,122,.25)] hover:bg-amber-200'
    : 'border-white/80 bg-white/55 text-stone-700 backdrop-blur-sm hover:bg-white/85'
}

function markerShown(marker) {
  if (!marker.empty) return props.layoutMode
  if (marker.region === 'pet') return props.layoutMode
  return true
}

function markerLabel(marker) {
  if (!marker.empty) {
    return marker.label
      ? `${marker.label} · ${t('tools.placementRemove')}`
      : t('tools.placementRemove')
  }
  return marker.region === 'pet' ? t('tools.petSlotEmpty') : t('tools.placementEmpty')
}

function activateMarker(marker) {
  if (marker.empty) {
    emit('open-plot', marker.slotId, marker.region)
  } else {
    emit('remove-placement', marker.inventoryId)
  }
}

function buildPlantBed() {
  const bed = new THREE.Group()
  bed.position.copy(PLANT_POSITION)
  scene.add(bed)
  addCylinder(bed, 0.84, 0.9, 0.14, 22, palette.stone, 0, 0.07, 0)
  addCylinder(bed, 0.76, 0.8, 0.1, 22, palette.dirt, 0, 0.12, 0)
  addCylinder(bed, 0.7, 0.7, 0.03, 22, palette.dirtDark, 0, 0.18, 0)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.032, 5, 22),
    material(0xe4c37c, { roughness: 0.8 })
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.2
  ring.castShadow = false
  bed.add(ring)

  const ringBase = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 0.92, 48),
    new THREE.MeshBasicMaterial({ color: 0x5f7f4a, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  )
  ringBase.rotation.x = -Math.PI / 2
  ringBase.position.y = 0.215
  bed.add(ringBase)

  progressRing = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 0.92, 48, 1, -Math.PI / 2, 0),
    new THREE.MeshBasicMaterial({ color: 0xf6d27a, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
  )
  progressRing.rotation.x = -Math.PI / 2
  progressRing.position.y = 0.22
  bed.add(progressRing)
  updateProgressRing()
}

function updateProgressRing() {
  if (!progressRing) return
  const ratio = props.plant ? Math.max(0.02, Math.min(1, (props.plant.growthScore || 0) / 15)) : 0
  progressRing.visible = ratio > 0
  if (!ratio) return
  progressRing.geometry.dispose()
  progressRing.geometry = new THREE.RingGeometry(0.86, 0.92, 48, 1, -Math.PI / 2, Math.PI * 2 * ratio)
}

function buildIsland() {
  const island = new THREE.Group()
  addRoundedBox(island, ISLAND_WIDTH + 0.5, 0.34, ISLAND_DEPTH + 0.5, 0.28, palette.stone, 0, -0.42, 0)
  addRoundedBox(island, ISLAND_WIDTH, 0.52, ISLAND_DEPTH, 0.34, palette.dirt, 0, -0.08, 0)
  addRoundedBox(island, ISLAND_WIDTH - 0.12, 0.16, ISLAND_DEPTH - 0.12, 0.3, palette.grass, 0, 0.18, 0)
  addRoundedBox(island, ISLAND_WIDTH - 0.35, 0.025, ISLAND_DEPTH - 0.35, 0.28, palette.grassLight, 0, 0.27, 0)
  scene.add(island)
}

function buildHouse() {
  const house = new THREE.Group()
  house.position.set(-2.45, GROUND_Y, -1.78)
  scene.add(house)

  addRoundedBox(house, 3.0, 0.22, 2.5, 0.08, palette.stone, 0, 0.12, 0)
  addRoundedBox(house, 2.7, 1.55, 2.15, 0.1, palette.cream, 0, 0.92, 0)
  addBox(house, 2.74, 0.1, 2.19, palette.creamDark, 0, 1.66, 0)
  addBox(house, 2.72, 0.12, 2.17, palette.woodDark, 0, 0.34, 0)

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.35, 1.18, 4),
    material(palette.roof, { flatShading: true })
  )
  roof.position.set(0, 2.12, 0)
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  roof.receiveShadow = true
  house.add(roof)

  addBox(house, 0.3, 0.74, 0.3, 0x8a4a34, 0.82, 2.25, -0.5)
  addBox(house, 0.36, 0.08, 0.36, 0x5f3626, 0.82, 2.64, -0.5)

  addBox(house, 0.54, 0.88, 0.06, 0x6b4226, -0.52, 0.58, 1.1)
  addBox(house, 0.08, 0.08, 0.04, 0xf2c14e, -0.34, 0.68, 1.14)

  const windowMat = material(0x9fd4e8, { emissive: 0x2b6f8a, emissiveIntensity: 0.22, roughness: 0.4 })
  addBox(house, 0.58, 0.5, 0.06, palette.woodDark, 0.55, 1.17, 1.1)
  const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.02), windowMat)
  frontWindow.position.set(0.55, 1.17, 1.14)
  house.add(frontWindow)
  addBox(house, 0.06, 0.4, 0.03, 0xdff3fb, 0.55, 1.17, 1.16)
  addBox(house, 0.48, 0.05, 0.03, 0xdff3fb, 0.55, 1.17, 1.16)

  addBox(house, 0.06, 0.5, 0.52, palette.woodDark, 1.37, 1.12, -0.45)
  const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.38, 0.4), windowMat)
  sideWindow.position.set(1.41, 1.12, -0.45)
  house.add(sideWindow)
  addBox(house, 0.03, 0.4, 0.05, 0xdff3fb, 1.43, 1.12, -0.45)
  addBox(house, 0.03, 0.05, 0.42, 0xdff3fb, 1.43, 1.12, -0.45)

  addRoundedBox(house, 0.72, 0.11, 0.22, 0.04, palette.woodDark, 0.55, 0.78, 1.2)
  addFlower(house, 0.36, 0.84, 1.23, 0xf2a03d)
  addFlower(house, 0.55, 0.84, 1.23, 0xef7f8f)

  addRoundedBox(house, 0.92, 0.12, 0.3, 0.04, palette.stone, -0.3, 0.18, 1.25)
  addBox(house, 0.5, 0.18, 0.06, palette.wood, -0.5, 0.32, 1.17)
}

function addFlower(parent, x, y, z, color) {
  addCylinder(parent, 0.014, 0.018, 0.2, 5, 0x4f8f3f, x, y + 0.1, z)
  addIco(parent, 0.065, color, x, y + 0.22, z)
  addIco(parent, 0.045, 0xf7f2dd, x + 0.06, y + 0.2, z + 0.025)
}

function buildFence() {
  const fence = new THREE.Group()
  scene.add(fence)
  const postGeo = new THREE.BoxGeometry(0.14, 0.82, 0.14)
  const postMat = material(palette.wood)
  const railMat = material(palette.woodDark)
  for (let index = 0; index < 8; index += 1) {
    const z = -2.85 + index * 0.72
    const post = new THREE.Mesh(postGeo, postMat)
    post.position.set(3.55, GROUND_Y + 0.41, z)
    post.castShadow = true
    post.receiveShadow = true
    fence.add(post)
    if (index < 7) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.72), railMat)
      rail.position.set(3.55, GROUND_Y + 0.36, z + 0.36)
      rail.castShadow = true
      fence.add(rail)
      const rail2 = rail.clone()
      rail2.position.y = GROUND_Y + 0.62
      fence.add(rail2)
    }
    addIco(fence, 0.07, index % 3 === 0 ? 0xef7f8f : 0xf2c14e, 3.55, GROUND_Y + 0.88, z)
  }
}

function buildLantern() {
  const lantern = new THREE.Group()
  lantern.position.set(2.98, GROUND_Y, -2.45)
  scene.add(lantern)
  addCylinder(lantern, 0.06, 0.08, 1.5, 6, palette.woodDark, 0, 0.75, 0)
  addBox(lantern, 0.32, 0.38, 0.32, 0x3f3932, 0, 1.56, 0)
  addBox(lantern, 0.22, 0.22, 0.22, palette.glow, 0, 1.56, 0, {
    emissive: 0xffc85c,
    emissiveIntensity: 1.2,
    roughness: 0.4
  })
  addBox(lantern, 0.42, 0.06, 0.42, 0x2b2620, 0, 1.78, 0)
  const light = new THREE.PointLight(0xffc86b, 0.9, 4.5, 2)
  light.position.set(0, 1.55, 0)
  lantern.add(light)
}

function buildPath() {
  const path = new THREE.Group()
  const points = [
    [-2.02, -0.05],
    [-1.55, 0.42],
    [-1.04, 0.88],
    [-0.55, 1.34],
    [-0.05, 1.78]
  ]
  for (const [x, z] of points) {
    const stone = addCylinder(
      path,
      0.26,
      0.29,
      0.055,
      7,
      palette.stone,
      x,
      GROUND_Y + 0.02,
      z,
      { rotation: [0, Math.random() * 0.4, 0] }
    )
    stone.castShadow = false
  }
  scene.add(path)
}

function buildFlowersAndBushes() {
  const garden = new THREE.Group()
  const flowers = [
    [-4.1, 2.2, 0xef7f8f],
    [-3.72, 2.55, 0xf2c14e],
    [-3.3, 2.95, 0xf7f2dd],
    [4.0, 1.5, 0xf2c14e],
    [3.75, 1.95, 0xef7f8f],
    [3.95, 2.65, 0xf7f2dd],
    [-3.9, -0.65, 0xf2c14e],
    [3.8, -0.55, 0xef7f8f],
    [-2.75, 3.55, 0xef7f8f],
    [2.35, 3.55, 0xf7f2dd]
  ]
  for (const [x, z, color] of flowers) {
    addFlower(garden, x, GROUND_Y, z, color)
  }
  const bushes = [
    [-3.95, 1.2, 0.28],
    [3.95, 2.2, 0.32],
    [-1.2, 3.9, 0.25],
    [1.3, 3.8, 0.28]
  ]
  for (const [x, z, radius] of bushes) {
    addIco(garden, radius, palette.leaf, x, GROUND_Y + radius * 0.8, z)
    addIco(garden, radius * 0.65, palette.leafDark, x + 0.15, GROUND_Y + radius * 0.6, z + 0.1)
  }
  scene.add(garden)
}

function createTree(scale = 1, x = 0, z = 0) {
  const tree = new THREE.Group()
  tree.position.set(x, GROUND_Y, z)
  tree.scale.setScalar(scale)
  addCylinder(tree, 0.1, 0.14, 1.2, 6, palette.woodDark, 0, 0.6, 0)
  addIco(tree, 0.58, palette.leaf, 0, 1.45, 0)
  addIco(tree, 0.45, palette.leafLight, -0.36, 1.65, 0.1)
  addIco(tree, 0.43, palette.leafDark, 0.4, 1.55, -0.08)
  addIco(tree, 0.34, palette.leaf, 0.1, 1.95, 0.18)
  return tree
}

function buildLevelDetails() {
  if (!scene) return
  if (!levelGroup) {
    levelGroup = new THREE.Group()
    scene.add(levelGroup)
  }
  clearGroup(levelGroup)

  if (props.level >= 2) {
    addRoundedBox(levelGroup, 1.4, 0.1, 0.7, 0.08, palette.dirt, -3.72, GROUND_Y + 0.06, 2.65)
    for (let index = 0; index < 5; index += 1) {
      addFlower(levelGroup, -4.15 + index * 0.24, GROUND_Y + 0.06, 2.65, index % 2 ? 0xef7f8f : 0xf2c14e)
    }
  }

  if (props.level >= 3) {
    levelGroup.add(createTree(0.92, -4.15, -2.95))
    levelGroup.add(createTree(0.75, 4.0, -3.0))
  }

  if (props.level >= 4) {
    for (let index = 0; index < 5; index += 1) {
      addBox(levelGroup, 0.42, 0.28, 0.28, palette.stone, -4.35 + index * 0.45, GROUND_Y + 0.14, -0.35)
    }
  }

  if (props.level >= 5) {
    addCylinder(levelGroup, 0.92, 0.98, 0.08, 18, palette.stone, -3.0, GROUND_Y + 0.05, 3.05)
    addCylinder(levelGroup, 0.78, 0.82, 0.06, 18, palette.water, -3.0, GROUND_Y + 0.1, 3.05, {
      transparent: true,
      opacity: 0.82,
      roughness: 0.25
    })
    addCylinder(levelGroup, 0.09, 0.13, 0.26, 6, palette.stone, -3.0, GROUND_Y + 0.24, 3.05)
    addCylinder(levelGroup, 0.43, 0.43, 0.02, 14, palette.water, -3.0, GROUND_Y + 0.27, 3.05, {
      transparent: true,
      opacity: 0.65
    })
  }
}

function makePlantModel(stage, speciesId, scale = 1) {
  const group = new THREE.Group()
  const accent = {
    'species-1': 0xf5a623,
    'species-2': 0xec4899,
    'species-3': 0x8b5cf6,
    'species-4': 0x06b6d4,
    'species-5': 0xef4444,
    'species-6': 0x22c55e
  }[speciesId] || 0xf5a623

  if (stage === 'seed') {
    addSphere(group, 0.18, 0x7a4f2e, 0, 0.15, 0, 7)
    addSphere(group, 0.12, 0x5fa84a, 0.12, 0.34, 0.02, 6)
    addSphere(group, 0.095, 0x86ce63, -0.1, 0.4, 0.05, 6)
    addSphere(group, 0.065, accent, 0.02, 0.46, 0.02, 6)
  } else if (stage === 'sprout') {
    addCylinder(group, 0.035, 0.05, 0.62, 5, 0x5fa84a, 0, 0.31, 0)
    addSphere(group, 0.16, 0x86ce63, -0.15, 0.44, 0.02, 7)
    addSphere(group, 0.15, 0x5fa84a, 0.16, 0.6, 0, 7)
    addSphere(group, 0.06, accent, 0.01, 0.76, 0, 6)
  } else if (stage === 'sapling') {
    addCylinder(group, 0.065, 0.09, 0.95, 6, palette.wood, 0, 0.47, 0)
    addIco(group, 0.38, palette.leaf, 0, 1.1, 0)
    addIco(group, 0.28, palette.leafLight, -0.3, 1.04, 0.06)
    addIco(group, 0.28, palette.leafDark, 0.3, 0.98, -0.03)
    addSphere(group, 0.06, accent, 0.26, 1.16, 0.13, 6)
  } else {
    addCylinder(group, 0.12, 0.17, 1.45, 6, palette.wood, 0, 0.72, 0)
    addIco(group, 0.62, palette.leaf, 0, 1.78, 0)
    addIco(group, 0.44, palette.leafLight, -0.45, 1.68, 0.12)
    addIco(group, 0.46, palette.leafDark, 0.46, 1.62, -0.1)
    addIco(group, 0.38, palette.leaf, 0.14, 2.2, 0.16)
    addIco(group, 0.33, palette.leafDark, -0.18, 2.16, -0.12)
    addSphere(group, 0.07, accent, 0.34, 1.9, 0.3, 6)
    addSphere(group, 0.065, accent, -0.38, 1.98, 0.1, 6)
    addSphere(group, 0.06, accent, 0.09, 1.7, -0.36, 6)
  }
  group.scale.setScalar(scale)
  return group
}

function syncPlant() {
  if (!scene) return
  if (plantGroup) {
    scene.remove(plantGroup)
    disposeObject(plantGroup)
    plantGroup = null
  }
  plantGrow = null
  if (!props.plant) {
    updateProgressRing()
    return
  }
  const stage = props.plant.stage || 'seed'
  const scale = stage === 'seed' ? 1.15 : stage === 'sprout' ? 1.2 : stage === 'sapling' ? 1.3 : 1.5
  plantGroup = makePlantModel(stage, props.plant.speciesId, scale)
  plantGroup.position.copy(PLANT_POSITION)
  plantGroup.userData.sway = true
  plantGroup.userData.targetScale = scale
  if (reducedMotion) {
    plantGroup.scale.setScalar(scale)
    plantGrow = null
  } else {
    plantGroup.scale.setScalar(0.08)
    plantGrow = { start: performance.now(), duration: 620, target: scale }
  }
  scene.add(plantGroup)
  updateProgressRing()
}

function syncMaturedPlant() {
  if (!scene) return
  if (maturedGroup) {
    scene.remove(maturedGroup)
    disposeObject(maturedGroup)
    maturedGroup = null
  }
  if (!props.maturedPlant) return
  maturedGroup = makePlantModel('mature', props.maturedPlant.speciesId, 0.82)
  maturedGroup.position.copy(MATURED_POSITION)
  scene.add(maturedGroup)
}

function makeChair() {
  const group = new THREE.Group()
  addRoundedBox(group, 0.46, 0.08, 0.46, 0.04, palette.cushion, 0, 0.36, 0)
  addBox(group, 0.46, 0.44, 0.08, palette.wood, 0, 0.58, -0.2)
  addBox(group, 0.08, 0.34, 0.08, palette.woodDark, -0.17, 0.17, 0.16)
  addBox(group, 0.08, 0.34, 0.08, palette.woodDark, 0.17, 0.17, 0.16)
  addBox(group, 0.08, 0.34, 0.08, palette.woodDark, -0.17, 0.17, -0.16)
  addBox(group, 0.08, 0.34, 0.08, palette.woodDark, 0.17, 0.17, -0.16)
  return group
}

function makeTable() {
  const group = new THREE.Group()
  addRoundedBox(group, 0.78, 0.09, 0.56, 0.04, palette.woodLight, 0, 0.52, 0)
  for (const x of [-0.28, 0.28]) {
    for (const z of [-0.16, 0.16]) {
      addBox(group, 0.08, 0.48, 0.08, palette.woodDark, x, 0.26, z)
    }
  }
  return group
}

function makeBench() {
  const group = new THREE.Group()
  addRoundedBox(group, 0.9, 0.1, 0.36, 0.04, palette.woodLight, 0, 0.34, 0)
  addBox(group, 0.9, 0.34, 0.08, palette.wood, 0, 0.52, -0.16)
  addBox(group, 0.86, 0.07, 0.07, palette.woodDark, 0, 0.42, -0.16)
  addBox(group, 0.08, 0.3, 0.08, palette.woodDark, -0.36, 0.15, 0.12)
  addBox(group, 0.08, 0.3, 0.08, palette.woodDark, 0.36, 0.15, 0.12)
  return group
}

function makeShelf() {
  const group = new THREE.Group()
  addRoundedBox(group, 0.58, 0.92, 0.28, 0.04, palette.wood, 0, 0.46, 0)
  addBox(group, 0.5, 0.04, 0.3, palette.woodDark, 0, 0.25, 0)
  addBox(group, 0.5, 0.04, 0.3, palette.woodDark, 0, 0.48, 0)
  addBox(group, 0.5, 0.04, 0.3, palette.woodDark, 0, 0.71, 0)
  addBox(group, 0.13, 0.18, 0.16, palette.cushion, -0.16, 0.59, 0.04)
  addBox(group, 0.12, 0.15, 0.16, 0xf2c14e, 0.03, 0.61, 0.04)
  addBox(group, 0.1, 0.2, 0.14, 0xef7f8f, 0.18, 0.6, 0.04)
  return group
}

function makeLamp() {
  const group = new THREE.Group()
  addCylinder(group, 0.05, 0.08, 1.0, 6, palette.woodDark, 0, 0.5, 0)
  addCylinder(group, 0.3, 0.18, 0.34, 8, palette.woodLight, 0, 1.08, 0)
  addCylinder(group, 0.18, 0.18, 0.06, 8, 0xfff0b0, 0, 0.9, 0, {
    emissive: 0xffd87a,
    emissiveIntensity: 1.1
  })
  addCylinder(group, 0.28, 0.28, 0.06, 8, palette.wood, 0, 1.28, 0)
  return group
}

function makeStool() {
  const group = new THREE.Group()
  addCylinder(group, 0.24, 0.24, 0.08, 8, palette.woodLight, 0, 0.32, 0)
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2
    addBox(group, 0.06, 0.3, 0.06, palette.woodDark, Math.cos(angle) * 0.16, 0.15, Math.sin(angle) * 0.16)
  }
  return group
}

function makePot() {
  const group = new THREE.Group()
  addCylinder(group, 0.2, 0.16, 0.32, 8, 0xb96a4a, 0, 0.16, 0)
  addCylinder(group, 0.22, 0.22, 0.06, 8, 0xd88a64, 0, 0.34, 0)
  addCylinder(group, 0.018, 0.024, 0.28, 5, 0x4f8f3f, 0, 0.48, 0)
  addSphere(group, 0.11, 0x6aa84f, -0.09, 0.55, 0.02, 7)
  addSphere(group, 0.1, 0x5fa84a, 0.1, 0.62, 0.01, 7)
  addIco(group, 0.07, 0xf2a03d, 0.01, 0.7, 0.02)
  return group
}

function makeLanternItem() {
  const group = new THREE.Group()
  addCylinder(group, 0.04, 0.05, 0.72, 6, 0x5b4a3e, 0, 0.36, 0)
  addBox(group, 0.32, 0.38, 0.32, 0x332c27, 0, 0.86, 0)
  addBox(group, 0.22, 0.24, 0.22, palette.glow, 0, 0.86, 0, {
    emissive: 0xffc85c,
    emissiveIntensity: 1.2
  })
  addBox(group, 0.42, 0.06, 0.42, 0x241f1c, 0, 1.08, 0)
  return group
}

function makeFountain() {
  const group = new THREE.Group()
  addCylinder(group, 0.46, 0.5, 0.12, 12, palette.stone, 0, 0.06, 0)
  addCylinder(group, 0.36, 0.38, 0.04, 12, palette.water, 0, 0.13, 0, {
    transparent: true,
    opacity: 0.82,
    roughness: 0.2
  })
  addCylinder(group, 0.07, 0.09, 0.42, 6, palette.stone, 0, 0.32, 0)
  addCylinder(group, 0.22, 0.22, 0.03, 10, palette.water, 0, 0.52, 0, {
    transparent: true,
    opacity: 0.7
  })
  addCylinder(group, 0.035, 0.045, 0.18, 5, palette.water, 0, 0.6, 0, {
    transparent: true,
    opacity: 0.55
  })
  return group
}

function makeBirdhouse() {
  const group = new THREE.Group()
  addCylinder(group, 0.045, 0.055, 0.6, 6, palette.woodDark, 0, 0.3, 0)
  addRoundedBox(group, 0.36, 0.32, 0.3, 0.04, palette.woodLight, 0, 0.72, 0)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.26, 4), material(palette.roofDark))
  roof.position.set(0, 0.98, 0)
  roof.rotation.y = Math.PI / 4
  group.add(roof)
  addSphere(group, 0.06, 0x332c27, 0, 0.74, 0.16, 6)
  return group
}

function makeStone() {
  const group = new THREE.Group()
  addIco(group, 0.38, palette.stone, 0, 0.28, 0, { rotation: [0.2, 0.5, 0.1] })
  addIco(group, 0.2, palette.stoneDark, 0.24, 0.16, 0.18)
  addIco(group, 0.16, palette.stone, -0.28, 0.13, -0.12)
  return group
}

function makeCottage() {
  const group = new THREE.Group()
  addRoundedBox(group, 0.72, 0.54, 0.62, 0.04, palette.cream, 0, 0.28, 0)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.42, 4), material(palette.roof))
  roof.position.set(0, 0.72, 0)
  roof.rotation.y = Math.PI / 4
  group.add(roof)
  addBox(group, 0.2, 0.3, 0.03, palette.woodDark, -0.14, 0.2, 0.32)
  addBox(group, 0.16, 0.16, 0.03, 0x9fd4e8, 0.17, 0.33, 0.32, {
    emissive: 0x2b6f8a,
    emissiveIntensity: 0.15
  })
  return group
}

function makePetModel(variant) {
  const group = new THREE.Group()
  const colors = {
    cat: 0xd9a65c,
    dog: 0x9a6a43,
    bird: 0x6aa9d9,
    rabbit: 0xe8e2d4
  }
  const color = colors[variant] || 0xd9a65c

  if (variant === 'bird') {
    addSphere(group, 0.2, color, 0, 0.28, 0, 8)
    addSphere(group, 0.12, 0x8cc7de, 0.08, 0.4, 0.04, 7)
    addBox(group, 0.08, 0.04, 0.08, 0xf2c14e, 0.21, 0.28, 0.06)
    addBox(group, 0.06, 0.2, 0.04, 0x5b3822, 0, 0.1, 0.08)
    return group
  }

  addRoundedBox(group, 0.42, 0.26, 0.28, 0.06, color, 0, 0.26, 0)
  addRoundedBox(group, 0.28, 0.26, 0.26, 0.06, color, 0, 0.46, 0.08)
  addBox(group, 0.12, 0.12, 0.03, 0x332c27, -0.08, 0.48, 0.22)
  addBox(group, 0.12, 0.12, 0.03, 0x332c27, 0.08, 0.48, 0.22)
  addBox(group, 0.06, 0.05, 0.03, 0xef7f8f, 0, 0.42, 0.23)
  addBox(group, 0.08, 0.08, 0.08, palette.woodDark, -0.12, 0.1, 0.06)
  addBox(group, 0.08, 0.08, 0.08, palette.woodDark, 0.12, 0.1, 0.06)

  if (variant === 'rabbit') {
    addRoundedBox(group, 0.08, 0.32, 0.08, 0.03, color, -0.08, 0.65, 0.04)
    addRoundedBox(group, 0.08, 0.32, 0.08, 0.03, color, 0.08, 0.65, 0.04)
  } else {
    addBox(group, 0.1, 0.12, 0.06, color, -0.1, 0.58, 0.08)
    addBox(group, 0.1, 0.12, 0.06, color, 0.1, 0.58, 0.08)
  }

  if (variant === 'cat' || variant === 'dog') {
    const tail = addBox(group, 0.06, 0.06, 0.26, color, 0, 0.3, -0.24, {
      rotation: [0.4, 0, 0]
    })
    tail.userData.tail = true
  }
  return group
}

function makeItemModel(variant) {
  switch (variant) {
    case 'chair': return makeChair()
    case 'table': return makeTable()
    case 'bench': return makeBench()
    case 'shelf': return makeShelf()
    case 'lamp': return makeLamp()
    case 'stool': return makeStool()
    case 'pot': return makePot()
    case 'lantern': return makeLanternItem()
    case 'fountain': return makeFountain()
    case 'birdhouse': return makeBirdhouse()
    case 'stone': return makeStone()
    case 'cottage': return makeCottage()
    case 'cat':
    case 'dog':
    case 'bird':
    case 'rabbit':
      return makePetModel(variant)
    case 'moon-tree': {
      const tree = createTree(0.75)
      tree.position.set(0, 0, 0)
      const group = new THREE.Group()
      group.add(tree)
      addIco(group, 0.22, 0xf5d76e, 0.34, 1.4, 0.2)
      tree.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone()
          child.material.color.offsetHSL(0.14, 0.2, 0.08)
          child.material.emissive = new THREE.Color(0x2d225f)
          child.material.emissiveIntensity = 0.25
        }
      })
      return group
    }
    case 'tree': {
      const tree = createTree(0.68)
      tree.position.set(0, 0, 0)
      const group = new THREE.Group()
      group.add(tree)
      return group
    }
    case 'memorial': {
      const group = new THREE.Group()
      addCylinder(group, 0.26, 0.3, 0.1, 8, palette.stoneDark, 0, 0.05, 0)
      addBox(group, 0.26, 0.5, 0.1, palette.stone, 0, 0.35, 0)
      addBox(group, 0.1, 0.16, 0.03, palette.glow, 0, 0.38, 0.06)
      return group
    }
    default: {
      const group = new THREE.Group()
      addRoundedBox(group, 0.48, 0.42, 0.48, 0.04, palette.woodLight, 0, 0.22, 0)
      addBox(group, 0.5, 0.08, 0.5, palette.woodDark, 0, 0.45, 0)
      return group
    }
  }
}

function addPlotTile(plot) {
  const group = new THREE.Group()
  const world = slotWorld(plot.slotNumber)
  group.position.copy(world)
  addRoundedBox(group, 0.82, 0.04, 0.82, 0.03, palette.woodDark, 0, 0.02, 0)
  addRoundedBox(group, 0.68, 0.045, 0.68, 0.03, palette.dirt, 0, 0.05, 0)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.7, 0.04, 0.7)),
    new THREE.LineBasicMaterial({ color: 0xf4d68d, transparent: true, opacity: 0.45 })
  )
  edges.position.y = 0.06
  edges.visible = props.layoutMode
  group.add(edges)
  group.userData.outline = edges
  plotGroup.add(group)
}

function syncPlots() {
  if (!scene || !plotGroup) return
  clearGroup(plotGroup)
  animatedItems = []

  for (const plot of props.plots) {
    const world = slotWorld(plot.slotNumber)
    if (!plot.placement) {
      addPlotTile(plot)
      continue
    }
    const model = makeItemModel(plot.variant)
    model.position.copy(world)
    const sizeScale = 1.15 + (Math.max(1, plot.size || 1) - 1) * 0.6
    model.scale.setScalar(sizeScale)
    model.userData.baseY = world.y
    model.userData.phase = Math.random() * Math.PI * 2
    if (['cat', 'dog', 'bird', 'rabbit'].includes(plot.variant)) {
      animatedItems.push(model)
    }
    plotGroup.add(model)
  }

  for (const plot of props.petPlots) {
    const world = petWorld(Math.max(0, (plot.slotNumber || 1) - 1))
    if (!plot.placement) {
      const pad = new THREE.Group()
      pad.position.copy(world)
      addCylinder(pad, 0.34, 0.36, 0.05, 10, palette.grassDark, 0, 0.03, 0)
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.37, 0.37, 0.06, 10)),
        new THREE.LineBasicMaterial({ color: 0xa7e08a, transparent: true, opacity: 0.4 })
      )
      edges.visible = props.layoutMode
      pad.add(edges)
      pad.userData.outline = edges
      plotGroup.add(pad)
      continue
    }
    const model = makeItemModel(plot.variant)
    model.position.copy(world)
    model.scale.setScalar(0.95)
    plotGroup.add(model)
  }

  rebuildMarkers()
}

function rebuildMarkers() {
  const next = []
  for (const plot of props.plots) {
    const world = slotWorld(plot.slotNumber)
    next.push({
      key: `garden-${plot.slotId}`,
      slotId: plot.slotId,
      region: 'garden',
      inventoryId: plot.placement?.inventoryId || null,
      empty: !plot.placement,
      label: plot.label,
      world: world.clone().setY(GROUND_Y + (plot.placement ? 1.15 : 0.08)),
      x: 0,
      y: 0,
      visible: true
    })
  }
  for (const plot of props.petPlots) {
    const world = petWorld(Math.max(0, (plot.slotNumber || 1) - 1))
    next.push({
      key: `pet-${plot.slotId}`,
      slotId: plot.slotId,
      region: 'pet',
      inventoryId: plot.placement?.inventoryId || null,
      empty: !plot.placement,
      label: plot.label,
      world: world.clone().setY(GROUND_Y + (plot.placement ? 0.7 : 0.06)),
      x: 0,
      y: 0,
      visible: true
    })
  }
  markers.value = next
  updateMarkerPositions()
}

function updateMarkerPositions() {
  if (!camera || !host.value) return
  const width = host.value.clientWidth
  const height = host.value.clientHeight
  if (width === 0 || height === 0) return
  for (const marker of markers.value) {
    const projected = marker.world.clone().project(camera)
    marker.x = (projected.x * 0.5 + 0.5) * width
    marker.y = (-projected.y * 0.5 + 0.5) * height
    marker.visible = projected.z > -1 && projected.z < 1
      && marker.x > -32 && marker.x < width + 32
      && marker.y > -32 && marker.y < height + 32
  }

  if (props.plant) {
    const heights = { seed: 0.9, sprout: 1.35, sapling: 2.15, mature: 3.5 }
    const labelWorld = PLANT_POSITION.clone()
    labelWorld.y = GROUND_Y + (heights[props.plant.stage] || 1)
    const projected = labelWorld.project(camera)
    const x = (projected.x * 0.5 + 0.5) * width
    const y = (-projected.y * 0.5 + 0.5) * height
    plantLabel.value = {
      visible: projected.z > -1 && projected.z < 1 && x > 0 && x < width && y > 0 && y < height,
      x,
      y
    }
  } else {
    plantLabel.value.visible = false
  }
}

function applyLayoutMode() {
  if (!plotGroup) return
  for (const child of plotGroup.children) {
    if (child.userData.outline) child.userData.outline.visible = props.layoutMode
  }
}

function initScene() {
  const element = host.value
  if (!element) return

  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas.value,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
  } catch (error) {
    failed.value = true
    return
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(element.clientWidth, element.clientHeight, false)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(34, element.clientWidth / Math.max(1, element.clientHeight), 0.1, 80)
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  camera.position.set(9.2, 9.6, 12)
  camera.lookAt(0, 0.8, 0.4)
  if (!reducedMotion) {
    camera.position.set(10.6, 11.4, 14.2)
    intro = {
      start: performance.now(),
      duration: 1100,
      from: camera.position.clone(),
      to: new THREE.Vector3(9.2, 9.6, 12)
    }
  }

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.7, 0.35)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.enablePan = false
  controls.minDistance = 12
  controls.maxDistance = 22
  controls.minPolarAngle = 0.72
  controls.maxPolarAngle = 1.22
  controls.minAzimuthAngle = -0.62
  controls.maxAzimuthAngle = 0.62
  controls.rotateSpeed = 0.45
  controls.enabled = reducedMotion
  controls.update()

  scene.add(new THREE.HemisphereLight(0xd9efff, 0x6b5236, 1.6))
  const sun = new THREE.DirectionalLight(0xfff1cf, 2.4)
  sun.position.set(7, 11, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -7
  sun.shadow.camera.right = 7
  sun.shadow.camera.top = 7
  sun.shadow.camera.bottom = -7
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 30
  sun.shadow.bias = -0.0004
  scene.add(sun)

  const fill = new THREE.DirectionalLight(0x9ecfff, 0.55)
  fill.position.set(-7, 5, -6)
  scene.add(fill)

  buildIsland()
  buildPlantBed()
  buildHouse()
  buildFence()
  buildLantern()
  buildPath()
  buildFlowersAndBushes()
  buildLevelDetails()

  plotGroup = new THREE.Group()
  scene.add(plotGroup)
  syncPlant()
  syncMaturedPlant()
  syncPlots()
  applyLayoutMode()

  resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(element)
  onResize()

  lastTime = performance.now()
  frame = requestAnimationFrame(animate)
}

function animate(time) {
  frame = requestAnimationFrame(animate)
  const delta = Math.min(0.05, (time - lastTime) / 1000)
  lastTime = time
  elapsed += delta
  if (intro) {
    const progress = Math.min(1, (time - intro.start) / intro.duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    camera.position.lerpVectors(intro.from, intro.to, eased)
    if (progress >= 1) {
      intro = null
      if (controls) controls.enabled = true
    }
  }
  controls?.update()

  if (plantGroup?.userData.sway && !reducedMotion) {
    plantGroup.rotation.z = Math.sin(elapsed * 0.8) * 0.018
    plantGroup.rotation.x = Math.sin(elapsed * 0.55) * 0.01
  }
  if (plantGrow && plantGroup) {
    const progress = Math.min(1, (time - plantGrow.start) / plantGrow.duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    const scale = 0.08 + (plantGrow.target - 0.08) * eased
    plantGroup.scale.setScalar(scale)
    if (progress >= 1) plantGrow = null
  }
  if (maturedGroup) {
    maturedGroup.rotation.z = Math.sin(elapsed * 0.45 + 1.2) * 0.012
  }
  if (!reducedMotion) {
    for (const item of animatedItems) {
      item.position.y = (item.userData.baseY || GROUND_Y) + Math.sin(elapsed * 2.2 + (item.userData.phase || 0)) * 0.012
    }
  }

  if (time - lastMarkerUpdate > 60) {
    updateMarkerPositions()
    lastMarkerUpdate = time
  }

  if (!document.hidden) renderer.render(scene, camera)
}

function resetView() {
  if (!camera) return
  controls.dispose?.()
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.7, 0.35)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.enablePan = false
  controls.minDistance = 12
  controls.maxDistance = 22
  controls.minPolarAngle = 0.72
  controls.maxPolarAngle = 1.22
  controls.minAzimuthAngle = -0.62
  controls.maxAzimuthAngle = 0.62
  controls.rotateSpeed = 0.45
  if (reducedMotion) {
    camera.position.set(9.2, 9.6, 12)
    controls.enabled = true
    return
  }
  controls.enabled = false
  intro = {
    start: performance.now(),
    duration: 700,
    from: camera.position.clone(),
    to: new THREE.Vector3(9.2, 9.6, 12)
  }
}

function onResize() {
  if (!renderer || !camera || !host.value) return
  const width = Math.max(1, host.value.clientWidth)
  const height = Math.max(1, host.value.clientHeight)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  updateMarkerPositions()
}

onMounted(() => {
  initScene()
})

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  controls?.dispose()
  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const mat of materials) {
          if (mat.map) mat.map.dispose()
          mat.dispose()
        }
      }
    })
  }
  renderer?.dispose()
  renderer?.forceContextLoss?.()
})

watch(() => props.level, buildLevelDetails)
watch(() => props.plant, syncPlant, { deep: true })
watch(() => props.maturedPlant, syncMaturedPlant, { deep: true })
watch(() => props.plots, syncPlots, { deep: true })
watch(() => props.petPlots, syncPlots, { deep: true })
watch(() => props.layoutMode, applyLayoutMode)
</script>

<style scoped>
.scene-sky {
  background:
    radial-gradient(circle at 78% 16%, rgba(255, 240, 180, 0.72), transparent 22%),
    linear-gradient(180deg, #b9e0ff 0%, #d8efff 56%, #edf8e8 100%);
}

.scene-cloud {
  position: absolute;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  filter: blur(0.4px);
  animation: cloud-drift 26s ease-in-out infinite alternate;
}

.scene-cloud::before,
.scene-cloud::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: inherit;
}

.scene-cloud::before {
  left: 22%;
  bottom: 8px;
  width: 46%;
  height: 28px;
}

.scene-cloud::after {
  right: 10%;
  bottom: 6px;
  width: 34%;
  height: 20px;
}

.scene-cloud-a {
  left: 7%;
  top: 17%;
  width: 148px;
}

.scene-cloud-b {
  right: 18%;
  top: 23%;
  width: 118px;
  opacity: 0.72;
  animation-delay: -8s;
}

.scene-cloud-c {
  left: 36%;
  top: 10%;
  width: 82px;
  opacity: 0.5;
  animation-delay: -16s;
}

@keyframes cloud-drift {
  from { transform: translateX(-8px); }
  to { transform: translateX(12px); }
}

@media (prefers-reduced-motion: reduce) {
  .scene-cloud { animation: none; }
}

canvas {
  touch-action: none;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}
</style>
