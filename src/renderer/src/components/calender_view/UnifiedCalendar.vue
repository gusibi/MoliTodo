<template>
  <div class="unified-calendar bg-background text-foreground">
    <!-- Loading state -->
    <div v-if="isLoading" class="calendar-loading">
      <div class="calendar-loading-spinner"></div>
      <p class="calendar-loading-text">{{ t('common.loading') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="calendar-error">
      <div class="calendar-error-icon">⚠️</div>
      <div class="calendar-error-text">{{ error }}</div>
      <button v-if="canRetry" @click="retryOperation" class="calendar-retry-btn">
        {{ t('calendar.retry') }} ({{ retryCount }}/{{ maxRetries }})
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
            {{ t('calendar.today') }}
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
          <button @click="changeView('day')" :class="[
            'calendar-view-btn',
            { 'active': currentView === 'day' }
          ]">
            {{ t('calendar.day') }}
          </button>
          <button @click="changeView('week')" :class="[
            'calendar-view-btn',
            { 'active': currentView === 'week' }
          ]">
            {{ t('calendar.week') }}
          </button>
          <button @click="changeView('month')" :class="[
            'calendar-view-btn',
            { 'active': currentView === 'month' }
          ]">
            {{ t('calendar.month') }}
          </button>
          
          <!-- 重复任务实例显示控制 -->
          <button v-if="taskStore.recurringTasks.length > 0" @click="toggleRecurringInstances" :class="[
            'calendar-view-btn',
            'calendar-recurring-toggle',
            { 'active': taskStore.showRecurringInstances }
          ]"
           :title="taskStore.showRecurringInstances ? t('calendar.hideRecurringInstances') : t('calendar.showRecurringInstances')">
            <i class="fas fa-repeat"></i>
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

          <!-- Day view -->
          <div v-if="currentView === 'day'" class="day-view">
            <!-- Day header -->
            <div class="day-header">
              <div class="day-header-empty"></div>
              <div class="day-header-day">
                <div class="day-header-day-name">{{ currentDayInfo.weekdayStr }}</div>
                <div :class="[
                  'day-header-day-number',
                  { 'today': isSameDay(currentDate, new Date()) }
                ]">
                  {{ currentDate.getDate() }}
                </div>
              </div>
            </div>

            <!-- Day grid -->
            <div class="day-grid-container">
              <!-- Time slot rows -->
              <div v-for="timeSlot in timeSlots" :key="timeSlot.id" class="day-time-slot-row"
                :style="{ minHeight: getDayTimeSlotMinHeight(timeSlot) + 'px' }">
                <!-- Time label column -->
                <div class="day-time-label">
                  <span>{{ timeSlot.label }}</span>
                </div>

                <!-- Day column for this time slot -->
                <div class="day-slot" @click="handleTimeSlotClick(currentDate, timeSlot)">
                  <!-- Tasks for this time slot -->
                  <div class="time-slot-tasks">
                    <div v-for="task in getTasksForTimeSlot(currentDayTasks, timeSlot)" :key="task.id" class="task-item"
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
                  <div v-if="day.tasks.length > 3" class="month-day-more"
                    @click.stop="showDayTasksModal(day.date, day.tasks)">
                    +{{ day.tasks.length - 3 }} {{ t('calendar.more') }}
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

    <!-- Day Tasks Modal -->
    <div v-if="dayTasksModal.show" class="day-tasks-modal-overlay" @click="closeDayTasksModal">
      <div class="day-tasks-modal" @click.stop>
        <div class="day-tasks-modal-header">
          <div class="day-tasks-modal-title">
            <i class="fas fa-tasks day-tasks-modal-icon"></i>
            <h4 class="day-tasks-modal-title-text">{{ dayTasksModal.title }}</h4>
          </div>
          <button @click="closeDayTasksModal" class="day-tasks-modal-close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="day-tasks-modal-content">
          <div v-for="task in dayTasksModal.tasks" :key="task.id" class="day-task-item">
            <label class="day-task-label" @click="handleTaskClick(task)">
              <span class="day-task-checkbox" :class="getTaskStatusClasses(task)">
                <i v-if="task.status === 'done'" class="fas fa-check"></i>
              </span>
              <span class="day-task-content" :class="{ 'day-task-content-completed': task.status === 'done' }">{{
                task.content }}</span>
              <span v-if="hasSpecificTime(task.reminderTime)" class="day-task-time"
                :class="{ 'day-task-time-completed': task.status === 'done' }">
                {{ formatTaskTime(task.reminderTime) }}
              </span>
            </label>
          </div>

          <div v-if="dayTasksModal.tasks.length === 0" class="day-tasks-modal-empty">
            {{ t('calendar.noTasks') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import { useI18n } from 'vue-i18n'

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
    validator: (value) => ['day', 'week', 'month'].includes(value)
  }
})

