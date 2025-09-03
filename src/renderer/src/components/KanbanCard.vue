<template>
  <div :class="[
    'kanban-card',
    `kanban-card--${task.status}`,
    { 'kanban-card--dragging': isDragging }
  ]" :draggable="true" @dragstart="handleDragStart" @dragend="handleDragEnd" @click="handleClick" tabindex="0"
    @keydown.enter="handleClick" @keydown.space.prevent="handleClick">
    <!-- 卡片头部 -->
    <div class="kanban-card-header">
      <div class="kanban-card-content" v-html="getFormattedContent()">
      </div>
      <!-- <div class="kanban-card-actions">
        <button class="kanban-card-action-btn" @click.stop="handleEdit" title="编辑任务">
          <i class="fas fa-edit"></i>
        </button>
      </div> -->
    </div>

    <!-- 任务描述 -->
    <div v-if="task.metadata?.note" class="kanban-card-description">
      {{ task.metadata.note }}
    </div>

    <!-- 时间信息 -->
    <div v-if="hasTimeInfo" class="kanban-card-time-info">
      <!-- 提醒时间和任务状态时间在同一行 -->
      <div class="kanban-card-time-row">
        <!-- 提醒时间 -->
        <div v-if="task.reminderTime" class="kanban-card-reminder-time" :class="{
          'kanban-card-time-overdue': new Date(task.reminderTime) < new Date() && task.status !== 'done'
        }">
          <i class="fas fa-calendar"></i>
          <span>{{ getFormattedReminderTime() }}</span>
        </div>

        <!-- 进行时间 -->
        <div v-if="task.status === 'doing' && !isTaskOvertime(task)" class="kanban-card-time kanban-card-time-doing">
          <i class="fas fa-play"></i>
          <span>{{ getFormattedDuration() }}</span>
        </div>
        <div v-else-if="task.status === 'doing' && isTaskOvertime(task)"
          class="kanban-card-time kanban-card-time-overtime">
          <i class="fas fa-clock"></i>
          <span>{{ getFormattedDuration() }}</span>
        </div>
        <div v-else-if="task.status === 'paused'" class="kanban-card-time kanban-card-time-paused">
          <i class="fas fa-pause"></i>
          <span>{{ getFormattedDuration() }}</span>
        </div>
        <div v-else-if="task.status === 'done' && task.totalDuration"
          class="kanban-card-time kanban-card-time-completed">
          <i class="fas fa-check"></i>
          <span>{{ getFormattedDuration() }}</span>
        </div>
      </div>
    </div>

    <!-- 任务操作按钮 -->
    <!-- <div class="kanban-card-actions-bottom">
      <button v-if="task.status === 'todo'" class="kanban-card-btn kanban-card-btn-start"
        @click.stop="handleStartTask" title="开始">
        <i class="fas fa-play"></i>
      </button>
      <button v-if="task.status === 'doing'" class="kanban-card-btn kanban-card-btn-pause"
        @click.stop="handlePauseTask" title="暂停">
        <i class="fas fa-pause"></i>
      </button>
      <button v-if="task.status === 'paused'" class="kanban-card-btn kanban-card-btn-resume"
        @click.stop="handleResumeTask" title="继续">
        <i class="fas fa-play"></i>
      </button>
      <button v-if="task.status === 'done'" class="kanban-card-btn kanban-card-btn-restart"
        @click.stop="handleRestartTask" title="重新开始">
        <i class="fas fa-redo"></i>
      </button>
      <button v-if="task.status === 'done'" class="kanban-card-btn kanban-card-btn-delete" 
        @click.stop="handleDeleteTask" title="删除">
        <i class="fas fa-trash"></i>
      </button>
    </div> -->
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatReminderTime, formatDuration, getCurrentDuration, isTaskOvertime } from '../utils/task-utils'
import { useTaskStore } from '@/store/taskStore'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  isDragging: {
    type: Boolean,
    default: false
  },
  timeUpdateTrigger: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['drag-start', 'drag-end', 'click', 'edit'])

const isDragging = ref(false)
const taskStore = useTaskStore()

// 计算属性
const hasTimeInfo = computed(() => {
  return props.task.reminderTime ||
    props.task.status === 'doing' ||
    props.task.status === 'paused' ||
    (props.task.status === 'done' && props.task.totalDuration)
})

// 方法
const handleDragStart = (event) => {
  isDragging.value = true
  event.dataTransfer.setData('application/json', JSON.stringify({
    id: props.task.id,
    status: props.task.status
  }))
  event.dataTransfer.effectAllowed = 'move'
  emit('drag-start', props.task)
}

const handleDragEnd = () => {
  isDragging.value = false
  emit('drag-end')
}

const handleClick = () => {
  emit('click', props.task)
}

const handleEdit = () => {
  emit('edit', props.task)
}

// 获取任务当前持续时间（包含响应式更新触发器）
const getCurrentDurationWithTrigger = (task) => {
  props.timeUpdateTrigger // 触发响应式更新
  return getCurrentDuration(task)
}

const getFormattedReminderTime = () => {
  if (!props.task.reminderTime) return ''
  return formatReminderTime(props.task.reminderTime)
}

const getFormattedDuration = () => {
  return formatDuration(getCurrentDurationWithTrigger(props.task))
}

// 任务操作方法
const handleStartTask = async () => {
  try {
    await taskStore.startTask(props.task.id)
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const handlePauseTask = async () => {
  try {
    await taskStore.pauseTask(props.task.id)
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const handleResumeTask = async () => {
  try {
    await taskStore.startTask(props.task.id) // resume 实际上就是重新开始
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

const handleDeleteTask = async () => {
  if (confirm('确定要删除这个任务吗？')) {
    await taskStore.deleteTask(props.task.id)
  }
}

const getFormattedContent = () => {
  if (!props.task.content) return ''
  // 将换行符转换为 HTML 换行标签，并转义其他 HTML 字符
  return props.task.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
}
</script>

<style>
@import '@/assets/styles/components/kanban-card.css';
</style>