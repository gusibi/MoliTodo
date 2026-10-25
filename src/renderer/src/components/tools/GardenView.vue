<template>
  <div class="tool-view-scroll h-full overflow-auto">
    <div class="tool-page">
      <ToolPageHeader
        :eyebrow="$t('tools.gardenEyebrow')"
        :title="$t('tools.gardenHeroTitle')"
        :description="$t('tools.gardenHeroDescription')"
        :icon="Sprout"
        tone="success"
      >
        <template #actions>
          <p class="max-w-[17rem] text-right text-[11px] leading-5 text-muted-foreground">
            {{ $t('tools.streakSummary', { streak: garden.currentStreak, total: garden.totalGrowthDays }) }}
          </p>
        </template>
      </ToolPageHeader>

      <div class="tool-reveal flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border/50">
        <nav
          role="tablist"
          :aria-label="$t('tools.gardenTabsLabel')"
          class="flex max-w-full flex-wrap items-center gap-5"
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
          class="-mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          :class="activeTab === tab.id
            ? 'border-success text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = tab.id"
          @keydown="handleTabKeydown($event, index)"
        >
          <component :is="tab.icon" class="h-3.5 w-3.5" aria-hidden="true" />
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.count !== null"
            class="tool-tick rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
          >
            {{ tab.count }}
          </span>
        </button>
        </nav>

        <button
          v-if="pendingRewardCount"
          type="button"
          class="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.07] px-2.5 py-1 text-[10px] font-medium text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
          @click="activeTab = 'garden'"
        >
          <Sparkles class="h-3 w-3" aria-hidden="true" />
          {{ $t('tools.pendingRewards') }} {{ pendingRewardCount }}
        </button>
      </div>

      <section
        v-if="activeTab === 'garden'"
        id="garden-panel-garden"
        role="tabpanel"
        aria-labelledby="garden-tab-garden"
        class="flex flex-col gap-4"
      >
        <!-- 三维小院：HUD 覆盖，场景占满视线 -->
        <div class="garden-stage tool-reveal relative aspect-[16/8.2] max-h-[500px] min-h-[320px] w-full overflow-hidden rounded-[26px] border border-border/50 bg-[#bfe3ff]">
          <GardenThreeScene
            :level="garden.level"
            :plant="plant"
            :matured-plant="lastMaturedPlant"
            :placements="scenePlacements"
            :layout-mode="layoutMode"
            @remove-placement="removePlacement"
            @move-placement="movePlacement"
          />

          <div class="pointer-events-none absolute left-14 top-4 z-30 flex flex-wrap items-center gap-1.5">
            <span class="garden-hud">{{ $t('tools.gardenLevel', { level: garden.level }) }}</span>
          </div>

          <div class="absolute right-3 top-3 z-30 flex max-w-[88%] flex-wrap items-center justify-end gap-1.5 rounded-xl border border-white/45 bg-background/70 p-1.5 shadow-sm backdrop-blur-md">
            <span class="hidden px-1 text-[10px] text-muted-foreground lg:inline">
              {{ $t('tools.placedCount', { placed: gardenPlacedCount, capacity: garden.capacity }) }}
            </span>
            <span class="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
              <span class="hidden sm:inline">{{ $t('tools.autoPlace') }}</span>
              <Switch
                :model-value="garden.autoPlace"
                :label="$t('tools.autoPlace')"
                @update:model-value="toggleAutoPlace"
              />
            </span>
            <Button size="sm" variant="outline" @click="toggleLayout">
              {{ layoutMode ? $t('tools.layoutDone') : $t('tools.layoutEdit') }}
            </Button>
            <Button size="sm" @click="openPlacementTray">
              <Plus class="h-3.5 w-3.5" aria-hidden="true" />
              {{ $t('tools.addItem') }}
            </Button>
          </div>

          <div
            v-if="scenePlacements.length === 0"
            class="pointer-events-none absolute inset-x-0 bottom-[6.5rem] z-20 flex flex-col items-center gap-2"
          >
            <p class="rounded-full bg-background/75 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">{{ $t('tools.emptyGardenHint') }}</p>
            <Button class="pointer-events-auto shadow-sm" size="sm" @click="openPlacementTray">
              <Plus class="h-3.5 w-3.5" aria-hidden="true" />
              {{ $t('tools.addFirstItem') }}
            </Button>
          </div>

          <div class="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex items-end justify-between gap-3">
            <div class="garden-hud inline-flex max-w-[78%] items-center gap-1.5">
              <span class="truncate font-medium text-foreground">{{ plant ? plantSpeciesName : $t('tools.noPlant') }}</span>
            </div>
            <p class="hidden shrink-0 rounded-full bg-background/70 px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur sm:block">
              {{ $t('tools.sceneOrbitHint') }}
            </p>
          </div>
        </div>

        <!-- 待领取奖励：先于统计出现，避免奖励被埋没 -->
        <section v-if="activeClaim" class="tool-surface tool-reveal border-primary/25 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="tool-label text-primary">{{ $t('tools.claims') }}</p>
              <h2 class="mt-1 text-base font-semibold tracking-tight text-foreground">{{ $t('tools.claimHint') }}</h2>
            </div>
            <span class="tool-tick rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">{{ pendingClaims.length }}</span>
          </div>

          <div v-if="claimOptions" class="mt-4">
            <div
              v-if="claimOptions.fallbackItem || claimOptions.directItem"
              class="flex items-center gap-3 rounded-xl border border-border/50 bg-background/45 p-3"
            >
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ItemArt :variant="(claimOptions.fallbackItem || claimOptions.directItem).variant" class="h-9 w-9" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground">{{ catalogName((claimOptions.fallbackItem || claimOptions.directItem).id) }}</p>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  {{ claimOptions.fallbackItem ? $t('tools.fallback') : $t('tools.lastItem') }}
                </p>
              </div>
            </div>

            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="candidate in claimOptions.candidates"
                :key="candidate.id"
                type="button"
                class="flex min-w-[160px] max-w-[220px] flex-1 items-center gap-2.5 rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                :class="selectedItemId === candidate.id
                  ? 'border-primary/40 bg-primary/[0.07]'
                  : 'border-border/50 bg-background/40 hover:bg-accent/30'"
                :aria-pressed="selectedItemId === candidate.id"
                @click="selectedItemId = candidate.id"
              >
                <div class="h-10 w-10 shrink-0">
                  <ItemArt :variant="candidate.variant" />
                </div>
                <div class="min-w-0">
                  <p class="truncate text-[11px] font-medium text-foreground">{{ catalogName(candidate.id) }}</p>
                  <p class="text-[9px] text-muted-foreground">{{ candidate.size }}×{{ candidate.size }}</p>
                </div>
              </button>
            </div>

            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p v-if="claimError" class="text-sm text-destructive" role="alert">{{ claimError }}</p>
              <div v-else class="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                <Sparkles class="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                <span>{{ $t('tools.claimAfterHint') }}</span>
              </div>
              <Button
                :loading="claiming"
                :disabled="!claimOptions.directItem && !claimOptions.fallbackItem && !selectedItemId"
                @click="claim"
              >
                {{ $t('tools.claim') }}
              </Button>
            </div>
          </div>
        </section>

        <div class="grid gap-4 lg:grid-cols-[1.38fr_1fr] lg:items-stretch">
          <section class="tool-surface tool-reveal p-5 sm:p-6">
            <div class="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
              <div
                v-for="(stat, index) in gardenStats"
                :key="stat.key"
                class="min-w-0"
                :class="index === 0 ? 'pr-3' : index === 3 ? 'pl-3' : 'px-3 sm:px-4'"
              >
                <p class="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{{ stat.label }}</p>
                <p class="tool-metric mt-1.5 text-[2rem] font-semibold leading-none text-foreground">{{ stat.value }}</p>
              </div>
            </div>

            <div class="mt-5 border-t border-border/50 pt-4">
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs font-medium text-foreground">{{ $t('tools.growthProgress') }}</p>
                <Button variant="ghost" size="sm" @click="growthGuideOpen = true">
                  <Info class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ $t('tools.growthGuide') }}
                </Button>
              </div>

              <template v-if="plant">
                <div class="mt-3 flex items-center">
                  <template v-for="(stage, index) in stageSteps" :key="stage.id">
                    <div class="flex flex-col items-center gap-1.5">
                      <span
                        class="flex h-2.5 w-2.5 items-center justify-center rounded-full border transition-colors"
                        :class="index <= stageIndex ? 'border-primary bg-primary' : 'border-border bg-background'"
                      />
                      <span class="text-[9px]" :class="index <= stageIndex ? 'text-foreground' : 'text-muted-foreground'">{{ stage.label }}</span>
                    </div>
                    <span v-if="index < stageSteps.length - 1" class="mx-1.5 mb-4 h-px flex-1" :class="index < stageIndex ? 'bg-primary/40' : 'bg-border'" />
                  </template>
                </div>
                <div class="mt-4 flex items-end justify-between gap-3">
                  <p class="tool-metric text-2xl font-semibold leading-none text-foreground">
                    {{ plant.growthScore }}<span class="text-sm font-normal text-muted-foreground">/15</span>
                  </p>
                  <p v-if="plantedAtLabel" class="text-[10px] text-muted-foreground">{{ $t('tools.plantedAt', { date: plantedAtLabel }) }}</p>
                </div>
                <div class="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div class="h-full rounded-full bg-primary transition-all duration-700" :style="{ width: progressWidth }" />
                </div>
                <p class="mt-1.5 text-[10px] text-muted-foreground">{{ nextStageHint }}</p>
              </template>

              <div v-else class="mt-3 flex flex-wrap items-center gap-2">
                <p class="mr-1 text-xs text-muted-foreground">{{ $t('tools.noPlant') }}</p>
                <Button
                  v-for="seed in seeds"
                  :key="seed.speciesId"
                  size="sm"
                  :loading="plantingSpecies === seed.speciesId"
                  @click="plantSeed(seed.speciesId)"
                >
                  {{ $t('tools.plantSeed', { species: speciesName(seed.speciesId) }) }}
                </Button>
                <Button
                  v-if="seeds.length === 0 && garden.canClaimBasicSeed"
                  size="sm"
                  :loading="claimingSeed"
                  @click="claimBasicSeed"
                >
                  {{ $t('tools.claimBasicSeed') }}
                </Button>
              </div>
            </div>
          </section>

          <section class="tool-surface tool-reveal p-5 sm:p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="tool-label">{{ $t('tools.expansion') }}</p>
                <p class="mt-1 text-sm font-medium text-foreground">{{ $t('tools.capacity', { count: garden.capacity }) }}</p>
              </div>
              <span class="tool-tick rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">{{ garden.level }}/5</span>
            </div>

            <div class="mt-4 grid grid-cols-5 gap-1.5">
              <div
                v-for="level in 5"
                :key="level"
                class="flex flex-col items-center gap-1 rounded-lg border py-2"
                :class="level <= garden.level ? 'border-primary/25 bg-primary/[0.06]' : 'border-border/50 bg-background/30'"
              >
                <span class="text-[10px] font-medium" :class="level <= garden.level ? 'text-primary' : 'text-muted-foreground'">Lv.{{ level }}</span>
                <span class="h-1 w-1 rounded-full" :class="level <= garden.level ? 'bg-primary' : 'bg-border'" />
              </div>
            </div>

            <p v-if="garden.nextExpansion" class="mt-4 border-t border-border/50 pt-3 text-[11px] leading-5 text-muted-foreground">
              {{ $t('tools.nextExpansion', {
                level: garden.nextExpansion.level,
                streak: garden.nextExpansion.streakDays,
                total: garden.nextExpansion.totalGrowthDays
              }) }}
            </p>
            <p v-else class="mt-4 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">{{ $t('tools.allExpansions') }}</p>
          </section>
        </div>

        <p v-if="placementError" class="text-sm text-destructive" role="alert">{{ placementError }}</p>
      </section>

      <section
        v-else-if="activeTab === 'collection'"
        id="garden-panel-collection"
        role="tabpanel"
        aria-labelledby="garden-tab-collection"
        class="tool-surface tool-reveal p-5 sm:p-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold tracking-tight text-foreground">{{ $t('tools.collection.title') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ $t('tools.collection.description') }}</p>
          </div>
          <span class="tool-tick rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">
            {{ $t('tools.collection.summary', { owned: collectionOwnedCount, total: collection.length }) }}
          </span>
        </div>

        <div class="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          <div
            v-for="entry in collection"
            :key="entry.id"
            class="group flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors"
            :class="entry.owned || entry.unlocked
              ? 'border-border/50 bg-background/45 hover:border-primary/25'
              : 'border-border/40 bg-background/20'"
          >
            <div class="h-12 w-12 transition-transform duration-300 group-hover:-translate-y-0.5" :class="{ 'opacity-35 grayscale': !entry.owned && !entry.unlocked }">
              <ItemArt :variant="entry.variant" />
            </div>
            <p class="line-clamp-1 text-[11px] text-foreground">{{ itemName(entry) }}</p>
            <p class="text-[9px]" :class="entry.owned || entry.unlocked ? 'text-primary/80' : 'text-muted-foreground'">{{ collectionStatus(entry) }}</p>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div class="tool-inset p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-medium text-foreground">{{ $t('tools.species') }}</h3>
              <span class="tool-tick text-[10px] text-muted-foreground">{{ species.length }}</span>
            </div>
            <p v-if="species.length === 0" class="mt-3 text-xs text-muted-foreground">{{ $t('tools.noSpecies') }}</p>
            <ul v-else class="mt-3 flex flex-wrap gap-1.5">
              <li v-for="entry in species" :key="entry.speciesId" class="rounded-full border border-border/50 bg-background/60 px-2.5 py-1 text-[11px] text-foreground">
                {{ speciesName(entry.speciesId) }}
              </li>
            </ul>
          </div>

          <div class="tool-inset p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-medium text-foreground">{{ $t('tools.seeds') }}</h3>
              <span class="tool-tick text-[10px] text-muted-foreground">{{ garden.seedCount }}</span>
            </div>
            <p v-if="seeds.length === 0" class="mt-3 text-xs text-muted-foreground">{{ $t('tools.noSeeds') }}</p>
            <ul v-else class="mt-3 flex flex-col gap-1.5">
              <li v-for="seed in seeds" :key="seed.speciesId" class="flex items-center justify-between text-[11px]">
                <span class="text-foreground">{{ speciesName(seed.speciesId) }}</span>
                <span class="text-muted-foreground">×{{ seed.quantity }}</span>
              </li>
            </ul>
          </div>

          <div class="tool-inset p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-medium text-foreground">{{ $t('tools.inventory') }}</h3>
              <span class="tool-tick text-[10px] text-muted-foreground">{{ inventory.length }}</span>
            </div>
            <p v-if="inventory.length === 0" class="mt-3 text-xs text-muted-foreground">{{ $t('tools.noInventory') }}</p>
            <ul v-else class="mt-3 flex flex-wrap gap-1.5">
              <li v-for="item in inventory" :key="item.id" class="flex items-center gap-1 rounded-full border border-border/50 bg-background/60 px-2 py-0.5 text-[11px] text-foreground">
                <div class="h-4 w-4 text-primary">
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
        class="tool-surface tool-reveal p-5 sm:p-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold tracking-tight text-foreground">{{ $t('tools.badges.title') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ $t('tools.badges.description') }}</p>
          </div>
          <span class="tool-tick rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">
            {{ $t('tools.badges.summary', { unlocked: badges.unlocked, total: badges.total }) }}
          </span>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <Tooltip
            v-for="badge in badges.items"
            :key="badge.id"
            side="bottom"
            content-class="max-w-[16rem] leading-5"
          >
            <template #trigger>
              <button
                type="button"
                class="flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                :class="badge.unlocked
                  ? 'border-success/25 bg-success/[0.05] hover:border-success/40'
                  : 'border-border/45 bg-background/25 hover:bg-background/45'"
                :aria-label="`${$t(`tools.badgeNames.${badge.definitionId}`)}：${badgeCondition(badge)}`"
                @click="selectedBadgeId = badge.id"
              >
                <BadgeArt
                  :definition-id="badge.definitionId"
                  :kind="badge.kind"
                  :unlocked="badge.unlocked"
                  class="h-9 w-9 shrink-0"
                  :class="{ 'grayscale opacity-40': !badge.unlocked }"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[11px] font-medium text-foreground">{{ $t(`tools.badgeNames.${badge.definitionId}`) }}</p>
                  <p class="truncate text-[9px]" :class="badge.unlocked ? 'text-success' : 'text-muted-foreground'">
                    <template v-if="badge.unlocked">{{ badgeStatus(badge) }}</template>
                    <template v-else>{{ $t('tools.badges.locked') }}</template>
                  </p>
                </div>
                <Lock v-if="!badge.unlocked" class="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              </button>
            </template>
            {{ badgeCondition(badge) }}
          </Tooltip>
        </div>
      </section>

      <section
        v-else
        id="garden-panel-history"
        role="tabpanel"
        aria-labelledby="garden-tab-history"
        class="tool-surface tool-reveal p-5 sm:p-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold tracking-tight text-foreground">{{ $t('tools.plantHistory') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ $t('tools.plantHistoryDescription') }}</p>
          </div>
          <span class="tool-tick rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">{{ plantHistory.length }}</span>
        </div>

        <p v-if="plantHistory.length === 0" class="mt-5 rounded-xl border border-dashed border-border/60 bg-background/35 px-4 py-7 text-center text-sm text-muted-foreground">
          {{ $t('tools.noPlantHistory') }}
        </p>
        <ul v-else class="mt-4">
          <li
            v-for="entry in plantHistory"
            :key="entry.id"
            class="flex items-center gap-3 border-t border-border/40 py-3 first:border-t-0"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 p-1 text-primary">
              <PlantArt :stage="entry.stage" :species-id="entry.speciesId" class="h-8 w-8" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] text-foreground">{{ speciesName(entry.speciesId) }} · {{ $t(`tools.stage.${entry.stage}`) }}</p>
              <p class="text-[10px] text-muted-foreground">{{ formatPlantDate(entry.plantedAt) }}</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-[11px] text-foreground">{{ $t(`tools.plantStatus.${entry.status}`) }}</p>
              <p class="tool-tick text-[10px] text-muted-foreground">{{ entry.growthScore }}/15</p>
            </div>
          </li>
        </ul>
      </section>

      <Dialog
        :open="Boolean(selectedBadge)"
        :title="selectedBadge ? $t(`tools.badgeNames.${selectedBadge.definitionId}`) : ''"
        content-class="w-[min(92vw,22rem)]"
        @update:open="(value) => { if (!value) selectedBadgeId = null }"
      >
        <div v-if="selectedBadge" class="flex flex-col items-center gap-3 pb-1 text-center">
          <BadgeArt
            :definition-id="selectedBadge.definitionId"
            :kind="selectedBadge.kind"
            :unlocked="selectedBadge.unlocked"
            class="h-24 w-24"
            :class="{ 'grayscale opacity-40': !selectedBadge.unlocked }"
          />
          <p class="text-sm text-foreground">{{ badgeCondition(selectedBadge) }}</p>
          <p class="text-xs text-muted-foreground">
            {{ selectedBadge.unlocked ? badgeStatus(selectedBadge) : $t('tools.badges.locked') }}
          </p>
        </div>
      </Dialog>

      <Dialog
        v-model:open="rewardDialogOpen"
        :title="$t('tools.reward.title')"
        content-class="w-[min(92vw,24rem)]"
      >
        <div v-if="claimedReward" class="flex flex-col items-center gap-3 pb-1 text-center">
          <div class="relative flex h-28 w-28 items-center justify-center">
            <span class="absolute inset-0 rounded-full border border-primary/15" aria-hidden="true" />
            <span class="absolute inset-3 rounded-full border border-primary/10 bg-primary/[0.04]" aria-hidden="true" />
            <div class="relative h-16 w-16">
              <ItemArt :variant="claimedReward.item.variant" />
            </div>
          </div>
          <p class="text-base font-semibold text-foreground">{{ catalogName(claimedReward.item.id) }}</p>
          <p class="text-xs leading-5 text-muted-foreground">
            {{ claimedReward.fallback ? $t('tools.reward.fallback') : $t('tools.reward.hint') }}
          </p>
        </div>
        <template #footer>
          <Button @click="rewardDialogOpen = false">{{ $t('tools.reward.done') }}</Button>
        </template>
      </Dialog>

      <Dialog
        v-model:open="growthGuideOpen"
        :title="$t('tools.growthGuide')"
        :description="$t('tools.growthGuideHint')"
        content-class="w-[min(94vw,32rem)]"
      >
        <div class="flex flex-col gap-4 pb-1">
          <p class="text-sm leading-6 text-muted-foreground">
            {{ $t('tools.growthRules.description', { score: growth.maturityScore }) }}
          </p>
          <ul class="flex flex-col gap-2">
            <li v-for="rule in growthRuleItems" :key="rule.id" class="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sprout class="h-4 w-4" aria-hidden="true" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground">{{ rule.label }}</p>
                <p class="mt-0.5 text-[11px] text-muted-foreground">{{ rule.hint }}</p>
              </div>
              <span class="tool-tick shrink-0 text-sm font-semibold text-primary">+{{ rule.points }}</span>
            </li>
          </ul>
          <p class="text-[11px] leading-5 text-muted-foreground">
            {{ $t('tools.growthRules.growthDay', {
              focus: growth.growthDay.focusCount,
              health: growth.growthDay.healthConfirmations
            }) }}
          </p>
        </div>
      </Dialog>

      <Dialog
        :open="placementDialogOpen"
        :title="$t('tools.addItem')"
        :description="$t('tools.placementTrayDescription')"
        content-class="w-[min(94vw,28rem)]"
        @update:open="(value) => { placementDialogOpen = value }"
      >
        <p v-if="placementOptions.length === 0" class="text-sm text-muted-foreground">
          {{ placementFull ? $t('tools.placementFull') : $t('tools.placementNoItems') }}
        </p>
        <div v-else class="flex flex-col gap-2">
          <Button
            v-for="item in placementOptions"
            :key="item.id"
            variant="outline"
            class="justify-start"
            :loading="placingItemId === item.id"
            @click="placeItem(item.id)"
          >
            <span class="min-w-0 flex-1 truncate text-left">{{ item.label }}</span>
            <span
              v-if="item.isPet"
              class="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-normal text-success"
            >
              {{ $t('tools.petSlotShort') }}
            </span>
            <span class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
              {{ item.size }}×{{ item.size }}
            </span>
          </Button>
          <p class="text-xs text-muted-foreground">{{ $t('tools.placementTrayHint') }}</p>
        </div>
        <p v-if="placementError" class="mt-3 text-sm text-destructive" role="alert">{{ placementError }}</p>
      </Dialog>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Award, BookOpen, History, Info, Lock, Plus, Sparkles, Sprout } from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import ToolPageHeader from './ToolPageHeader.vue'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import PlantArt from './art/PlantArt.vue'
