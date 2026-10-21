<template>
  <div class="reminder-popup" style="-webkit-app-region: drag">
    <div class="reminder-popup-header">
      <Bell class="h-4 w-4 text-primary" aria-hidden="true" />
      <span>{{ $t('reminderPopup.title') }}</span>
    </div>

    <div v-if="intents.length === 0" class="reminder-popup-empty">
      {{ $t('reminderPopup.empty') }}
    </div>

    <ul v-else class="reminder-popup-list" style="-webkit-app-region: no-drag">
      <li v-for="intent in intents" :key="intent.occurrenceId" class="reminder-popup-row">
        <span class="reminder-popup-label">{{ actionLabel(intent.ruleType) }}</span>
        <div class="reminder-popup-actions">
          <Button size="sm" :disabled="busyId === intent.occurrenceId" @click="respond(intent, 'confirm')">
            {{ confirmLabel(intent.ruleType) }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="busyId === intent.occurrenceId || intent.snoozeCount >= 2"
            @click="respond(intent, 'snooze')"
          >
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
import { Bell } from '@lucide/vue'
import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()
const intents = ref([])
const busyId = ref(null)
const error = ref('')

function actionLabel(type) {
  return t(`tools.reminder.${type || 'water'}`)
}

function confirmLabel(type) {
  if (type === 'stand') return t('reminderPopup.confirmStand')
  if (type === 'eyes') return t('reminderPopup.confirmEyes')
  return t('reminderPopup.confirmWater')
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
  @apply flex h-screen w-screen flex-col gap-2 rounded-xl border border-border/60 bg-background px-4 py-3 shadow-2xl;
  box-sizing: border-box;
  overflow: hidden;
}

.reminder-popup-header {
  @apply flex items-center gap-2 text-sm font-semibold text-foreground;
}

.reminder-popup-empty {
  @apply text-sm text-muted-foreground;
}

.reminder-popup-list {
  @apply flex flex-col gap-2 overflow-auto;
}

.reminder-popup-row {
  @apply flex items-center justify-between gap-2;
}

.reminder-popup-label {
  @apply min-w-0 flex-1 truncate text-sm text-foreground;
}

.reminder-popup-actions {
  @apply flex shrink-0 items-center gap-1;
}

.reminder-popup-error {
  @apply text-xs text-destructive;
}
</style>
