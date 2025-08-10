<template>
    <div class="monthly-calendar w-full">
        <!-- Error state -->
        <div v-if="hasError" class="monthly-calendar-error">
            <div class="monthly-calendar-error-content">
                <div class="monthly-calendar-error-icon">⚠️</div>
                <div class="monthly-calendar-error-message">{{ error }}</div>
                <button v-if="canRetry" @click="retryInitialization" class="monthly-calendar-retry-btn">
                    重试
                </button>
            </div>
        </div>

        <!-- Calendar container -->
        <div v-else ref="calendarEl" class="monthly-calendar-container h-full"></div>
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
    datesSet: handleDatesSet,
    dayCellContent: renderDayCellContent
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
    const isCompleted = task.status === 'done'
    
    // Get status indicator color class based on task status (matching WeeklyTaskCard)
    let indicatorColorClass = ''
    switch (task.status) {
        case 'todo':
            indicatorColorClass = 'bg-border'
            break
        case 'doing':
            indicatorColorClass = 'bg-warning'
            break
        case 'paused':
            indicatorColorClass = 'bg-muted-foreground'
            break
        case 'done':
            indicatorColorClass = 'bg-success'
            break
        default:
            indicatorColorClass = 'bg-border'
    }

    return {
        html: `
      <div class="monthly-event-content ${isCompleted ? 'monthly-event-content-completed' : ''}">
        <div class="monthly-event-indicator ${indicatorColorClass}"></div>
        <div class="monthly-event-title ${isCompleted ? 'monthly-event-title-completed' : ''}">${eventInfo.event.title}</div>
        ${hasTime ? `<div class="monthly-event-time ${isCompleted ? 'monthly-event-time-completed' : ''}">${formatEventTime(eventInfo.event.start)}</div>` : ''}
        ${isCompleted ? '<i class="fas fa-check monthly-event-check-icon"></i>' : ''}
      </div>
    `
    }
}

// Custom day cell content
function renderDayCellContent(info) {
    const dayNumber = info.dayNumberText.replace(/[^\d]/g, '') // 只保留数字

    if (info.isToday) {
        return {
            html: `
                <span class="fc-today-number">${dayNumber}</span>
                <span class="fc-today-suffix">日</span>
            `
        }
    } else {
        return {
            html: `${dayNumber}日`
        }
    }
}

// Custom event appearance
function customizeEventAppearance(info) {
    const task = info.event.extendedProps.originalTask
    const element = info.el

    // Add base custom class
    element.classList.add('monthly-task-event')

    // Add status-specific classes
    if (task.status === 'done') {
        element.classList.add('task-completed')
    }

    if (task.priority === 'high') {
        element.classList.add('task-high-priority')
    }

    // Add status-specific styling classes
    switch (task.status) {
        case 'doing':
            element.classList.add('task-status-doing')
            break
        case 'paused':
            element.classList.add('task-status-paused')
            break
        case 'done':
            element.classList.add('task-status-done')
            break
        default:
            element.classList.add('task-status-todo')
    }
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
@import '../assets/styles/components/monthly-calendar.css';
</style>