// Task store
const taskStore = useTaskStore()

const emit = defineEmits([
  'edit-task',
  'create-task',
  'show-tooltip',
  'hide-tooltip'
])

const { t } = useI18n()

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

// Day tasks modal state
const dayTasksModal = ref({
  show: false,
  date: null,
  tasks: [],
  title: ''
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
  details.push(t('calendar.taskLabel', { content: task.content }))

  // Status
  const statusMap = {
    'todo': t('task.status.todo'),
    'in-progress': t('task.status.inProgress'),
    'paused': t('task.status.paused'),
    'completed': t('task.status.completed')
  }
  details.push(t('calendar.statusLabel', { status: statusMap[task.status] || task.status }))

  // Priority
  if (task.priority) {
    const priorityMap = {
      'low': t('task.priority.low'),
      'normal': t('task.priority.normal'),
      'high': t('task.priority.high')
    }
    details.push(t('calendar.priorityLabel', { priority: priorityMap[task.priority] || task.priority }))
  }

  // Reminder time
  if (task.reminderTime) {
    const reminderDate = new Date(task.reminderTime)
    const dateStr = reminderDate.toLocaleDateString('zh-CN')
    const timeStr = reminderDate.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
    details.push(t('calendar.reminderTimeLabel', { date: dateStr, time: timeStr }))
  }

  // Created time
  if (task.createdAt) {
    const createdDate = new Date(task.createdAt)
    const dateStr = createdDate.toLocaleDateString('zh-CN')
    details.push(t('calendar.createdTimeLabel', { date: dateStr }))
  }

  return details.join('\n')
}

// Define time slots (4 periods like WeeklyColumn)
const timeSlots = [
  { id: 'morning', label: t('calendar.morning'), start: 6, end: 12 },
  { id: 'afternoon', label: t('calendar.afternoon'), start: 12, end: 18 },
  { id: 'evening', label: t('calendar.evening'), start: 18, end: 24 },
  { id: 'night', label: t('calendar.night'), start: 0, end: 6 }
]

// Initialize current period
const initializeCurrentPeriod = () => {
  try {
    currentDate.value = new Date()
    error.value = null
    retryCount.value = 0
  } catch (err) {
    console.error('Error initializing current period:', err)
    error.value = t('calendar.initializationFailed')
  }
}

// Current title
const currentTitle = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1

  if (currentView.value === 'day') {
    const day = currentDate.value.getDate()
    return t('calendar.dateFormat', { year, month, day })
  } else if (currentView.value === 'month') {
    return t('calendar.monthFormat', { year, month })
  } else {
    const weekStart = getWeekStart(currentDate.value)
    const weekEnd = getWeekEnd(weekStart)

    const startMonth = weekStart.getMonth() + 1
    const startDay = weekStart.getDate()
    const endMonth = weekEnd.getMonth() + 1
    const endDay = weekEnd.getDate()

    if (startMonth === endMonth) {
      return t('calendar.dateRangeSameMonth', { year, startMonth, startDay, endDay })
    } else {
      return t('calendar.dateRangeDifferentMonth', { year, startMonth, startDay, endMonth, endDay })
    }
  }
})