import BadgeArt from './art/BadgeArt.vue'
import ItemArt from './art/ItemArt.vue'
const GardenThreeScene = defineAsyncComponent(() => import('./art/GardenThreeScene.vue'))

const { t } = useI18n()
const toolsStore = useToolsStore()
const activeTab = ref('garden')
const selectedBadgeId = ref(null)
const selectedItemId = ref(null)
const claimOptions = ref(null)
const claiming = ref(false)
const claimError = ref('')
const claimedReward = ref(null)
const rewardDialogOpen = ref(false)
const placementDialogOpen = ref(false)
const growthGuideOpen = ref(false)
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
const selectedBadge = computed(() => (
  badges.value.items.find((badge) => badge.id === selectedBadgeId.value) || null
))
const growth = computed(() => gardenView.value?.growth || {
  maturityScore: 15,
  events: {
    focus: { points: 1, dailyLimit: 10 },
    water: { points: 2, dailyLimit: 3 },
    sun: { points: 2, dailyLimit: 3 }
  },
  growthDay: { focusCount: 1, healthConfirmations: 2 }
})
const growthRuleItems = computed(() => {
  const events = growth.value.events
  return [
    {
      id: 'focus',
      label: t('tools.growthRules.focus'),
      points: events.focus.points,
      hint: t('tools.growthRules.focusHint', { limit: events.focus.dailyLimit })
    },
    {
      id: 'water',
      label: t('tools.growthRules.water'),
      points: events.water.points,
      hint: t('tools.growthRules.waterHint', { limit: events.water.dailyLimit })
    },
    {
      id: 'sun',
      label: t('tools.growthRules.sun'),
      points: events.sun.points,
      hint: t('tools.growthRules.sunHint', { limit: events.sun.dailyLimit })
    }
  ]
})
const collectionOwnedCount = computed(() => (
  collection.value.filter((entry) => entry.owned || entry.unlocked).length
))
const inventory = computed(() => gardenView.value?.inventory || [])
const placements = computed(() => gardenView.value?.placements || [])
const gardenPlacements = computed(() => placements.value.filter((placement) => placement.regionId === 'garden'))
const petPlacements = computed(() => placements.value.filter((placement) => placement.regionId === 'pet'))
const inventoryById = computed(() => {
  const map = {}
  for (const item of inventory.value) map[item.id] = item
  return map
})
const layoutMode = ref(false)
function itemSize(item) {
  const entry = collectionByCatalogId.value[item.catalogId]
  if (item.kind === 'tree' || entry?.category === 'species') return 1
  return entry?.size || 1
}
const gardenPlacedCount = computed(() => gardenPlacements.value.length)
const petPlacedCount = computed(() => petPlacements.value.length)
const scenePlacements = computed(() => placements.value.map((placement) => {
  const item = inventoryById.value[placement.inventoryId]
  const entry = item ? collectionByCatalogId.value[item.catalogId] : null
  return {
    ...placement,
    variant: entry?.variant || 'box',
    size: item ? itemSize(item) : 1,
    label: item ? itemName(entry) : '',
    isPet: placement.regionId === 'pet'
  }
}))
const placementOptions = computed(() => {
  const placedIds = new Set(placements.value.map((placement) => placement.inventoryId))
  const gardenFull = gardenPlacedCount.value >= (garden.value.capacity || 0)
  const petFull = petPlacedCount.value >= (garden.value.petCapacity || 0)
  return inventory.value
    .filter((item) => item.quantity > 0 && !placedIds.has(item.id))
    .filter((item) => (item.kind === 'pet' ? !petFull : !gardenFull))
    .map((item) => {
      const entry = collectionByCatalogId.value[item.catalogId]
      return {
        ...item,
        size: itemSize(item),
        isPet: item.kind === 'pet',
        label: itemName(entry) || item.catalogId
      }
    })
})
const placementFull = computed(() => (
  gardenPlacedCount.value >= (garden.value.capacity || 0)
  && petPlacedCount.value >= (garden.value.petCapacity || 0)
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
const gardenStats = computed(() => [
  { key: 'focus', label: t('tools.todayFocus'), value: today.value.focusCount },
  { key: 'water', label: t('tools.todayWater'), value: today.value.waterCount },
  { key: 'sun', label: t('tools.todaySun'), value: today.value.sunCount },
  { key: 'growth', label: t('tools.todayGrowth'), value: today.value.totalGrowth }
])
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
const stageSteps = computed(() => (
  ['seed', 'sprout', 'sapling', 'mature'].map((stage) => ({
    id: stage,
    label: t(`tools.stage.${stage}`)
  }))
))
const stageIndex = computed(() => {
  if (!plant.value) return -1
  const score = plant.value.growthScore
  if (score >= 15) return 3
  if (score >= 10) return 2
  if (score >= 5) return 1
  return 0
})
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

function catalogName(catalogId) {
  return t(`tools.itemNames.${catalogId}`)
}

function formatPlantDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function openPlacementTray() {
  placementError.value = ''
  placementDialogOpen.value = true
}

async function placeItem(inventoryId) {
  placingItemId.value = inventoryId
  placementError.value = ''
  try {
    await toolsStore.placeItem(inventoryId)
    placementDialogOpen.value = false
  } catch (err) {
    placementError.value = err.message
  } finally {
    placingItemId.value = null
  }
}

async function movePlacement({ inventoryId, x, z }) {
  placementError.value = ''
  try {
    await toolsStore.moveItem(inventoryId, { x, z })
  } catch (err) {
    placementError.value = err.message
    await toolsStore.loadGardenView()
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

function badgeCondition(badge) {
  const condition = badge?.condition
  if (!condition) return ''
  if (badge.kind === 'expansion') {
    return t('tools.badges.conditions.expansion', {
      streak: condition.streakDays,
      total: condition.totalGrowthDays,
      capacity: condition.capacity
    })
  }
  const metricKey = {
    focusCount: 'focus',
    healthCount: 'health',
    growthDayCount: 'growthDay'
  }[condition.metric] || 'growthDay'
  return t(`tools.badges.conditions.${metricKey}`, { count: condition.threshold })
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
    const result = await toolsStore.claimReward(activeClaim.value.id, selectedItemId.value)
    if (result?.claimed && result.item) {
      claimedReward.value = { item: result.item, fallback: Boolean(result.fallback) }
      rewardDialogOpen.value = true
    }
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
