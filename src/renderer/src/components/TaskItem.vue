<template>
  <div 
    :class="['task-item-row', {
      'task-item-completed': task.status === 'done',
      'task-item-in-progress': task.status === 'doing',
      'task-item-paused': task.status === 'paused',
      'task-item-selected': isSelected
    }]" 
    @click="$emit('select', task.id, $event)" 
    @dblclick="handleEditTask" 
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false">
    
    <button class="task-item-expand" v-if="task.description">
      <i class="fas fa-chevron-right"></i>
    </button>
    <div class="task-item-expand-placeholder" v-else></div>
    
    <div class="task-item-checkbox">
      <input 
        type="checkbox" 
        :id="`task-${task.id}`"
        :checked="task.status === 'done'" 
        @change="handleToggleComplete(task)"
        @click.stop 
      />
      <label :for="`task-${task.id}`"></label>
    </div>
    
    <div class="task-item-info">
      <div class="task-item-title" v-html="highlightedContent"></div>
      <div class="task-item-description" v-if="task.description">{{ task.description }}</div>
      <div class="task-item-tags">
        <!-- 状态标签 -->
        <span v-if="task.status === 'doing'" class="task-item-tag task-item-tag-status task-item-tag-doing">
          <i class="fas fa-play"></i>
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
        
        <!-- 时间标签 -->
        <span 
          v-if="task.reminderTime" 
          class="task-item-tag task-item-tag-reminder tooltip-container" 
          @mouseenter="showTooltip($event, `提醒时间: ${formatReminderTime(task.reminderTime)}`)"
          @mouseleave="hideTooltip">
          <i class="fas fa-calendar"></i>
          {{ formatReminderTime(task.reminderTime) }}
        </span>
        <span 
          v-else-if="task.createdAt" 
          class="task-item-tag task-item-tag-created tooltip-container"
          @mouseenter="showTooltip($event, `创建时间: ${formatCreatedTime(task.createdAt)}`)"
          @mouseleave="hideTooltip">
          <i class="fas fa-clock"></i>
          {{ formatCreatedTime(task.createdAt) }}
        </span>
        
        <!-- 完成时间标签 -->
        <span v-if="task.completedAt" class="task-item-tag task-item-tag-completed-time">
          <i class="fas fa-check-circle"></i>
          {{ formatCompletedTime(task.completedAt) }}
        </span>
      </div>
    </div>
    
    <!-- 任务操作按钮 - 悬浮时显示 -->
    <div v-show="isHovered || isSelected" class="task-item-actions">
      <button 
        v-if="task.status === 'todo'" 
        class="task-item-btn-action task-item-btn-start" 
        @click.stop="handleStartTask" 
        title="开始">
        <i class="fas fa-play"></i>
      </button>
      <button 
        v-if="task.status === 'doing'" 
        class="task-item-btn-action task-item-btn-pause" 
        @click.stop="handlePauseTask" 
        title="暂停">
        <i class="fas fa-pause"></i>
      </button>
      <button 
        v-if="task.status === 'paused'" 
        class="task-item-btn-action task-item-btn-resume" 
        @click.stop="handleResumeTask" 
        title="继续">
        <i class="fas fa-play"></i>
      </button>
      <button 
        v-if="task.status === 'doing' || task.status === 'paused'" 
        class="task-item-btn-action task-item-btn-complete" 
        @click.stop="handleCompleteTask" 
        title="完成">
        <i class="fas fa-check"></i>
      </button>
      <button 
        v-if="task.status === 'done'" 
        class="task-item-btn-action task-item-btn-restart" 
        @click.stop="handleRestartTask" 
        title="重新开始">
        <i class="fas fa-redo"></i>
      </button>
      <button 
        class="task-item-btn-action task-item-btn-edit" 
        @click.stop="handleEditTask" 
        title="编辑">
        <i class="fas fa-edit"></i>
      </button>
      <button 
        class="task-item-btn-action task-item-btn-delete" 
        @click.stop="handleDeleteTask" 
        title="删除">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTaskStore } from '../store/taskStore'

const taskStore = useTaskStore()

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  },
  currentDuration: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'select',
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
  emit('edit', props.task)
}

// 高亮搜索词
const highlightedContent = computed(() => {
  if (!props.searchQuery) return props.task.content
  
  const regex = new RegExp(`(${props.searchQuery})`, 'gi')
  return props.task.content.replace(regex, '<mark>$1</mark>')
})

// 格式化持续时间
const formatDuration = (duration) => {
  if (!duration) return '0分钟'
  
  const hours = Math.floor(duration / 3600000)
  const minutes = Math.floor((duration % 3600000) / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`
  } else {
    return `${seconds}秒`
  }
}

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
@import '../assets/styles/components/task-item.css';

</style>