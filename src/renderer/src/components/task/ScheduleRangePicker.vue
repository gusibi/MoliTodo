<template>
  <div class="schedule-range">
    <div class="schedule-range-fields">
      <button type="button" class="schedule-range-field" :class="{ 'is-active': activeField === 'startDate' }"
        :aria-pressed="activeField === 'startDate'" @click="activeField = 'startDate'">
        {{ startDateLabel }}
      </button>
      <input v-if="activeField === 'startTime'" v-model="timeDraft" type="time" class="schedule-range-time-input"
        :aria-label="t('tasks.scheduleStartLabel')" @change="commitTimeDraft" @blur="activeField = null"
        @keydown.enter.prevent="$event.target.blur()" />
      <button v-else type="button" class="schedule-range-field" :class="{ 'is-active': activeField === 'startTime' }"
        :aria-pressed="activeField === 'startTime'" @click="activateTimeField('startTime')">
        {{ startTimeLabel }}
      </button>
      <span class="schedule-range-sep" aria-hidden="true">–</span>
      <input v-if="activeField === 'endTime'" v-model="timeDraft" type="time" class="schedule-range-time-input"
        :aria-label="t('tasks.scheduleEndLabel')" @change="commitTimeDraft" @blur="activeField = null"
        @keydown.enter.prevent="$event.target.blur()" />
      <button v-else type="button" class="schedule-range-field" :class="{ 'is-active': activeField === 'endTime' }"
        :aria-pressed="activeField === 'endTime'" @click="activateTimeField('endTime')">
        {{ endTimeLabel }}
      </button>
      <button type="button" class="schedule-range-field" :class="{ 'is-active': activeField === 'endDate' }"
        :aria-pressed="activeField === 'endDate'" @click="activeField = 'endDate'">
        {{ endDateLabel }}
      </button>
    </div>
    <div v-if="isDateField" class="schedule-range-control">
      <v-date-picker :model-value="activeDateValue" mode="date" :is-dark="isDark" :min-date="minDate"
        @update:modelValue="onDateChange" borderless />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { localeCode } from '@/utils/locale-format.js'
import { useTheme } from '@/composables/useTheme'

/**
 * 安排时间范围选择：日期块点击后用下方日历改，时间块点击后就地变成时间输入框。
 * 选开始日期/时间会把结束按同一天（或原跨度）对齐，结束早于开始自动落到次日。
 */
