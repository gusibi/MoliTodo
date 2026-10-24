<template>
  <div class="h-full overflow-auto px-6 py-6">
    <div class="mx-auto flex max-w-5xl flex-col gap-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
            {{ $t('tools.focusView.eyebrow') }}
          </p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {{ $t('tools.focusView.heroTitle') }}
          </h1>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {{ $t('tools.focusView.heroDescription') }}
          </p>
        </div>
        <div class="flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
          <Timer class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {{ $t('tools.focusView.minimum') }}
        </div>
      </header>

      <section class="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div class="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm sm:p-6">
          <div class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl" />
          <div class="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-success/[0.05] blur-3xl" />

          <template v-if="active">
            <div class="relative flex items-center justify-between gap-3">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                :class="isBreak ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'"
              >
                <component :is="isBreak ? Coffee : Timer" class="h-3.5 w-3.5" aria-hidden="true" />
                {{ isBreak ? $t('tools.focusView.breakBadge') : $t('tools.focusView.focusBadge') }}
              </span>
            </div>

            <div class="relative mt-6 flex flex-col items-center">
              <div class="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                <svg viewBox="0 0 220 220" class="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="110" cy="110" r="92" fill="none" stroke="currentColor" class="text-border/60" stroke-width="5" />
                  <circle
                    cx="110"
                    cy="110"
                    r="92"
                    fill="none"
                    stroke="currentColor"
                    :class="ringClass"
                    stroke-width="6"
                    stroke-linecap="round"
                    :stroke-dasharray="circumference"
                    :stroke-dashoffset="dashOffset"
                    class="transition-[stroke-dashoffset] duration-700 ease-linear"
                  />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
                  <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {{ isBreak ? $t('tools.focusView.breakBadge') : $t('tools.focusView.focusBadge') }}
                  </p>
                  <p class="mt-1 text-6xl font-semibold tabular-nums tracking-tight text-foreground sm:text-7xl" aria-live="polite">
                    {{ displayTime }}
                  </p>
                  <p class="mt-1 text-sm text-muted-foreground">{{ statusLabel }}</p>
                </div>
              </div>

              <div class="mt-5 w-full max-w-md rounded-2xl border border-border/50 bg-background/45 p-3">
                <div class="flex items-center gap-2.5">
                  <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ListTodo class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] text-muted-foreground">{{ activeTask ? $t('tools.focusView.linkedTask') : $t('tools.focusView.sessionLabel') }}</p>
                    <p class="truncate text-sm font-medium text-foreground">{{ activeTask?.content || $t('tools.focusView.freeFocus') }}</p>
                  </div>
                  <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {{ Math.round(active.plannedSeconds / 60) }} {{ $t('tools.focusView.minutesUnit') }}
                  </span>
                </div>
              </div>

              <div class="mt-5 flex flex-wrap justify-center gap-2">
                <Button v-if="active.status === 'running'" variant="outline" @click="pause">
                  <Pause class="h-4 w-4" aria-hidden="true" />
                  {{ $t('tools.focusView.pause') }}
                </Button>
                <Button v-else @click="resume">
                  <Play class="h-4 w-4" aria-hidden="true" />
                  {{ $t('tools.focusView.resume') }}
                </Button>
                <Button v-if="isBreak" variant="outline" @click="skipBreak">
                  <SkipForward class="h-4 w-4" aria-hidden="true" />
                  {{ $t('tools.focusView.skipBreak') }}
                </Button>
                <Button v-else variant="destructive" @click="cancel">
                  {{ $t('tools.focusView.cancel') }}
                </Button>
              </div>
              <p v-if="isBreak" class="mt-3 text-center text-xs text-muted-foreground">
                {{ $t('tools.focusView.breakHint', { minutes: breakMinutes }) }}
              </p>
            </div>
          </template>

          <template v-else>
            <div class="relative">
              <div>
                <h2 class="text-xl font-semibold tracking-tight text-foreground">{{ $t('tools.focusView.prepareTitle') }}</h2>
                <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.focusView.prepareDescription') }}</p>
              </div>

              <div class="mt-5">
                <p class="text-sm font-medium text-foreground">{{ $t('tools.focusView.durationLabel') }}</p>
                <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    v-for="minutes in durations"
                    :key="minutes"
                    type="button"
                    class="group flex flex-col items-start rounded-2xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                    :class="!customOpen && selectedMinutes === minutes ? 'border-primary/40 bg-primary/[0.07]' : 'border-border/60 bg-background/45 hover:bg-accent/40'"
                    :aria-pressed="!customOpen && selectedMinutes === minutes"
                    @click="chooseDuration(minutes)"
                  >
                    <span class="text-2xl font-semibold tabular-nums text-foreground">{{ minutes }}</span>
                    <span class="text-xs text-muted-foreground">{{ $t('tools.focusView.minutesUnit') }}</span>
                  </button>
                  <button
                    type="button"
                    class="flex flex-col items-start rounded-2xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                    :class="customOpen ? 'border-primary/40 bg-primary/[0.07]' : 'border-border/60 bg-background/45 hover:bg-accent/40'"
                    :aria-pressed="customOpen"
                    @click="openCustom"
                  >
                    <span class="text-sm font-medium text-foreground">{{ $t('tools.focusView.customDuration') }}</span>
                    <span class="mt-1 text-2xl font-semibold tabular-nums text-foreground">{{ customOpen ? customMinutes : '—' }}</span>
                  </button>
                </div>
                <div v-if="customOpen" class="mt-2 flex items-center gap-2">
                  <Input
                    id="focus-custom-minutes"
                    v-model.number="customMinutes"
                    type="number"
                    min="15"
                    max="240"
                    class="w-28"
                    :aria-label="$t('tools.focusView.customMinutes')"
                  />
                  <span class="text-xs text-muted-foreground">{{ $t('tools.focusView.minutesUnit') }}</span>
                </div>
              </div>

              <div class="mt-5">
                <p class="text-sm font-medium text-foreground">{{ $t('tools.focusView.taskLabel') }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ $t('tools.focusView.taskHint') }}</p>
                <DropdownMenu content-class="w-[min(90vw,30rem)]">
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

              <Button class="mt-5 w-full sm:w-auto" size="lg" :loading="starting" @click="start">
                <Play class="h-4 w-4" aria-hidden="true" />
                {{ $t('tools.focusView.start', { minutes: effectiveMinutes }) }}
              </Button>
              <p v-if="error" class="mt-3 text-sm text-destructive" role="alert">{{ error }}</p>
            </div>
          </template>
        </div>

        <aside class="flex flex-col gap-4">
          <div class="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold text-foreground">{{ $t('tools.focusView.todayTitle') }}</h2>
              <CalendarCheck class="h-4 w-4 text-primary/70" aria-hidden="true" />
            </div>
            <div class="mt-4 grid grid-cols-3 gap-2">
              <div class="rounded-xl bg-background/55 px-2.5 py-3">
                <p class="text-[11px] text-muted-foreground">{{ $t('tools.focusView.todaySessions') }}</p>
                <p class="mt-1 text-xl font-semibold tabular-nums text-foreground">{{ todaySessions }}</p>
                <p class="text-[10px] text-muted-foreground">{{ $t('tools.focusView.sessionsUnit') }}</p>
              </div>
              <div class="rounded-xl bg-background/55 px-2.5 py-3">
                <p class="text-[11px] text-muted-foreground">{{ $t('tools.focusView.todayMinutes') }}</p>
                <p class="mt-1 text-xl font-semibold tabular-nums text-foreground">{{ todayMinutes }}</p>
                <p class="text-[10px] text-muted-foreground">{{ $t('tools.focusView.minutesUnit') }}</p>
              </div>
              <div class="rounded-xl bg-background/55 px-2.5 py-3">
                <p class="text-[11px] text-muted-foreground">{{ $t('tools.focusView.todayDone') }}</p>
                <p class="mt-1 text-xl font-semibold tabular-nums text-foreground">{{ completionRate }}%</p>
                <p class="text-[10px] text-muted-foreground">{{ $t('tools.focusView.status.completed') }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
            <div class="flex items-end justify-between gap-2">
              <div>
                <h2 class="text-base font-semibold text-foreground">{{ $t('tools.focusView.weekTitle') }}</h2>
                <p class="mt-0.5 text-xs text-muted-foreground">{{ $t('tools.focusView.weekHint') }}</p>
              </div>
              <BarChart3 class="h-4 w-4 text-primary/70" aria-hidden="true" />
            </div>
            <div class="mt-4 flex h-28 items-end gap-1.5">
              <div
                v-for="day in weekDays"
                :key="day.date"
                class="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                :title="`${day.date}: ${day.minutes} ${$t('tools.focusView.minutesUnit')}`"
              >
                <div class="flex w-full max-w-6 flex-1 items-end rounded-md bg-muted/50 p-[2px]">
                  <div
                    class="w-full rounded-sm bg-primary/70"
                    :class="day.today ? 'bg-primary' : 'bg-primary/55'"
                    :style="{ height: `${day.height}%` }"
                  />
                </div>
                <span class="text-[10px]" :class="day.today ? 'font-semibold text-foreground' : 'text-muted-foreground'">{{ day.label }}</span>
              </div>
            </div>
          </div>

          <div class="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
            <div class="pointer-events-none absolute -bottom-16 -right-12 h-40 w-40 rounded-full bg-primary/[0.07] blur-3xl" />
            <div class="relative flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles class="h-4 w-4 text-primary" aria-hidden="true" />
              {{ $t('tools.focusView.tipTitle') }}
            </div>
            <p class="relative mt-3 text-sm leading-6 text-muted-foreground">{{ $t('tools.focusView.tipBody') }}</p>
            <p class="relative mt-3 text-xs leading-5 text-muted-foreground/80">{{ $t('tools.focusView.tipShortBreak') }}</p>
          </div>
        </aside>
      </section>

      <section class="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold tracking-tight text-foreground">{{ $t('tools.focusView.history') }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.focusView.historyDescription') }}</p>
          </div>
          <span class="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            {{ $t('tools.focusView.recentCount', { count: recent.length }) }}
          </span>
        </div>

        <p v-if="recent.length === 0" class="mt-6 rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {{ $t('tools.focusView.empty') }}
        </p>
        <ul v-else class="mt-4 grid gap-2 md:grid-cols-2">
          <li
            v-for="session in recent"
            :key="session.id"
            class="flex items-start gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
          >
            <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" :class="sessionTone(session.status).soft">
              <component :is="sessionTone(session.status).icon" class="h-4 w-4" aria-hidden="true" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <p class="truncate text-sm font-medium text-foreground">{{ sessionTask(session) }}</p>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px]" :class="sessionTone(session.status).badge">
                  {{ sessionStatusLabel(session.status) }}
                </span>
              </div>
              <p class="mt-0.5 text-[11px] text-muted-foreground">
                {{ formatSessionTime(session) }} · {{ $t('tools.focusView.planned', { minutes: Math.round(session.plannedSeconds / 60) }) }}
              </p>
              <div class="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-primary/70" :style="{ width: `${sessionProgress(session)}%` }" />
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
  Pause,
  Play,
  SkipForward,
  Sparkles,
  Timer
} from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import { useTaskStore } from '@/store/taskStore'
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
let timer = null

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
const circumference = 2 * Math.PI * 92
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
      .reduce((total, session) => total + Math.round((session.elapsedSeconds || session.plannedSeconds || 0) / 60), 0)
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
    height: day.minutes > 0 ? Math.max(8, Math.round((day.minutes / max) * 100)) : 0
  }))
})

watch(active, (session) => {
  remaining.value = session ? session.remainingSeconds : 0
}, { immediate: true })

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

function handleToolsUpdated() {
  toolsStore.loadFocusState()
  toolsStore.loadShellSnapshot()
}

onMounted(async () => {
  await Promise.all([toolsStore.loadFocusState(), toolsStore.loadShellSnapshot()])
  timer = setInterval(tickDown, 1000)
  window.electronAPI?.events?.on('tools-updated', handleToolsUpdated)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.electronAPI?.events?.off('tools-updated', handleToolsUpdated)
})
</script>
