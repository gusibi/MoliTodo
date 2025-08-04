<template>
  <div class="weekly-column" :class="{ 'weekly-column-today': isToday }">
    <!-- Day header -->
    <div class="weekly-column-header">
      <div class="weekly-column-day-name">{{ day.dayName }}</div>
      <div class="weekly-column-day-number" :class="{ 'weekly-column-day-number-today': isToday }">
        {{ day.dayNumber }}
      </div>
    </div>
    
    <!-- Tasks container -->
    <div class="weekly-column-tasks">
      <!-- Tasks list -->
      <div v-if="sortedTasks.length > 0" class="weekly-column-task-list">
        <WeeklyTaskCard
          v-for="task in sortedTasks"
          :key="task.id"
          :task="task"
          :show-time="true"
          @edit="handleEditTask"
          @show-tooltip="handleShowTooltip"
          @hide-tooltip="handleHideTooltip"
        />
      </div>
      
      <!-- Empty state -->
      <div v-else class="weekly-column-empty">
        <div class="weekly-column-empty-icon">📅</div>
        <div class="weekly-column-empty-text">无任务</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import WeeklyTaskCard from './WeeklyTaskCard.vue'

const props = defineProps({
  day: {
    type: Object,
    required: true,
    validator: (day) => {
      return day && 
             typeof day.date !== 'undefined' &&
             typeof day.dayName === 'string' &&
             typeof day.dayNumber === 'number' &&
             Array.isArray(day.tasks)
    }
  },
  isToday: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'edit-task',
  'show-tooltip',
  'hide-tooltip'
])

// Sort tasks by reminder time
const sortedTasks = computed(() => {
  if (!props.day.tasks || props.day.tasks.length === 0) {
    return []
  }
  
  return [...props.day.tasks].sort((a, b) => {
    // If both have reminder times, sort by time
    if (a.reminderTime && b.reminderTime) {
      return new Date(a.reminderTime) - new Date(b.reminderTime)
    }
    
    // Tasks with reminder time come first
    if (a.reminderTime && !b.reminderTime) return -1
    if (!a.reminderTime && b.reminderTime) return 1
    
    // If neither has reminder time, sort by creation time
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  })
})

// Handle task edit
const handleEditTask = (task) => {
  emit('edit-task', task)
}

// Handle tooltip show
const handleShowTooltip = (data) => {
  emit('show-tooltip', data)
}

// Handle tooltip hide
const handleHideTooltip = () => {
  emit('hide-tooltip')
}
</script>

<style>
@import '../assets/styles/components/weekly-view.css';
</style>