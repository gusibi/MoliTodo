<template>
  <div class="h-full overflow-auto px-6 py-6">
    <div class="mx-auto flex max-w-5xl flex-col gap-5">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
            {{ $t('tools.reminder.eyebrow') }}
          </p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {{ $t('tools.reminder.heroTitle') }}
          </h1>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {{ $t('tools.reminder.heroDescription') }}
          </p>
        </div>
        <Button @click="openCreate">
          <Plus class="h-icon-sm w-icon-sm" aria-hidden="true" />
          {{ $t('tools.reminder.newRule') }}
        </Button>
      </header>

      <section class="grid items-start gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div class="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <div class="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/[0.07] blur-3xl" />
          <div class="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-info/[0.06] blur-3xl" />
          <div class="relative flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {{ $t('tools.reminder.todayTitle') }}
              </p>
              <p class="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {{ $t('tools.reminder.todayCare', { count: careCount }) }}
              </p>
              <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.reminder.todayHint') }}</p>
            </div>
            <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <HeartPulse class="h-7 w-7" aria-hidden="true" />
            </div>
          </div>

          <div class="relative mt-5 grid grid-cols-3 gap-2">
            <div
              v-for="item in todayStats"
              :key="item.key"
              class="rounded-xl border border-border/50 bg-background/55 px-3 py-3"
            >
              <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <component :is="item.icon" class="h-3.5 w-3.5" :class="item.iconClass" aria-hidden="true" />
                <span>{{ item.label }}</span>
              </div>
              <p class="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{{ item.value }}</p>
              <p class="text-[11px] text-muted-foreground">{{ item.unit }}</p>
            </div>
          </div>

          <div class="relative mt-5">
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-foreground">{{ $t('tools.reminder.weekTitle') }}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">{{ $t('tools.reminder.weekHint') }}</p>
              </div>
              <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-full bg-info" />{{ $t('tools.reminder.water') }}</span>
                <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-full bg-warning" />{{ $t('tools.reminder.stand') }}</span>
                <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-full bg-primary" />{{ $t('tools.reminder.focus') }}</span>
              </div>
            </div>
            <div class="mt-3 flex h-24 items-end gap-1.5">
              <div
                v-for="day in weekDays"
                :key="day.localDate"
                class="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                :title="day.title"
              >
                <div class="flex w-full max-w-7 flex-1 flex-col justify-end gap-[2px] rounded-md bg-muted/50 p-[2px]">
                  <div
                    v-if="day.focus > 0"
                    class="min-h-[3px] rounded-sm bg-primary/75"
                    :style="{ height: `${day.focus}%` }"
                  />
                  <div
                    v-if="day.stand > 0"
                    class="min-h-[3px] rounded-sm bg-warning/80"
                    :style="{ height: `${day.stand}%` }"
                  />
                  <div
                    v-if="day.water > 0"
                    class="min-h-[3px] rounded-sm bg-info/80"
                    :style="{ height: `${day.water}%` }"
                  />
                </div>
                <span
                  class="text-[11px]"
                  :class="day.today ? 'font-semibold text-foreground' : 'text-muted-foreground'"
                >
                  {{ day.label }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex min-h-0 flex-col gap-3">
          <div class="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.12] via-card to-card p-4 shadow-sm">
            <div class="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full border border-primary/10" />
            <div class="relative flex items-center justify-between gap-3">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                <Bell class="h-3.5 w-3.5" aria-hidden="true" />
                {{ $t('tools.reminder.nextTitle') }}
              </span>
              <Sparkles class="h-3.5 w-3.5 text-primary/60" aria-hidden="true" />
            </div>

            <template v-if="nextReminder">
              <div class="relative mt-3 flex items-end justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs text-muted-foreground">{{ typeLabel(nextReminder.type) }}</p>
                  <p class="mt-0.5 text-3xl font-semibold tracking-tight text-foreground">{{ nextReminder.time }}</p>
                  <p class="mt-0.5 text-xs font-medium text-primary">{{ nextReminder.relative }}</p>
                </div>
                <div class="shrink-0 text-right text-[10px] leading-4 text-muted-foreground">
                  <p>{{ $t('tools.reminder.nextInterval', { minutes: nextReminder.intervalMinutes }) }}</p>
                  <p>{{ $t('tools.reminder.nextWindow', { start: nextReminder.windowStart, end: nextReminder.windowEnd }) }}</p>
                </div>
              </div>
              <div v-if="upcomingReminders.length > 1" class="relative mt-3 flex items-center gap-2 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                <span class="shrink-0 uppercase tracking-[0.12em]">{{ $t('tools.reminder.upcomingTitle') }}</span>
                <span
                  v-for="item in upcomingReminders.slice(1, 3)"
                  :key="item.ruleId"
                  class="inline-flex min-w-0 items-center gap-1"
                >
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="item.dotClass" />
                  <span class="truncate">{{ typeLabel(item.type) }}</span>
                  <span class="shrink-0 tabular-nums text-foreground">{{ item.time }}</span>
                </span>
              </div>
            </template>

            <template v-else>
              <div class="relative mt-3 flex items-center gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <Bell class="h-4 w-4" aria-hidden="true" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-foreground">
                    {{ hasEnabledRules ? $t('tools.reminder.nextNoneWindow') : $t('tools.reminder.nextNone') }}
                  </p>
                  <p class="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    {{ hasEnabledRules ? $t('tools.reminder.nextNoneWindowHint') : $t('tools.reminder.nextNoneHint') }}
                  </p>
                </div>
                <Button v-if="!hasEnabledRules" size="sm" variant="outline" @click="openCreate">
                  <Plus class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ $t('tools.reminder.newRule') }}
                </Button>
              </div>
            </template>
          </div>

          <div class="flex min-h-0 flex-col rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
            <div class="flex items-end justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ $t('tools.reminder.recentTitle') }}</h2>
              </div>
              <CheckCircle2 class="h-3.5 w-3.5 shrink-0 text-success/70" aria-hidden="true" />
            </div>

            <p v-if="recentOccurrences.length === 0" class="mt-2 rounded-lg border border-dashed border-border/60 bg-background/40 px-3 py-3 text-center text-[11px] text-muted-foreground">
              {{ $t('tools.reminder.recentEmpty') }}
            </p>
            <ul v-else class="mt-2 flex flex-col divide-y divide-border/40">
              <li
                v-for="occurrence in recentOccurrences.slice(0, 3)"
                :key="occurrence.id"
                class="flex items-center gap-2.5 py-1.5"
              >
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" :class="typeMeta(occurrence.ruleType).softClass">
                  <component :is="typeMeta(occurrence.ruleType).icon" class="h-3 w-3" aria-hidden="true" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs text-foreground">{{ typeLabel(occurrence.ruleType) }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ formatOccurrenceTime(occurrence) }}</p>
                </div>
                <span class="rounded-full px-1.5 py-0.5 text-[10px]" :class="occurrenceStatusClass(occurrence.status)">
                  {{ occurrenceStatusLabel(occurrence.status) }}
                </span>
              </li>
            </ul>
          </div>

          <div class="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-3.5 shadow-sm">
            <div class="pointer-events-none absolute -bottom-16 -right-12 h-40 w-40 rounded-full bg-success/10 blur-3xl" />
            <div class="relative">
              <div class="flex items-center gap-2 text-xs font-medium text-foreground">
                <Sparkles class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {{ $t('tools.reminder.tipTitle') }}
              </div>
              <p class="mt-2 text-sm font-semibold leading-5 tracking-tight text-foreground">{{ $t('tools.reminder.tipQuote') }}</p>
              <p class="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{{ $t('tools.reminder.tipBody') }}</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold tracking-tight text-foreground">{{ $t('tools.reminder.rules') }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.reminder.rulesDescription') }}</p>
          </div>
          <span class="rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs text-muted-foreground">
            {{ $t('tools.reminder.ruleCount', { count: rules.length }) }}
          </span>
        </div>

        <div v-if="rules.length === 0" class="mt-3 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-10 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bell class="h-5 w-5" aria-hidden="true" />
          </div>
          <p class="mt-3 font-medium text-foreground">{{ $t('tools.reminder.noRules') }}</p>
          <p class="mt-1 max-w-sm text-sm text-muted-foreground">{{ $t('tools.reminder.noRulesHint') }}</p>
          <Button class="mt-4" @click="openCreate">
            <Plus class="h-icon-sm w-icon-sm" aria-hidden="true" />
            {{ $t('tools.reminder.newRule') }}
          </Button>
        </div>

        <div v-else class="mt-3 flex flex-col gap-2">
          <article
            v-for="rule in rules"
            :key="rule.id"
            class="group flex flex-col gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5 shadow-sm transition-colors hover:border-border sm:flex-row sm:items-center"
            :class="rule.enabled !== 1 ? 'opacity-70' : ''"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" :class="typeMeta(rule.type).softClass" :title="typeMeta(rule.type).hint">
                <component :is="typeMeta(rule.type).icon" class="h-4 w-4" aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-medium text-foreground">{{ typeLabel(rule.type) }}</h3>
                  <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                    {{ $t('tools.reminder.intervalValue', { minutes: rule.intervalMinutes }) }}
                  </span>
                </div>
                <div class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    <Clock class="h-3 w-3 shrink-0" aria-hidden="true" />
                    {{ $t('tools.reminder.windowValue', { start: rule.windowStart, end: rule.windowEnd }) }}
                    <span class="text-border">·</span>
                    {{ weekdaySummary(rule.weekdays) }}
                  </span>
                  <span class="text-border">·</span>
                  <span class="inline-flex min-w-0 items-center gap-1">
                    <CalendarDays class="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span class="truncate">{{ ruleNextLabel(rule) }}</span>
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 sm:justify-end">
              <span class="text-[10px] text-muted-foreground md:hidden">
                {{ rule.enabled === 1 ? $t('tools.reminder.enabledHint') : $t('tools.reminder.disabledHint') }}
              </span>
              <Switch
                :model-value="rule.enabled === 1"
                :label="$t('tools.reminder.enabled')"
                @update:model-value="toggleRule(rule, $event)"
              />
              <div class="flex items-center gap-1">
                <IconButton size="icon-sm" :label="$t('tools.reminder.edit')" @click="openEdit(rule)">
                  <Pencil class="h-icon-sm w-icon-sm" />
                </IconButton>
                <IconButton size="icon-sm" :label="$t('tools.reminder.delete')" @click="requestDelete(rule)">
                  <Trash2 class="h-icon-sm w-icon-sm" />
                </IconButton>
              </div>
            </div>
          </article>
        </div>
      </section>


    </div>

    <Dialog
      v-model:open="editorOpen"
      :title="editingRule ? $t('tools.reminder.editTitle') : $t('tools.reminder.createTitle')"
      :description="$t('tools.reminder.editorDescription')"
      content-class="w-[min(94vw,40rem)]"
      :close-on-overlay="false"
    >
      <div class="flex flex-col gap-5 pb-1">
        <div>
          <p class="text-sm font-medium text-foreground">{{ $t('tools.reminder.type') }}</p>
          <div class="mt-2 grid grid-cols-3 gap-2">
            <button
              v-for="option in typeOptions"
              :key="option.value"
              type="button"
              class="flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              :class="form.type === option.value ? 'border-primary/40 bg-primary/[0.07]' : 'border-border/60 bg-background/50 hover:bg-accent/40'"
              :aria-pressed="form.type === option.value"
              @click="form.type = option.value"
            >
              <component :is="option.icon" class="h-4 w-4" :class="option.iconClass" aria-hidden="true" />
              <span class="text-sm font-medium text-foreground">{{ option.label }}</span>
              <span class="text-[11px] leading-4 text-muted-foreground">{{ option.hint }}</span>
            </button>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField :label="$t('tools.reminder.interval')" html-for="reminder-interval">
            <div id="reminder-interval" role="group" :aria-label="$t('tools.reminder.interval')" class="grid grid-cols-3 gap-1.5">
              <button
                v-for="minutes in intervals"
                :key="minutes"
                type="button"
                class="h-8 rounded-md border text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                :class="form.intervalMinutes === minutes ? 'border-primary/40 bg-primary/10 font-medium text-primary' : 'border-border/60 bg-background text-muted-foreground hover:bg-accent/50'"
                :aria-pressed="form.intervalMinutes === minutes"
                @click="form.intervalMinutes = minutes"
              >
                {{ minutes }} {{ $t('tools.reminder.minutesShort') }}
              </button>
            </div>
          </FormField>

          <FormField :label="$t('tools.reminder.anchorMode')" html-for="reminder-anchor-created">
            <div id="reminder-anchor-created" role="group" :aria-label="$t('tools.reminder.anchorMode')" class="grid gap-1.5">
              <button
                v-for="option in anchorOptions"
                :key="option.value"
                type="button"
                class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                :class="form.anchorMode === option.value ? 'border-primary/40 bg-primary/[0.07] text-foreground' : 'border-border/60 bg-background text-muted-foreground hover:bg-accent/40'"
                :aria-pressed="form.anchorMode === option.value"
                @click="form.anchorMode = option.value"
              >
                <component :is="option.icon" class="h-3.5 w-3.5" aria-hidden="true" />
                {{ option.label }}
              </button>
            </div>
          </FormField>

          <FormField :label="$t('tools.reminder.windowStart')" html-for="reminder-start">
            <Input id="reminder-start" v-model="form.windowStart" type="time" />
          </FormField>

          <FormField :label="$t('tools.reminder.windowEnd')" html-for="reminder-end">
            <Input id="reminder-end" v-model="form.windowEnd" type="time" />
          </FormField>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-foreground">{{ $t('tools.reminder.weekdays') }}</p>
            <span class="text-xs text-muted-foreground">{{ weekdaySummary(form.weekdays) }}</span>
          </div>
          <div class="mt-2 grid grid-cols-7 gap-1.5">
            <button
              v-for="day in weekdays"
              :key="day.value"
              type="button"
              class="h-9 rounded-md border text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              :class="form.weekdays.includes(day.value) ? 'border-primary/30 bg-primary/10 font-medium text-primary' : 'border-border/60 bg-background text-muted-foreground hover:bg-accent/40'"
              :aria-pressed="form.weekdays.includes(day.value)"
              :aria-label="day.label"
              @click="toggleWeekday(day.value)"
            >
              {{ day.short }}
            </button>
          </div>
        </div>

        <p v-if="editorError" class="text-sm text-destructive" role="alert">{{ editorError }}</p>
      </div>

      <template #footer>
        <Button variant="ghost" @click="editorOpen = false">{{ $t('common.cancel') }}</Button>
        <Button :loading="saving" @click="saveRule">
          {{ editingRule ? $t('tools.reminder.saveEdit') : $t('tools.reminder.create') }}
        </Button>
      </template>
    </Dialog>

    <AlertDialog
      :open="deleteOpen"
      :title="$t('tools.reminder.deleteTitle')"
      :description="$t('tools.reminder.deleteConfirm', { type: deletingRule ? typeLabel(deletingRule.type) : '' })"
      :cancel-label="$t('common.cancel')"
      :confirm-label="$t('common.delete')"
      confirm-variant="destructive"
      :loading="deleteLoading"
      :error="deleteError"
      @update:open="(value) => { if (!value) closeDelete() }"
      @confirm="confirmDelete"
      @cancel="closeDelete"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Droplets,
  Eye,
  HeartPulse,
  Hourglass,
  Pencil,
  PersonStanding,
  Plus,
  Sparkles,
  Timer as TimerIcon,
  Trash2
} from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Input from '@/components/ui/input/Input.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import FormField from '@/components/ui/form-field/FormField.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import AlertDialog from '@/components/ui/alert-dialog/AlertDialog.vue'

