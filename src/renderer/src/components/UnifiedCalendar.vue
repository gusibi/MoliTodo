<template>
  <div class="unified-calendar bg-background text-foreground">
    <!-- Loading state -->
    <div v-if="isLoading" class="calendar-loading">
      <div class="calendar-loading-spinner"></div>
      <p class="calendar-loading-text">加载中...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="calendar-error">
      <div class="calendar-error-icon">⚠️</div>
      <div class="calendar-error-text">{{ error }}</div>
      <button v-if="canRetry" @click="retryOperation" class="calendar-retry-btn">
        重试 ({{ retryCount }}/{{ maxRetries }})
      </button>
    </div>

    <!-- Calendar content -->
    <div v-else class="unified-calendar-content">
      <!-- Calendar header - 固定不滚动 -->
      <div class="calendar-header flex items-center justify-between p-4 border-b border-border">
        <!-- Navigation controls -->
        <div class="calendar-nav-controls">
          <button @click="navigatePrevious" class="calendar-nav-btn">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button @click="goToToday" class="calendar-today-btn">
            今天
          </button>
          <button @click="navigateNext" class="calendar-nav-btn">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Current period title -->
        <h2 class="calendar-title">{{ currentTitle }}</h2>

        <!-- View controls -->
        <div class="calendar-view-controls">
          <button @click="changeView('week')" :class="[
            'calendar-view-btn',
            { 'active': currentView === 'week' }
          ]">
            周视图
          </button>
          <button @click="changeView('month')" :class="[
            'calendar-view-btn',
            { 'active': currentView === 'month' }
          ]">
            月视图
          </button>
        </div>
      </div>

      <!-- Calendar grid - 可滚动区域 -->
      <div class="calendar-grid">
        <!-- 隐藏滚动条但保持滚动功能 -->
        <div class="calendar-content">
          <!-- Week view -->
          <div v-if="currentView === 'week'" class="week-view">
            <!-- Week header -->
            <div class="week-header">
              <div class="week-header-empty"></div>
              <div v-for="day in weekDays" :key="day.date.toISOString()" class="week-header-day">
                <div class="week-header-day-name">{{ day.dayName }}</div>
                <div :class="[
                  'week-header-day-number',
                  { 'today': day.isToday }
                ]">
                  {{ day.dayNumber }}
                </div>
              </div>
            </div>

            <!-- Week grid -->
            <div class="week-grid-container">
              <!-- Time slot rows -->
              <div v-for="timeSlot in timeSlots" :key="timeSlot.id" class="week-time-slot-row"
                :style="{ minHeight: getTimeSlotMinHeight(timeSlot) + 'px' }">
                <!-- Time label column -->
                <div class="week-time-label">
                  <span>{{ timeSlot.label }}</span>
                </div>

                <!-- Day columns for this time slot -->
                <div v-for="day in weekDays" :key="day.date.toISOString()" class="week-day-slot"
                  @click="handleTimeSlotClick(day.date, timeSlot)">
                  <!-- Tasks for this time slot -->
                  <div class="time-slot-tasks">
                    <div v-for="task in getTasksForTimeSlot(day.tasks, timeSlot)" :key="task.id" class="task-item"
                      :class="getTaskClasses(task)" @click.stop="handleTaskClick(task)"
                      @mouseenter="handleShowTooltip({ task, event: $event })" @mouseleave="handleHideTooltip">
                      <div class="task-content">{{ task.content }}</div>
                      <div v-if="hasSpecificTime(task.reminderTime)" class="task-time">
                        {{ formatTaskTime(task.reminderTime) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Month view -->
          <div v-if="currentView === 'month'" class="month-view">
            <!-- Month header -->
            <div class="month-header">
              <div v-for="dayName in monthDayNames" :key="dayName" class="month-header-day">
                {{ dayName }}
              </div>
            </div>

            <!-- Month grid -->
            <div class="month-grid">
              <div v-for="day in monthDays" :key="day.date.toISOString()" class="month-day" :class="[
                day.isCurrentMonth ? 'current-month' : 'other-month',
                { 'today': day.isToday }
              ]" @click="handleDateClick(day.date)">
                <!-- Day number -->
                <div :class="[
                  'month-day-number',
                  day.isCurrentMonth ? 'current-month' : 'other-month',
                  { 'today': day.isToday }
                ]">
                  {{ day.dayNumber }}
                </div>

                <!-- Tasks -->
                <div class="month-day-tasks">
                  <div v-for="task in day.tasks.slice(0, 3)" :key="task.id" class="month-day-task"
                    :class="getTaskClasses(task)" @click.stop="handleTaskClick(task)"
                    @mouseenter="handleShowTooltip({ task, event: $event })" @mouseleave="handleHideTooltip">
                    {{ task.content }}
                  </div>

                  <!-- More tasks indicator -->
                  <div v-if="day.tasks.length > 3" class="month-day-more" @click.stop="handleDateClick(day.date)">
                    +{{ day.tasks.length - 3 }} 更多
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Tooltip -->
    <div v-if="tooltip.show && tooltip.task" class="task-tooltip" :style="{
      left: tooltip.x + 'px',
      top: tooltip.y + 'px'
    }">
      <div class="task-tooltip-content">
        {{ formatTaskDetails(tooltip.task) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

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
  },
  initialView: {
    type: String,
    default: 'month',
    validator: (value) => ['week', 'month'].includes(value)
  }
})

