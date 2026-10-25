<template>
  <div class="tool-view-scroll h-full overflow-auto">
    <div class="tool-page">
      <ToolPageHeader
        :eyebrow="$t('tools.focusView.eyebrow')"
        :title="$t('tools.focusView.heroTitle')"
        :description="$t('tools.focusView.heroDescription')"
        :icon="Timer"
        tone="primary"
      >
        <template #actions>
          <Button variant="outline" size="sm" @click="toggleFocusWidget">
            <Monitor class="h-3.5 w-3.5" aria-hidden="true" />
            {{ focusWidgetVisible ? $t('tools.focusView.widgetHide') : $t('tools.focusView.widgetShow') }}
          </Button>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-[11px] text-muted-foreground">
            <Timer class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {{ $t('tools.focusView.minimum') }}
          </span>
        </template>
      </ToolPageHeader>
      <p v-if="widgetError" class="text-sm text-destructive" role="alert">{{ widgetError }}</p>

      <section class="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-stretch">
        <!-- 进行中：以计时器为唯一主角 -->
        <div v-if="active" class="tool-surface tool-reveal relative flex min-h-[460px] flex-col overflow-hidden p-6 sm:p-8">
          <div
            class="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
            :class="[
              isBreak ? 'tool-halo-success' : 'tool-halo',
              active.status === 'running' ? 'focus-halo-live' : ''
            ]"
          />
          <div class="relative flex items-start justify-between gap-3">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
              :class="isBreak ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'"
            >
              <component :is="isBreak ? Coffee : Timer" class="h-3.5 w-3.5" aria-hidden="true" />
              {{ isBreak ? $t('tools.focusView.breakBadge') : $t('tools.focusView.focusBadge') }}
            </span>
          </div>

          <Transition name="tool-toast">
            <div
              v-if="completedNotice"
              class="absolute right-5 top-5 z-20 flex max-w-[16rem] items-center gap-2.5 rounded-xl border border-success/30 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur"
              role="status"
            >
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 class="h-4 w-4" aria-hidden="true" />
              </span>
              <div class="min-w-0">
                <p class="text-xs font-medium text-foreground">{{ $t('tools.focusView.completedTitle') }}</p>
                <p class="mt-0.5 text-[10px] text-muted-foreground">{{ $t('tools.focusView.completedHint', { minutes: breakMinutes }) }}</p>
              </div>
            </div>
          </Transition>

          <div class="relative flex flex-1 flex-col items-center justify-center py-5">
            <div class="relative flex h-[252px] w-[252px] items-center justify-center sm:h-[292px] sm:w-[292px]">
              <svg viewBox="0 0 220 220" class="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="110" cy="110" r="96" fill="none" stroke="currentColor" class="text-border/50" stroke-width="2" />
                <g class="text-border/70">
                  <line
                    v-for="tick in 12"
                    :key="tick"
                    x1="110"
                    y1="6"
                    x2="110"
                    y2="11"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    :transform="`rotate(${tick * 30} 110 110)`"
                  />
                </g>
                <circle
                  cx="110"
                  cy="110"
                  r="96"
                  fill="none"
                  stroke="currentColor"
                  :class="ringClass"
                  stroke-width="4"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="dashOffset"
                  class="focus-ring-progress transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
                <p class="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {{ isBreak ? $t('tools.focusView.breakBadge') : $t('tools.focusView.focusBadge') }}
                </p>
                <p class="tool-metric mt-1.5 text-[4.4rem] font-semibold leading-none text-foreground sm:text-[5rem]" role="timer">
                  {{ displayTime }}
                </p>
                <p class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                  <span class="h-1.5 w-1.5 rounded-full" :class="active.status === 'running' ? 'animate-pulse bg-primary' : 'bg-muted-foreground/60'" />
                  {{ statusLabel }}
                </p>
              </div>
            </div>

            <div class="mt-6 w-full max-w-md rounded-xl border border-border/45 bg-background/45 px-3.5 py-3">
              <div class="flex items-center gap-2.5">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ListTodo class="h-4 w-4" aria-hidden="true" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {{ isBreak ? $t('tools.focusView.lastRound') : activeTask ? $t('tools.focusView.linkedTask') : $t('tools.focusView.sessionLabel') }}
                  </p>
                  <p class="truncate text-sm font-medium text-foreground">{{ activeTask?.content || $t('tools.focusView.freeFocus') }}</p>
                </div>
                <span v-if="!isBreak" class="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {{ elapsedLabel }}
                </span>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button v-if="active.status === 'running'" variant="outline" size="lg" class="h-11 px-5" @click="pause">
                <Pause class="h-4 w-4" aria-hidden="true" />
                {{ $t('tools.focusView.pause') }}
              </Button>
              <Button v-else size="lg" class="h-11 px-5" @click="resume">
                <Play class="h-4 w-4" aria-hidden="true" />
                {{ $t('tools.focusView.resume') }}
              </Button>
              <Button v-if="isBreak" variant="outline" class="h-11" @click="skipBreak">
                <SkipForward class="h-4 w-4" aria-hidden="true" />
                {{ $t('tools.focusView.skipBreak') }}
              </Button>
              <Button v-else variant="ghost" class="h-11 text-muted-foreground hover:text-destructive" @click="cancel">
                <X class="h-4 w-4" aria-hidden="true" />
                {{ $t('tools.focusView.cancel') }}
              </Button>
            </div>
            <p class="mt-3 text-center text-[10px] text-muted-foreground/70" aria-hidden="true">
              <kbd class="rounded border border-border/70 px-1 py-0.5 font-sans text-[9px]">Space</kbd>
              {{ $t('tools.focusView.spaceHint') }}
            </p>
            <p v-if="isBreak" class="mt-2 text-center text-xs text-muted-foreground">
              {{ $t('tools.focusView.breakHint', { minutes: breakMinutes }) }}
            </p>
            <p class="mt-auto pt-8 text-center text-[11px] text-muted-foreground/75">
              {{ isBreak ? $t('tools.focusView.breakFooter') : $t('tools.focusView.focusFooter') }}
            </p>
          </div>
        </div>

        <!-- 准备中：在同一个表面里完成选择与开始 -->
        <div v-else class="tool-surface tool-reveal relative flex flex-col overflow-hidden p-6 sm:p-7">
          <div class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />
          <div class="relative grid flex-1 gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div class="focus-composer-column min-w-0">
              <p class="tool-label">{{ $t('tools.focusView.durationLabel') }}</p>
              <div class="focus-durations mt-3">
                <button
                  v-for="minutes in durations"
                  :key="minutes"
                  type="button"
                  class="group relative flex min-w-0 flex-col items-start rounded-xl border px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  :class="!customOpen && selectedMinutes === minutes
                    ? 'border-primary/40 bg-primary/[0.08]'
                    : 'border-border/60 bg-background/45 hover:border-border hover:bg-accent/30'"
                  :aria-pressed="!customOpen && selectedMinutes === minutes"
                  @click="chooseDuration(minutes)"
                >
                  <span class="tool-metric text-[1.65rem] font-semibold leading-none text-foreground">{{ minutes }}</span>
                  <span class="mt-1.5 whitespace-nowrap text-[10px] text-muted-foreground">{{ $t('tools.focusView.minutesUnit') }}</span>
                  <span
                    v-if="!customOpen && selectedMinutes === minutes"
                    class="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary"
                  />
                </button>
              </div>

              <button
                type="button"
                class="mt-2 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                :class="customOpen ? 'text-primary' : ''"
                :aria-pressed="customOpen"
                @click="openCustom"
              >
                <SlidersHorizontal class="h-3.5 w-3.5" aria-hidden="true" />
                {{ $t('tools.focusView.customDuration') }}
                <span v-if="customOpen" class="tool-tick font-medium text-foreground">{{ customMinutes }}</span>
              </button>
              <div v-if="customOpen" class="mt-1.5 flex items-center gap-2">
                <Input
                  id="focus-custom-minutes"
                  v-model.number="customMinutes"
                  type="number"
                  min="15"
                  max="240"
                  class="w-24"
                  :aria-label="$t('tools.focusView.customMinutes')"
                />
                <span class="text-xs text-muted-foreground">{{ $t('tools.focusView.minutesUnit') }}</span>
              </div>

              <div class="mt-6">
                <p class="text-xs font-medium text-foreground">{{ $t('tools.focusView.taskLabel') }}</p>
                <p class="mt-1 text-[11px] text-muted-foreground">{{ $t('tools.focusView.taskHint') }}</p>
                <DropdownMenu content-class="w-[min(90vw,28rem)]">
                  <template #trigger>
                    <Button variant="outline" class="mt-2 w-full justify-between">
                      <span class="flex min-w-0 items-center gap-2">
                        <ListTodo class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span class="truncate">{{ linkedTask?.content || $t('tools.focusView.noTask') }}</span>
                      </span>
                      <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </template>
                  <DropdownMenuItem :selected="!linkedTaskId" @select="linkedTaskId = ''">
                    <CircleDot class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {{ $t('tools.focusView.noTask') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-for="task in taskOptions"
                    :key="task.id"
                    :selected="String(linkedTaskId) === String(task.id)"
                    @select="linkedTaskId = task.id"
                  >
                    <Circle class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span class="truncate">{{ task.content }}</span>
                  </DropdownMenuItem>
                </DropdownMenu>
              </div>

              <Button class="mt-5 h-11 w-full" size="lg" :loading="starting" @click="start">
                <Play class="h-4 w-4" aria-hidden="true" />
                {{ $t('tools.focusView.start', { minutes: effectiveMinutes }) }}
              </Button>
              <p v-if="error" class="mt-2 text-sm text-destructive" role="alert">{{ error }}</p>
            </div>

            <div class="relative hidden h-[228px] w-[228px] items-center justify-center md:flex">
              <svg viewBox="0 0 220 220" class="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="110" cy="110" r="96" fill="none" stroke="currentColor" class="text-border/50" stroke-width="2" />
                <g class="text-border/70">
                  <line
                    v-for="tick in 12"
                    :key="tick"
                    x1="110"
                    y1="6"
                    x2="110"
                    y2="11"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    :transform="`rotate(${tick * 30} 110 110)`"
                  />
                </g>
                <circle
                  cx="110"
                  cy="110"
                  r="96"
                  fill="none"
                  stroke="currentColor"
                  class="text-primary/45 transition-[stroke-dasharray] duration-500 ease-out"
                  stroke-width="3"
                  stroke-linecap="round"
                  :stroke-dasharray="previewDash"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p class="tool-metric text-5xl font-semibold leading-none text-foreground">{{ previewTime }}</p>
                <p class="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{{ $t('tools.focusView.readyHint') }}</p>
              </div>
            </div>
          </div>

          <div class="relative mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/45 pt-4 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <Sprout class="h-3.5 w-3.5 text-success" aria-hidden="true" />
              {{ $t('tools.focusView.footerRecord') }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <Coffee class="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
              {{ $t('tools.focusView.footerBreak') }}
            </span>
          </div>
        </div>

        <aside class="flex flex-col gap-4">
          <section v-if="active" class="tool-surface p-5">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-sm font-semibold tracking-tight text-foreground">
                {{ isBreak ? $t('tools.focusView.breakBadge') : $t('tools.focusView.sessionLabel') }}
              </h2>
              <span class="h-1.5 w-1.5 rounded-full" :class="isBreak ? 'bg-success' : 'bg-primary'" />
            </div>
            <dl class="mt-3 space-y-2 text-xs">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">
                  {{ isBreak ? $t('tools.focusView.breakDurationLabel') : $t('tools.focusView.durationLabel') }}
                </dt>
                <dd class="tool-tick font-medium text-foreground">{{ Math.round(active.plannedSeconds / 60) }} {{ $t('tools.focusView.minutesUnit') }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">{{ $t('tools.focusView.remainingLabel') }}</dt>
                <dd class="tool-tick font-medium text-foreground">{{ displayTime }}</dd>
              </div>
              <div v-if="!isBreak" class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">{{ $t('tools.focusView.taskLabel') }}</dt>
                <dd class="max-w-[12rem] truncate text-right text-foreground">{{ activeTask?.content || $t('tools.focusView.freeFocus') }}</dd>
              </div>
            </dl>
            <div class="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-[width] duration-1000" :style="{ width: `${Math.round((1 - remaining / Math.max(1, active.plannedSeconds)) * 100)}%` }" />
            </div>
          </section>

          <section class="tool-surface p-5">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ $t('tools.focusView.todayTitle') }}</h2>
              <CalendarCheck class="h-4 w-4 text-primary/70" aria-hidden="true" />
            </div>
            <div class="mt-3 grid grid-cols-3 divide-x divide-border/50">
              <div class="pr-2.5">
                <p class="text-[10px] text-muted-foreground">{{ $t('tools.focusView.todaySessions') }}</p>
                <p class="tool-metric mt-1 text-2xl font-semibold leading-none text-foreground">{{ todaySessions }}</p>
              </div>
              <div class="px-2.5">
                <p class="text-[10px] text-muted-foreground">{{ $t('tools.focusView.todayMinutes') }}</p>
                <p class="tool-metric mt-1 text-2xl font-semibold leading-none text-foreground">{{ todayMinutes }}</p>
              </div>
              <div class="pl-2.5">
                <p class="text-[10px] text-muted-foreground">{{ $t('tools.focusView.todayDone') }}</p>
                <p class="tool-metric mt-1 text-2xl font-semibold leading-none text-foreground">{{ completionRate }}<span class="ml-0.5 text-sm font-normal text-muted-foreground">%</span></p>
              </div>
            </div>

            <div class="mt-5 border-t border-border/50 pt-4">
              <div class="flex items-end justify-between gap-2">
                <div>
                  <p class="text-xs font-medium text-foreground">{{ $t('tools.focusView.weekTitle') }}</p>
                  <p class="mt-0.5 text-[10px] text-muted-foreground">{{ $t('tools.focusView.weekHint') }}</p>
                </div>
                <BarChart3 class="h-4 w-4 text-primary/70" aria-hidden="true" />
              </div>
              <div class="relative mt-4 flex h-[92px] items-end gap-1.5" aria-hidden="true">
                <div
                  v-for="day in weekDays"
                  :key="day.date"
                  class="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  :title="`${day.date}: ${day.minutes} ${$t('tools.focusView.minutesUnit')}`"
                >
                  <div class="flex h-[68px] w-full max-w-[22px] items-end overflow-hidden rounded-[4px] bg-muted/45 p-[2px]">
                    <div
                      class="tool-bar-seg w-full rounded-[2px]"
                      :class="day.minutes > 0
                        ? (day.today ? 'bg-primary' : 'bg-primary/45')
                        : 'bg-border/70'"
                      :style="{ height: `${day.height}%` }"
                    />
                  </div>
                  <span class="text-[9px]" :class="day.today ? 'font-semibold text-foreground' : 'text-muted-foreground'">{{ day.label }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="relative overflow-hidden rounded-2xl border border-border/45 bg-background/35 p-5">
            <div class="pointer-events-none absolute -bottom-14 -right-10 h-32 w-32 rounded-full bg-primary/[0.07] blur-2xl" />
            <div class="relative flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {{ $t('tools.focusView.tipTitle') }}
            </div>
            <p class="relative mt-2.5 text-[13px] leading-5 text-foreground/90">{{ $t('tools.focusView.tipBody') }}</p>
            <p class="relative mt-1.5 text-[11px] leading-5 text-muted-foreground">{{ $t('tools.focusView.tipShortBreak') }}</p>
          </section>
        </aside>
      </section>

      <section class="tool-surface tool-reveal overflow-hidden">
        <div class="flex flex-wrap items-end justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
          <div>
            <h2 class="text-base font-semibold tracking-tight text-foreground">{{ $t('tools.focusView.history') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ $t('tools.focusView.historyDescription') }}</p>
          </div>
          <span class="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">
            {{ $t('tools.focusView.recentCount', { count: recent.length }) }}
          </span>
        </div>

        <p v-if="recent.length === 0" class="mx-5 mb-5 rounded-xl border border-dashed border-border/60 bg-background/35 px-4 py-7 text-center text-sm text-muted-foreground sm:mx-6">
          {{ $t('tools.focusView.empty') }}
        </p>
        <ul v-else class="grid gap-x-5 border-t border-border/45 px-5 sm:px-6 md:grid-cols-2">
          <li
            v-for="session in recent"
            :key="session.id"
            class="flex items-start gap-3 border-b border-border/40 py-3.5 md:border-b-0 md:py-4"
          >
            <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="sessionTone(session.status).soft">
              <component :is="sessionTone(session.status).icon" class="h-4 w-4" aria-hidden="true" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <p class="truncate text-[13px] font-medium text-foreground">{{ sessionTask(session) }}</p>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px]" :class="sessionTone(session.status).badge">
                  {{ sessionStatusLabel(session.status) }}
                </span>
              </div>
              <p class="mt-0.5 text-[10px] text-muted-foreground">
                {{ formatSessionTime(session) }} · {{ $t('tools.focusView.planned', { minutes: Math.round(session.plannedSeconds / 60) }) }}
              </p>
              <div class="mt-2 h-0.5 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-primary/60" :style="{ width: `${sessionProgress(session)}%` }" />
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  CircleSlash,
  Coffee,
  ListTodo,
  Monitor,
  Pause,
  Play,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Timer,
  X
} from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import { useTaskStore } from '@/store/taskStore'
import ToolPageHeader from './ToolPageHeader.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'

const toolsStore = useToolsStore()
const taskStore = useTaskStore()
const { t, locale } = useI18n()
const durations = [15, 25, 45, 60]
const starting = ref(false)
const error = ref('')
const remaining = ref(0)
const linkedTaskId = ref('')
const selectedMinutes = ref(25)
const customOpen = ref(false)
const customMinutes = ref(30)
const focusWidgetVisible = ref(false)
const widgetError = ref('')
const completedNotice = ref(false)
let timer = null
let completedTimer = null

const active = computed(() => toolsStore.focusState?.active || null)
const recent = computed(() => toolsStore.focusState?.recent || [])
const shell = computed(() => toolsStore.shellSnapshot)
const isBreak = computed(() => active.value?.phase === 'break')
const breakMinutes = computed(() => Math.max(1, Math.round((active.value?.plannedSeconds || 0) / 60)))
const taskOptions = computed(() => taskStore.tasks.filter((task) => task.status !== 'done'))
const linkedTask = computed(() => taskOptions.value.find((task) => String(task.id) === String(linkedTaskId.value)) || null)
const activeTask = computed(() => {
  if (!active.value?.linkedTaskId) return null
  return taskStore.tasks.find((task) => String(task.id) === String(active.value.linkedTaskId)) || null
})
const effectiveMinutes = computed(() => {
  if (!customOpen.value) return selectedMinutes.value
  const value = Number(customMinutes.value)
  return Number.isFinite(value) && value >= 15 ? Math.round(value) : selectedMinutes.value
})
const previewTime = computed(() => `${String(effectiveMinutes.value).padStart(2, '0')}:00`)
const todayDate = computed(() => shell.value?.localDate || new Date().toLocaleDateString('en-CA'))
const todayRecentSessions = computed(() => (
  recent.value.filter((session) => localDateOf(session.startedAt) === todayDate.value)
))
const todaySessions = computed(() => Math.max(
  shell.value?.today?.focusCount || 0,
  todayRecentSessions.value.filter((session) => session.status === 'completed').length
))
const todayMinutes = computed(() => {
  return todayRecentSessions.value
    .reduce((total, session) => total + Math.round((session.elapsedSeconds || session.plannedSeconds || 0) / 60), 0)
})
const completionRate = computed(() => {
  if (todayRecentSessions.value.length === 0) return 0
  const completed = todayRecentSessions.value.filter((session) => session.status === 'completed').length
  return Math.round((completed / todayRecentSessions.value.length) * 100)
})
const statusLabel = computed(() => {
  if (!active.value) return ''
  const paused = active.value.status === 'paused'
  if (isBreak.value) {
    return paused ? t('tools.focusView.breakPaused') : t('tools.focusView.breakRunning')
  }
  return paused ? t('tools.focusView.paused') : t('tools.focusView.running')
})
const displayTime = computed(() => {
  const seconds = Math.max(0, remaining.value)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
})
const elapsedMinutes = computed(() => {
  if (!active.value) return 0
  const elapsed = Math.max(0, (active.value.plannedSeconds || 0) - remaining.value)
  return Math.max(0, Math.floor(elapsed / 60))
})
const elapsedLabel = computed(() => {
  if (!active.value) return ''
  if (elapsedMinutes.value < 1) return t('tools.focusView.elapsedJustNow')
  return t('tools.focusView.elapsed', { minutes: elapsedMinutes.value })
})
const circumference = 2 * Math.PI * 96
const previewDash = computed(() => {
  const arc = Math.min(1, Math.max(0, effectiveMinutes.value / 60)) * circumference
  return `${arc} ${circumference}`
})
const dashOffset = computed(() => {
  if (!active.value) return circumference
  const planned = Math.max(1, active.value.plannedSeconds || 1)
  const elapsed = Math.min(planned, Math.max(0, planned - remaining.value))
  return circumference * (1 - elapsed / planned)
})
const ringClass = computed(() => {
  if (isBreak.value) return 'text-success'
  if (active.value?.status === 'paused') return 'text-muted-foreground'
  return 'text-primary'
})
const weekDays = computed(() => {
  const today = new Date()
  const summaries = recent.value
  const days = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const key = date.toLocaleDateString('en-CA')
    const minutes = summaries
      .filter((session) => localDateOf(session.startedAt) === key)
      .reduce((total, session) => total + Math.round(session.elapsedSeconds || session.plannedSeconds || 0), 0)
    days.push({
      date: key,
      minutes,
      label: new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'zh-CN', { weekday: 'short' }).format(date),
      today: key === todayDate.value
    })
  }
  const max = Math.max(1, ...days.map((day) => day.minutes))
  return days.map((day) => ({
    ...day,
    height: day.minutes > 0 ? Math.max(6, Math.round((day.minutes / max) * 100)) : 2
  }))
})

