<template>
  <div class="h-full overflow-auto px-6 py-6">
    <div class="mx-auto flex max-w-5xl flex-col gap-5">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
            {{ $t('tools.gardenEyebrow') }}
          </p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {{ $t('tools.gardenHeroTitle') }}
          </h1>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {{ $t('tools.gardenHeroDescription') }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-foreground">
            {{ $t('tools.gardenLevel', { level: garden.level }) }}
          </span>
          <span class="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            {{ $t('tools.streakSummary', { streak: garden.currentStreak, total: garden.totalGrowthDays }) }}
          </span>
          <span
            v-if="pendingRewardCount"
            class="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            {{ $t('tools.pendingRewards') }} {{ pendingRewardCount }}
          </span>
        </div>
      </header>

      <nav
        role="tablist"
        :aria-label="$t('tools.gardenTabsLabel')"
        class="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border/60 bg-card/60 p-1"
      >
        <button
          v-for="(tab, index) in tabs"
          :id="`garden-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-controls="`garden-panel-${tab.id}`"
          :aria-selected="activeTab === tab.id"
          :tabindex="activeTab === tab.id ? 0 : -1"
          class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          :class="activeTab === tab.id
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'"
          @click="activeTab = tab.id"
          @keydown="handleTabKeydown($event, index)"
        >
          <component :is="tab.icon" class="h-4 w-4" aria-hidden="true" />
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.count !== null"
            class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
          >
            {{ tab.count }}
          </span>
        </button>
      </nav>

      <section
        v-if="activeTab === 'garden'"
        id="garden-panel-garden"
        role="tabpanel"
        aria-labelledby="garden-tab-garden"
        class="flex flex-col gap-5"
      >
        <div class="relative aspect-[800/520] max-h-[520px] w-full overflow-hidden rounded-2xl border border-border/60 shadow-sm">
          <GardenThreeScene
            :level="garden.level"
            :plant="plant"
            :matured-plant="lastMaturedPlant"
            :plots="scenePlots"
            :pet-plots="scenePetPlots"
            :layout-mode="layoutMode"
            @open-plot="openPlacement"
            @remove-placement="removePlacement"
          />

          <div class="absolute right-3 top-3 z-30 flex max-w-[72%] flex-wrap items-center justify-end gap-2 rounded-lg border border-border/40 bg-background/75 p-1.5 backdrop-blur">
            <span class="hidden text-xs text-muted-foreground sm:inline">{{ $t('tools.autoPlace') }}</span>
            <Switch
              :model-value="garden.autoPlace"
              :label="$t('tools.autoPlace')"
              @update:model-value="toggleAutoPlace"
            />
            <Button size="sm" variant="outline" @click="toggleLayout">
              {{ layoutMode ? $t('tools.layoutDone') : $t('tools.layoutEdit') }}
            </Button>
          </div>

          <div class="pointer-events-none absolute inset-x-5 bottom-4 flex items-end justify-between gap-3">
            <div class="min-w-0">
              <p class="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
                <span>{{ $t('tools.garden') }} · {{ $t('tools.gardenLevel', { level: garden.level }) }}</span>
                <span
                  v-if="plant"
                  class="rounded-full border border-border/50 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur"
                >
                  {{ $t(`tools.stage.${plant.stage}`) }} · {{ plant.growthScore }}/15
                </span>
              </p>
              <p class="mt-0.5 hidden text-xs text-muted-foreground lg:block">{{ $t('tools.sceneHint') }}</p>
            </div>
            <p class="hidden shrink-0 text-sm text-muted-foreground lg:block">
              {{ $t('tools.streakSummary', { streak: garden.currentStreak, total: garden.totalGrowthDays }) }}
            </p>
          </div>
        </div>

        <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div class="tool-stat">
            <span class="tool-stat-label">{{ $t('tools.todayFocus') }}</span>
            <span class="tool-stat-value">{{ today.focusCount }}</span>
          </div>
          <div class="tool-stat">
            <span class="tool-stat-label">{{ $t('tools.todayWater') }}</span>
            <span class="tool-stat-value">{{ today.waterCount }}</span>
          </div>
          <div class="tool-stat">
            <span class="tool-stat-label">{{ $t('tools.todaySun') }}</span>
            <span class="tool-stat-value">{{ today.sunCount }}</span>
          </div>
          <div class="tool-stat">
            <span class="tool-stat-label">{{ $t('tools.todayGrowth') }}</span>
            <span class="tool-stat-value">{{ today.totalGrowth }}</span>
          </div>
        </section>

        <p v-if="placementError" class="text-sm text-destructive" role="alert">{{ placementError }}</p>

        <div class="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
          <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.plant') }}</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  {{ plant ? plantSpeciesName : $t('tools.noPlantDescription') }}
                </p>
              </div>
              <span v-if="plant" class="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {{ $t(`tools.stage.${plant.stage}`) }}
              </span>
            </div>

            <div v-if="plant" class="mt-5">
              <div class="flex items-end justify-between gap-3">
                <p class="text-3xl font-semibold tabular-nums text-foreground">
                  {{ plant.growthScore }}<span class="text-base font-normal text-muted-foreground">/15</span>
                </p>
                <p v-if="plantedAtLabel" class="text-xs text-muted-foreground">
                  {{ $t('tools.plantedAt', { date: plantedAtLabel }) }}
                </p>
              </div>
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-primary transition-all duration-700" :style="{ width: progressWidth }" />
              </div>
              <p class="mt-2 text-xs leading-5 text-muted-foreground">{{ nextStageHint }}</p>
            </div>

            <div v-else class="mt-5 flex flex-col gap-3">
              <p class="text-sm text-muted-foreground">{{ $t('tools.noPlant') }}</p>
              <div v-if="seeds.length > 0" class="flex flex-wrap gap-2">
                <Button
                  v-for="seed in seeds"
                  :key="seed.speciesId"
                  size="sm"
                  :loading="plantingSpecies === seed.speciesId"
                  @click="plantSeed(seed.speciesId)"
                >
                  {{ $t('tools.plantSeed', { species: speciesName(seed.speciesId) }) }}
                </Button>
              </div>
              <Button
                v-else-if="garden.canClaimBasicSeed"
                size="sm"
                :loading="claimingSeed"
                @click="claimBasicSeed"
              >
                {{ $t('tools.claimBasicSeed') }}
              </Button>
            </div>
          </section>

          <div class="flex flex-col gap-4">
            <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.expansion') }}</h2>
                <span class="text-sm text-muted-foreground">{{ $t('tools.capacity', { count: garden.capacity }) }}</span>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  v-for="entry in expansions"
                  :key="entry.level"
                  class="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-foreground"
                >
                  Lv.{{ entry.level }}
                </span>
              </div>
              <p v-if="garden.nextExpansion" class="mt-3 text-xs leading-5 text-muted-foreground">
                {{ $t('tools.nextExpansion', {
                  level: garden.nextExpansion.level,
                  streak: garden.nextExpansion.streakDays,
                  total: garden.nextExpansion.totalGrowthDays
                }) }}
              </p>
              <p v-else class="mt-3 text-xs text-muted-foreground">{{ $t('tools.allExpansions') }}</p>
            </section>

            <section v-if="activeClaim" class="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.claims') }}</h2>
                <span class="text-sm text-muted-foreground">{{ pendingClaims.length }}</span>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.claimHint') }}</p>

              <div v-if="claimOptions" class="mt-4 flex flex-col gap-3">
                <div v-if="claimOptions.fallbackItem" class="text-sm text-foreground">
                  {{ $t('tools.fallback') }} · {{ claimOptions.fallbackItem.id }}
                </div>
                <div v-else-if="claimOptions.directItem" class="text-sm text-foreground">
                  {{ $t('tools.lastItem') }} · {{ claimOptions.directItem.id }}
                </div>
                <div v-else class="flex flex-wrap gap-2">
                  <Button
                    v-for="candidate in claimOptions.candidates"
                    :key="candidate.id"
                    :variant="selectedItemId === candidate.id ? 'default' : 'outline'"
                    size="sm"
                    @click="selectedItemId = candidate.id"
                  >
                    {{ candidate.id }}
                  </Button>
                </div>

                <div class="flex items-center gap-3">
                  <Button
                    :loading="claiming"
                    :disabled="!claimOptions.directItem && !claimOptions.fallbackItem && !selectedItemId"
                    @click="claim"
                  >
                    {{ $t('tools.claim') }}
                  </Button>
                  <p v-if="claimError" class="text-sm text-destructive" role="alert">{{ claimError }}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'collection'"
        id="garden-panel-collection"
        role="tabpanel"
        aria-labelledby="garden-tab-collection"
        class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.collection.title') }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.collection.description') }}</p>
          </div>
          <span class="text-sm text-muted-foreground">
            {{ $t('tools.collection.summary', { owned: collectionOwnedCount, total: collection.length }) }}
          </span>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          <div
            v-for="entry in collection"
            :key="entry.id"
            class="flex flex-col items-center gap-1 rounded-lg border border-border/50 bg-background/40 p-2 text-center"
            :class="{ 'opacity-45 grayscale': !entry.owned && !entry.unlocked }"
          >
            <div class="h-12 w-12">
              <ItemArt :variant="entry.variant" />
            </div>
            <p class="line-clamp-1 text-xs text-foreground">{{ itemName(entry) }}</p>
            <p class="text-2xs text-muted-foreground">{{ collectionStatus(entry) }}</p>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div class="rounded-xl border border-border/50 bg-background/40 p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-foreground">{{ $t('tools.species') }}</h3>
              <span class="text-xs text-muted-foreground">{{ species.length }}</span>
            </div>
            <p v-if="species.length === 0" class="mt-3 text-sm text-muted-foreground">
              {{ $t('tools.noSpecies') }}
            </p>
            <ul v-else class="mt-3 flex flex-wrap gap-2">
              <li
                v-for="entry in species"
                :key="entry.speciesId"
                class="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-foreground"
              >
                {{ speciesName(entry.speciesId) }}
              </li>
            </ul>
          </div>

          <div class="rounded-xl border border-border/50 bg-background/40 p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-foreground">{{ $t('tools.seeds') }}</h3>
              <span class="text-xs text-muted-foreground">{{ garden.seedCount }}</span>
            </div>
            <p v-if="seeds.length === 0" class="mt-3 text-sm text-muted-foreground">
              {{ $t('tools.noSeeds') }}
            </p>
            <ul v-else class="mt-3 flex flex-col gap-2">
              <li
                v-for="seed in seeds"
                :key="seed.speciesId"
                class="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm"
              >
                <span class="text-foreground">{{ speciesName(seed.speciesId) }}</span>
                <span class="text-muted-foreground">×{{ seed.quantity }}</span>
              </li>
            </ul>
          </div>

          <div class="rounded-xl border border-border/50 bg-background/40 p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-foreground">{{ $t('tools.inventory') }}</h3>
              <span class="text-xs text-muted-foreground">{{ inventory.length }}</span>
            </div>
            <p v-if="inventory.length === 0" class="mt-3 text-sm text-muted-foreground">
              {{ $t('tools.noInventory') }}
            </p>
            <ul v-else class="mt-3 flex flex-wrap gap-2">
              <li
                v-for="item in inventory"
                :key="item.id"
                class="flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-2.5 py-1 text-xs text-foreground"
              >
                <div class="h-5 w-5 text-primary">
                  <ItemArt :variant="collectionByCatalogId[item.catalogId]?.variant || 'box'" />
                </div>
                {{ itemName(collectionByCatalogId[item.catalogId]) || item.catalogId }}
                <span class="text-muted-foreground">×{{ item.quantity }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'badges'"
        id="garden-panel-badges"
        role="tabpanel"
        aria-labelledby="garden-tab-badges"
        class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.badges.title') }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.badges.description') }}</p>
          </div>
          <span class="text-sm text-muted-foreground">
            {{ $t('tools.badges.summary', { unlocked: badges.unlocked, total: badges.total }) }}
          </span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          <div
            v-for="badge in badges.items"
            :key="badge.id"
            class="flex min-w-0 items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2"
            :class="{ 'opacity-55': !badge.unlocked }"
          >
            <BadgeArt
              :definition-id="badge.definitionId"
              :kind="badge.kind"
              :unlocked="badge.unlocked"
              class="h-7 w-7 shrink-0"
              :class="{ 'grayscale opacity-45': !badge.unlocked }"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs text-foreground" :title="$t(`tools.badgeNames.${badge.definitionId}`)">
                {{ $t(`tools.badgeNames.${badge.definitionId}`) }}
              </p>
              <p class="truncate text-[10px] text-muted-foreground">
                <template v-if="badge.unlocked">{{ badgeStatus(badge) }}</template>
                <template v-else>{{ $t('tools.badges.locked') }}</template>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        v-else
        id="garden-panel-history"
        role="tabpanel"
        aria-labelledby="garden-tab-history"
        class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.plantHistory') }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.plantHistoryDescription') }}</p>
          </div>
          <span class="text-sm text-muted-foreground">{{ plantHistory.length }}</span>
        </div>
        <p v-if="plantHistory.length === 0" class="mt-4 text-sm text-muted-foreground">
          {{ $t('tools.noPlantHistory') }}
        </p>
        <ul v-else class="mt-4 divide-y divide-border/40">
          <li
            v-for="entry in plantHistory"
            :key="entry.id"
            class="flex items-center gap-3 py-3"
          >
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 p-1 text-primary">
              <PlantArt :stage="entry.stage" :species-id="entry.speciesId" class="h-8 w-8" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-foreground">
                {{ speciesName(entry.speciesId) }} · {{ $t(`tools.stage.${entry.stage}`) }}
              </p>
              <p class="text-xs text-muted-foreground">{{ formatPlantDate(entry.plantedAt) }}</p>
            </div>
            <span class="shrink-0 text-xs text-muted-foreground">
              {{ $t(`tools.plantStatus.${entry.status}`) }} · {{ entry.growthScore }}/15
            </span>
          </li>
        </ul>
      </section>

      <Dialog
        :open="placementDialogOpen"
        :title="$t('tools.placementChoose')"
        :description="$t('tools.placementHint')"
        content-class="w-[min(94vw,28rem)]"
        @update:open="(value) => { placementDialogOpen = value }"
      >
        <p v-if="placementOptions.length === 0" class="text-sm text-muted-foreground">
          {{ $t('tools.placementNoItems') }}
        </p>
        <div v-else class="flex flex-col gap-2">
          <Button
            v-for="item in placementOptions"
            :key="item.id"
            variant="outline"
            class="justify-start"
            :disabled="!item.fits"
            :loading="placingItemId === item.id"
            @click="placeItem(item.id)"
          >
            <span class="min-w-0 flex-1 truncate text-left">
              {{ itemName(collectionByCatalogId[item.catalogId]) || item.catalogId }}
            </span>
            <span class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
              {{ item.size }}×{{ item.size }}
            </span>
            <span v-if="!item.fits" class="shrink-0 text-[10px] text-destructive">
              {{ $t('tools.placementNoFit') }}
            </span>
          </Button>
          <p v-if="fittingPlacementCount === 0" class="text-xs text-muted-foreground">
            {{ $t('tools.placementNoFitHint') }}
          </p>
        </div>
        <p v-if="placementError" class="mt-3 text-sm text-destructive" role="alert">{{ placementError }}</p>
      </Dialog>
    </div>
  </div>
