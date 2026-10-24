<template>
  <div class="focus-widget-shell">
    <div class="focus-widget-card" :class="isBreak ? 'focus-widget-card--break' : ''">
      <div class="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary/[0.08] blur-3xl" />

      <header class="focus-widget-header" style="-webkit-app-region: drag">
        <div class="flex min-w-0 items-center gap-2">
          <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Timer class="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span class="truncate text-xs font-semibold tracking-tight text-foreground">
            {{ $t('focusWidget.brand') }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-0.5" style="-webkit-app-region: no-drag">
          <IconButton size="icon-sm" :label="$t('focusWidget.openFocus')" @click="openFocus">
            <Maximize2 class="h-icon-sm w-icon-sm" />
          </IconButton>
          <IconButton size="icon-sm" :label="$t('focusWidget.hide')" @click="hideWidget">
            <X class="h-icon-sm w-icon-sm" />
          </IconButton>
        </div>
      </header>

      <div v-if="active" class="focus-widget-active">
        <div class="flex items-center justify-between gap-2">
          <span
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            :class="isBreak ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'"
          >
            <component :is="isBreak ? Coffee : Timer" class="h-2.5 w-2.5" aria-hidden="true" />
            {{ isBreak ? $t('tools.focusView.breakBadge') : $t('tools.focusView.focusBadge') }}
          </span>
          <span class="text-[10px] text-muted-foreground">{{ statusLabel }}</span>
        </div>

        <div class="mt-2 flex items-end justify-between gap-3">
          <p class="text-4xl font-semibold tabular-nums leading-none tracking-tight text-foreground" aria-live="polite">
            {{ displayTime }}
          </p>
          <span class="mb-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {{ Math.round(active.plannedSeconds / 60) }} {{ $t('focusWidget.minutesUnit') }}
          </span>
        </div>

        <p class="mt-2 truncate text-[11px] text-muted-foreground">
          {{ activeTask?.content || $t('tools.focusView.freeFocus') }}
        </p>

        <div class="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full transition-[width] duration-500 ease-linear"
            :class="isBreak ? 'bg-success' : 'bg-primary'"
            :style="{ width: `${progress}%` }"
          />
        </div>

        <div class="mt-2 flex items-center gap-1.5">
          <Button v-if="active.status === 'running'" size="sm" variant="outline" class="flex-1" @click="pause">
            <Pause class="h-3.5 w-3.5" aria-hidden="true" />
            {{ $t('tools.focusView.pause') }}
          </Button>
          <Button v-else size="sm" class="flex-1" @click="resume">
            <Play class="h-3.5 w-3.5" aria-hidden="true" />
            {{ $t('tools.focusView.resume') }}
          </Button>
          <Button v-if="isBreak" size="sm" variant="outline" class="flex-1" @click="skipBreak">
            <SkipForward class="h-3.5 w-3.5" aria-hidden="true" />
            {{ $t('tools.focusView.skipBreak') }}
          </Button>
          <Button v-else size="sm" variant="destructive" class="flex-1" @click="cancel">
            {{ $t('tools.focusView.cancel') }}
          </Button>
        </div>
      </div>

      <div v-else class="focus-widget-idle">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-medium text-foreground">{{ $t('focusWidget.quickStart') }}</p>
          <span class="text-[10px] text-muted-foreground">{{ $t('focusWidget.freeFocus') }}</span>
        </div>

        <div class="mt-1.5 grid grid-cols-3 gap-1.5">
          <button
            v-for="minutes in durations"
            :key="minutes"
            type="button"
            class="flex items-baseline justify-center gap-0.5 rounded-lg border py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            :class="selectedMinutes === minutes ? 'border-primary/40 bg-primary/[0.08] text-primary' : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-accent/40'"
            :aria-pressed="selectedMinutes === minutes"
            @click="selectedMinutes = minutes"
          >
            <span class="text-lg font-semibold tabular-nums">{{ minutes }}</span>
            <span class="text-[9px]">{{ $t('focusWidget.minutesUnit') }}</span>
          </button>
        </div>

        <Button class="mt-2 w-full" size="sm" :loading="starting" @click="start">
          <Play class="h-3.5 w-3.5" aria-hidden="true" />
          {{ $t('focusWidget.start', { minutes: selectedMinutes }) }}
        </Button>

        <p class="mt-1.5 text-center text-[10px] leading-4 text-muted-foreground">{{ $t('focusWidget.hint') }}</p>
      </div>

      <p v-if="error" class="mt-1 line-clamp-2 text-[10px] text-destructive" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Coffee, Maximize2, Pause, Play, SkipForward, Timer, X } from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

const { t } = useI18n()
const toolsStore = useToolsStore()
const durations = [15, 25, 45]
const selectedMinutes = ref(25)
const starting = ref(false)
const error = ref('')
const remaining = ref(0)
const tasks = ref([])
let timer = null

const active = computed(() => toolsStore.focusState?.active || null)
const isBreak = computed(() => active.value?.phase === 'break')
const activeTask = computed(() => {
  if (!active.value?.linkedTaskId) return null
  return tasks.value.find((task) => String(task.id) === String(active.value.linkedTaskId)) || null
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
const progress = computed(() => {
  if (!active.value) return 0
  const planned = Math.max(1, active.value.plannedSeconds || 1)
  const elapsed = Math.min(planned, Math.max(0, planned - remaining.value))
  return Math.round((elapsed / planned) * 100)
})

watch(active, (session) => {
  remaining.value = session ? session.remainingSeconds : 0
}, { immediate: true })

function tickDown() {
  if (!active.value || active.value.status !== 'running') return
  if (remaining.value > 0) remaining.value -= 1
  if (remaining.value === 0) toolsStore.loadFocusState()
}

async function loadTasks() {
  try {
    tasks.value = await window.electronAPI.tasks.getAll()
  } catch (err) {
    console.warn('读取专注关联任务失败:', err)
  }
}

async function start() {
  error.value = ''
  starting.value = true
  try {
    await toolsStore.startFocus({ plannedMinutes: selectedMinutes.value, linkedTaskId: null })
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

async function openFocus() {
  try {
    await window.electronAPI.tools.openFocus()
  } catch (err) {
    error.value = err.message
  }
}

async function hideWidget() {
  try {
    await window.electronAPI.config.set('focusWidget.visible', false)
  } catch (err) {
    error.value = err.message
  }
}

function handleToolsUpdated() {
  toolsStore.loadFocusState()
  loadTasks()
}

onMounted(async () => {
  await Promise.all([toolsStore.loadFocusState(), loadTasks()])
  timer = setInterval(tickDown, 1000)
  window.electronAPI?.events?.on('tools-updated', handleToolsUpdated)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.electronAPI?.events?.off('tools-updated', handleToolsUpdated)
})
</script>

<style scoped>
.focus-widget-shell {
  @apply h-screen w-screen p-1.5;
}

.focus-widget-card {
  @apply relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 p-3 text-foreground shadow-lg backdrop-blur;
}

.focus-widget-card--break {
  @apply border-success/20;
}

.focus-widget-header {
  @apply flex shrink-0 items-center justify-between gap-2;
}

.focus-widget-active {
  @apply mt-2 flex min-h-0 flex-1 flex-col;
}

.focus-widget-idle {
  @apply mt-2 flex min-h-0 flex-1 flex-col;
}
</style>
