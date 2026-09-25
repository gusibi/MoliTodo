<template>
  <Popover :open="open" :align="align" content-class="p-1 w-52" @update:open="handleOpenChange">
    <template #trigger>
      <span class="when-chip-anchor">
        <Tooltip v-if="task.reminderTime">
          <template #trigger>
            <button type="button" :class="['task-reminder-pill', { 'overdue': isOverdue }]">
              <AlarmClock class="h-2.5 w-2.5" aria-hidden="true" />
              <span>{{ formatReminderTime(task.reminderTime) }}</span>
            </button>
          </template>
          {{ $t('tasks.reminderTime') }}
        </Tooltip>
        <button v-else type="button" :title="$t('floatView.setReminder')"
          class="task-reminder-pill task-reminder-add">
          <AlarmClock class="h-2.5 w-2.5" aria-hidden="true" />
          <span>{{ $t('floatView.reminderShort') }}</span>
        </button>
      </span>
    </template>
    <div class="reminder-popover">
      <template v-if="!pickerVisible">
        <div v-for="option in customReminderOptions" :key="option.id" class="reminder-option"
          @click.stop="applyPreset(option)">
          <AlarmClock class="h-3.5 w-3.5 reminder-option-icon" aria-hidden="true" />
          <span>{{ option.label }}</span>
        </div>
        <div class="reminder-option reminder-option-picker" @click.stop="openPicker">
          <CalendarClock class="h-3.5 w-3.5 reminder-option-icon" aria-hidden="true" />
          <span>{{ $t('tasks.customReminder') }}</span>
        </div>
        <div v-if="task.reminderTime" class="reminder-option reminder-option-clear" @click.stop="clearReminder">
          <X class="h-3.5 w-3.5 reminder-option-icon" aria-hidden="true" />
          <span>{{ $t('tasks.clearReminder') }}</span>
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
import { AlarmClock, CalendarClock, X } from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import { storeToRefs } from 'pinia'
import { materializeVirtualInstance } from '@/utils/today-agenda'
import { isReminderOverdue } from '@/utils/task-utils'
import { useTheme } from '@/composables/useTheme'
import Popover from '../ui/popover/Popover.vue'
import Tooltip from '../ui/tooltip/Tooltip.vue'

/**
 * 行上提醒 pill + 提醒气泡（悬浮窗与 Today 行共用的提醒入口）。
 * 预设/自定义时间/清除；虚拟重复实例先物化再设置。
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

const taskStore = useTaskStore()
const { customReminderOptions } = storeToRefs(taskStore)
const { isDark } = useTheme()

const open = ref(false)
const pickerVisible = ref(false)
const pickerValue = ref(null)

const pickerMinDate = computed(() => new Date())

const isOverdue = computed(() => isReminderOverdue(props.task.reminderTime))

const formatReminderTime = (date) => taskStore.formatTimeDisplay(date, 'reminder')

function handleOpenChange(value) {
  open.value = value
  if (value) {
    pickerVisible.value = false
    pickerValue.value = null
    ensureOptionsLoaded()
  }
  emit('open-change', value)
}

async function ensureOptionsLoaded() {
  if (!customReminderOptions.value || customReminderOptions.value.length === 0) {
    await taskStore.loadCustomReminderOptions()
  }
}

// 预设提醒：相对时间从现在起算，绝对时间已过则顺延到明天（沿用原弹窗逻辑）
async function applyPreset(option) {
  const now = new Date()
  let reminderTime = null

  if (option.type === 'relative') {
    let milliseconds = 0
    switch (option.unit) {
      case 'minutes':
        milliseconds = option.value * 60 * 1000
        break
      case 'hours':
        milliseconds = option.value * 60 * 60 * 1000
        break
      case 'days':
        milliseconds = option.value * 24 * 60 * 60 * 1000
        break
    }
    reminderTime = new Date(now.getTime() + milliseconds)
  } else if (option.type === 'absolute') {
    const targetDate = new Date(now)
    targetDate.setDate(now.getDate() + option.dayOffset)
    const [hours, minutes] = option.time.split(':').map(Number)
    targetDate.setHours(hours, minutes, 0, 0)
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1)
    }
    reminderTime = targetDate
  }

  if (!reminderTime) return
  await setReminder(reminderTime)
}

async function setReminder(date) {
  const target = await materializeVirtualInstance(taskStore, props.task)
  if (!target) return
  try {
    await window.electronAPI.tasks.setReminder(target.id, date.toISOString())
    open.value = false
    pickerVisible.value = false
    emit('updated', target)
  } catch (error) {
    console.error('设置提醒失败:', error)
  }
}

function openPicker() {
  // 无提醒时不预填时间：预填会让选择同一时刻不触发 update（值未变化）
  pickerValue.value = props.task.reminderTime ? new Date(props.task.reminderTime) : null
  pickerVisible.value = true
}

async function setFromPicker() {
  if (!pickerValue.value) return
  const date = new Date(pickerValue.value)
  if (Number.isNaN(date.getTime()) || date <= new Date()) return
  await setReminder(date)
}

async function clearReminder() {
  const target = await materializeVirtualInstance(taskStore, props.task)
  if (!target) return
  try {
    await window.electronAPI.tasks.clearReminder(target.id)
    open.value = false
    pickerVisible.value = false
    emit('updated', target)
  } catch (error) {
    console.error('清除提醒失败:', error)
  }
}
</script>

<style scoped>
.when-chip-anchor {
  @apply inline-flex;
}

/* When 气泡内的日历（与 When 气泡同一交互模式） */
.when-calendar {
  @apply p-1;
}

.when-calendar :deep(.vc-container) {
  @apply bg-popover border-0;
}

.reminder-popover {
  @apply flex flex-col;
}

.reminder-option {
  @apply flex items-center gap-2 px-2 py-1.5 text-xs rounded-md;
  @apply text-popover-foreground hover:bg-accent;
  @apply transition-colors cursor-pointer;
}

.reminder-option-icon {
  @apply w-3.5 h-3.5 text-primary flex-shrink-0;
}

.reminder-option-clear {
  @apply text-destructive/90;
}

.reminder-option-clear .reminder-option-icon {
  @apply text-destructive/70;
}

.reminder-option-clear:hover {
  @apply bg-destructive/10 text-destructive;
}

/* 行上提醒 pill：小闹钟图标 + 时间/占位 */
.task-reminder-pill {
  @apply inline-flex items-center gap-1 text-[11px] rounded-full px-1 py-0.5;
  @apply text-muted-foreground cursor-pointer transition-colors;
}

.task-reminder-pill:hover {
  @apply bg-accent/70 text-accent-foreground;
}

.task-reminder-pill.overdue {
  @apply text-destructive font-medium;
}

/* 无提醒时的「+ 提醒」入口：hover / focus 时与提醒 pill 同位显现（由所在行的样式控制） */
.task-reminder-add {
  @apply text-muted-foreground/40;
  display: none;
}
</style>
