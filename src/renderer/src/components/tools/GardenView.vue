<template>
  <div class="h-full overflow-auto px-7 py-6">
    <div class="mx-auto flex max-w-4xl flex-col gap-6">
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <div class="tool-stat">
          <span class="tool-stat-label">{{ $t('tools.pendingRewards') }}</span>
          <span class="tool-stat-value">{{ pendingRewardCount }}</span>
        </div>
      </section>

      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.plant') }}</h2>
          <span v-if="plant" class="text-sm text-muted-foreground">
            {{ $t('tools.gardenLevel', { level: garden.level }) }}
          </span>
        </div>

        <div v-if="plant" class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div class="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <component :is="plantIcon" class="h-14 w-14" :stroke-width="1.6" aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="text-xl font-semibold text-foreground">
                  {{ $t(`tools.stage.${plant.stage}`) }}
                </p>
                <p class="mt-1 text-sm text-muted-foreground">{{ plant.speciesId }}</p>
              </div>
              <p class="text-sm font-medium text-muted-foreground">
                {{ $t('tools.growthScore', { score: plant.growthScore }) }}
              </p>
            </div>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-all" :style="{ width: progressWidth }" />
            </div>
          </div>
        </div>

        <div v-else class="mt-4 flex flex-col gap-3">
          <p class="text-sm text-muted-foreground">{{ $t('tools.noPlant') }}</p>
          <div v-if="seeds.length > 0" class="flex flex-wrap gap-2">
            <Button
              v-for="seed in seeds"
              :key="seed.speciesId"
              size="sm"
              :loading="plantingSpecies === seed.speciesId"
              @click="plantSeed(seed.speciesId)"
            >
              {{ $t('tools.plantSeed', { species: seed.speciesId }) }}
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

      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.badges.title') }}</h2>
          <span class="text-sm text-muted-foreground">
            {{ $t('tools.badges.summary', { unlocked: badges.unlocked, total: badges.total }) }}
          </span>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="badge in badges.items"
            :key="badge.id"
            class="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
            :class="{ 'opacity-50': !badge.unlocked }"
          >
            <Award v-if="badge.unlocked" class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <Lock v-else class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-foreground">
                {{ $t(`tools.badgeNames.${badge.definitionId}`) }}
              </p>
              <p class="text-xs text-muted-foreground">
                <template v-if="badge.unlocked">
                  {{ badgeStatus(badge) }}
                </template>
                <template v-else>{{ $t('tools.badges.locked') }}</template>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.plantHistory') }}</h2>
          <span class="text-sm text-muted-foreground">{{ plantHistory.length }}</span>
        </div>
        <p v-if="plantHistory.length === 0" class="mt-4 text-sm text-muted-foreground">
          {{ $t('tools.noPlantHistory') }}
        </p>
        <ul v-else class="mt-4 flex flex-col gap-2">
          <li
            v-for="entry in plantHistory"
            :key="entry.id"
            class="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm"
          >
            <span class="text-foreground">{{ entry.speciesId }} · {{ $t(`tools.stage.${entry.stage}`) }}</span>
            <span class="text-muted-foreground">
              {{ $t(`tools.plantStatus.${entry.status}`) }} · {{ entry.growthScore }}/15
            </span>
          </li>
        </ul>
      </section>

      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.expansion') }}</h2>
          <span class="text-sm text-muted-foreground">
            {{ $t('tools.capacity', { count: garden.capacity }) }}
          </span>
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
        <p class="mt-3 text-sm text-muted-foreground">
          {{ $t('tools.streakSummary', { streak: garden.currentStreak, total: garden.totalGrowthDays }) }}
        </p>
        <p v-if="garden.nextExpansion" class="mt-1 text-sm text-muted-foreground">
          {{ $t('tools.nextExpansion', {
            level: garden.nextExpansion.level,
            streak: garden.nextExpansion.streakDays,
            total: garden.nextExpansion.totalGrowthDays
          }) }}
        </p>
        <p v-else class="mt-1 text-sm text-muted-foreground">{{ $t('tools.allExpansions') }}</p>
      </section>

      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.placement') }}</h2>
          <span class="text-sm text-muted-foreground">
            {{ $t('tools.placementCount', { placed: placements.length, capacity: garden.capacity }) }}
          </span>
        </div>
        <div class="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
          <div
            v-for="slotId in capacitySlots"
            :key="slotId"
            class="flex min-h-16 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/40 p-2 text-center"
          >
            <template v-if="placementBySlot[slotId]">
              <span class="max-w-full truncate text-xs text-foreground">
                {{ inventoryById[placementBySlot[slotId].inventoryId]?.catalogId || '—' }}
              </span>
              <IconButton
                size="icon-sm"
                class="mt-1 h-5 w-5"
                :label="$t('tools.placementRemove')"
                @click="removePlacement(placementBySlot[slotId].inventoryId)"
              >
                <X class="h-3 w-3" />
              </IconButton>
            </template>
            <button
              v-else
              type="button"
              class="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              @click="openPlacement(slotId)"
            >
              <Plus class="h-4 w-4" aria-hidden="true" />
              {{ $t('tools.placementEmpty') }}
            </button>
          </div>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">{{ $t('tools.placementHint') }}</p>
        <p v-if="placementError" class="mt-2 text-sm text-destructive" role="alert">{{ placementError }}</p>
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

      <section class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.species') }}</h2>
            <span class="text-sm text-muted-foreground">{{ species.length }}</span>
          </div>
          <p v-if="species.length === 0" class="mt-4 text-sm text-muted-foreground">
            {{ $t('tools.noSpecies') }}
          </p>
          <ul v-else class="mt-4 flex flex-wrap gap-2">
            <li
              v-for="entry in species"
              :key="entry.speciesId"
              class="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-foreground"
            >
              {{ entry.speciesId }}
            </li>
          </ul>
        </div>

        <div class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.seeds') }}</h2>
            <span class="text-sm text-muted-foreground">{{ garden.seedCount }}</span>
          </div>
          <p v-if="seeds.length === 0" class="mt-4 text-sm text-muted-foreground">
            {{ $t('tools.noSeeds') }}
          </p>
          <ul v-else class="mt-4 flex flex-col gap-2">
            <li
              v-for="seed in seeds"
              :key="seed.speciesId"
              class="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm"
            >
              <span class="text-foreground">{{ seed.speciesId }}</span>
              <span class="text-muted-foreground">×{{ seed.quantity }}</span>
            </li>
          </ul>
        </div>

        <div class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.inventory') }}</h2>
            <span class="text-sm text-muted-foreground">{{ inventory.length }}</span>
          </div>
          <p v-if="inventory.length === 0" class="mt-4 text-sm text-muted-foreground">
            {{ $t('tools.noInventory') }}
          </p>
          <ul v-else class="mt-4 flex flex-wrap gap-2">
            <li
              v-for="item in inventory"
              :key="item.id"
              class="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-foreground"
            >
              {{ item.catalogId }}<span class="ml-1 text-muted-foreground">×{{ item.quantity }}</span>
            </li>
          </ul>
        </div>
      </section>

      <Dialog
        :open="placementDialogOpen"
        :title="$t('tools.placementChoose')"
        :description="$t('tools.placementHint')"
        content-class="w-[min(94vw,28rem)]"
        @update:open="(value) => { placementDialogOpen = value }"
      >
        <p v-if="unplacedInventory.length === 0" class="text-sm text-muted-foreground">
          {{ $t('tools.placementNoItems') }}
        </p>
        <div v-else class="flex flex-col gap-2">
          <Button
            v-for="item in unplacedInventory"
            :key="item.id"
            variant="outline"
            class="justify-start"
            :loading="placingItemId === item.id"
            @click="placeItem(item.id)"
          >
            {{ item.catalogId }}
          </Button>
        </div>
      </Dialog>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, X, Sprout, Leaf, TreePine, Award, Lock } from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'

