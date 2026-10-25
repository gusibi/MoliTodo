<template>
  <div class="tool-view-scroll h-full overflow-auto">
    <div class="tool-page">
      <ToolPageHeader
        :eyebrow="$t('tools.reminder.eyebrow')"
        :title="$t('tools.reminder.heroTitle')"
        :description="$t('tools.reminder.heroDescription')"
        :icon="HeartPulse"
        tone="info"
      >
        <template #actions>
          <Button @click="openCreate">
            <Plus class="h-icon-sm w-icon-sm" aria-hidden="true" />
            {{ $t('tools.reminder.newRule') }}
          </Button>
        </template>
      </ToolPageHeader>

      <!-- 今日节律 + 下一次提醒：一个表面，两条信息轴 -->
      <section class="tool-surface tool-reveal overflow-hidden">
        <div class="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div class="relative p-5 sm:p-7">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="tool-label">{{ $t('tools.reminder.todayTitle') }}</p>
                <div class="mt-3 flex items-end gap-2.5">
                  <span class="tool-metric text-[3.6rem] leading-[0.82] text-foreground sm:text-[4.2rem]">{{ careCount }}</span>
                  <span class="pb-1 text-sm font-medium text-muted-foreground">{{ $t('tools.reminder.todayCareUnit') }}</span>
                </div>
                <p class="mt-3 text-[13px] text-muted-foreground">{{ $t('tools.reminder.todayHint') }}</p>
                <p v-if="today.focusCount" class="mt-1 text-xs text-primary">
                  {{ $t(today.focusCount === 1 ? 'tools.reminder.todayFocusNoteOne' : 'tools.reminder.todayFocusNote', { count: today.focusCount }) }}
                </p>
              </div>
              <div class="relative hidden h-[76px] w-[76px] shrink-0 items-center justify-center sm:flex">
                <span class="absolute inset-0 rounded-full border border-info/20" />
                <span class="absolute inset-[7px] rounded-full border border-info/30" />
                <span class="absolute inset-[16px] rounded-full bg-info/10" />
                <HeartPulse class="relative h-6 w-6 text-info" aria-hidden="true" />
              </div>
            </div>

            <div class="mt-7 grid grid-cols-3 divide-x divide-border/50">
              <div
                v-for="(item, index) in todayStats"
                :key="item.key"
                class="min-w-0"
                :class="index === 0 ? 'pr-3' : index === 2 ? 'pl-3' : 'px-3'"
              >
                <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <component :is="item.icon" class="h-3.5 w-3.5" :class="item.iconClass" aria-hidden="true" />
                  <span class="truncate">{{ item.label }}</span>
                </div>
                <p class="mt-2 flex items-baseline gap-1">
                  <span class="tool-metric text-2xl font-semibold text-foreground">{{ item.value }}</span>
                  <span class="text-[11px] text-muted-foreground">{{ item.unit }}</span>
                </p>
                <div class="mt-2 h-0.5 overflow-hidden rounded-full bg-muted">
                  <div class="h-full rounded-full transition-[width] duration-700" :class="item.barClass" :style="{ width: item.progress }" />
                </div>
              </div>
            </div>
          </div>

          <div class="relative flex flex-col border-t border-border/50 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div class="flex items-center justify-between gap-3">
              <p class="tool-label">{{ $t('tools.reminder.nextTitle') }}</p>
              <Bell class="h-4 w-4 text-info/70" aria-hidden="true" />
            </div>

            <template v-if="nextReminder">
              <div class="mt-4 flex items-center gap-5">
                <div
                  class="relative flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-full p-[4px]"
                  :style="{ background: `conic-gradient(${nextReminder.dialColor} ${nextReminder.progress}%, hsl(var(--border) / 0.55) 0)` }"
                  aria-hidden="true"
                >
                  <div class="flex h-full w-full flex-col items-center justify-center rounded-full border border-border/40 bg-card">
                    <component :is="typeMeta(nextReminder.type).icon" class="h-4 w-4" :class="typeMeta(nextReminder.type).iconClass" />
                    <span class="mt-1 text-[10px] text-muted-foreground">{{ typeLabel(nextReminder.type) }}</span>
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="tool-metric text-[2.6rem] font-semibold leading-none text-foreground">{{ nextReminder.time }}</p>
                  <p class="mt-1 text-xs font-medium text-info">{{ nextReminder.relative }}</p>
                  <p class="mt-2 text-[11px] leading-4 text-muted-foreground">
                    {{ $t('tools.reminder.nextInterval', { minutes: nextReminder.intervalMinutes }) }}
                    <span class="mx-1 text-border">·</span>
                    {{ $t('tools.reminder.nextWindow', { start: nextReminder.windowStart, end: nextReminder.windowEnd }) }}
                  </p>
                </div>
              </div>

              <div v-if="upcomingReminders.length > 1" class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                <span class="uppercase tracking-[0.14em]">{{ $t('tools.reminder.upcomingTitle') }}</span>
                <span
                  v-for="item in upcomingReminders.slice(1, 3)"
                  :key="item.ruleId"
                  class="inline-flex min-w-0 items-center gap-1.5"
                >
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="item.dotClass" />
                  <span class="truncate">{{ typeLabel(item.type) }}</span>
                  <span class="shrink-0 font-medium tabular-nums text-foreground">{{ item.time }}</span>
                </span>
              </div>
            </template>

            <template v-else>
              <div class="mt-5 flex items-center gap-4">
                <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/50 text-muted-foreground">
                  <Bell class="h-5 w-5" aria-hidden="true" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-foreground">
                    {{ hasEnabledRules ? $t('tools.reminder.nextNoneWindow') : $t('tools.reminder.nextNone') }}
                  </p>
                  <p class="mt-1 text-[11px] leading-4 text-muted-foreground">
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
        </div>
      </section>

      <!-- 最近 7 天：堆叠柱状图，按天总量归一化 -->
      <section class="tool-surface tool-reveal p-5 sm:p-7">
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 class="text-base font-semibold tracking-tight text-foreground">{{ $t('tools.reminder.weekTitle') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ $t('tools.reminder.weekHint') }}</p>
          </div>
          <div class="flex items-center gap-5">
            <div>
              <p class="tool-metric text-lg font-semibold leading-none text-foreground">{{ weekCareTotal }}</p>
              <p class="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{{ $t('tools.reminder.weekCareTotal') }}</p>
            </div>
            <div class="h-8 w-px bg-border/60" />
            <div>
              <p class="tool-metric text-lg font-semibold leading-none text-foreground">{{ weekFocusTotal }}</p>
              <p class="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{{ $t('tools.reminder.weekFocusTotal') }}</p>
            </div>
            <div class="ml-2 hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
              <span class="flex items-center gap-1.5"><i class="tool-water h-1.5 w-1.5 rounded-full" />{{ $t('tools.reminder.water') }}</span>
              <span class="flex items-center gap-1.5"><i class="h-1.5 w-1.5 rounded-full bg-warning" />{{ $t('tools.reminder.stand') }}</span>
              <span class="flex items-center gap-1.5"><i class="h-1.5 w-1.5 rounded-full border border-primary" />{{ $t('tools.reminder.focus') }}</span>
            </div>
          </div>
        </div>

        <div class="relative mt-5 flex h-[136px] items-end gap-1.5 sm:gap-2" aria-hidden="true">
          <span class="pointer-events-none absolute inset-x-0 bottom-[22px] h-px bg-border/60" />
          <div
            v-for="day in weekDays"
            :key="day.localDate"
            class="group relative flex h-full flex-1 flex-col items-center justify-end gap-2"
            :title="day.title"
          >
            <div
              class="flex h-[108px] w-full max-w-[34px] flex-col justify-end overflow-hidden rounded-[5px] p-[2px]"
              :class="day.today ? 'bg-primary/[0.04] ring-1 ring-inset ring-primary/10' : 'bg-transparent'"
            >
              <div
                v-if="day.focusHeight > 0"
                class="tool-bar-seg min-h-[2px] rounded-[2px] bg-primary/70"
                :style="{ height: `${day.focusHeight}%` }"
              />
              <div
                v-if="day.standHeight > 0"
                class="tool-bar-seg min-h-[2px] rounded-[2px] bg-warning/80"
                :style="{ height: `${day.standHeight}%` }"
              />
              <div
                v-if="day.waterHeight > 0"
                class="tool-bar-seg min-h-[2px] rounded-[2px] tool-water"
                :style="{ height: `${day.waterHeight}%` }"
              />
            </div>
            <span class="flex items-center gap-1 text-[10px]">
              <span :class="day.today ? 'font-semibold text-foreground' : 'text-muted-foreground'">{{ day.label }}</span>
              <span v-if="day.today" class="h-1 w-1 rounded-full bg-primary" />
            </span>
          </div>
        </div>
        <ul class="sr-only">
          <li v-for="day in weekDays" :key="day.localDate">{{ day.title }}</li>
        </ul>
      </section>

      <div class="grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <section class="tool-surface tool-reveal overflow-hidden">
          <div class="flex flex-wrap items-end justify-between gap-3 px-5 pb-4 pt-5">
            <div>
              <h2 class="text-base font-semibold tracking-tight text-foreground">{{ $t('tools.reminder.rules') }}</h2>
              <p class="mt-1 text-xs text-muted-foreground">{{ $t('tools.reminder.rulesDescription') }}</p>
            </div>
            <span class="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground">
              {{ $t('tools.reminder.ruleCount', { count: rules.length }) }}
            </span>
          </div>

          <div v-if="rules.length === 0" class="mx-5 mb-5 flex flex-col items-center rounded-xl border border-dashed border-border/70 bg-background/35 px-6 py-9 text-center">
            <div class="flex h-11 w-11 items-center justify-center rounded-full bg-info/10 text-info">
              <Bell class="h-5 w-5" aria-hidden="true" />
            </div>
            <p class="mt-3 text-sm font-medium text-foreground">{{ $t('tools.reminder.noRules') }}</p>
            <p class="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{{ $t('tools.reminder.noRulesHint') }}</p>
            <Button class="mt-4" size="sm" @click="openCreate">
              <Plus class="h-icon-sm w-icon-sm" aria-hidden="true" />
              {{ $t('tools.reminder.newRule') }}
            </Button>
          </div>

          <div v-else class="divide-y divide-border/45 border-t border-border/45">
            <article
              v-for="rule in rules"
              :key="rule.id"
              class="group flex flex-col gap-2.5 px-5 py-3.5 transition-colors hover:bg-accent/20 sm:flex-row sm:items-center"
              :class="rule.enabled !== 1 ? 'opacity-65' : ''"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" :class="typeMeta(rule.type).softClass" :title="typeMeta(rule.type).hint">
                  <component :is="typeMeta(rule.type).icon" class="h-4 w-4" aria-hidden="true" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-medium text-foreground">{{ typeLabel(rule.type) }}</h3>
                    <span class="rounded-full bg-muted/80 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {{ $t('tools.reminder.intervalValue', { minutes: rule.intervalMinutes }) }}
                    </span>
                  </div>
                  <div class="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
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
                <div class="flex items-center gap-0.5">
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

        <aside class="flex flex-col gap-4">
          <section class="tool-surface tool-reveal p-5">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base font-semibold tracking-tight text-foreground">{{ $t('tools.reminder.recentTitle') }}</h2>
              <CheckCircle2 class="h-4 w-4 text-success/70" aria-hidden="true" />
            </div>

            <p v-if="recentOccurrences.length === 0" class="mt-3 rounded-xl border border-dashed border-border/60 bg-background/35 px-3 py-5 text-center text-[11px] text-muted-foreground">
              {{ $t('tools.reminder.recentEmpty') }}
            </p>
            <ul v-else class="mt-2 divide-y divide-border/40">
              <li
                v-for="occurrence in recentOccurrences.slice(0, 4)"
                :key="occurrence.id"
                class="flex items-center gap-2.5 py-2.5"
              >
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" :class="typeMeta(occurrence.ruleType).softClass">
                  <component :is="typeMeta(occurrence.ruleType).icon" class="h-3.5 w-3.5" aria-hidden="true" />
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
          </section>

          <section class="relative overflow-hidden rounded-2xl border border-border/45 bg-background/35 p-5">
            <div class="pointer-events-none absolute -bottom-14 -right-10 h-32 w-32 rounded-full bg-success/10 blur-2xl" />
            <div class="relative">
              <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles class="h-3.5 w-3.5 text-success" aria-hidden="true" />
                {{ $t('tools.reminder.tipTitle') }}
              </div>
              <p class="mt-2.5 text-[15px] font-semibold leading-6 tracking-tight text-foreground">{{ $t('tools.reminder.tipQuote') }}</p>
              <p class="mt-1.5 text-[11px] leading-5 text-muted-foreground">{{ $t('tools.reminder.tipBody') }}</p>
            </div>
          </section>
        </aside>
      </div>
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
import ToolPageHeader from './ToolPageHeader.vue'
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
    softClass: 'bg-info/10 text-info',
    dialColor: 'hsl(var(--info))'
  },
  {
    value: 'stand',
    label: t('tools.reminder.stand'),
    hint: t('tools.reminder.standHint'),
    icon: PersonStanding,
    iconClass: 'text-warning',
    softClass: 'bg-warning/10 text-warning',
    dialColor: 'hsl(var(--warning))'
  },
  {
    value: 'eyes',
    label: t('tools.reminder.eyes'),
    hint: t('tools.reminder.eyesHint'),
    icon: Eye,
    iconClass: 'text-success',
    softClass: 'bg-success/10 text-success',
    dialColor: 'hsl(var(--success))'
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
    unit: t(today.value.waterCount === 1 ? 'tools.reminder.timesUnitOne' : 'tools.reminder.timesUnit'),
    progress: `${Math.min(100, (today.value.waterCount / 3) * 100)}%`,
    barClass: 'tool-water',
    icon: Droplets,
    iconClass: 'text-info'
  },
  {
    key: 'stand',
    label: t('tools.reminder.stand'),
    value: today.value.sunCount,
    unit: t(today.value.sunCount === 1 ? 'tools.reminder.timesUnitOne' : 'tools.reminder.timesUnit'),
    progress: `${Math.min(100, (today.value.sunCount / 3) * 100)}%`,
    barClass: 'bg-warning/70',
    icon: PersonStanding,
    iconClass: 'text-warning'
  },
  {
    key: 'focus',
    label: t('tools.reminder.focus'),
    value: today.value.focusCount,
    unit: t(today.value.focusCount === 1 ? 'tools.reminder.sessionsUnitOne' : 'tools.reminder.sessionsUnit'),
    progress: `${Math.min(100, (today.value.focusCount / 10) * 100)}%`,
    barClass: 'bg-primary/70',
    icon: TimerIcon,
    iconClass: 'text-primary'
  }
])

