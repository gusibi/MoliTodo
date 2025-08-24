<template>
  <div :class="['task-item-row', {
    'task-item-completed': task.status === 'done',
    'task-item-in-progress': task.status === 'doing' && !isTaskOvertime,
    'task-item-overtime': task.status === 'doing' && isTaskOvertime,
    'task-item-paused': task.status === 'paused',
    'task-item-editing': isEditing
  }]" @dblclick="!isEditing && handleEditTask" @mouseenter="isHovered = true" @mouseleave="isHovered = false">

    <!-- <button class="task-item-expand" v-if="task.metadata.note">
      <i class="fas fa-chevron-right"></i>
    </button>
    <div class="task-item-expand-placeholder" v-else></div>
     -->
    <div class="task-item-checkbox">
      <input type="checkbox" :id="`task-${task.id}`" :checked="task.status === 'done'"
        @change="handleToggleComplete(task)" @click.stop />
      <label :for="`task-${task.id}`"></label>
    </div>

    <div class="task-item-info">
      <div class="task-item-title" v-html="highlightedContent"></div>
      <div class="task-item-description" v-if="task.metadata.note">{{ task.metadata.note }}</div>
      <div class="task-item-tags">
        <!-- 重复任务徽标 -->
        <span v-if="task.recurrence" :class="['task-item-tag', 'task-item-tag-recurring', 'tooltip-container']"
          @mouseenter="showTooltip($event, getRecurrenceTooltip(task.recurrence))"
          @mouseleave="hideTooltip">
          <i class="fas fa-repeat"></i>
          {{ getRecurrenceBadge(task.recurrence) }}
        </span>
        
        <!-- 时间标签 -->
        <span v-if="task.reminderTime" :class="['task-item-tag', 'task-item-tag-reminder', 'tooltip-container', {
          'task-item-tag-overdue': isReminderOverdue
        }]" @mouseenter="showTooltip($event, `提醒时间: ${formatReminderTime(task.reminderTime)}`)"
          @mouseleave="hideTooltip">
          <i class="fas fa-calendar"></i>
          {{ formatReminderTime(task.reminderTime) }}
        </span>
        <span v-else-if="task.createdAt" class="task-item-tag task-item-tag-created tooltip-container"
          @mouseenter="showTooltip($event, `创建时间: ${formatCreatedTime(task.createdAt)}`)" @mouseleave="hideTooltip">
          <i class="fas fa-clock"></i>
          {{ formatCreatedTime(task.createdAt) }}
        </span>

        <!-- 状态标签 -->
        <span v-if="task.status === 'doing' && !isTaskOvertime" class="task-item-tag task-item-tag-status task-item-tag-doing">
          <i class="fas fa-play"></i>
          进行中 {{ formatDuration(currentDuration) }}
        </span>
        <span v-else-if="task.status === 'doing' && isTaskOvertime" class="task-item-tag task-item-tag-status task-item-tag-overtime">
          <i class="fas fa-clock"></i>
          进行中 {{ formatDuration(currentDuration) }}
        </span>
        <span v-else-if="task.status === 'paused'" class="task-item-tag task-item-tag-status task-item-tag-paused">
          <i class="fas fa-pause"></i>
          暂停中 {{ formatDuration(task.totalDuration || 0) }}
        </span>
        <span v-else-if="task.status === 'done'" class="task-item-tag task-item-tag-status task-item-tag-completed">
          <i class="fas fa-check"></i>
          用时 {{ formatDuration(task.totalDuration || 0) }}
        </span>

        <!-- 完成时间标签 -->
        <span v-if="task.completedAt" class="task-item-tag task-item-tag-completed-time">
          <i class="fas fa-check-circle"></i>
          {{ formatCompletedTime(task.completedAt) }}
        </span>
      </div>
    </div>

    <!-- 任务操作按钮 - 悬浮时显示 -->
    <div v-show="isHovered || isEditing" class="task-item-actions">
      <button v-if="task.status === 'todo'" class="task-item-btn-action task-item-btn-start"
        @click.stop="handleStartTask" title="开始">
        <i class="fas fa-play"></i>
      </button>
      <button v-if="task.status === 'doing'" class="task-item-btn-action task-item-btn-pause"
        @click.stop="handlePauseTask" title="暂停">
        <i class="fas fa-pause"></i>
      </button>
      <button v-if="task.status === 'paused'" class="task-item-btn-action task-item-btn-resume"
        @click.stop="handleResumeTask" title="继续">
        <i class="fas fa-play"></i>
      </button>
      <button v-if="task.status === 'doing' || task.status === 'paused'"
        class="task-item-btn-action task-item-btn-complete" @click.stop="handleCompleteTask" title="完成">
        <i class="fas fa-check"></i>
      </button>
      <button v-if="task.status === 'done'" class="task-item-btn-action task-item-btn-restart"
        @click.stop="handleRestartTask" title="重新开始">
        <i class="fas fa-redo"></i>
      </button>
      <button v-if="task.status !== 'done'" class="task-item-btn-action task-item-btn-edit" @click.stop="handleEditTask"
        title="编辑">
        <i class="fas fa-edit"></i>
      </button>
      <button class="task-item-btn-action task-item-btn-delete" @click.stop="handleDeleteTask" title="删除">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import { formatDuration } from '../utils/task-utils'

