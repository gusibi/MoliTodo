<template>
  <div 
    :class="['weekly-task-card', 'weekly-task-card-base', {
      'weekly-task-card-todo': task.status === 'todo',
      'weekly-task-card-doing': task.status === 'doing',
      'weekly-task-card-paused': task.status === 'paused',
      'weekly-task-card-done': task.status === 'done'
    }]"
    @click="handleEdit"
    @mouseenter="handleShowTooltip"
    @mouseleave="handleHideTooltip"
  >
    <!-- Status indicator bar -->
    <div 
      :class="['weekly-task-card-status-bar', {
        'bg-border': task.status === 'todo',
        'bg-warning': task.status === 'doing',
        'bg-muted-foreground': task.status === 'paused',
        'bg-success': task.status === 'done'
      }]"
    ></div>
    
    <!-- Task content -->
    <div class="weekly-task-card-content">
      <!-- Time display -->
      <div v-if="showTime && task.reminderTime" class="weekly-task-card-time">
        {{ formatTime(task.reminderTime) }}
      </div>
      
      <!-- Task title with recurring badge -->
      <div class="weekly-task-card-title-row">
        <div 
          :class="['weekly-task-card-title', {
            'line-through text-muted-foreground': task.status === 'done'
          }]"
        >
          {{ truncatedContent }}
        </div>
        
        <!-- Recurring badge -->
        <span v-if="task.recurrence" class="weekly-task-card-recurring-badge">
          {{ getRecurrenceBadge(task.recurrence) }}
        </span>
      </div>
      
      <!-- Status icon -->
      <div class="weekly-task-card-status-icon">
        <i :class="{
          'fas fa-circle': task.status === 'todo',
          'fas fa-play-circle': task.status === 'doing',
          'fas fa-pause-circle': task.status === 'paused',
          'fas fa-check-circle': task.status === 'done'
        }"></i>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  showTime: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'edit',
  'show-tooltip',
  'hide-tooltip'
])

// Computed property for truncated content
const truncatedContent = computed(() => {
  if (!props.task.content) return ''
  return props.task.content.length > 12 
    ? props.task.content.substring(0, 12) + '...' 
    : props.task.content
})

// Format time for display
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

// Get recurrence badge text
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

// Handle edit click
const handleEdit = () => {
  emit('edit', props.task)
}

// Handle tooltip show
const handleShowTooltip = (event) => {
  const tooltipText = `${props.task.content}${props.task.description ? '\n' + props.task.description : ''}`
  emit('show-tooltip', { event, text: tooltipText })
}

// Handle tooltip hide
const handleHideTooltip = () => {
  emit('hide-tooltip')
}
</script>

<style>
@import '../assets/styles/components/weekly-view.css';

.weekly-task-card-title-row {
  @apply flex items-center justify-between gap-1;
}

.weekly-task-card-title {
  @apply flex-1 min-w-0;
}

.weekly-task-card-recurring-badge {
  @apply inline-flex items-center justify-center;
  @apply w-4 h-4 text-[9px] font-medium;
  @apply bg-green-100 text-green-700 rounded-sm;
  @apply flex-shrink-0;
}

.dark .weekly-task-card-recurring-badge {
  @apply bg-green-900/30 text-green-400;
}
</style>