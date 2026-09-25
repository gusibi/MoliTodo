<template>
  <Popover :open="open" :align="align" content-class="p-1" @update:open="handleOpenChange">
    <template #trigger>
      <span class="when-chip-anchor">
        <Tooltip :content-class="whenInfo.variant === 'overdue' ? 'text-destructive' : ''">
          <template #trigger>
            <button type="button" :class="['task-when-chip', whenInfo.variant]">
              <component :is="whenInfo.icon" class="h-2.5 w-2.5" aria-hidden="true" />
              <span>{{ whenInfo.label }}</span>
            </button>
          </template>
          {{ whenInfo.tooltip }}
        </Tooltip>
      </span>
    </template>
    <div class="when-popover">
      <template v-if="!pickerVisible">
        <div class="when-option when-option-today" @click.stop="setWhenQuick('today')">
          <CalendarDays class="h-3.5 w-3.5 when-option-icon" aria-hidden="true" />
          <span>{{ $t('categories.today') }}</span>
        </div>
        <div class="when-option when-option-tomorrow" @click.stop="setWhenQuick('tomorrow')">
          <CalendarDays class="h-3.5 w-3.5 when-option-icon" aria-hidden="true" />
          <span>{{ $t('floatView.chipTomorrow') }}</span>
        </div>
        <div class="when-option when-option-next-week" @click.stop="setWhenQuick('nextWeek')">
          <CalendarDays class="h-3.5 w-3.5 when-option-icon" aria-hidden="true" />
          <span>{{ $t('tasks.nextWeek') }}</span>
        </div>
        <div v-if="hasSchedule(task)" class="when-option when-option-clear" @click.stop="clearWhen">
          <X class="h-3.5 w-3.5 when-option-icon" aria-hidden="true" />
          <span>{{ $t('tasks.clearSchedule') }}</span>
        </div>
        <div class="when-option when-option-picker" @click.stop="openPicker">
          <CalendarClock class="h-3.5 w-3.5 when-option-icon" aria-hidden="true" />
          <span>{{ $t('tasks.pickDate') }}</span>
        </div>
      </template>
      <div v-else class="when-calendar">
        <v-date-picker v-model="pickerValue" mode="dateTime" is24hr :minute-increment="5"
          :is-dark="isDark" :min-date="pickerMinDate" @update:modelValue="setFromPicker" borderless />
      </div>
    </div>
  </Popover>
</template>

<script setup>
import { ref, computed } from 'vue'
import { CalendarClock, CalendarDays, CalendarPlus, X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'
import {
  hasSchedule,
  hasDeadline,
  isOverdue,
  scheduleStartDate,
  localDateKey
} from '@/utils/task-time-rules'
import { materializeVirtualInstance } from '@/utils/today-agenda'
import { dayLabel, formatTimeHM } from '@/utils/when-labels'
import { useTheme } from '@/composables/useTheme'
import Popover from '../ui/popover/Popover.vue'
import Tooltip from '../ui/tooltip/Tooltip.vue'

/**
 * 行上 When chip + When 气泡（悬浮窗与 Today 行共用的就地改期入口）。
 * 安排优先、截止其次（逾期红）、未安排 ghost；虚拟重复实例先物化再执行。
 */
const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  align: {
    type: String,
    default: 'start'
  }
})

const emit = defineEmits(['updated', 'open-change'])

const { t: $t, locale } = useI18n()
const taskStore = useTaskStore()
const { isDark } = useTheme()

const open = ref(false)
const pickerVisible = ref(false)
const pickerValue = ref(null)

const pickerMinDate = computed(() => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
})

// chip 上的日期文案：安排（含开始 – 结束区间）优先，其次截止（逾期红），否则未安排占位
const whenInfo = computed(() => {
  const task = props.task
  if (hasSchedule(task)) {
    const start = scheduleStartDate(task)
    const isMidnight = start.getHours() === 0 && start.getMinutes() === 0
    let label = dayLabel(start, $t, locale.value) + (isMidnight ? '' : formatTimeHM(start))
    const end = toDateValue(task.scheduledEndAt)
    if (end && end.getTime() > start.getTime()) {
      const sameDay = start.toDateString() === end.toDateString()
      label += sameDay
        ? ` –${formatTimeHM(end)}`
        : ` – ${dayLabel(end, $t, locale.value)}${formatTimeHM(end)}`
    }
    return {
      label,
      icon: CalendarDays,
      variant: 'scheduled',
      tooltip: $t('tasks.scheduleStartLabel')
    }
  }
  if (hasDeadline(task)) {
    const due = new Date(`${localDateKey(task.dueDate)}T00:00:00`)
    const label = dayLabel(due, $t, locale.value) + (task.dueTime ? ` ${task.dueTime}` : '')
    const overdue = isOverdue(task)
    return {
      label,
      icon: CalendarClock,
      variant: overdue ? 'overdue' : 'scheduled',
      tooltip: $t('tasks.deadlineLabel')
    }
  }
  return {
    label: $t('floatView.unscheduledSection'),
    icon: CalendarPlus,
    variant: 'ghost',
    tooltip: $t('floatView.whenChipTitle')
  }
})

