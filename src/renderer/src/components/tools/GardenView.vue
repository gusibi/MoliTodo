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

        <div v-if="plant" class="mt-4 flex flex-col gap-3">
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
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: progressWidth }" />
          </div>
        </div>

        <p v-else class="mt-4 text-sm text-muted-foreground">{{ $t('tools.noPlant') }}</p>
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

      <section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useToolsStore } from '@/store/toolsStore'
import Button from '@/components/ui/button/Button.vue'

const toolsStore = useToolsStore()
const selectedItemId = ref(null)
const claimOptions = ref(null)
const claiming = ref(false)
const claimError = ref('')

const gardenView = computed(() => toolsStore.gardenView)
const plant = computed(() => gardenView.value?.plant || null)
const garden = computed(() => gardenView.value?.garden || {
  level: 1,
  seedCount: 0,
  autoPlant: true
})
const seeds = computed(() => gardenView.value?.seeds || [])
const inventory = computed(() => gardenView.value?.inventory || [])
const expansions = computed(() => gardenView.value?.expansions || [])
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
