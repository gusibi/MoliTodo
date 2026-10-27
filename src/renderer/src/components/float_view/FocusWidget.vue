<template>
  <div class="focus-widget-shell">
    <div
      class="focus-widget-card group"
      :class="{ 'focus-widget-card--shake': isShaking, 'focus-widget-card--notify': Boolean(notice) }"
      style="-webkit-app-region: drag"
    >
      <div v-if="notice" class="moli-alert-ring" aria-hidden="true" />
      <div class="focus-widget-glow focus-widget-glow--primary" />
      <div class="focus-widget-glow focus-widget-glow--warm" />

      <header class="relative z-10 flex shrink-0 items-center justify-between">
        <div class="flex min-w-0 items-center gap-1.5">
          <span class="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
            <Timer class="h-3 w-3" aria-hidden="true" />
          </span>
          <span class="text-[10px] font-semibold tracking-[0.14em] text-foreground/80">
            MOLI
          </span>
          <span class="text-[9px] tracking-[0.08em] text-muted-foreground/70">{{ $t('focusWidget.label') }}</span>
        </div>
        <div class="no-drag flex items-center gap-0.5 opacity-45 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <IconButton size="icon-sm" :label="$t('focusWidget.openFocus')" @click="openFocus">
            <ArrowUpRight class="h-3.5 w-3.5" />
          </IconButton>
          <IconButton size="icon-sm" :label="$t('focusWidget.hide')" @click="hideWidget">
            <X class="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </header>

      <Transition name="widget-swap" mode="out-in">
        <div v-if="notice" key="notice" class="relative z-10 mt-1 flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-inset ring-success/20">
            <Check class="h-4 w-4" :stroke-width="2.5" aria-hidden="true" />
          </span>
          <p class="mt-1.5 text-sm font-semibold text-foreground">{{ $t('focusWidget.noticeTitle') }}</p>
          <p class="mt-0.5 text-[10px] text-muted-foreground">
            {{ $t('focusWidget.noticeHint', { minutes: notice.minutes }) }}
          </p>
          <div class="no-drag mt-2 flex items-center justify-center gap-1.5">
            <Button
              size="sm"
              class="h-7 rounded-full px-2.5 text-[10px]"
              :disabled="starting"
              @click="nextRound"
            >
              <RotateCw class="h-3 w-3" aria-hidden="true" />
              {{ $t('focusWidget.noticeNext') }}
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="h-7 rounded-full px-2.5 text-[10px]"
              :disabled="starting"
              @click="dismissNotice"
            >
              {{ $t('focusWidget.noticeDismiss') }}
            </Button>
          </div>
        </div>

        <div v-else-if="active" key="active" class="relative z-10 mt-1.5 flex min-h-0 flex-1 flex-col">
          <div class="flex flex-1 items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {{ isBreak ? $t('focusWidget.breakRemaining') : $t('focusWidget.remaining') }}
              </p>
              <p class="mt-0.5 text-[42px] font-semibold leading-none tracking-[-0.055em] tabular-nums text-foreground" aria-live="polite">
                {{ displayTime }}
              </p>
              <p class="mt-1.5 truncate text-[10px] text-muted-foreground/85">
                {{ activeTask?.content || $t('tools.focusView.freeFocus') }}
              </p>
            </div>

            <div class="no-drag relative flex h-[74px] w-[74px] shrink-0 items-center justify-center">
              <svg viewBox="0 0 76 76" class="pointer-events-none absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="38" cy="38" r="34" fill="none" stroke="currentColor" class="text-foreground/[0.08]" stroke-width="2.5" />
                <circle
                  cx="38"
                  cy="38"
                  r="34"
                  fill="none"
                  stroke="currentColor"
                  :class="isBreak ? 'text-success' : 'text-primary'"
                  stroke-width="3"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="dashOffset"
                  class="transition-[stroke-dashoffset] duration-700 ease-linear"
                />
              </svg>
              <IconButton
                v-if="active.status === 'running'"
                size="icon"
                :label="$t('tools.focusView.pause')"
                class="h-[50px] w-[50px] rounded-full border border-foreground/10 bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
                @click="pause"
              >
                <Pause class="h-4 w-4" />
              </IconButton>
              <IconButton
                v-else
                size="icon"
                :label="$t('tools.focusView.resume')"
                class="h-[50px] w-[50px] rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
                @click="resume"
              >
                <Play class="ml-0.5 h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1">
            <div class="flex min-w-0 items-center gap-1.5 text-[9px] text-muted-foreground">
              <span class="h-1.5 w-1.5 rounded-full" :class="isBreak ? 'bg-success' : 'bg-primary'" />
              <span class="truncate">{{ statusLabel }}</span>
              <span class="text-muted-foreground/40">·</span>
              <span class="shrink-0">{{ Math.round(active.plannedSeconds / 60) }} {{ $t('focusWidget.minutesUnit') }}</span>
            </div>
            <div class="no-drag flex shrink-0 items-center gap-1">
              <Button
                v-if="isBreak"
                size="sm"
                variant="ghost"
                class="h-6 rounded-full px-2 text-[10px] text-muted-foreground hover:text-foreground"
                @click="skipBreak"
              >
                {{ $t('tools.focusView.skipBreak') }}
              </Button>
              <Button
                v-else
                size="sm"
                variant="ghost"
                class="h-6 rounded-full px-2 text-[10px] text-muted-foreground hover:text-destructive"
                @click="cancel"
              >
                {{ $t('tools.focusView.cancel') }}
              </Button>
            </div>
          </div>
        </div>

        <div v-else key="idle" class="relative z-10 mt-1.5 flex min-h-0 flex-1 flex-col">
          <div class="flex flex-1 items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {{ $t('focusWidget.ready') }}
              </p>
              <div class="mt-0.5 flex items-baseline gap-1">
                <span class="text-[54px] font-semibold leading-none tracking-[-0.065em] tabular-nums text-foreground">
                  {{ selectedMinutes }}
                </span>
                <span class="text-[10px] font-medium text-muted-foreground">{{ $t('focusWidget.minutesUnit') }}</span>
              </div>
              <p class="mt-1.5 text-[10px] text-muted-foreground/85">{{ $t('focusWidget.freeFocus') }}</p>
            </div>

            <div class="no-drag relative flex h-[74px] w-[74px] shrink-0 items-center justify-center">
              <div class="pointer-events-none absolute inset-0 rounded-full border border-primary/15" />
              <div class="pointer-events-none absolute inset-[7px] rounded-full border border-primary/[0.07]" />
              <IconButton
                size="icon"
                :label="$t('focusWidget.start', { minutes: selectedMinutes })"
                :loading="starting"
                class="h-[50px] w-[50px] rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:scale-[1.03] hover:bg-primary/90 active:scale-95"
                @click="start"
              >
                <Play class="ml-0.5 h-[18px] w-[18px]" />
              </IconButton>
            </div>
          </div>

          <div class="no-drag flex items-center justify-start gap-1 pt-1">
            <div class="flex items-center gap-0.5 rounded-full border border-foreground/[0.07] bg-foreground/[0.035] p-0.5">
              <Button
                v-for="minutes in durations"
                :key="minutes"
                size="sm"
                variant="ghost"
                class="h-6 min-w-9 rounded-full px-2 text-[10px] tabular-nums"
                :class="selectedMinutes === minutes ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                :aria-pressed="selectedMinutes === minutes"
                :aria-label="$t('focusWidget.durationLabel', { minutes })"
                @click="selectedMinutes = minutes"
              >
                {{ minutes }}
              </Button>
            </div>
          </div>
        </div>
      </Transition>

      <p v-if="error" class="relative z-10 mt-1 line-clamp-1 text-[9px] text-destructive" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUpRight, Check, Pause, Play, RotateCw, Timer, X } from '@lucide/vue'
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
const isShaking = ref(false)
let timer = null
let shakeTimer = null