const weekDays = computed(() => {
  const rawDays = health.value?.days || []
  const maxTotal = Math.max(1, ...rawDays.map((day) => day.waterCount + day.sunCount + day.focusCount))
  return rawDays.map((day) => {
    const total = day.waterCount + day.sunCount + day.focusCount
    return {
      ...day,
      total,
      today: day.localDate === health.value?.localDate,
      label: formatWeekday(day.localDate),
      title: t('tools.reminder.daySummary', {
        date: day.localDate,
        water: day.waterCount,
        stand: day.sunCount,
        focus: day.focusCount
      }),
      waterHeight: day.waterCount ? Math.max(2, (day.waterCount / maxTotal) * 100) : 0,
      standHeight: day.sunCount ? Math.max(2, (day.sunCount / maxTotal) * 100) : 0,
      focusHeight: day.focusCount ? Math.max(2, (day.focusCount / maxTotal) * 100) : 0
    }
  })
})

const weekCareTotal = computed(() => weekDays.value.reduce((total, day) => total + day.waterCount + day.sunCount, 0))
const weekFocusTotal = computed(() => weekDays.value.reduce((total, day) => total + day.focusCount, 0))

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
  const minutesLeft = Math.max(0, Math.round((date.getTime() - now.value) / 60000))
  const interval = Math.max(1, next.intervalMinutes || 1)
  const progress = Math.min(100, Math.max(0, Math.round((1 - minutesLeft / interval) * 100)))
  return {
    ...next,
    time: formatClock(date),
    relative: formatRelative(date),
    progress,
    dialColor: typeMeta(next.type).dialColor
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