const taskStore = useTaskStore()

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  currentDuration: {
    type: Number,
    default: 0
  },
  isEditing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'edit',
  'show-tooltip',
  'hide-tooltip'
])

const isHovered = ref(false)

// 任务操作方法
const handleToggleComplete = async (task) => {
  if (task.status === 'done') {
    // 如果已完成，重新开始任务
    await taskStore.updateTask(task.id, { status: 'todo', completedAt: null })
  } else {
    // 如果未完成，标记为完成
    await taskStore.completeTask(task.id)
  }
}

const handleStartTask = async () => {
  console.log('开始任务 - 当前状态:', props.task.status, '任务ID:', props.task.id)
  await taskStore.startTask(props.task.id)
}

const handlePauseTask = async () => {
  console.log('暂停任务 - 当前状态:', props.task.status, '任务ID:', props.task.id)
  await taskStore.pauseTask(props.task.id)
}

const handleResumeTask = async () => {
  console.log('继续任务 - 当前状态:', props.task.status, '任务ID:', props.task.id)
  await taskStore.startTask(props.task.id) // resume 实际上就是重新开始
}

const handleCompleteTask = async () => {
  await taskStore.completeTask(props.task.id)
}

const handleRestartTask = async () => {
  await taskStore.updateTask(props.task.id, {
    status: 'todo',
    completedAt: null,
    startTime: null,
    totalDuration: 0
  })
}

const handleDeleteTask = async () => {
  if (confirm('确定要删除这个任务吗？')) {
    await taskStore.deleteTask(props.task.id)
  }
}

const handleEditTask = () => {
  // 如果任务已完成，不允许编辑
  if (props.task.status === 'done') {
    alert('已完成的任务不能编辑')
    return
  }
  emit('edit', props.task)
}

// 高亮搜索词
const highlightedContent = computed(() => {
  if (!props.searchQuery) return props.task.content

  const regex = new RegExp(`(${props.searchQuery})`, 'gi')
  return props.task.content.replace(regex, '<mark>$1</mark>')
})

// 判断提醒时间是否已过期
const isReminderOverdue = computed(() => {
  if (!props.task.reminderTime) return false
  return new Date(props.task.reminderTime) < new Date()
})

// 判断任务是否超时（进行中且已超过提醒时间）
const isTaskOvertime = computed(() => {
  if (props.task.status !== 'doing' || !props.task.reminderTime) return false
  return new Date(props.task.reminderTime) < new Date()
})

// formatDuration 已从 task-utils 导入

// 格式化提醒时间
const formatReminderTime = (timestamp) => {
  return taskStore.formatTimeDisplay(timestamp, 'reminder')
}

// 格式化创建时间
const formatCreatedTime = (timestamp) => {
  return taskStore.formatTimeDisplay(timestamp, 'created')
}

// 格式化完成时间
const formatCompletedTime = (timestamp) => {
  return taskStore.formatTimeDisplay(timestamp, 'created')
}

// 获取重复任务徽标文本
const getRecurrenceBadge = (recurrence) => {
  if (!recurrence || !recurrence.type) return ''
  
  switch (recurrence.type) {
    case 'daily':
      return 'D'
    case 'weekly':
      return 'W'
    case 'monthly':
      return 'M'
    case 'yearly':
      return 'Y'
    default:
      return 'R'
  }
}

// 获取重复任务提示文本
const getRecurrenceTooltip = (recurrence) => {
  if (!recurrence || !recurrence.type) return '重复任务'
  
  const interval = recurrence.interval || 1
  const intervalText = interval > 1 ? `每${interval}` : '每'
  
  switch (recurrence.type) {
    case 'daily':
      return `${intervalText}天重复`
    case 'weekly':
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        const dayNames = ['日', '一', '二', '三', '四', '五', '六']
        const selectedDays = recurrence.daysOfWeek.map(day => dayNames[day]).join('、')
        return `${intervalText}周的周${selectedDays}重复`
      }
      return `${intervalText}周重复`
    case 'monthly':
      return `${intervalText}月重复`
    case 'yearly':
      return `${intervalText}年重复`
    default:
      return '重复任务'
  }
}

// Tooltip 相关
const showTooltip = (event, text) => {
  // 这里可以触发父组件的 tooltip 显示逻辑
  emit('show-tooltip', { event, text })
}

const hideTooltip = () => {
  emit('hide-tooltip')
}
</script>

<style>
@import '@/assets/styles/components/task-item.css';

.task-item-tag-recurring {
  background-color: var(--color-success-light);
  color: var(--color-success);
}
</style>