const { t, locale } = useI18n()
const toolsStore = useToolsStore()
const intervals = [10, 20, 30, 45, 60, 90]
const now = ref(Date.now())
let clockTimer = null

const EMPTY_FORM = Object.freeze({
  type: 'water',
  intervalMinutes: 30,
  windowStart: '09:00',
  windowEnd: '18:00',
  anchorMode: 'created',
  weekdays: [0, 1, 2, 3, 4, 5, 6]
})
const form = reactive({ ...EMPTY_FORM, weekdays: [...EMPTY_FORM.weekdays] })
const editorOpen = ref(false)
const editingRule = ref(null)
const editorError = ref('')
const saving = ref(false)
const deletingRule = ref(null)
const deleteOpen = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')

const health = computed(() => toolsStore.healthView)
const rules = computed(() => health.value?.rules || toolsStore.reminderRules)
const today = computed(() => health.value?.today || {
  focusCount: 0,
  waterCount: 0,
  sunCount: 0
})
const careCount = computed(() => today.value.waterCount + today.value.sunCount)
const recentOccurrences = computed(() => health.value?.recentOccurrences || [])
const hasEnabledRules = computed(() => rules.value.some((rule) => rule.enabled === 1))

const weekdays = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'zh-CN', { weekday: 'short' })
  const shortFormatter = new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'zh-CN', { weekday: 'narrow' })
  // 2024-01-07 is a Sunday, so index 0 maps to Sunday.
  return [0, 1, 2, 3, 4, 5, 6].map((value) => ({
    value,
    label: formatter.format(new Date(Date.UTC(2024, 0, 7 + value))),
    short: shortFormatter.format(new Date(Date.UTC(2024, 0, 7 + value)))
  }))
})

