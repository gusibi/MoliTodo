<template>
  <div class="h-full overflow-auto px-7 py-6">
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.focusView.title') }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.focusView.description') }}</p>
          </div>
          <span class="text-sm text-muted-foreground">{{ $t('tools.focusView.minimum') }}</span>
        </div>

        <div v-if="active" class="mt-6 flex flex-col items-center gap-4">
          <p class="text-5xl font-semibold tabular-nums text-foreground">{{ displayTime }}</p>
          <p class="text-sm text-muted-foreground">
            {{ active.status === 'paused' ? $t('tools.focusView.paused') : $t('tools.focusView.running') }}
          </p>
          <div class="flex flex-wrap justify-center gap-2">
            <Button v-if="active.status === 'running'" variant="outline" @click="pause">
              {{ $t('tools.focusView.pause') }}
            </Button>
            <Button v-else @click="resume">
              {{ $t('tools.focusView.resume') }}
            </Button>
            <Button variant="destructive" @click="cancel">
              {{ $t('tools.focusView.cancel') }}
            </Button>
          </div>
        </div>

        <div v-else class="mt-6 flex flex-wrap gap-2">
          <Button
            v-for="minutes in durations"
            :key="minutes"
            :loading="starting === minutes"
            @click="start(minutes)"
          >
            {{ $t('tools.focusView.start', { minutes }) }}
          </Button>
        </div>

        <p v-if="error" class="mt-3 text-sm text-destructive" role="alert">{{ error }}</p>
      </section>

      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.focusView.history') }}</h2>
        <p v-if="recent.length === 0" class="mt-4 text-sm text-muted-foreground">
          {{ $t('tools.focusView.empty') }}
        </p>
        <ul v-else class="mt-4 flex flex-col gap-2">
          <li
            v-for="session in recent"
            :key="session.id"
            class="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm"
          >
            <span class="text-foreground">
              {{ Math.round(session.plannedSeconds / 60) }} {{ $t('tools.focusView.minutesUnit') }}
            </span>
            <span class="text-muted-foreground">{{ $t(`tools.focusView.status.${session.status}`) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useToolsStore } from '@/store/toolsStore'
import Button from '@/components/ui/button/Button.vue'

const toolsStore = useToolsStore()
const durations = [15, 25, 45]
const starting = ref(null)
const error = ref('')
const remaining = ref(0)
let timer = null

const active = computed(() => toolsStore.focusState?.active || null)
const recent = computed(() => toolsStore.focusState?.recent || [])
const displayTime = computed(() => {
  const seconds = Math.max(0, remaining.value)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
})

function tickDown() {
  if (!active.value || active.value.status !== 'running') return
  if (remaining.value > 0) {
    remaining.value -= 1
  }
  if (remaining.value === 0) {
    toolsStore.loadFocusState()
  }
}

watch(active, (session) => {
  remaining.value = session ? session.remainingSeconds : 0
}, { immediate: true })

async function start(minutes) {
  error.value = ''
  starting.value = minutes
  try {
    await toolsStore.startFocus({ plannedMinutes: minutes })
  } catch (err) {
    error.value = err.message
  } finally {
    starting.value = null
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

function handleToolsUpdated() {
  toolsStore.loadFocusState()
}

onMounted(async () => {
  await toolsStore.loadFocusState()
  timer = setInterval(tickDown, 1000)
  window.electronAPI?.events?.on('tools-updated', handleToolsUpdated)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.electronAPI?.events?.off('tools-updated', handleToolsUpdated)
})
</script>