watch(active, (session) => {
  remaining.value = session ? session.remainingSeconds : 0
}, { immediate: true })

watch(() => active.value?.phase, (phase, previous) => {
  if (previous === 'focus' && phase === 'break') {
    completedNotice.value = true
    if (completedTimer) clearTimeout(completedTimer)
    completedTimer = setTimeout(() => { completedNotice.value = false }, 4200)
    return
  }
  if (phase !== 'break') {
    completedNotice.value = false
    if (completedTimer) {
      clearTimeout(completedTimer)
      completedTimer = null
    }
  }
})

function localDateOf(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-CA')
}

function tickDown() {
  if (!active.value || active.value.status !== 'running') return
  if (remaining.value > 0) remaining.value -= 1
  if (remaining.value === 0) toolsStore.loadFocusState()
}

function chooseDuration(minutes) {
  selectedMinutes.value = minutes
  customOpen.value = false
}

function openCustom() {
  customOpen.value = true
  if (customMinutes.value < 15) customMinutes.value = 30
}

async function start() {
  error.value = ''
  if (customOpen.value && (!Number.isFinite(Number(customMinutes.value)) || Number(customMinutes.value) < 15)) {
    error.value = t('tools.focusView.minimum')
    return
  }
  starting.value = true
  try {
    await toolsStore.startFocus({
      plannedMinutes: effectiveMinutes.value,
      linkedTaskId: linkedTaskId.value || null
    })
  } catch (err) {
    error.value = err.message
  } finally {
    starting.value = false
  }
}