</template>


<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Award, BookOpen, History, Sprout } from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import PlantArt from './art/PlantArt.vue'
import BadgeArt from './art/BadgeArt.vue'
import ItemArt from './art/ItemArt.vue'
const GardenThreeScene = defineAsyncComponent(() => import('./art/GardenThreeScene.vue'))

const { t } = useI18n()
const toolsStore = useToolsStore()
const activeTab = ref('garden')
const selectedItemId = ref(null)
const claimOptions = ref(null)
const claiming = ref(false)
const claimError = ref('')
const placementDialogOpen = ref(false)
const selectedSlotId = ref(null)
const placingItemId = ref(null)
const placementError = ref('')
const plantingSpecies = ref(null)
const claimingSeed = ref(false)

const gardenView = computed(() => toolsStore.gardenView)
const plant = computed(() => gardenView.value?.plant || null)
const garden = computed(() => gardenView.value?.garden || {
  level: 1,
  seedCount: 0,
  autoPlant: true
})
const seeds = computed(() => gardenView.value?.seeds || [])
const species = computed(() => gardenView.value?.species || [])
const plantHistory = computed(() => gardenView.value?.plantHistory || [])
const collection = computed(() => gardenView.value?.collection || [])
const collectionByCatalogId = computed(() => {
  const map = {}
  for (const entry of collection.value) {
    if (entry.category === 'item' || entry.category === 'fallback') {
      map[entry.id] = entry
    } else if (entry.category === 'species' && entry.speciesId) {
      map[entry.speciesId] = entry
    }
  }
  return map
})
const badges = computed(() => gardenView.value?.badges || {
  pendingRewards: 0,
  total: 0,
  unlocked: 0,
  items: []
})
const collectionOwnedCount = computed(() => (
  collection.value.filter((entry) => entry.owned || entry.unlocked).length
))
const inventory = computed(() => gardenView.value?.inventory || [])
const expansions = computed(() => gardenView.value?.expansions || [])
const placements = computed(() => gardenView.value?.placements || [])
const gardenPlacements = computed(() => placements.value.filter((placement) => placement.regionId === 'garden'))
const petPlacements = computed(() => placements.value.filter((placement) => placement.regionId === 'pet'))
const inventoryById = computed(() => {
  const map = {}
  for (const item of inventory.value) map[item.id] = item
  return map
})
const petMap = computed(() => {
  const map = {}
  for (const placement of petPlacements.value) map[placement.slotId] = placement
  return map
})
const placementRegion = ref('garden')
const layoutMode = ref(false)
const scenePetPlots = computed(() => (
  Array.from({ length: garden.value.petCapacity || 0 }, (_, index) => {
    const slotId = `pet-${index + 1}`
    const placement = petMap.value[slotId] || null
    const entry = placement ? placementEntry(placement.inventoryId) : null
    return {
      key: `pet-${index + 1}`,
      slotId,
      slotNumber: index + 1,
      region: 'pet',
      placement,
      size: 1,
      variant: entry?.variant || 'box',
      label: placement ? itemName(entry) : ''
    }
  })
))
const scenePlots = computed(() => {
  const capacity = garden.value.capacity || 0
  const columns = garden.value.columns || 4
  const anchors = new Map()
  const occupied = new Set()

  for (const placement of gardenPlacements.value) {
    const entry = placementEntry(placement.inventoryId)
    const size = entry?.size || 1
    const anchor = parseSlotNumber(placement.slotId)
    const row = Math.floor((anchor - 1) / columns)
    const column = (anchor - 1) % columns
    anchors.set(anchor, { placement, size, row, column })
    for (let rowOffset = 0; rowOffset < size; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < size; columnOffset += 1) {
        occupied.add((row + rowOffset) * columns + column + columnOffset + 1)
      }
    }
  }

  const cells = []
  for (let slot = 1; slot <= capacity; slot += 1) {
    if (occupied.has(slot) && !anchors.has(slot)) continue
    const anchor = anchors.get(slot)
    const entry = anchor ? placementEntry(anchor.placement.inventoryId) : null
    const size = anchor?.size || 1
    cells.push({
      key: anchor ? `placed-${slot}` : `empty-${slot}`,
      slotId: `slot-${slot}`,
      slotNumber: slot,
      region: 'garden',
      placement: anchor?.placement || null,
      size,
      variant: entry?.variant || 'box',
      label: anchor ? itemName(entry) : ''
    })
  }
  return cells
})
const unplacedInventory = computed(() => {
  const placedIds = new Set(placements.value.map((placement) => placement.inventoryId))
  return inventory.value.filter((item) => {
    if (placedIds.has(item.id)) return false
    return placementRegion.value === 'pet' ? item.kind === 'pet' : item.kind !== 'pet'
  })
})
function itemSize(item) {
  const entry = collectionByCatalogId.value[item.catalogId]
  if (item.kind === 'tree' || entry?.category === 'species') return 1
  return entry?.size || 1
}
function itemFitsSlot(item, slotId, region) {
  if (region === 'pet' || !slotId) return true
  const size = itemSize(item)
  const columns = garden.value.columns || 4
  const capacity = garden.value.capacity || 0
  const anchor = parseSlotNumber(slotId)
  const column = (anchor - 1) % columns
  const row = Math.floor((anchor - 1) / columns)
  if (column + size > columns) return false
  const lastCell = (row + size - 1) * columns + column + size
  return lastCell <= capacity
}
const placementOptions = computed(() => unplacedInventory.value.map((item) => ({
  ...item,
  size: itemSize(item),
  fits: itemFitsSlot(item, selectedSlotId.value, placementRegion.value)
})))
const fittingPlacementCount = computed(() => (
  placementOptions.value.filter((item) => item.fits).length
))
const pendingClaims = computed(() => (
  gardenView.value?.rewardClaims?.filter((claim) => !claim.claimedAt) || []
))
const activeClaim = computed(() => pendingClaims.value[0] || null)
const pendingRewardCount = computed(() => gardenView.value?.badges?.pendingRewards || 0)
const today = computed(() => toolsStore.shellSnapshot?.today || {
  focusCount: 0,
  waterCount: 0,
  sunCount: 0,
  totalGrowth: 0
})
const tabs = computed(() => [
  {
    id: 'garden',
    label: t('tools.gardenTab'),
    icon: Sprout,
    count: null
  },
  {
    id: 'collection',
    label: t('tools.collection.title'),
    icon: BookOpen,
    count: `${collectionOwnedCount.value}/${collection.value.length}`
  },
  {
    id: 'badges',
    label: t('tools.badges.title'),
    icon: Award,
    count: `${badges.value.unlocked}/${badges.value.total}`
  },
  {
    id: 'history',
    label: t('tools.plantHistory'),
    icon: History,
    count: plantHistory.value.length ? String(plantHistory.value.length) : null
  }
])
const lastMaturedPlant = computed(() => (
  plantHistory.value.find((entry) => entry.status === 'matured') || null
))
const plantSpeciesName = computed(() => (
  plant.value ? speciesName(plant.value.speciesId) : ''
))
const plantedAtLabel = computed(() => formatPlantDate(plant.value?.plantedAt))
const nextStageHint = computed(() => {
  if (!plant.value) return ''
  const score = plant.value.growthScore
  if (score >= 15) return t('tools.growthComplete')
  const nextStage = score < 5
    ? { score: 5, stage: 'sprout' }
    : score < 10
      ? { score: 10, stage: 'sapling' }
      : { score: 15, stage: 'mature' }
  return t('tools.nextStage', {
    points: nextStage.score - score,
    stage: t(`tools.stage.${nextStage.stage}`)
  })
})
const progressWidth = computed(() => {
  if (!plant.value) return '0%'
  return `${Math.min(100, Math.round((plant.value.growthScore / 15) * 100))}%`
})

