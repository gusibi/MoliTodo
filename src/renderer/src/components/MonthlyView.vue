<template>
  <div class="monthly-view">
    <!-- Loading state -->
    <div v-if="isLoading" class="monthly-view-loading">
      <i class="fas fa-spinner fa-spin"></i>
      <p>加载中...</p>
    </div>
    
    <!-- Error state -->
    <div v-else-if="hasError" class="monthly-view-error">
      <div class="monthly-view-error-icon">⚠️</div>
      <div class="monthly-view-error-text">{{ error }}</div>
      <button 
        v-if="canRetry" 
        @click="retryOperation" 
        class="monthly-view-retry-btn"
      >
        重试 ({{ retryCount }}/{{ maxRetries }})
      </button>
    </div>
    
    <!-- Monthly view content -->
    <div v-else class="monthly-view-content">
      <!-- Month navigation -->
      <div class="monthly-view-navigation">
        <MonthlyNavigation
          :current-month="currentMonth"
          @navigate-month="navigateMonth"
          @go-to-today="goToCurrentMonth"
        />
      </div>
      
      <!-- Monthly calendar - scrollable -->
      <div class="monthly-view-calendar-container">
        <MonthlyCalendar
          :events="calendarEvents"
          :current-date="currentMonth"
          @date-click="handleDateClick"
          @event-click="handleEventClick"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import MonthlyNavigation from './MonthlyNavigation.vue'
import MonthlyCalendar from './MonthlyCalendar.vue'

const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'edit-task',
  'create-task',
  'show-tooltip',
  'hide-tooltip'
])

// Current month state
const currentMonth = ref(new Date())

// Error handling state
const error = ref(null)
const retryCount = ref(0)
const maxRetries = 3

// Month calculation utilities
const getMonthStart = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

const getMonthEnd = (date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

const isSameDay = (date1, date2) => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

// Initialize current month with error handling
const initializeCurrentMonth = () => {
  try {
    const today = new Date()
    currentMonth.value = new Date(today.getFullYear(), today.getMonth(), 1)
    error.value = null
    retryCount.value = 0
  } catch (err) {
    console.error('Error initializing current month:', err)
    error.value = '初始化月视图失败'
  }
}

// Filter tasks for current month
const monthlyTasks = computed(() => {
  if (!props.tasks || props.tasks.length === 0) {
    return []
  }
  
  const monthStart = getMonthStart(currentMonth.value)
  const monthEnd = getMonthEnd(currentMonth.value)
  
  return props.tasks.filter(task => {
    if (!task.reminderTime) return false
    
    try {
      const reminderDate = new Date(task.reminderTime)
      if (isNaN(reminderDate.getTime())) return false
      
      return reminderDate >= monthStart && reminderDate <= monthEnd
    } catch (error) {
      console.warn('Invalid reminder time for task:', task.id, error)
      return false
    }
  })
})

// Convert tasks to calendar events
const calendarEvents = computed(() => {
  return monthlyTasks.value.map(task => {
    const reminderDate = new Date(task.reminderTime)
    
    return {
      id: task.id,
      title: task.content,
      start: reminderDate,
      allDay: !hasSpecificTime(task.reminderTime),
      backgroundColor: getStatusColor(task.status),
      borderColor: getPriorityColor(task.priority || 'normal'),
      textColor: '#ffffff',
      extendedProps: {
        taskId: task.id,
        status: task.status,
        priority: task.priority || 'normal',
        listId: task.listId,
        originalTask: task
      }
    }
  })
})

// Helper functions
const hasSpecificTime = (dateTime) => {
  const date = new Date(dateTime)
  return date.getHours() !== 0 || date.getMinutes() !== 0
}

const getStatusColor = (status) => {
  const colors = {
    completed: '#10b981', // green
    pending: '#f59e0b',   // amber
    overdue: '#ef4444'    // red
  }
  return colors[status] || '#6b7280' // gray default
}

const getPriorityColor = (priority) => {
  const colors = {
    high: '#ef4444',     // red
    medium: '#f59e0b',   // amber
    normal: '#6b7280'    // gray
  }
  return colors[priority] || '#6b7280'
}

// Navigate month
const navigateMonth = (direction) => {
  try {
    const newMonth = new Date(currentMonth.value)
    newMonth.setMonth(newMonth.getMonth() + direction)
    currentMonth.value = newMonth
  } catch (error) {
    console.error('Error navigating month:', error)
    initializeCurrentMonth()
  }
}

// Go to current month
const goToCurrentMonth = () => {
  initializeCurrentMonth()
}

// Handle date click
const handleDateClick = (date) => {
  emit('create-task', { date })
}

// Handle event click
const handleEventClick = (event) => {
  const task = event.extendedProps.originalTask
  emit('edit-task', task)
}

// Retry functionality
const retryOperation = () => {
  if (retryCount.value < maxRetries) {
    retryCount.value++
    error.value = null
    initializeCurrentMonth()
  }
}

// Computed states
const isLoading = computed(() => props.loading)
const hasError = computed(() => error.value !== null)
const canRetry = computed(() => hasError.value && retryCount.value < maxRetries)

// Initialize on mount
onMounted(() => {
  initializeCurrentMonth()
})

// Watch for task changes
watch(() => props.tasks, () => {
  // Tasks are reactive, computed properties will update automatically
}, { deep: true })
</script>

<style>
@import '../assets/styles/components/monthly-calendar.css';
</style>