const typeOptions = computed(() => [
  {
    value: 'water',
    label: t('tools.reminder.water'),
    hint: t('tools.reminder.waterHint'),
    icon: Droplets,
    iconClass: 'text-info',
    softClass: 'bg-info/10 text-info'
  },
  {
    value: 'stand',
    label: t('tools.reminder.stand'),
    hint: t('tools.reminder.standHint'),
    icon: PersonStanding,
    iconClass: 'text-warning',
    softClass: 'bg-warning/10 text-warning'
  },
  {
    value: 'eyes',
    label: t('tools.reminder.eyes'),
    hint: t('tools.reminder.eyesHint'),
    icon: Eye,
    iconClass: 'text-success',
    softClass: 'bg-success/10 text-success'
  }
])

const anchorOptions = computed(() => [
  {
    value: 'created',
    label: t('tools.reminder.anchorCreated'),
    icon: Clock
  },
  {
    value: 'hour',
    label: t('tools.reminder.anchorHour'),
    icon: Hourglass
  }
])

const todayStats = computed(() => [
  {
    key: 'water',
    label: t('tools.reminder.water'),
    value: today.value.waterCount,
    unit: t('tools.reminder.timesUnit'),
    icon: Droplets,
    iconClass: 'text-info'
  },
  {
    key: 'stand',
    label: t('tools.reminder.stand'),
    value: today.value.sunCount,
    unit: t('tools.reminder.timesUnit'),
    icon: PersonStanding,
    iconClass: 'text-warning'
  },
  {
    key: 'focus',
    label: t('tools.reminder.focus'),
    value: today.value.focusCount,
    unit: t('tools.reminder.sessionsUnit'),
    icon: TimerIcon,
    iconClass: 'text-primary'
  }
])