const emit = defineEmits([
  'edit-task',
  'create-task',
  'show-tooltip',
  'hide-tooltip'
])

// State
const currentView = ref(props.initialView)
const currentDate = ref(new Date())
const error = ref(null)
const retryCount = ref(0)
const maxRetries = 3

// Tooltip state
const tooltip = ref({
  show: false,
  task: null,
  x: 0,
  y: 0
})

// Utility functions
const getWeekStart = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  return new Date(d.setDate(diff))
}

const getWeekEnd = (weekStart) => {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return weekEnd
}

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

const formatHour = (hour) => {
  return `${hour.toString().padStart(2, '0')}:00`
}

const formatTaskTime = (dateTime) => {
  const date = new Date(dateTime)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

const hasSpecificTime = (dateTime) => {
  const date = new Date(dateTime)
  return date.getHours() !== 0 || date.getMinutes() !== 0
}

const formatTaskDetails = (task) => {
  if (!task) return ''

  const details = []

  // Task content
  details.push(`任务: ${task.content}`)

  // Status
  const statusMap = {
    'todo': '待办',
    'in-progress': '进行中',
    'paused': '暂停',
    'completed': '已完成'
  }
  details.push(`状态: ${statusMap[task.status] || task.status}`)

  // Priority
  if (task.priority) {
    const priorityMap = {
      'low': '低',
      'normal': '普通',
      'high': '高'
    }
    details.push(`优先级: ${priorityMap[task.priority] || task.priority}`)
  }

  // Reminder time
  if (task.reminderTime) {
    const reminderDate = new Date(task.reminderTime)
    const dateStr = reminderDate.toLocaleDateString('zh-CN')
    const timeStr = reminderDate.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
    details.push(`提醒时间: ${dateStr} ${timeStr}`)
  }

  // Created time
  if (task.createdAt) {
    const createdDate = new Date(task.createdAt)
    const dateStr = createdDate.toLocaleDateString('zh-CN')
    details.push(`创建时间: ${dateStr}`)
  }

  return details.join('\n')
}

// Define time slots (4 periods like WeeklyColumn)
const timeSlots = [
  { id: 'morning', label: '上午 (06:00-12:00)', start: 6, end: 12 },
  { id: 'afternoon', label: '下午 (12:00-18:00)', start: 12, end: 18 },
  { id: 'evening', label: '晚上 (18:00-24:00)', start: 18, end: 24 },
  { id: 'night', label: '凌晨 (00:00-06:00)', start: 0, end: 6 }
]

// Initialize current period
const initializeCurrentPeriod = () => {
  try {
    currentDate.value = new Date()
    error.value = null
    retryCount.value = 0
  } catch (err) {
    console.error('Error initializing current period:', err)
    error.value = '初始化日历失败'
  }
}

// Current title
const currentTitle = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1

  if (currentView.value === 'month') {
    return `${year}年${month}月`
  } else {
    const weekStart = getWeekStart(currentDate.value)
    const weekEnd = getWeekEnd(weekStart)

    const startMonth = weekStart.getMonth() + 1
    const startDay = weekStart.getDate()
    const endMonth = weekEnd.getMonth() + 1
    const endDay = weekEnd.getDate()

    if (startMonth === endMonth) {
      return `${year}年${startMonth}月${startDay}日 - ${endDay}日`
    } else {
      return `${year}年${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`
    }
  }
})