function toDateValue(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function handleOpenChange(value) {
  open.value = value
  if (value) {
    pickerVisible.value = false
    pickerValue.value = null
  }
  emit('open-change', value)
}

// 改安排：保留原有时长（有结束时间时按偏移平移）；相对提醒由应用层自动重算
async function applyWhen(date) {
  const target = await materializeVirtualInstance(taskStore, props.task)
  if (!target) return
  try {
    const payload = { scheduledStartAt: date.toISOString() }
    const oldStart = toDateValue(target.scheduledStartAt)
    const oldEnd = toDateValue(target.scheduledEndAt)
    if (oldEnd && oldStart && oldEnd.getTime() > oldStart.getTime()) {
      payload.scheduledEndAt = new Date(date.getTime() + (oldEnd.getTime() - oldStart.getTime())).toISOString()
    }
    await taskStore.updateTask(target.id, payload)
    open.value = false
    pickerVisible.value = false
    emit('updated', target)
  } catch (error) {
    console.error('更新安排失败:', error)
  }
}

function setWhenQuick(kind) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  if (kind === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  } else if (kind === 'nextWeek') {
    // 下周：取下周一（与「下周X」口语的锚点一致）
    const diff = (1 - date.getDay() + 7) % 7 || 7
    date.setDate(date.getDate() + diff)
  }
  applyWhen(date)
}

async function clearWhen() {
  const target = await materializeVirtualInstance(taskStore, props.task)
  if (!target) return
  try {
    await taskStore.updateTask(target.id, { scheduledStartAt: null, scheduledEndAt: null })
    open.value = false
    pickerVisible.value = false
    emit('updated', target)
  } catch (error) {
    console.error('清除安排失败:', error)
  }
}

function openPicker() {
  // 未安排时不预填日期：预填会让点击同一天不触发 update（值未变化），日历仍显示当前月份
  pickerValue.value = hasSchedule(props.task) ? scheduleStartDate(props.task) : null
  pickerVisible.value = true
}

async function setFromPicker() {
  if (!pickerValue.value) return
  const date = toDateValue(pickerValue.value)
  if (!date) return
  await applyWhen(date)
}
</script>

<style scoped>
.when-popover {
  @apply flex flex-col;
}

.when-option {
  @apply flex items-center gap-2 px-2 py-1.5 text-xs rounded-md;
  @apply text-popover-foreground hover:bg-accent;
  @apply transition-colors cursor-pointer;
}

.when-option-icon {
  @apply w-3.5 h-3.5 text-muted-foreground flex-shrink-0;
}

/* When 气泡的清除安排用危险色 */
.when-option-clear {
  @apply text-destructive/90;
}

.when-option-clear .when-option-icon {
  @apply text-destructive/70;
}

.when-option-clear:hover {
  @apply bg-destructive/10 text-destructive;
}

/* When 气泡内的日历 */
.when-calendar {
  @apply p-1;
}

.when-calendar :deep(.vc-container) {
  @apply bg-popover border-0;
}

/* When chip 的 Popover 锚点（Tooltip 与 Popover 触发器解耦用） */
.when-chip-anchor {
  @apply inline-flex;
}

/* 行上 When chip：安排/截止/未安排占位 */
.task-when-chip {
  @apply inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full;
  @apply transition-colors cursor-pointer;
}

.task-when-chip.scheduled {
  @apply text-muted-foreground;
}

.task-when-chip.overdue {
  @apply text-destructive font-medium;
}

.task-when-chip.ghost {
  @apply text-muted-foreground/50;
}

.task-when-chip:hover {
  @apply bg-accent/70 text-accent-foreground;
}

.task-when-chip.ghost:hover {
  @apply text-accent-foreground;
}
</style>
