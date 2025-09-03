<template>
  <div
    :class="[
      'kanban-card',
      `kanban-card--${task.status}`,
      { 'kanban-card--dragging': isDragging }
    ]"
    :draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @click="handleClick"
    tabindex="0"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <!-- 卡片头部 -->
    <div class="kanban-card-header">
      <div class="kanban-card-content">
        {{ task.content }}
      </div>
      <div class="kanban-card-actions">
        <button
          class="kanban-card-action-btn"
          @click.stop="handleEdit"
          title="编辑任务"
        >
          <i class="fas fa-edit"></i>
        </button>
      </div>
    </div>

    <!-- 卡片元信息 -->
    <div v-if="hasMetaInfo" class="kanban-card-meta">
      <!-- 提醒时间 -->
      <div v-if="task.reminderTime" class="kanban-card-meta-item">
        <i class="fas fa-bell kanban-card-meta-icon"></i>
        <span :class="getReminderTimeClass()">
          {{ getFormattedReminderTime() }}
        </span>
      </div>

      <!-- 到期时间 -->
      <div v-if="task.dueDate" class="kanban-card-meta-item">
        <i class="fas fa-calendar kanban-card-meta-icon"></i>
        <span :class="getDueDateClass()">
          {{ getFormattedDueDate() }}
        </span>
      </div>

      <!-- 时间追踪 -->
      <div v-if="hasTimeTracking" class="kanban-card-meta-item">
        <i class="fas fa-clock kanban-card-meta-icon"></i>
        <span class="kanban-card-time">
          {{ task.getFormattedDuration(true) }}
        </span>
      </div>

      <!-- 创建时间 -->
      <div class="kanban-card-meta-item">
        <i class="fas fa-calendar-plus kanban-card-meta-icon"></i>
        <span class="kanban-card-time">
          {{ getFormattedCreatedTime() }}
        </span>
      </div>
    </div>

    <!-- 标签和图标 -->
    <div v-if="hasBadges" class="kanban-card-badges">
      <!-- 备注图标 -->
      <span v-if="task.hasComment()" class="kanban-card-badge kanban-card-badge--comment">
        <i class="fas fa-comment"></i>
        备注
      </span>

      <!-- 重复任务图标 -->
      <span v-if="task.isRecurring()" class="kanban-card-badge kanban-card-badge--recurring">
        <i class="fas fa-redo"></i>
        重复
      </span>

      <!-- 时间追踪图标 -->
      <span v-if="hasTimeTracking" class="kanban-card-badge kanban-card-badge--tracking">
        <i class="fas fa-stopwatch"></i>
        计时
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  isDragging: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['drag-start', 'drag-end', 'click', 'edit'])

const isDragging = ref(false)

// 计算属性
const hasMetaInfo = computed(() => {
  return props.task.reminderTime || 
         props.task.dueDate || 
         hasTimeTracking.value || 
         true // 总是显示创建时间
})

const hasBadges = computed(() => {
  return props.task.hasComment() || 
         props.task.isRecurring() || 
         hasTimeTracking.value
})

const hasTimeTracking = computed(() => {
  return props.task.getTotalWorkDuration() > 0 || props.task.isInProgress()
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

const getFormattedReminderTime = () => {
  if (!props.task.reminderTime) return ''
  return props.task.getFormattedReminderTime()
}

const getReminderTimeClass = () => {
  if (!props.task.reminderTime) return ''
  
  const now = new Date()
  const reminderTime = new Date(props.task.reminderTime)
  
  if (reminderTime < now) {
    return 'kanban-card-time--overdue'
  } else if (reminderTime - now < 60 * 60 * 1000) { // 1小时内
    return 'kanban-card-time--due-soon'
  }
  
  return 'kanban-card-time'
}

const getFormattedDueDate = () => {
  if (!props.task.dueDate) return ''
  
  const dueDate = new Date(props.task.dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return '今天到期'
  } else if (diffDays === 1) {
    return '明天到期'
  } else if (diffDays === -1) {
    return '昨天到期'
  } else if (diffDays < 0) {
    return `${Math.abs(diffDays)}天前到期`
  } else {
    return `${diffDays}天后到期`
  }
}

const getDueDateClass = () => {
  if (!props.task.dueDate) return ''
  
  const dueDate = new Date(props.task.dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return 'kanban-card-time--overdue'
  } else if (diffDays <= 1) {
    return 'kanban-card-time--due-soon'
  }
  
  return 'kanban-card-time'
}

const getFormattedCreatedTime = () => {
  const createdAt = new Date(props.task.createdAt)
  const now = new Date()
  const diffMs = now - createdAt
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return '今天创建'
  } else if (diffDays === 1) {
    return '昨天创建'
  } else if (diffDays < 7) {
    return `${diffDays}天前创建`
  } else {
    return createdAt.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    })
  }
}
</script>

<style>
@import '@/assets/styles/components/kanban-card.css';
</style>