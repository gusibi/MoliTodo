<template>
  <Popover :open="open" :align="align" content-class="p-1.5" @update:open="handleOpenChange">
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
      <div v-if="quickActions" class="when-quick-row" role="group" :aria-label="$t('tasks.quickSchedule')">
        <Button variant="ghost" size="sm" class="when-quick-btn" :disabled="saving" @click.stop="setWhenQuick('today')">
          <span>{{ $t('tasks.today') }}</span>
        </Button>
        <Button variant="ghost" size="sm" class="when-quick-btn" :disabled="saving" @click.stop="setWhenQuick('tomorrow')">
          <span>{{ $t('tasks.tomorrow') }}</span>
        </Button>
        <Button variant="ghost" size="sm" class="when-quick-btn" :disabled="saving" @click.stop="setWhenQuick('nextWeek')">
          <span>{{ $t('tasks.nextWeek') }}</span>
        </Button>
      </div>
      <div class="when-range" :class="{ 'has-quick': quickActions }">
        <ScheduleRangePicker v-model="pickerRange" :min-date="pickerMinDate"
          @update:model-value="pickerDirty = true" />
      </div>
      <div v-if="hasSchedule(task)" class="when-option when-option-clear when-picker-clear" @click.stop="clearWhen">
        <X class="h-3.5 w-3.5 when-option-icon" aria-hidden="true" />
        <span>{{ $t('tasks.clearSchedule') }}</span>
      </div>
      <p v-if="saveError" class="when-save-error" role="alert">{{ saveError }}</p>
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
import Popover from '../ui/popover/Popover.vue'
import Tooltip from '../ui/tooltip/Tooltip.vue'
import Button from '../ui/button/Button.vue'
import ScheduleRangePicker from './ScheduleRangePicker.vue'

/**
 * 行上 When chip + When 气泡（悬浮窗与 Today 行共用的就地改期入口）。
 * 点击 chip 展示范围选择器（预填当前安排），底部提供清除安排；
 * Today 行通过 quickActions 额外启用今天 / 明天 / 下周快捷项。
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
  },
  quickActions: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['updated', 'open-change'])

const { t: $t, locale } = useI18n()
const taskStore = useTaskStore()

const open = ref(false)
const pickerRange = ref({ start: null, end: null })
const pickerDirty = ref(false)
const saveError = ref('')
const saving = ref(false)

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
  // 点击 chip 直接展示范围选择器并预填当前安排；
  // 选日期/时间不会立即关闭弹层，方便一次设置开始与结束，点击外部/Escape 时统一保存一次。
  if (value) {
    pickerRange.value = {
      start: toDateValue(props.task.scheduledStartAt),
      end: toDateValue(props.task.scheduledEndAt)
    }
    pickerDirty.value = false
    saveError.value = ''
    open.value = true
    emit('open-change', true)
    return
  }
  const pendingStart = toDateValue(pickerRange.value.start)
  if (pickerDirty.value && pendingStart) {
    const pendingEnd = toDateValue(pickerRange.value.end)
    // 先提交，成功后才关闭；失败时保留弹层与已选范围，显示错误并可重试。
    void applyRange(pendingStart, pendingEnd)
    return
  }
  open.value = false
  emit('open-change', false)
}

// 区间快捷按钮：今天 / 明天 / 下周。已有安排时保留开始时刻与有效时长。
async function setWhenQuick(kind) {
  const oldStart = toDateValue(props.task.scheduledStartAt)
  const oldEnd = toDateValue(props.task.scheduledEndAt)
  const nextStart = new Date()
  nextStart.setHours(0, 0, 0, 0)
  if (kind === 'tomorrow') {
    nextStart.setDate(nextStart.getDate() + 1)
  } else if (kind === 'nextWeek') {
    // 下周：取下周一（与「下周X」口语的锚点一致）
    const diff = (1 - nextStart.getDay() + 7) % 7 || 7
    nextStart.setDate(nextStart.getDate() + diff)
  }
  if (oldStart && (oldStart.getHours() || oldStart.getMinutes())) {
    nextStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0)
  }

  let nextEnd = null
  if (oldEnd && oldStart && oldEnd.getTime() > oldStart.getTime()) {
    nextEnd = new Date(nextStart.getTime() + (oldEnd.getTime() - oldStart.getTime()))
  }
  await applyRange(nextStart, nextEnd)
}

// 一次提交开始与结束；相对提醒由应用层自动重算
async function applyRange(nextStart, nextEnd) {
  if (saving.value) return
  saving.value = true
  try {
    const target = await materializeVirtualInstance(taskStore, props.task)
    if (!target) {
      saveError.value = $t('today.saveFailed', { error: '' })
      return
    }
    const result = await taskStore.updateTask(target.id, {
      scheduledStartAt: nextStart.toISOString(),
      scheduledEndAt: nextEnd ? nextEnd.toISOString() : null
    })
    if (!result?.success) throw new Error(result?.error || '')
    saveError.value = ''
    pickerDirty.value = false
    pickerRange.value = { start: null, end: null }
    open.value = false
    emit('open-change', false)
    emit('updated', target)
  } catch (error) {
    saveError.value = $t('today.saveFailed', { error: error?.message || '' })
  } finally {
    saving.value = false
  }
}

async function clearWhen() {
  if (saving.value) return
  saving.value = true
  try {
    const target = await materializeVirtualInstance(taskStore, props.task)
    if (!target) {
      saveError.value = $t('today.saveFailed', { error: '' })
      return
    }
    const result = await taskStore.updateTask(target.id, { scheduledStartAt: null, scheduledEndAt: null })
    if (!result?.success) throw new Error(result?.error || '')
    saveError.value = ''
    pickerDirty.value = false
    pickerRange.value = { start: null, end: null }
    open.value = false
    emit('open-change', false)
    emit('updated', target)
  } catch (error) {
    saveError.value = $t('today.saveFailed', { error: error?.message || '' })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.when-popover {
  @apply flex flex-col gap-1;
}

.when-quick-row {
  @apply grid grid-cols-3 gap-0.5 rounded-lg bg-accent/40 p-0.5;
}

.when-quick-btn {
  @apply justify-center rounded-md text-muted-foreground;
}

.when-quick-btn:hover {
  @apply bg-background text-foreground shadow-sm;
}

.when-range.has-quick {
  @apply mt-1 border-t border-border/50 pt-2;
}

.when-save-error {
  @apply px-1 pt-1 text-xs text-destructive;
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

/* 面板底部的清除安排入口：与范围选择器之间留分隔 */
.when-picker-clear {
  @apply mt-1 border-t border-border/60 pt-1.5;
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
