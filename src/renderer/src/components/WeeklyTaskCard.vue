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
      
      <!-- Task title -->
      <div 
        :class="['weekly-task-card-title', {
          'line-through text-muted-foreground': task.status === 'done'
        }]"
      >
        {{ task.content }}
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
</style>