function handleTabKeydown(event, index) {
  const lastIndex = tabs.value.length - 1
  let nextIndex = null
  if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1
  if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = lastIndex
  if (nextIndex === null) return
  event.preventDefault()
  activeTab.value = tabs.value[nextIndex].id
  event.currentTarget.parentElement
    ?.querySelectorAll('[role="tab"]')
    ?.[nextIndex]
    ?.focus()
}

function speciesName(speciesId) {
  return t(`tools.speciesNames.${speciesId}`)
}

function formatPlantDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function parseSlotNumber(slotId) {
  return Number(String(slotId).split('-')[1])
}

function openPlacement(slotId, region = 'garden') {
  placementRegion.value = region
  selectedSlotId.value = slotId
  placementError.value = ''
  placementDialogOpen.value = true
}

async function placeItem(inventoryId) {
  if (!selectedSlotId.value) return
  placingItemId.value = inventoryId
  placementError.value = ''
  try {
    await toolsStore.placeItem(inventoryId, selectedSlotId.value)
    placementDialogOpen.value = false
    selectedSlotId.value = null
  } catch (err) {
    placementError.value = err.message
  } finally {
    placingItemId.value = null
  }
}

async function removePlacement(inventoryId) {
  placementError.value = ''
  try {
    await toolsStore.removePlacement(inventoryId)
  } catch (err) {
    placementError.value = err.message
  }
}