// Week data
const weekDays = computed(() => {
  const weekStart = getWeekStart(currentDate.value)
  const days = []
  const dayNames = [t('calendar.monday'), t('calendar.tuesday'), t('calendar.wednesday'), t('calendar.thursday'), t('calendar.friday'), t('calendar.saturday'), t('calendar.sunday')]

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
const monthDayNames = [t('calendar.monday'), t('calendar.tuesday'), t('calendar.wednesday'), t('calendar.thursday'), t('calendar.friday'), t('calendar.saturday'), t('calendar.sunday')]

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
  let allTasks = []
  
  // 始终包含普通任务
  if (props.tasks && props.tasks.length > 0) {
    allTasks = [...props.tasks]
  }
  // console.log('普通任务:', allTasks)
  
  // 如果显示重复实例，则添加重复任务实例
  if (taskStore.showRecurringInstances && taskStore.expandedTasks && taskStore.expandedTasks.length > 0) {
    // 合并重复任务实例，避免与普通任务重复
    const recurringInstances = taskStore.expandedTasks.filter(task => task.occurrence_date || task.occurrenceDate)
    allTasks = [...allTasks, ...recurringInstances]
  }
  // console.log('全部任务:', allTasks)
  
  if (!allTasks || allTasks.length === 0) return []

  return allTasks.filter(task => {
    // 对于重复任务实例，检查occurrence_date或occurrenceDate
    if (task.occurrence_date || task.occurrenceDate) {
      try {
        const occurrenceDate = new Date(task.occurrence_date || task.occurrenceDate)
        if (isNaN(occurrenceDate.getTime())) return false
        return isSameDay(occurrenceDate, date)
      } catch (error) {
        console.warn('Invalid occurrence date for task:', task.id, error)
        return false
      }
    }
    
    // 对于普通任务，检查reminderTime
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
    // 对于重复任务实例，使用occurrence_date或occurrenceDate排序
    const timeA = (a.occurrence_date || a.occurrenceDate) ? new Date(a.occurrence_date || a.occurrenceDate).getTime() : new Date(a.reminderTime).getTime()
    const timeB = (b.occurrence_date || b.occurrenceDate) ? new Date(b.occurrence_date || b.occurrenceDate).getTime() : new Date(b.reminderTime).getTime()
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
  const statusClasses = []
  
  // 状态类
  switch (task.status) {
    case 'done':
      statusClasses.push('task-status-done')
      break
    case 'doing':
      statusClasses.push('task-status-doing')
      break
    case 'paused':
      statusClasses.push('task-status-paused')
      break
    default:
      statusClasses.push('task-status-todo')
  }
  
  // 重复任务实例标识
  if (task.occurrence_date || task.series_id) {
    statusClasses.push('task-recurring-instance')
  }
  
  return statusClasses.join(' ')
}

// Navigation methods
const navigatePrevious = () => {
  try {
    const newDate = new Date(currentDate.value)

    if (currentView.value === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else if (currentView.value === 'month') {
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

    if (currentView.value === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else if (currentView.value === 'month') {
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

// Toggle recurring instances display
const toggleRecurringInstances = () => {
  taskStore.toggleRecurringInstances()
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

// Day tasks modal methods
const showDayTasksModal = (date, tasks) => {
  const dateStr = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  dayTasksModal.value = {
    show: true,
    date: new Date(date),
    tasks: [...tasks],
    title: t('calendar.tasksForDate', { date: dateStr })
  }
}

const closeDayTasksModal = () => {
  dayTasksModal.value.show = false
}

// Handle keyboard events for modal
const handleKeydown = (event) => {
  if (event.key === 'Escape' && dayTasksModal.value.show) {
    closeDayTasksModal()
  }
}

// Get task status classes for modal
const getTaskStatusClasses = (task) => {
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

// Day view data
const currentDayInfo = computed(() => {
  const date = currentDate.value
  const weekdays = [t('calendar.sunday'), t('calendar.monday'), t('calendar.tuesday'), t('calendar.wednesday'), t('calendar.thursday'), t('calendar.friday'), t('calendar.saturday')]

  return {
    dateStr: `${date.getMonth() + 1}月${date.getDate()}日`,
    weekdayStr: weekdays[date.getDay()]
  }
})

const currentDayTasks = computed(() => {
  return getTasksForDate(currentDate.value)
})

const completedTasksCount = computed(() => {
  return currentDayTasks.value.filter(task => task.status === 'done').length
})

// Get priority text
const getPriorityText = (priority) => {
  const priorityMap = {
    'low': '低优先级',
    'high': '高优先级'
  }
  return priorityMap[priority] || priority
}

// Calculate minimum height for a time slot in day view
const getDayTimeSlotMinHeight = (timeSlot) => {
  const tasksInSlot = getTasksForTimeSlot(currentDayTasks.value, timeSlot)
  const maxTasks = tasksInSlot.length

  // Base height + (task height * number of tasks) + padding
  const baseHeight = 96 // Minimum height for empty slots
  const taskHeight = 32 // Height per task
  const padding = 16 // Extra padding

  return Math.max(baseHeight, (maxTasks * taskHeight) + padding)
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

  // Add keyboard event listener
  document.addEventListener('keydown', handleKeydown)
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
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
@import '@/assets/styles/components/unified-calendar.css';
</style>