<template>
  <div class="flat-task-item-wrapper">
    <li
      class="flat-task-item"
      :class="{
        'flat-task-item-completed': task.status === 'done',
        'flat-task-item-editing': isEditing,
        'flat-task-item-hovered': isHovered,
        'flat-task-item-dragging': isDragging,
        'flat-task-item-selected': isSelected
      }"
      @click="handleTaskClick"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
      draggable="true"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <!-- 状态指示小红点（装饰性，语义由文案与图标承担） -->
      <div
        class="flat-task-status-indicator"
        aria-hidden="true"
        :class="{
          'flat-task-status-todo': task.status === 'todo',
          'flat-task-status-doing': task.status === 'doing' && !isTaskOvertime(task),
          'flat-task-status-overtime': task.status === 'doing' && isTaskOvertime(task),
          'flat-task-status-paused': task.status === 'paused',
          'flat-task-status-done': task.status === 'done'
        }"
      ></div>

      <!-- 任务左侧部分（包含勾选框和文本） -->
      <div class="flat-task-left">
        <!-- 多选模式下且显示选择复选框时 -->
        <div v-if="showSelectCheckbox" class="flat-task-select-checkbox" @click.stop>
          <Checkbox :id="`select-task-${task.id}`" :model-value="isSelected" :label="task.content"
            @update:model-value="$emit('select-change')" />
        </div>
        <div v-else class="flat-task-checkbox" @click.stop>
          <Checkbox :id="`flat-task-${task.id}`" :model-value="task.status === 'done'"
            indicator-class="ui-checkbox-indicator-flat"
            :label="task.status === 'done' ? $t('tasks.markIncomplete') : $t('tasks.markComplete')"
            @update:model-value="handleToggleComplete" />
        </div>

        <!-- 任务详情 -->
        <div class="flat-task-details">
          <div class="flat-task-title" v-html="getHighlightedContent(task)"></div>
          <div v-if="task.metadata?.note" class="flat-task-description" v-html="getHighlightedNote(task)"></div>

          <!-- 时间信息 -->
          <div class="flat-task-time-info">
            <!-- 重复任务图标（模板或实例） -->
            <div v-if="task.recurrence || task.seriesId" class="flat-task-recurring-icon">
              <Repeat class="h-icon-sm w-icon-sm" />
            </div>

            <!-- 安排 / 截止时间 -->
            <div
              class="flat-task-reminder-time"
              v-if="formatTaskTimeInfo(task)"
              :class="{ 'flat-task-time-overdue': isTaskTimeOverdue(task) }"
            >
              <Calendar class="h-icon-sm w-icon-sm" />
              <span>{{ formatTaskTimeInfo(task) }}</span>
            </div>

            <!-- 附加徽标（分组原因 / 重复任务等） -->
            <span
              v-for="(badge, index) in badges"
              :key="index"
              class="flat-task-badge"
              :class="badge.tone ? `flat-task-badge-${badge.tone}` : ''"
            >
              {{ badge.text }}
            </span>

            <!-- 进行时间 -->
            <div v-if="task.status === 'doing' && !isTaskOvertime(task)" class="flat-task-time flat-task-time-doing">
              <Play class="h-icon-sm w-icon-sm" />
              <span>{{ formatDuration(getCurrentDurationWithTrigger(task)) }}</span>
            </div>
            <div v-else-if="task.status === 'doing' && isTaskOvertime(task)"
              class="flat-task-time flat-task-time-overtime">
              <Clock class="h-icon-sm w-icon-sm" />
              <span>{{ formatDuration(getCurrentDurationWithTrigger(task)) }}</span>
            </div>
            <div v-else-if="task.status === 'paused'" class="flat-task-time flat-task-time-paused">
              <Pause class="h-icon-sm w-icon-sm" />
              <span>{{ formatDuration(task.totalDuration || 0) }}</span>
            </div>
            <div v-else-if="task.status === 'done' && task.totalDuration"
              class="flat-task-time flat-task-time-completed">
              <Check class="h-icon-sm w-icon-sm" />
              <span>{{ formatDuration(task.totalDuration) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 任务右侧操作 - 单行水平对齐；紧凑外观不挤动正文 -->
      <div class="flat-task-right flat-task-actions-reveal">
        <IconButton
          v-if="task.status === 'todo'"
          size="icon-sm"
          class="text-muted-foreground hover:bg-success/10 hover:text-success"
          :label="$t('tasks.start')"
          @click.stop="handleStartTask"
        >
          <Play class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          v-if="task.status === 'doing'"
          size="icon-sm"
          class="text-muted-foreground hover:bg-warning/10 hover:text-warning"
          :label="$t('tasks.pause')"
          @click.stop="handlePauseTask"
        >
          <Pause class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          v-if="task.status === 'paused'"
          size="icon-sm"
          class="text-muted-foreground hover:bg-success/10 hover:text-success"
          :label="$t('tasks.resume')"
          @click.stop="handleResumeTask"
        >
          <Play class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          v-if="task.status === 'done'"
          size="icon-sm"
          class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          :label="$t('tasks.restart')"
          @click.stop="handleRestartTask"
        >
          <RotateCcw class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          v-if="task.status === 'done'"
          size="icon-sm"
          class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          :label="$t('tasks.deleteTask')"
          @click.stop="handleDeleteTask($event)"
        >
          <Trash2 class="h-icon-sm w-icon-sm" />
        </IconButton>
      </div>
    </li>
  </div>
</template>

<script setup>
import { Calendar, Check, Clock, Pause, Play, Repeat, RotateCcw, Trash2 } from '@lucide/vue'
import { isTaskOvertime, formatDuration, formatReminderTime, getCurrentDuration } from '../utils/task-utils'
import { useTaskStore } from '@/store/taskStore'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isVirtualInstance } from '../utils/today-agenda.js'
import { localeCode } from '../utils/locale-format.js'
import Checkbox from './ui/checkbox/Checkbox.vue'
import IconButton from './ui/button/IconButton.vue'

const { t, locale } = useI18n()

// 任务时间展示：优先安排（开始[-结束]），其次截止（有具体时刻显示时刻，否则只显示日期）
const formatTaskTimeInfo = (task) => {
  if (!task) return ''
  const code = localeCode(locale.value)
  if (task.scheduledStartAt) {
    let text = formatReminderTime(task.scheduledStartAt)
    if (task.scheduledEndAt) {
      const end = new Date(task.scheduledEndAt)
      const start = new Date(task.scheduledStartAt)
      const sameDay = start.toDateString() === end.toDateString()
      const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
      text += sameDay
        ? ` – ${endTime}`
        : ` – ${end.toLocaleDateString(code, { month: 'short', day: 'numeric' })} ${endTime}`
    }
    return text
  }
  if (task.dueDate) {
    if (task.dueTime) {
      return t('tasks.deadlinePrefix', { time: formatReminderTime(`${task.dueDate}T${task.dueTime}:00`) })
    }
    const date = new Date(`${task.dueDate}T00:00:00`)
    return t('tasks.deadlinePrefix', { time: date.toLocaleDateString(code, { month: 'short', day: 'numeric' }) })
  }
  return ''
}

const isTaskTimeOverdue = (task) => {
  if (!task || task.status === 'done' || !task.dueDate) return false
  let boundary
  if (task.dueTime) {
    boundary = new Date(`${task.dueDate}T${task.dueTime}:00`)
  } else {
    boundary = new Date(`${task.dueDate}T00:00:00`)
    boundary.setDate(boundary.getDate() + 1)
  }
  return new Date() >= boundary
}

// 定义 props
const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  timeUpdateTrigger: {
    type: Number,
    default: 0
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  isHovered: {
    type: Boolean,
    default: false
  },
  isMultiSelectMode: {
    type: Boolean,
    default: false
  },
  showSelectCheckbox: {
    type: Boolean,
    default: false
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  badges: {
    type: Array,
    default: () => []
  }
})

// 定义事件
const emit = defineEmits([
  'task-click',
  'select-change',
  'mouseenter',
  'mouseleave',
  'drag-start',
  'drag-end',
  'delete-request'
])

// 使用 taskStore
const taskStore = useTaskStore()

// 虚拟重复实例：操作需路由到重复实例接口（先物化再执行状态机）
const isVirtual = computed(() => isVirtualInstance(props.task))

// 物化当前虚拟实例并返回真实任务行
const materializeVirtual = async () => {
  const result = await taskStore.updateRecurringInstance(
    props.task.seriesId,
    props.task.occurrenceDate,
    {}
  )
  return result && result.success ? result.task : null
}

// 拖拽相关响应式数据
const isDragging = ref(false)

// 拖拽事件处理
const handleDragStart = (event) => {
  isDragging.value = true
  // 设置拖拽数据
  event.dataTransfer.setData('application/json', JSON.stringify({
    taskId: props.task.id,
    taskContent: props.task.content,
    currentListId: props.task.listId
  }))
  event.dataTransfer.effectAllowed = 'move'

  // 发送拖拽开始事件
  emit('drag-start', props.task)
}

const handleDragEnd = () => {
  isDragging.value = false
  // 发送拖拽结束事件
  emit('drag-end', props.task)
}

// 获取任务当前持续时间（包含响应式更新触发器）
const getCurrentDurationWithTrigger = (task) => {
  props.timeUpdateTrigger // 触发响应式更新
  return getCurrentDuration(task)
}

// 获取高亮内容
const getHighlightedContent = (task) => {
  if (!props.searchQuery) return task.content
  const regex = new RegExp(`(${props.searchQuery})`, 'gi')
  return task.content.replace(regex, '<mark>$1</mark>')
}

// 获取高亮备注内容
const getHighlightedNote = (task) => {
  if (!task.metadata?.note || !props.searchQuery) return task.metadata?.note || ''
  const regex = new RegExp(`(${props.searchQuery})`, 'gi')
  return task.metadata.note.replace(regex, '<mark>$1</mark>')
}

// 事件处理函数
const handleTaskClick = () => {
  emit('task-click', props.task)
}

// 任务操作方法 - 直接调用 taskStore
const handleToggleComplete = async () => {
  try {
    if (isVirtual.value) {
      // 虚拟重复实例：取消完成不存在（虚拟实例总是未完成）
      await taskStore.completeRecurringInstance(props.task.seriesId, props.task.occurrenceDate)
      return
    }
    if (props.task.status === 'done') {
      // 如果已完成，重新开始任务
      await taskStore.updateTask(props.task.id, { status: 'todo', completedAt: null })
    } else {
      // 如果未完成，标记为完成
      await taskStore.completeTask(props.task.id)
    }
  } catch (error) {
    console.error('切换任务完成状态失败:', error)
  }
}

const handleStartTask = async () => {
  try {
    if (isVirtual.value) {
      const materialized = await materializeVirtual()
      if (materialized) await taskStore.startTask(materialized.id)
      return
    }
    await taskStore.startTask(props.task.id)
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const handlePauseTask = async () => {
  try {
    if (isVirtual.value) {
      const materialized = await materializeVirtual()
      if (materialized) await taskStore.pauseTask(materialized.id)
      return
    }
    await taskStore.pauseTask(props.task.id)
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const handleResumeTask = async () => {
  try {
    await handleStartTask()
  } catch (error) {
    console.error('继续任务失败:', error)
  }
}

const handleRestartTask = async () => {
  try {
    await taskStore.updateTask(props.task.id, {
      status: 'todo',
      completedAt: null,
      startTime: null,
      totalDuration: 0
    })
  } catch (error) {
    console.error('重新开始任务失败:', error)
  }
}

const handleDeleteTask = (event) => {
  // 删除统一走外部 AlertDialog，携带触发控件以便成功/取消后恢复焦点
  emit('delete-request', { task: props.task, trigger: event?.currentTarget || null })
}
</script>

<style>
@import '@/assets/styles/components/flat-task-list.css';
</style>