const { t } = useI18n()
const toolsStore = useToolsStore()
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
const badges = computed(() => gardenView.value?.badges || {
  pendingRewards: 0,
  total: 0,
  unlocked: 0,
  items: []
})
const plantIcon = computed(() => {
  if (!plant.value) return Sprout
  if (plant.value.stage === 'mature') return TreePine
  if (plant.value.stage === 'sapling') return Leaf
  return Sprout
})
const inventory = computed(() => gardenView.value?.inventory || [])
const expansions = computed(() => gardenView.value?.expansions || [])
const placements = computed(() => gardenView.value?.placements || [])
const inventoryById = computed(() => {
  const map = {}
  for (const item of inventory.value) map[item.id] = item
  return map
})
const placementBySlot = computed(() => {
  const map = {}
  for (const placement of placements.value) {
    if (placement.regionId === 'garden') map[placement.slotId] = placement
  }
  return map
})
const capacitySlots = computed(() => (
  Array.from({ length: garden.value.capacity || 0 }, (_, index) => `slot-${index + 1}`)
))
const unplacedInventory = computed(() => {
  const placedIds = new Set(placements.value.map((placement) => placement.inventoryId))
  return inventory.value.filter((item) => !placedIds.has(item.id))
})
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
const progressWidth = computed(() => {
  if (!plant.value) return '0%'
  return `${Math.min(100, Math.round((plant.value.growthScore / 15) * 100))}%`
})

function openPlacement(slotId) {
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
</style>
