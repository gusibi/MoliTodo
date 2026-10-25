<template>
  <div class="reminder-popup-shell">
    <div class="reminder-popup-card">
      <div class="reminder-popup-glow reminder-popup-glow--primary" />
      <div class="reminder-popup-glow reminder-popup-glow--warm" />

      <header class="relative z-10 flex shrink-0 items-center gap-1.5" style="-webkit-app-region: drag">
        <span class="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
          <Bell class="h-3 w-3" aria-hidden="true" />
        </span>
        <span class="text-[10px] font-semibold tracking-[0.14em] text-foreground/80">MOLI</span>
        <span class="text-[9px] tracking-[0.08em] text-muted-foreground/70">{{ $t('reminderPopup.title') }}</span>
        <span
          v-if="intents.length > 0"
          class="ml-auto rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground"
        >
          {{ intents.length }}
        </span>
      </header>

      <div v-if="intents.length === 0" class="relative z-10 flex flex-1 flex-col items-center justify-center pb-1 text-center">
        <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
          <Bell class="h-5 w-5" aria-hidden="true" />
        </span>
        <p class="mt-2 text-sm font-medium text-foreground">{{ $t('reminderPopup.empty') }}</p>
        <p class="mt-0.5 text-[11px] text-muted-foreground">{{ $t('reminderPopup.emptyHint') }}</p>
      </div>

      <ul v-else class="reminder-popup-list" style="-webkit-app-region: no-drag">
        <li v-for="intent in intents" :key="intent.occurrenceId" class="reminder-popup-item">
          <div class="reminder-popup-item-main">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-current/10"
              :class="tone(intent.ruleType).soft"
            >
              <component :is="tone(intent.ruleType).icon" class="h-4 w-4" aria-hidden="true" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <p class="truncate text-[15px] font-semibold leading-5 text-foreground">
                  {{ leadLabel(intent.ruleType) }}
                </p>
                <span class="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {{ formatScheduled(intent.scheduledAt) }}
                </span>
              </div>
              <p class="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {{ bodyLabel(intent.ruleType) }}
              </p>
              <p v-if="intent.snoozeCount > 0" class="mt-1 text-[10px] text-muted-foreground/80">
                {{ $t('reminderPopup.snoozedCount', { count: intent.snoozeCount }) }}
              </p>
            </div>
          </div>

          <div class="reminder-popup-actions">
            <Button
              size="sm"
              class="h-7 rounded-full px-2.5 text-[11px]"
              :disabled="busyId === intent.occurrenceId"
              @click="respond(intent, 'confirm')"
            >
              <Check class="h-3 w-3" aria-hidden="true" />
              {{ confirmLabel(intent.ruleType) }}
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="h-7 rounded-full px-2.5 text-[11px]"
              :disabled="busyId === intent.occurrenceId || intent.snoozeCount >= 2"
              @click="respond(intent, 'snooze')"
            >
              <AlarmClock class="h-3 w-3" aria-hidden="true" />
              {{ $t('reminderPopup.snooze') }}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              class="h-7 rounded-full px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
              :disabled="busyId === intent.occurrenceId"
              @click="respond(intent, 'skip')"
            >
              {{ $t('reminderPopup.skip') }}
            </Button>
          </div>
        </li>
      </ul>

      <p v-if="error" class="relative z-10 shrink-0 text-[11px] text-destructive" role="alert">{{ error }}</p>
    </div>
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
.reminder-popup-shell {
  @apply h-screen w-screen p-1.5;
  box-sizing: border-box;
}

.reminder-popup-card {
  @apply relative flex h-full w-full flex-col gap-2 overflow-hidden rounded-[26px] border border-foreground/[0.07] p-3.5 text-foreground;
  background:
    linear-gradient(145deg, hsl(var(--card) / 0.96), hsl(var(--card) / 0.88)),
    radial-gradient(120% 100% at 15% 0%, hsl(var(--primary) / 0.10), transparent 52%);
  box-shadow:
    0 18px 40px -24px rgba(0, 0, 0, 0.55),
    0 2px 10px -2px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 hsl(var(--card) / 0.7);
  animation: reminder-popup-in 180ms ease-out;
}

@keyframes reminder-popup-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.reminder-popup-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.035;
  mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E");
}

.reminder-popup-glow {
  @apply pointer-events-none absolute rounded-full blur-2xl;
}

.reminder-popup-glow--primary {
  @apply -right-10 -top-14 h-36 w-36 bg-primary/[0.10];
}

.reminder-popup-glow--warm {
  @apply -bottom-16 left-6 h-32 w-32 bg-warning/[0.06];
}

.reminder-popup-list {
  @apply relative z-10 flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pr-0.5;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.2) transparent;
}

.reminder-popup-list::-webkit-scrollbar {
  width: 4px;
}

.reminder-popup-list::-webkit-scrollbar-track {
  background: transparent;
}

.reminder-popup-list::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 2px;
}

.reminder-popup-item {
  @apply rounded-2xl border border-foreground/[0.06] bg-foreground/[0.035] p-2.5;
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
}

.reminder-popup-item-main {
  @apply flex flex-1 items-center gap-2.5;
}

.reminder-popup-actions {
  @apply flex shrink-0 items-center justify-end gap-1 pt-2;
}

@media (prefers-reduced-motion: reduce) {
  .reminder-popup-card {
    animation: none;
  }
}
</style>