async function toggleAutoPlace(enabled) {
  placementError.value = ''
  try {
    await toolsStore.setAutoPlace(enabled)
  } catch (err) {
    placementError.value = err.message
  }
}

function toggleLayout() {
  layoutMode.value = !layoutMode.value
}

async function plantSeed(speciesId) {
  plantingSpecies.value = speciesId
  try {
    await toolsStore.plantSeed(speciesId)
  } catch (err) {
    placementError.value = err.message
  } finally {
    plantingSpecies.value = null
  }
}

async function claimBasicSeed() {
  claimingSeed.value = true
  try {
    await toolsStore.claimBasicSeed()
  } catch (err) {
    placementError.value = err.message
  } finally {
    claimingSeed.value = false
  }
}

function badgeStatus(badge) {
  if (badge.claimStatus === 'claimed') return t('tools.badges.claimed')
  if (badge.claimStatus === 'pending') return t('tools.badges.pending')
  return t('tools.badges.earned')
}

function itemName(entry) {
  if (!entry) return ''
  if (entry.category === 'species') {
    return t(`tools.speciesNames.${entry.speciesId}`)
  }
  return t(`tools.itemNames.${entry.id}`)
}

function collectionStatus(entry) {
  if (entry.category === 'species') {
    if (entry.owned) return t('tools.collection.ownedTree')
    if (entry.unlocked) return t('tools.collection.unlockedTree')
    return t('tools.collection.locked')
  }
  return entry.owned ? t('tools.collection.owned') : t('tools.collection.locked')
}

