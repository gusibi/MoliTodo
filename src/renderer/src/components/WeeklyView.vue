<template>
  <div class="weekly-view">
    <!-- Loading state -->
    <div v-if="isLoading" class="weekly-view-loading">
      <i class="fas fa-spinner fa-spin"></i>
      <p>加载中...</p>
    </div>
    
    <!-- Error state -->
    <div v-else-if="hasError" class="weekly-view-error">
      <div class="weekly-view-error-icon">⚠️</div>
      <div class="weekly-view-error-text">{{ error }}</div>
      <button v-if="canRetry" @click="retryOperation" class="weekly-view-retry-btn">
        重试 ({{ retryCount }}/{{ maxRetries }})
      </button>
    </div>
    
    <!-- Weekly view content -->
    <div v-else class="weekly-view-content">
      <!-- Week navigation -->
      <WeeklyNavigation
        :current-week-start="currentWeekStart"
        :current-week-end="currentWeekEnd"
        @navigate-week="navigateWeek"
        @go-to-current="goToCurrentWeek"
      />
      
      <!-- Weekly grid -->
      <WeeklyGrid
        :week-days="weekDays"
        :current-week-start="currentWeekStart"
        @edit-task="handleEditTask"
        @show-tooltip="handleShowTooltip"
        @hide-tooltip="handleHideTooltip"
      />
      
     
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import WeeklyNavigation from './WeeklyNavigation.vue'
import WeeklyGrid from './WeeklyGrid.vue'

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
  'show-tooltip',
  'hide-tooltip'
])

// Current week state
const currentWeekStart = ref(new Date())
const currentWeekEnd = ref(new Date())

// Error handling state
const error = ref(null)
const retryCount = ref(0)
const maxRetries = 3

// Week calculation utilities
const getWeekStart = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(d.setDate(diff))
}

const getWeekEnd = (weekStart) => {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return weekEnd
}

const isSameDay = (date1, date2) => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

// Initialize current week with error handling
const initializeCurrentWeek = () => {
  try {
    const today = new Date()
    const weekStart = getWeekStart(today)
    const weekEnd = getWeekEnd(weekStart)
    
    currentWeekStart.value = weekStart
    currentWeekEnd.value = weekEnd
    error.value = null
    retryCount.value = 0
  } catch (err) {
    console.error('Error initializing current week:', err)
    error.value = '初始化周视图失败'
    
    // Fallback to basic date calculation
    try {
      const today = new Date()
      currentWeekStart.value = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      currentWeekEnd.value = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6)
    } catch (fallbackErr) {
      console.error('Fallback initialization failed:', fallbackErr)
    }
  }
}

// Filter tasks for current week with proper date validation
const weeklyTasks = computed(() => {
  if (!props.tasks || props.tasks.length === 0) {
    return []
  }
  
  return props.tasks.filter(task => {
    // Only show tasks with reminder times
    if (!task.reminderTime) return false
    
    try {
      const reminderDate = new Date(task.reminderTime)
      
      // Validate date
      if (isNaN(reminderDate.getTime())) return false
      
      // Check if reminder date falls within current week
      const reminderStart = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate())
      const weekStart = new Date(currentWeekStart.value.getFullYear(), currentWeekStart.value.getMonth(), currentWeekStart.value.getDate())
      const weekEnd = new Date(currentWeekEnd.value.getFullYear(), currentWeekEnd.value.getMonth(), currentWeekEnd.value.getDate())
      
      return reminderStart >= weekStart && reminderStart <= weekEnd
    } catch (error) {
      console.warn('Invalid reminder time for task:', task.id, error)
      return false
    }
  })
})

// Group tasks by day of the week with proper timezone handling
const weekDays = computed(() => {
  const days = []
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  
  // Create 7 days (Monday to Sunday)
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart.value)
    date.setDate(date.getDate() + i)
    
    // Filter tasks for this day
    const dayTasks = weeklyTasks.value.filter(task => {
      if (!task.reminderTime) return false
      
      try {
        const reminderDate = new Date(task.reminderTime)
        if (isNaN(reminderDate.getTime())) return false
        
        return isSameDay(reminderDate, date)
      } catch (error) {
        console.warn('Error filtering task for day:', task.id, error)
        return false
      }
    })
    
    // Sort tasks by reminder time
    const sortedDayTasks = dayTasks.sort((a, b) => {
      const timeA = new Date(a.reminderTime).getTime()
      const timeB = new Date(b.reminderTime).getTime()
      return timeA - timeB
    })
    
    // Check if this is today
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    
    days.push({
      date: new Date(date),
      dayName: dayNames[i],
      dayNumber: date.getDate(),
      tasks: sortedDayTasks,
      isToday
    })
  }
  
  return days
})

// Navigate week with proper date calculations
const navigateWeek = (direction) => {
  try {
    const newWeekStart = new Date(currentWeekStart.value)
    newWeekStart.setDate(newWeekStart.getDate() + (direction * 7))
    
    const newWeekEnd = getWeekEnd(newWeekStart)
    
    currentWeekStart.value = newWeekStart
    currentWeekEnd.value = newWeekEnd
  } catch (error) {
    console.error('Error navigating week:', error)
    // Fallback to current week
    initializeCurrentWeek()
  }
}

// Go to current week
const goToCurrentWeek = () => {
  initializeCurrentWeek()
}

// Retry functionality
const retryOperation = () => {
  if (retryCount.value < maxRetries) {
    retryCount.value++
    error.value = null
    initializeCurrentWeek()
  }
}

// Check if tasks are loading or if there's an error
const isLoading = computed(() => {
  return props.loading
})

const hasError = computed(() => {
  return error.value !== null
})

const canRetry = computed(() => {
  return hasError.value && retryCount.value < maxRetries
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

// Initialize on mount
onMounted(() => {
  initializeCurrentWeek()
})

// Watch for task changes and refresh if needed
watch(() => props.tasks, () => {
  // Tasks are reactive, computed properties will update automatically
}, { deep: true })
</script>

<style>
@import '../assets/styles/components/weekly-view.css';
</style>