// Week data
const weekDays = computed(() => {
  const weekStart = getWeekStart(currentDate.value)
  const days = []
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)

    const dayTasks = getTasksForDate(date)
    const today = new Date()

    days.push({
      date: new Date(date),
      dayName: dayNames[i],
      dayNumber: date.getDate(),
      tasks: dayTasks,
      isToday: isSameDay(date, today)
    })
  }

  return days
})

// Month data
const monthDayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const monthDays = computed(() => {
  const monthStart = getMonthStart(currentDate.value)
  const monthEnd = getMonthEnd(currentDate.value)

  // Get first day of calendar (might be from previous month)
  const calendarStart = new Date(monthStart)
  const startDay = monthStart.getDay()
  calendarStart.setDate(calendarStart.getDate() - (startDay === 0 ? 6 : startDay - 1))

  // Get last day of calendar (might be from next month)
  const calendarEnd = new Date(monthEnd)
  const endDay = monthEnd.getDay()
  calendarEnd.setDate(calendarEnd.getDate() + (endDay === 0 ? 0 : 7 - endDay))

  const days = []
  const currentMonth = currentDate.value.getMonth()
  const today = new Date()

  for (let date = new Date(calendarStart); date <= calendarEnd; date.setDate(date.getDate() + 1)) {
    const dayTasks = getTasksForDate(date)

    days.push({
      date: new Date(date),
      dayNumber: date.getDate(),
      tasks: dayTasks,
      isCurrentMonth: date.getMonth() === currentMonth,
      isToday: isSameDay(date, today)
    })
  }

  return days
})

// Get tasks for a specific date
const getTasksForDate = (date) => {
  if (!props.tasks || props.tasks.length === 0) return []

  return props.tasks.filter(task => {
    if (!task.reminderTime) return false

    try {
      const reminderDate = new Date(task.reminderTime)
      if (isNaN(reminderDate.getTime())) return false

      return isSameDay(reminderDate, date)
    } catch (error) {
      console.warn('Invalid reminder time for task:', task.id, error)
      return false
    }
  }).sort((a, b) => {
    const timeA = new Date(a.reminderTime).getTime()
    const timeB = new Date(b.reminderTime).getTime()
    return timeA - timeB
  })
}

// Get tasks for specific time slot
const getTasksForTimeSlot = (dayTasks, timeSlot) => {
  if (!dayTasks || dayTasks.length === 0) {
    return []
  }

  return dayTasks.filter(task => {
    if (!task.reminderTime) {
      // Tasks without reminder time go to morning slot
      return timeSlot.id === 'morning'
    }

    const reminderDate = new Date(task.reminderTime)
    const hour = reminderDate.getHours()

    // Handle cross-day case (night time slot)
    if (timeSlot.start > timeSlot.end) {
      return hour >= timeSlot.start || hour < timeSlot.end
    }

    return hour >= timeSlot.start && hour < timeSlot.end
  }).sort((a, b) => {
    // Sort by reminder time
    if (a.reminderTime && b.reminderTime) {
      return new Date(a.reminderTime) - new Date(b.reminderTime)
    }

    // Tasks with reminder time first
    if (a.reminderTime && !b.reminderTime) return -1
    if (!a.reminderTime && b.reminderTime) return 1

    // Both without reminder time, sort by creation time
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  })
}