function placementEntry(inventoryId) {
  const item = inventoryById.value[inventoryId]
  if (!item) return null
  return collectionByCatalogId.value[item.catalogId] || null
}

async function loadClaimOptions() {
  claimOptions.value = null
  selectedItemId.value = null
  if (!activeClaim.value) return
  try {
    claimOptions.value = await toolsStore.getClaimOptions(activeClaim.value.id)
  } catch (err) {
    claimError.value = err.message
  }
}

async function claim() {
  if (!activeClaim.value || !claimOptions.value) return
  claiming.value = true
  claimError.value = ''
  try {
    await toolsStore.claimReward(activeClaim.value.id, selectedItemId.value)
    await loadClaimOptions()
  } catch (err) {
    claimError.value = err.message
  } finally {
    claiming.value = false
  }
}

async function refresh() {
  await Promise.all([
    toolsStore.loadGardenView(),
    toolsStore.loadShellSnapshot()
  ])
  await loadClaimOptions()
}

function handleToolsUpdated() {
  refresh()
}

onMounted(() => {
  refresh()
  window.electronAPI?.events?.on('tools-updated', handleToolsUpdated)
})

onUnmounted(() => {
  window.electronAPI?.events?.off('tools-updated', handleToolsUpdated)
})

watch(activeClaim, loadClaimOptions)
</script>

<style scoped>
.tool-stat {
  @apply flex flex-col gap-1 rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm;
}

.tool-stat-label {
  @apply text-xs font-medium text-muted-foreground;
}

.tool-stat-value {
  @apply text-2xl font-semibold text-foreground;
}

.plant-stage-enter-active {
  transition: opacity 500ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
}

.plant-stage-leave-active {
  transition: opacity 220ms ease;
}

.plant-stage-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.72);
}

.plant-stage-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .plant-stage-enter-active,
  .plant-stage-leave-active {
    transition: none;
  }
}
</style>