const weekDays = computed(() => {
  const rawDays = health.value?.days || []
  const maxValue = Math.max(1, ...rawDays.map((day) => day.waterCount + day.sunCount + day.focusCount))
  return rawDays.map((day) => {
    const total = day.waterCount + day.sunCount + day.focusCount
    const scale = total > 0 ? Math.max(12, Math.round((total / maxValue) * 100)) : 0
    return {
      ...day,
      today: day.localDate === health.value?.localDate,
      label: formatWeekday(day.localDate),
      title: t('tools.reminder.daySummary', {
        date: day.localDate,
        water: day.waterCount,
        stand: day.sunCount,
        focus: day.focusCount
      }),
      water: day.waterCount ? Math.max(8, Math.round((day.waterCount / total) * scale)) : 0,
      stand: day.sunCount ? Math.max(8, Math.round((day.sunCount / total) * scale)) : 0,
      focus: day.focusCount ? Math.max(8, Math.round((day.focusCount / total) * scale)) : 0
    }
  })
})

const upcomingReminders = computed(() => {
  const rulesWithNext = rules.value
    .filter((rule) => rule.enabled === 1 && rule.nextRunAt)
    .slice()
    .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())
  return rulesWithNext.map((rule) => ({
    ruleId: rule.id,
    type: rule.type,
    time: formatClock(new Date(rule.nextRunAt)),
    dotClass: rule.type === 'stand' ? 'bg-warning' : rule.type === 'eyes' ? 'bg-success' : 'bg-info'
  }))
})

