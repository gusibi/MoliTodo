<template>
  <div class="reminder-popup">
    <div class="reminder-popup-header" style="-webkit-app-region: drag">
      <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bell class="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-semibold text-foreground">{{ $t('reminderPopup.title') }}</span>
        <span class="block text-[11px] text-muted-foreground">{{ $t('reminderPopup.todayHint') }}</span>
      </span>
      <span v-if="intents.length > 0" class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        {{ intents.length }}
      </span>
    </div>

    <div v-if="intents.length === 0" class="reminder-popup-empty">
      <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Bell class="h-5 w-5" aria-hidden="true" />
      </span>
      <p class="mt-3 text-sm font-medium text-foreground">{{ $t('reminderPopup.empty') }}</p>
      <p class="mt-1 text-xs text-muted-foreground">{{ $t('reminderPopup.emptyHint') }}</p>
    </div>

    <ul v-else class="reminder-popup-list" style="-webkit-app-region: no-drag">
      <li v-for="intent in intents" :key="intent.occurrenceId" class="reminder-popup-card">
        <div class="flex items-start gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="tone(intent.ruleType).soft">
            <component :is="tone(intent.ruleType).icon" class="h-5 w-5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-foreground">{{ leadLabel(intent.ruleType) }}</p>
            <p class="mt-0.5 text-xs leading-5 text-muted-foreground">{{ bodyLabel(intent.ruleType) }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground/80">
              {{ $t('reminderPopup.scheduledAt', { time: formatScheduled(intent.scheduledAt) }) }}
              <template v-if="intent.snoozeCount > 0">
                · {{ $t('reminderPopup.snoozedCount', { count: intent.snoozeCount }) }}
              </template>
            </p>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center justify-end gap-1.5">
          <Button size="sm" :disabled="busyId === intent.occurrenceId" @click="respond(intent, 'confirm')">
            <Check class="h-3.5 w-3.5" aria-hidden="true" />
            {{ confirmLabel(intent.ruleType) }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="busyId === intent.occurrenceId || intent.snoozeCount >= 2"
            @click="respond(intent, 'snooze')"
          >
            <AlarmClock class="h-3.5 w-3.5" aria-hidden="true" />
            {{ $t('reminderPopup.snooze') }}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            :disabled="busyId === intent.occurrenceId"
            @click="respond(intent, 'skip')"
          >
            {{ $t('reminderPopup.skip') }}
          </Button>
        </div>
      </li>
    </ul>

    <p v-if="error" class="reminder-popup-error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlarmClock, Bell, Check, Droplets, Eye, PersonStanding } from '@lucide/vue'
import Button from '@/components/ui/button/Button.vue'

const { t, locale } = useI18n()
const intents = ref([])
const busyId = ref(null)
const error = ref('')

function tone(type) {
  if (type === 'stand') {
    return { icon: PersonStanding, soft: 'bg-warning/10 text-warning' }
  }
  if (type === 'eyes') {
    return { icon: Eye, soft: 'bg-success/10 text-success' }
  }
  return { icon: Droplets, soft: 'bg-info/10 text-info' }
}

function leadLabel(type) {
  if (type === 'stand') return t('reminderPopup.leadStand')
  if (type === 'eyes') return t('reminderPopup.leadEyes')
  return t('reminderPopup.leadWater')
}

function bodyLabel(type) {
  if (type === 'stand') return t('reminderPopup.bodyStand')
  if (type === 'eyes') return t('reminderPopup.bodyEyes')
  return t('reminderPopup.bodyWater')
}

function confirmLabel(type) {
  if (type === 'stand') return t('reminderPopup.confirmStand')
  if (type === 'eyes') return t('reminderPopup.confirmEyes')
  return t('reminderPopup.confirmWater')
}

function formatScheduled(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handleIntents(nextIntents) {
  intents.value = Array.isArray(nextIntents) ? nextIntents : []
  error.value = ''
}

function handleIntentsEvent(event, nextIntents) {
  handleIntents(nextIntents)
}

async function respond(intent, action) {
  busyId.value = intent.occurrenceId
  error.value = ''
  try {
    await window.electronAPI.tools.respondReminder(intent.occurrenceId, action)
    intents.value = intents.value.filter((entry) => entry.occurrenceId !== intent.occurrenceId)
  } catch (err) {
    error.value = err.message
  } finally {
    busyId.value = null
  }
}

onMounted(async () => {
  window.electronAPI.events.on('reminder-popup-intents', handleIntentsEvent)
  try {
    const initial = await window.electronAPI.tools.getPopupIntents()
    handleIntents(initial)
  } catch (err) {
    error.value = err.message
  }
})

onUnmounted(() => {
  window.electronAPI.events.off('reminder-popup-intents', handleIntentsEvent)
})
</script>

<style scoped>
.reminder-popup {
  @apply flex h-screen w-screen flex-col gap-2.5 rounded-xl border border-border/60 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur;
  box-sizing: border-box;
  overflow: hidden;
}

.reminder-popup-header {
  @apply flex shrink-0 items-center gap-2.5;
}

.reminder-popup-empty {
  @apply flex flex-1 flex-col items-center justify-center pb-2 text-center;
}

.reminder-popup-list {
  @apply flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-0.5;
}

.reminder-popup-card {
  @apply rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm;
}

.reminder-popup-error {
  @apply shrink-0 text-xs text-destructive;
}
</style>