async function pause() {
  error.value = ''
  try {
    await toolsStore.pauseFocus()
  } catch (err) {
    error.value = err.message
  }
}

async function resume() {
  error.value = ''
  try {
    await toolsStore.resumeFocus()
  } catch (err) {
    error.value = err.message
  }
}

async function cancel() {
  error.value = ''
  try {
    await toolsStore.cancelFocus()
  } catch (err) {
    error.value = err.message
  }
}

async function skipBreak() {
  error.value = ''
  try {
    await toolsStore.skipFocusBreak()
  } catch (err) {
    error.value = err.message
  }
}

function sessionTask(session) {
  if (!session.linkedTaskId) return t('tools.focusView.noTaskRecord')
  const task = taskStore.tasks.find((entry) => String(entry.id) === String(session.linkedTaskId))
  return task?.content || t('tools.focusView.noTaskRecord')
}

function formatSessionTime(session) {
  if (!session.startedAt) return ''
  return new Date(session.startedAt).toLocaleString(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function sessionStatusLabel(status) {
  return t(`tools.focusView.status.${status}`)
}

function sessionTone(status) {
  if (status === 'completed') {
    return {
      icon: CheckCircle2,
      soft: 'bg-success/10 text-success',
      badge: 'bg-success/10 text-success'
    }
  }
  if (status === 'interrupted') {
    return {
      icon: CircleSlash,
      soft: 'bg-warning/10 text-warning',
      badge: 'bg-warning/10 text-warning'
    }
  }
  return {
    icon: Circle,
    soft: 'bg-muted text-muted-foreground',
    badge: 'bg-muted text-muted-foreground'
  }
}

function sessionProgress(session) {
  const planned = Math.max(1, session.plannedSeconds || 1)
  const actual = Math.max(0, session.elapsedSeconds || 0)
  return Math.min(100, Math.round((actual / planned) * 100))
}

async function loadWidgetVisibility() {
  try {
    const config = await window.electronAPI.config.get()
    focusWidgetVisible.value = config?.focusWidget?.visible === true
  } catch (err) {
    widgetError.value = err.message
  }
}

async function toggleFocusWidget() {
  widgetError.value = ''
  try {
    const next = !focusWidgetVisible.value
    await window.electronAPI.config.set('focusWidget.visible', next)
    focusWidgetVisible.value = next
  } catch (err) {
    widgetError.value = err.message
  }
}

function handleToolsUpdated() {
  toolsStore.loadFocusState()
  toolsStore.loadShellSnapshot()
}

function handleFocusWidgetVisibility(event, visible) {
  focusWidgetVisible.value = Boolean(visible)
}

function handleKeydown(event) {
  if (!active.value || event.code !== 'Space' || event.repeat) return
  const target = event.target
  if (target instanceof Element && target.closest('button, a, input, textarea, select, [role="menuitem"], [role="option"], [contenteditable="true"]')) {
    return
  }
  event.preventDefault()
  if (active.value.status === 'running') {
    pause()
  } else {
    resume()
  }
}

onMounted(async () => {
  await Promise.all([toolsStore.loadFocusState(), toolsStore.loadShellSnapshot(), loadWidgetVisibility()])
  timer = setInterval(tickDown, 1000)
  window.electronAPI?.events?.on('tools-updated', handleToolsUpdated)
  window.electronAPI?.events?.on('focus-widget-visibility', handleFocusWidgetVisibility)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (completedTimer) clearTimeout(completedTimer)
  window.removeEventListener('keydown', handleKeydown)
  window.electronAPI?.events?.off('tools-updated', handleToolsUpdated)
  window.electronAPI?.events?.off('focus-widget-visibility', handleFocusWidgetVisibility)
})
</script>