// Calculate minimum height for a time slot based on maximum tasks in any day
const getTimeSlotMinHeight = (timeSlot) => {
  let maxTasks = 0

  weekDays.value.forEach(day => {
    const tasksInSlot = getTasksForTimeSlot(day.tasks, timeSlot)
    maxTasks = Math.max(maxTasks, tasksInSlot.length)
  })

  // Base height + (task height * number of tasks) + padding
  // Each task needs about 32px (16px for content + 8px for time + 8px spacing)
  const baseHeight = 96 // Minimum height for empty slots (doubled from 48px)
  const taskHeight = 32 // Height per task
  const padding = 16 // Extra padding (doubled from 8px)

  return Math.max(baseHeight, (maxTasks * taskHeight) + padding)
}

// Get task CSS classes based on status
const getTaskClasses = (task) => {
  switch (task.status) {
    case 'done':
      return 'task-status-done'
    case 'doing':
      return 'task-status-doing'
    case 'paused':
      return 'task-status-paused'
    default:
      return 'task-status-todo'
  }
}

// Navigation methods
const navigatePrevious = () => {
  try {
    const newDate = new Date(currentDate.value)

    if (currentView.value === 'month') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setDate(newDate.getDate() - 7)
    }

    currentDate.value = newDate
  } catch (error) {
    console.error('Error navigating previous:', error)
    initializeCurrentPeriod()
  }
}

const navigateNext = () => {
  try {
    const newDate = new Date(currentDate.value)

    if (currentView.value === 'month') {
      newDate.setMonth(newDate.getMonth() + 1)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }

    currentDate.value = newDate
  } catch (error) {
    console.error('Error navigating next:', error)
    initializeCurrentPeriod()
  }
}

const goToToday = () => {
  currentDate.value = new Date()
}

// Change view
const changeView = (view) => {
  if (view !== currentView.value) {
    currentView.value = view
  }
}

// Event handlers
const handleDateClick = (date) => {
  emit('create-task', { date })
}

const handleTimeSlotClick = (date, timeSlot) => {
  const taskDate = new Date(date)
  // Set time to the start of the time slot
  taskDate.setHours(timeSlot.start, 0, 0, 0)
  emit('create-task', { date: taskDate })
}

const handleTaskClick = (task) => {
  emit('edit-task', task)
}

const handleShowTooltip = (data) => {
  const { task, event } = data
  const rect = event.target.getBoundingClientRect()

  // Calculate initial tooltip position
  let x = rect.left + rect.width / 2
  let y = rect.top - 10

  // Adjust position to keep tooltip within viewport
  const tooltipWidth = 300 // Estimated max width
  const tooltipHeight = 120 // Estimated height

  // Horizontal adjustment
  if (x - tooltipWidth / 2 < 10) {
    x = tooltipWidth / 2 + 10
  } else if (x + tooltipWidth / 2 > window.innerWidth - 10) {
    x = window.innerWidth - tooltipWidth / 2 - 10
  }

  // Vertical adjustment - show below if not enough space above
  if (y - tooltipHeight < 10) {
    y = rect.bottom + 10
  }

  tooltip.value = {
    show: true,
    task,
    x,
    y
  }

  // Also emit for parent component compatibility
  emit('show-tooltip', data)
}

const handleHideTooltip = () => {
  tooltip.value.show = false
  emit('hide-tooltip')
}

// Retry functionality
const retryOperation = () => {
  if (retryCount.value < maxRetries) {
    retryCount.value++
    error.value = null
    initializeCurrentPeriod()
  }
}

// Computed states
const isLoading = computed(() => props.loading)
const hasError = computed(() => error.value !== null)
const canRetry = computed(() => hasError.value && retryCount.value < maxRetries)

// Initialize on mount
onMounted(() => {
  initializeCurrentPeriod()
})

// Watch for view changes
watch(() => props.initialView, (newView) => {
  if (newView !== currentView.value) {
    changeView(newView)
  }
})

// Watch for task changes
watch(() => props.tasks, () => {
  // Tasks are reactive, computed properties will update automatically
}, { deep: true })
</script>

<style>
@import '../assets/styles/components/unified-calendar.css';
</style>