const DEFAULT_DURATION_MS = 60 * 60 * 1000

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ start: null, end: null })
  },
  // 可选日期下限（Today 行上不允许排到过去）
  minDate: {
    type: Date,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const { t, locale } = useI18n()
const { isDark } = useTheme()

const activeField = ref('startDate')
const timeDraft = ref('')

const start = computed(() => toDate(props.modelValue?.start))
const end = computed(() => toDate(props.modelValue?.end))
const isDateField = computed(() => activeField.value === 'startDate' || activeField.value === 'endDate')
const activeDateValue = computed(() => (activeField.value === 'startDate' ? start.value : (end.value || start.value)))

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function localKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// 默认开始时刻：今天取当前时刻（对齐 5 分钟），其他日期取 09:00
function defaultStartTime(date) {
  const result = new Date(date)
  if (localKey(result) === localKey(new Date())) {
    const now = new Date()
    result.setHours(now.getHours(), Math.floor(now.getMinutes() / 5) * 5, 0, 0)
  } else {
    result.setHours(9, 0, 0, 0)
  }
  return result
}

function withTime(date, time) {
  const result = new Date(date)
  result.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return result
}

function commit(nextStart, nextEnd) {
  emit('update:modelValue', {
    start: nextStart ? nextStart.toISOString() : null,
    end: nextEnd ? nextEnd.toISOString() : null
  })
}

// 开始变化后对齐结束：同日跟随到同一天；跨天整体平移保持时长
function pairEndWithStart(prevStart, nextStart, prevEnd) {
  if (!prevEnd) return null
  const sameDay = !prevStart || localKey(prevStart) === localKey(prevEnd)
  let nextEnd = sameDay
    ? withTime(nextStart, prevEnd)
    : new Date(prevEnd.getTime() + (nextStart.getTime() - prevStart.getTime()))
  if (nextEnd.getTime() < nextStart.getTime()) {
    nextEnd = new Date(nextStart.getTime() + DEFAULT_DURATION_MS)
  }
  return nextEnd
}

function onDateChange(value) {
  const picked = toDate(value)
  if (!picked) return
  if (activeField.value === 'startDate') {
    const prevStart = start.value
    const prevEnd = end.value
    const nextStart = withTime(picked, prevStart || defaultStartTime(picked))
    commit(nextStart, pairEndWithStart(prevStart, nextStart, prevEnd))
    return
  }
  // 结束日期
  let nextStart = start.value
  let nextEnd = withTime(picked, end.value || (nextStart ? new Date(nextStart.getTime() + DEFAULT_DURATION_MS) : defaultStartTime(picked)))
  if (!nextStart) {
    nextStart = new Date(nextEnd.getTime() - DEFAULT_DURATION_MS)
  } else if (nextEnd.getTime() < nextStart.getTime()) {
    nextEnd = new Date(nextStart.getTime() + DEFAULT_DURATION_MS)
  }
  commit(nextStart, nextEnd)
}

function onTimeChange(picked) {
  if (!picked) return
  if (activeField.value === 'startTime') {
    const prevStart = start.value
    const prevEnd = end.value
    const base = prevStart || defaultStartTime(new Date())
    const nextStart = withTime(base, picked)
    commit(nextStart, pairEndWithStart(prevStart || base, nextStart, prevEnd))
    return
  }
  // 结束时间：跨天保留原结束日期，只改时刻；早于开始则顺延到次日
  const nextStart = start.value || defaultStartTime(new Date())
  const prevEnd = end.value
  const crossDay = prevEnd && localKey(prevEnd) !== localKey(nextStart)
  let nextEnd = withTime(crossDay ? prevEnd : nextStart, picked)
  if (nextEnd.getTime() < nextStart.getTime()) {
    nextEnd = new Date(nextEnd.getTime() + 24 * 60 * 60 * 1000)
  }
  commit(nextStart, nextEnd)
}

function activateTimeField(field) {
  const target = field === 'startTime' ? start.value : end.value
  timeDraft.value = target
    ? `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`
    : ''
  activeField.value = field
}

// change 即提交；input 保持焦点到 blur/Escape 再退出编辑态，
// 提交后立即卸载会让焦点落到弹层外，触发气泡的 focus-outside 关闭
function commitTimeDraft() {
  if (activeField.value !== 'startTime' && activeField.value !== 'endTime') return
  const [hours, minutes] = String(timeDraft.value).split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return
  const picked = new Date()
  picked.setHours(hours, minutes, 0, 0)
  onTimeChange(picked)
}

function dateLabel(date) {
  if (!date) return t('tasks.pickDate')
  if (localKey(date) === localKey(new Date())) return t('categories.today')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (localKey(date) === localKey(tomorrow)) return t('floatView.chipTomorrow')
  return date.toLocaleDateString(localeCode(locale.value), { month: 'numeric', day: 'numeric' })
}

function timeLabel(date) {
  if (!date) return t('tasks.pickTime')
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const startDateLabel = computed(() => dateLabel(start.value))
const startTimeLabel = computed(() => timeLabel(start.value))
// 结束日期默认跟随开始（同一天）
const endDateLabel = computed(() => dateLabel(end.value || start.value))
const endTimeLabel = computed(() => timeLabel(end.value))
</script>

<style scoped>
.schedule-range {
  @apply flex flex-col;
  min-width: 15rem;
}

.schedule-range-fields {
  @apply flex items-center gap-1 px-1 pb-2;
}

.schedule-range-field {
  @apply flex-1 min-w-0 truncate rounded-md border border-border px-1.5 py-1 text-[11px] leading-none;
  @apply text-foreground bg-transparent transition-colors;
}

.schedule-range-field:hover {
  @apply bg-accent;
}

.schedule-range-field.is-active {
  @apply border-primary text-primary bg-primary/10;
}

/* 就地编辑的时间输入框：与日期/时间块同尺寸，点时间块原位出现；
   原生时间输入有最小内容宽度，压窄会裁掉小时段 */
.schedule-range-time-input {
  @apply min-w-[4.25rem] flex-1 rounded-md border border-primary bg-primary/10 px-1.5 py-1 text-[11px] leading-none;
  @apply text-primary text-center outline-none transition-colors;
  @apply focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30;
  @apply dark:[color-scheme:dark];
}

.schedule-range-sep {
  @apply flex-shrink-0 text-[11px] text-muted-foreground;
}

.schedule-range-control :deep(.vc-container) {
  @apply bg-popover border-0;
}
</style>
