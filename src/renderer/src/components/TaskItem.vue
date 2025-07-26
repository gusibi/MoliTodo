<template>
  <div 
    :class="['task-row', {
      completed: task.status === 'done',
      'in-progress': task.status === 'doing',
      'paused': task.status === 'paused',
      selected: isSelected
    }]" 
    @click="$emit('select', task.id, $event)" 
    @dblclick="handleEditTask" 
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false">
    
    <button class="task-expand" v-if="task.description">
      <i class="fas fa-chevron-right"></i>
    </button>
    <div class="task-expand-placeholder" v-else></div>
    
    <div class="task-checkbox">
      <input 
        type="checkbox" 
        :id="`task-${task.id}`"
        :checked="task.status === 'done'" 
        @change="handleToggleComplete(task)"
        @click.stop 
      />
      <label :for="`task-${task.id}`"></label>
    </div>
    
    <div class="task-info">
      <div class="task-title" v-html="highlightedContent"></div>
      <div class="task-description" v-if="task.description">{{ task.description }}</div>
      <div class="task-tags">
        <!-- 状态标签 -->
        <span v-if="task.status === 'doing'" class="tag tag-status tag-doing">
          <i class="fas fa-play"></i>
          进行中 {{ formatDuration(currentDuration) }}
        </span>
        <span v-else-if="task.status === 'paused'" class="tag tag-status tag-paused">
          <i class="fas fa-pause"></i>
          暂停中 {{ formatDuration(task.totalDuration || 0) }}
        </span>
        <span v-else-if="task.status === 'done'" class="tag tag-status tag-completed">
          <i class="fas fa-check"></i>
          用时 {{ formatDuration(task.totalDuration || 0) }}
        </span>
        
        <!-- 时间标签 -->
        <span 
          v-if="task.reminderTime" 
          class="tag tag-reminder tooltip-container" 
          @mouseenter="showTooltip($event, `提醒时间: ${formatReminderTime(task.reminderTime)}`)"
          @mouseleave="hideTooltip">
          <i class="fas fa-calendar"></i>
          {{ formatReminderTime(task.reminderTime) }}
        </span>
        <span 
          v-else-if="task.createdAt" 
          class="tag tag-created tooltip-container"
          @mouseenter="showTooltip($event, `创建时间: ${formatCreatedTime(task.createdAt)}`)"
          @mouseleave="hideTooltip">
          <i class="fas fa-clock"></i>
          {{ formatCreatedTime(task.createdAt) }}
        </span>
        
        <!-- 完成时间标签 -->
        <span v-if="task.completedAt" class="tag tag-completed-time">
          <i class="fas fa-check-circle"></i>
          {{ formatCompletedTime(task.completedAt) }}
        </span>
      </div>
    </div>
    
    <!-- 任务操作按钮 - 悬浮时显示 -->
    <div v-show="isHovered || isSelected" class="task-actions">
      <button 
        v-if="task.status === 'todo'" 
        class="btn-action btn-start" 
        @click.stop="handleStartTask" 
        title="开始">
        <i class="fas fa-play"></i>
      </button>
      <button 
        v-if="task.status === 'doing'" 
        class="btn-action btn-pause" 
        @click.stop="handlePauseTask" 
        title="暂停">
        <i class="fas fa-pause"></i>
      </button>
      <button 
        v-if="task.status === 'paused'" 
        class="btn-action btn-resume" 
        @click.stop="handleResumeTask" 
        title="继续">
        <i class="fas fa-play"></i>
      </button>
      <button 
        v-if="task.status === 'doing' || task.status === 'paused'" 
        class="btn-action btn-complete" 
        @click.stop="handleCompleteTask" 
        title="完成">
        <i class="fas fa-check"></i>
      </button>
      <button 
        v-if="task.status === 'done'" 
        class="btn-action btn-restart" 
        @click.stop="handleRestartTask" 
        title="重新开始">
        <i class="fas fa-redo"></i>
      </button>
      <button 
        class="btn-action btn-edit" 
        @click.stop="handleEditTask" 
        title="编辑">
        <i class="fas fa-edit"></i>
      </button>
      <button 
        class="btn-action btn-delete" 
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
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays === 1) {
    return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays === -1) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

// 格式化创建时间
const formatCreatedTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays === 1) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric'
    })
  }
}

// 格式化完成时间
const formatCompletedTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return `今天完成`
  } else if (diffDays === 1) {
    return `昨天完成`
  } else if (diffDays < 7) {
    return `${diffDays}天前完成`
  } else {
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric'
    }) + '完成'
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
@import '../assets/styles/components/task-item.css';

</style>