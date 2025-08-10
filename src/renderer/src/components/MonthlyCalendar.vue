<template>
  <div class="monthly-calendar flex-1 min-h-96">
    <!-- Error state -->
    <div v-if="hasError" class="flex items-center justify-center py-16 text-red-600">
      <div class="text-center">
        <div class="text-4xl mb-4">⚠️</div>
        <div class="text-lg">{{ error }}</div>
        <button 
          v-if="canRetry" 
          @click="retryInitialization" 
          class="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
        >
          重试
        </button>
      </div>
    </div>
    
    <!-- Calendar container -->
    <div v-else ref="calendarEl" class="h-full"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Calendar } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

const props = defineProps({
  events: {
    type: Array,
    default: () => []
  },
  currentDate: {
    type: Date,
    required: true
  },
  locale: {
    type: String,
    default: 'zh-cn'
  }
})

const emit = defineEmits([
  'date-click',
  'event-click',
  'event-drop',
  'month-change'
])

// Refs
const calendarEl = ref(null)
let calendar = null

// Error handling
const error = ref(null)
const retryCount = ref(0)
const maxRetries = 3

// Computed states
const hasError = computed(() => error.value !== null)
const canRetry = computed(() => hasError.value && retryCount.value < maxRetries)

// Calendar configuration
const calendarOptions = {
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: props.locale,
  headerToolbar: false, // 使用自定义导航
  height: 'auto',
  events: props.events,
  eventClick: handleEventClick,
  dateClick: handleDateClick,
  eventDrop: handleEventDrop,
  eventDidMount: customizeEventAppearance,
  dayMaxEvents: 3, // 每日最多显示3个事件
  moreLinkClick: 'popover', // 点击"更多"显示弹出框
  eventDisplay: 'block',
  displayEventTime: false, // 不显示时间（在自定义渲染中处理）
  firstDay: 1, // 周一为第一天
  weekends: true,
  editable: true, // 允许拖拽
  droppable: true,
  dayHeaderFormat: { weekday: 'short' },
  eventClassNames: 'monthly-event',
  dayCellClassNames: 'monthly-day-cell',
  eventContent: renderEventContent,
  datesSet: handleDatesSet
}

// Initialize calendar
const initializeCalendar = async () => {
  try {
    if (!calendarEl.value) {
      throw new Error('Calendar element not found')
    }

    calendar = new Calendar(calendarEl.value, calendarOptions)
    await calendar.render()
    
    // Set initial date
    calendar.gotoDate(props.currentDate)
    
    error.value = null
    retryCount.value = 0
  } catch (err) {
    console.error('Error initializing calendar:', err)
    error.value = '日历初始化失败'
    
    // Fallback to simple grid view
    if (retryCount.value >= maxRetries) {
      error.value = '日历加载失败，请刷新页面重试'
    }
  }
}

// Retry initialization
const retryInitialization = () => {
  if (retryCount.value < maxRetries) {
    retryCount.value++
    error.value = null
    nextTick(() => {
      initializeCalendar()
    })
  }
}

// Event handlers
function handleEventClick(info) {
  const task = info.event.extendedProps.originalTask
  emit('event-click', {
    event: info.jsEvent,
    task: task,
    calendarEvent: info.event
  })
}

function handleDateClick(info) {
  emit('date-click', {
    date: info.date,
    dateStr: info.dateStr,
    jsEvent: info.jsEvent
  })
}

function handleEventDrop(info) {
  const task = info.event.extendedProps.originalTask
  emit('event-drop', {
    task: task,
    newDate: info.event.start,
    oldDate: info.oldEvent.start,
    calendarEvent: info.event
  })
}

function handleDatesSet(info) {
  emit('month-change', {
    start: info.start,
    end: info.end,
    view: info.view
  })
}

// Custom event rendering
function renderEventContent(eventInfo) {
  const task = eventInfo.event.extendedProps.originalTask
  const hasTime = eventInfo.event.extendedProps.hasTime
  
  return {
    html: `
      <div class="flex items-center gap-1 text-xs">
        <div class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${eventInfo.event.borderColor}"></div>
        <div class="truncate flex-1">${eventInfo.event.title}</div>
        ${hasTime ? `<div class="text-xs opacity-75">${formatEventTime(eventInfo.event.start)}</div>` : ''}
      </div>
    `
  }
}

// Custom event appearance
function customizeEventAppearance(info) {
  const task = info.event.extendedProps.originalTask
  const element = info.el
  
  // Add custom classes based on task properties
  element.classList.add('monthly-task-event')
  
  if (task.status === 'done') {
    element.classList.add('task-completed')
  }
  
  if (task.priority === 'high') {
    element.classList.add('task-high-priority')
  }
  
  // Add hover effects
  element.addEventListener('mouseenter', () => {
    element.style.transform = 'translateY(-1px)'
    element.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
  })
  
  element.addEventListener('mouseleave', () => {
    element.style.transform = 'translateY(0)'
    element.style.boxShadow = 'none'
  })
}

// Helper functions
function formatEventTime(date) {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
}

// Update calendar when props change
watch(() => props.events, (newEvents) => {
  if (calendar) {
    calendar.removeAllEvents()
    calendar.addEventSource(newEvents)
  }
}, { deep: true })

watch(() => props.currentDate, (newDate) => {
  if (calendar && newDate) {
    calendar.gotoDate(newDate)
  }
})

// Lifecycle
onMounted(async () => {
  await nextTick()
  await initializeCalendar()
})

onUnmounted(() => {
  if (calendar) {
    calendar.destroy()
    calendar = null
  }
})
</script>

<style>
/* FullCalendar custom styles */
.fc {
  font-family: inherit;
}

.fc-theme-standard .fc-scrollgrid {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.fc-theme-standard td, 
.fc-theme-standard th {
  border-color: #e5e7eb;
}

.fc-col-header-cell {
  background-color: #f9fafb;
  font-weight: 600;
  color: #374151;
  padding: 8px;
}

.fc-daygrid-day {
  min-height: 100px;
}

.fc-daygrid-day-number {
  color: #374151;
  font-weight: 500;
  padding: 4px;
}

.fc-day-today {
  background-color: #eff6ff !important;
}

.fc-day-today .fc-daygrid-day-number {
  background-color: #3b82f6;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Custom event styles */
.monthly-task-event {
  border-radius: 4px;
  padding: 2px 6px;
  margin: 1px 0;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid;
}

.monthly-task-event:hover {
  opacity: 0.9;
}

.task-completed {
  opacity: 0.7;
  text-decoration: line-through;
}

.task-high-priority {
  font-weight: 600;
  border-left-width: 4px;
}

/* More link styling */
.fc-more-link {
  color: #6b7280;
  font-size: 11px;
  text-decoration: none;
}

.fc-more-link:hover {
  color: #374151;
  text-decoration: underline;
}

/* Popover styling */
.fc-popover {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.fc-popover-header {
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 8px 12px;
  font-weight: 600;
  color: #374151;
}

.fc-popover-body {
  padding: 8px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .fc-daygrid-day {
    min-height: 80px;
  }
  
  .monthly-task-event {
    font-size: 10px;
    padding: 1px 4px;
  }
  
  .fc-daygrid-day-number {
    font-size: 12px;
  }
}
</style>