const nextReminder = computed(() => {
  const next = health.value?.nextReminder
  if (!next) return null
  const date = new Date(next.nextRunAt)
  return {
    ...next,
    time: formatClock(date),
    relative: formatRelative(date)
  }
})

function typeMeta(type) {
  return typeOptions.value.find((entry) => entry.value === type) || typeOptions.value[0]
}

function typeLabel(type) {
  return typeMeta(type).label
}

function formatClock(date) {
  return date.toLocaleTimeString(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatWeekday(localDate) {
  const [year, month, day] = localDate.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    weekday: 'short'
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatRelative(date) {
  const minutes = Math.max(0, Math.round((date.getTime() - now.value) / 60000))
  if (minutes < 1) return t('tools.reminder.relativeSoon')
  if (minutes < 60) return t('tools.reminder.relativeMinutes', { minutes })
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest
    ? t('tools.reminder.relativeHoursMinutes', { hours, minutes: rest })
    : t('tools.reminder.relativeHours', { hours })
}

function formatRuleNext(rule) {
  if (rule.enabled !== 1) return t('tools.reminder.ruleDisabled')
  if (!rule.nextRunAt) return t('tools.reminder.ruleNoNext')
  const date = new Date(rule.nextRunAt)
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const sameDay = localDate === health.value?.localDate
  return t('tools.reminder.nextRun', {
    time: sameDay
      ? formatClock(date)
      : `${new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' }).format(date)} ${formatClock(date)}`
  })
}

function ruleNextLabel(rule) {
  return formatRuleNext(rule)
}

function weekdaySummary(days) {
  if (!Array.isArray(days) || days.length === 0 || days.length === 7) {
    return t('tools.reminder.everyDay')
  }
  return days
    .map((day) => weekdays.value.find((entry) => entry.value === day)?.label)
    .filter(Boolean)
    .join(t('tools.reminder.weekdaySeparator'))
}

function formatOccurrenceTime(occurrence) {
  const value = occurrence.respondedAt || occurrence.scheduledAt
  if (!value) return ''
  return new Date(value).toLocaleString(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function occurrenceStatusLabel(status) {
  const key = `tools.reminder.status.${status}`
  const translated = t(key)
  return translated === key ? t('tools.reminder.status.expired') : translated
}

function occurrenceStatusClass(status) {
  if (status === 'confirmed') return 'bg-success/10 text-success'
  if (status === 'skipped') return 'bg-muted text-muted-foreground'
  if (status === 'snoozed') return 'bg-warning/10 text-warning'
  return 'bg-muted text-muted-foreground'
}

function resetForm() {
  form.type = EMPTY_FORM.type
  form.intervalMinutes = EMPTY_FORM.intervalMinutes
  form.windowStart = EMPTY_FORM.windowStart
  form.windowEnd = EMPTY_FORM.windowEnd
  form.anchorMode = EMPTY_FORM.anchorMode
  form.weekdays = [...EMPTY_FORM.weekdays]
}

function openCreate() {
  editingRule.value = null
  editorError.value = ''
  resetForm()
  editorOpen.value = true
}

function openEdit(rule) {
  editingRule.value = rule
  editorError.value = ''
  form.type = rule.type
  form.intervalMinutes = rule.intervalMinutes
  form.windowStart = rule.windowStart
  form.windowEnd = rule.windowEnd
  form.anchorMode = rule.anchorMode
  form.weekdays = [...rule.weekdays]
  editorOpen.value = true
}

function toggleWeekday(day) {
  if (form.weekdays.includes(day)) {
    form.weekdays = form.weekdays.filter((entry) => entry !== day)
  } else {
    form.weekdays = [...form.weekdays, day].sort((a, b) => a - b)
  }
}

async function saveRule() {
  editorError.value = ''
  if (form.windowStart >= form.windowEnd) {
    editorError.value = t('tools.reminder.windowInvalid')
    return
  }
  saving.value = true
  try {
    const payload = {
      type: form.type,
      intervalMinutes: form.intervalMinutes,
      anchorMode: form.anchorMode,
      windowStart: form.windowStart,
      windowEnd: form.windowEnd,
      weekdays: [...form.weekdays]
    }
    if (editingRule.value) {
      await toolsStore.updateReminderRule(editingRule.value.id, payload)
    } else {
      await toolsStore.createReminderRule(payload)
    }
    editorOpen.value = false
    await toolsStore.loadHealthView()
  } catch (err) {
    editorError.value = err.message
  } finally {
    saving.value = false
  }
}

async function toggleRule(rule, enabled) {
  try {
    await toolsStore.updateReminderRule(rule.id, { enabled })
  } catch (err) {
    editorError.value = err.message
  }
}

function requestDelete(rule) {
  deletingRule.value = rule
  deleteError.value = ''
  deleteLoading.value = false
  deleteOpen.value = true
}

function closeDelete() {
  deleteOpen.value = false
  deletingRule.value = null
}

async function confirmDelete() {
  if (!deletingRule.value) return
  deleteLoading.value = true
  deleteError.value = ''
  try {
    await toolsStore.deleteReminderRule(deletingRule.value.id)
    closeDelete()
  } catch (err) {
    deleteError.value = err.message
  } finally {
    deleteLoading.value = false
  }
}

async function load() {
  await Promise.all([
    toolsStore.loadHealthView(),
    toolsStore.loadReminderRules(),
    toolsStore.loadShellSnapshot()
  ])
}

function handleToolsUpdated() {
  load()
}

onMounted(async () => {
  await load()
  clockTimer = setInterval(() => { now.value = Date.now() }, 30 * 1000)
  window.electronAPI?.events?.on('tools-updated', handleToolsUpdated)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  window.electronAPI?.events?.off('tools-updated', handleToolsUpdated)
})
</script>