const active = computed(() => toolsStore.focusState?.active || null)
const notice = computed(() => toolsStore.focusState?.notice || null)
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
const circumference = 2 * Math.PI * 34
const dashOffset = computed(() => {
  if (!active.value) return circumference
  const planned = Math.max(1, active.value.plannedSeconds || 1)
  const elapsed = Math.min(planned, Math.max(0, planned - remaining.value))
  return circumference * (1 - elapsed / planned)
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

async function dismissNotice() {
  error.value = ''
  try {
    await toolsStore.dismissFocusNotice()
  } catch (err) {
    error.value = err.message
  }
}

async function nextRound() {
  error.value = ''
  const minutes = notice.value?.minutes || selectedMinutes.value
  starting.value = true
  try {
    await toolsStore.dismissFocusNotice()
    await toolsStore.startFocus({ plannedMinutes: minutes, linkedTaskId: null })
  } catch (err) {
    error.value = err.message
  } finally {
    starting.value = false
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

// 专注结束：主进程发送事件后抖动小组件，并进入持续通知模式。
// 通知由主进程 focusState.notice 持有，用户点「进入休息」或「下一轮」后才消失。
function handleFocusCompleted() {
  if (shakeTimer) clearTimeout(shakeTimer)
  isShaking.value = false
  nextTick(() => {
    isShaking.value = true
    shakeTimer = setTimeout(() => {
      isShaking.value = false
      shakeTimer = null
    }, 1400)
  })

  toolsStore.loadFocusState()
}

onMounted(async () => {
  await Promise.all([toolsStore.loadFocusState(), loadTasks()])
  timer = setInterval(tickDown, 1000)
  window.electronAPI?.events?.on('tools-updated', handleToolsUpdated)
  window.electronAPI?.events?.on('focus-completed', handleFocusCompleted)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (shakeTimer) clearTimeout(shakeTimer)
  window.electronAPI?.events?.off('tools-updated', handleToolsUpdated)
  window.electronAPI?.events?.off('focus-completed', handleFocusCompleted)
})
</script>

<style scoped>
.focus-widget-shell {
  @apply h-screen w-screen p-1.5;
}

.focus-widget-card {
  @apply relative flex h-full w-full flex-col overflow-hidden rounded-[26px] border border-foreground/[0.07] p-3.5 text-foreground;
  background:
    linear-gradient(145deg, hsl(var(--card) / 0.96), hsl(var(--card) / 0.88)),
    radial-gradient(120% 100% at 15% 0%, hsl(var(--primary) / 0.10), transparent 52%);
  box-shadow:
    0 18px 40px -24px rgba(0, 0, 0, 0.55),
    0 2px 10px -2px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 hsl(var(--card) / 0.7);
}

.focus-widget-card--notify {
  border-color: hsl(var(--primary) / 0.3);
}

.focus-widget-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.035;
  mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E");
}

.focus-widget-glow {
  @apply pointer-events-none absolute rounded-full blur-2xl;
}

.focus-widget-glow--primary {
  @apply -right-10 -top-14 h-36 w-36 bg-primary/[0.10];
}

.focus-widget-glow--warm {
  @apply -bottom-16 left-6 h-32 w-32 bg-warning/[0.06];
}

.no-drag {
  -webkit-app-region: no-drag;
}

.widget-swap-enter-active,
.widget-swap-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

@keyframes focus-widget-shake {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  12% { transform: translate3d(-4px, 0, 0) rotate(-0.6deg); }
  24% { transform: translate3d(4px, 0, 0) rotate(0.6deg); }
  36% { transform: translate3d(-3px, 0, 0) rotate(-0.45deg); }
  48% { transform: translate3d(3px, 0, 0) rotate(0.45deg); }
  60% { transform: translate3d(-2px, 0, 0) rotate(-0.3deg); }
  72% { transform: translate3d(2px, 0, 0) rotate(0.3deg); }
  84% { transform: translate3d(-1px, 0, 0) rotate(-0.15deg); }
}

.focus-widget-card--shake {
  animation: focus-widget-shake 700ms ease-in-out 2;
}

.widget-swap-enter-from {
  opacity: 0;
  transform: translateY(4px) scale(0.985);
}

.widget-swap-leave-to {
  opacity: 0;
  transform: translateY(-3px) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .widget-swap-enter-active,
  .widget-swap-leave-active {
    transition: none;
  }

  .focus-widget-card--shake {
    animation: none;
  }
}
</style>
