<template>
  <div class="flex h-screen bg-background text-foreground">
    <!-- 左侧任务列表 -->
    <div class="w-80 min-w-80 bg-card border-r border-border flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <div v-if="allMonthTasks.length === 0" class="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
          <i class="fas fa-calendar-check text-5xl mb-4 opacity-50"></i>
          <p class="text-sm">{{ t('calendar.noTasksThisMonth') }}</p>
        </div>
        
        <!-- 未完成任务 -->
        <div v-if="pendingTasks.length > 0" class="mb-4">
          <h4 class="text-xs font-medium text-muted-foreground mb-2 px-2">{{ t('calendar.pendingTasks') }} ({{ pendingTasks.length }})</h4>
          <FlatTaskItem
            v-for="task in pendingTasks"
            :key="task.id"
            :task="task"
            :search-query="searchQuery"
            :time-update-trigger="timeUpdateTrigger"
            @task-click="handleEditTask"
            class="mb-1"
          />
        </div>
        
        <!-- 已完成任务 -->
        <div v-if="completedTasks.length > 0">
          <h4 class="text-xs font-medium text-muted-foreground mb-2 px-2">{{ t('calendar.completedTasks') }} ({{ completedTasks.length }})</h4>
          <FlatTaskItem
            v-for="task in completedTasks"
            :key="task.id"
            :task="task"
            :search-query="searchQuery"
            :time-update-trigger="timeUpdateTrigger"
            @task-click="handleEditTask"
            class="mb-1 opacity-70"
          />
        </div>
      </div>
    </div>

    <!-- 右侧日历视图 -->
    <div class="flex-1 overflow-hidden">
      <UnifiedCalendar
        ref="calendarRef"
        :tasks="tasks"
        :loading="loading"
        :search-query="searchQuery"
        initial-view="month"
        @edit-task="handleEditTask"
        @create-task="handleCreateTask"
        @show-tooltip="handleShowTooltip"
        @hide-tooltip="handleHideTooltip"
        @date-range-change="handleDateRangeChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import UnifiedCalendar from './UnifiedCalendar.vue'
import FlatTaskItem from '../FlatTaskItem.vue'
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
  }
})

const emit = defineEmits([
  'edit-task',
  'create-task',
  'show-tooltip',
  'hide-tooltip'
])

const { t } = useI18n()

// Task store
const taskStore = useTaskStore()

// 时间更新触发器，用于实时更新任务时间显示
const timeUpdateTrigger = ref(0)
let timeUpdateInterval = null

// 日历组件引用
const calendarRef = ref(null)

// 日历时间范围状态
const calendarDateRange = ref({
  currentDate: new Date(),
  view: 'month',
  monthStart: null,
  monthEnd: null,
  weekStart: null,
  weekEnd: null
})


// 工具函数：判断两个日期是否是同一天
const isSameDay = (date1, date2) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
}



// 获取指定日期的任务（复制UnifiedCalendar的逻辑）
const getTasksForDate = (date) => {
  let allTasks = []
  
  // 始终包含普通任务
  if (props.tasks && props.tasks.length > 0) {
    allTasks = [...props.tasks]
  }
  
  // 如果显示重复实例，则添加重复任务实例
  if (taskStore.showRecurringInstances && taskStore.expandedTasks && taskStore.expandedTasks.length > 0) {
    const recurringInstances = taskStore.expandedTasks.filter(task => task.occurrence_date || task.occurrenceDate)
    allTasks = [...allTasks, ...recurringInstances]
  }
  
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
  })
}

// 获取月视图中所有日期的任务（与右侧日历联动）
const allMonthTasks = computed(() => {
  const { monthStart, monthEnd } = calendarDateRange.value
  
  if (!monthStart || !monthEnd) {
    return []
  }
  
  // 获取日历显示范围（包括前后月份的日期）
  const calendarStart = new Date(monthStart)
  const startDay = monthStart.getDay()
  calendarStart.setDate(calendarStart.getDate() - (startDay === 0 ? 6 : startDay - 1))
  
  const calendarEnd = new Date(monthEnd)
  const endDay = monthEnd.getDay()
  calendarEnd.setDate(calendarEnd.getDate() + (endDay === 0 ? 0 : 7 - endDay))
  
  // 收集所有日期的任务
  const allTasks = []
  const taskIds = new Set() // 用于去重
  
  for (let date = new Date(calendarStart); date <= calendarEnd; date.setDate(date.getDate() + 1)) {
    const dayTasks = getTasksForDate(date)
    dayTasks.forEach(task => {
      // 过滤掉重复任务实例（只显示真正的任务，不显示预览）
      const isRecurringInstance = task.id && task.id.startsWith('recurringTask_')
      if (!taskIds.has(task.id) && !isRecurringInstance) {
        taskIds.add(task.id)
        allTasks.push(task)
      }
    })
  }
  
  return allTasks.sort((a, b) => {
    // 按提醒时间排序（只处理真正的任务）
    const timeA = new Date(a.reminderTime || a.createdAt || 0).getTime()
    const timeB = new Date(b.reminderTime || b.createdAt || 0).getTime()
    return timeA - timeB
  })
})

// 未完成任务
const pendingTasks = computed(() => {
  return allMonthTasks.value.filter(task => task.status !== 'done')
})

// 已完成任务
const completedTasks = computed(() => {
  return allMonthTasks.value.filter(task => task.status === 'done')
})


// Handle task edit
const handleEditTask = (task) => {
  emit('edit-task', task)
}

// Handle task creation
const handleCreateTask = (data) => {
  emit('create-task', data)
}

// Handle tooltip show
const handleShowTooltip = (data) => {
  emit('show-tooltip', data)
}

// Handle tooltip hide
const handleHideTooltip = () => {
  emit('hide-tooltip')
}

// Handle calendar date range change
const handleDateRangeChange = (dateRange) => {
  calendarDateRange.value = dateRange
}

// 启动时间更新定时器
onMounted(() => {
  // 每秒更新一次时间触发器，用于实时显示任务进行时间
  timeUpdateInterval = setInterval(() => {
    timeUpdateTrigger.value++
  }, 1000)
})

// 清理定时器
onUnmounted(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval)
  }
})
</script>

<style scoped>
.monthly-view-container {
  display: flex;
  height: 100vh;
  background: var(--background);
  color: var(--foreground);
}

/* 左侧任务列表 */
.monthly-todo-sidebar {
  width: 320px;
  min-width: 320px;
  background: var(--card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.monthly-todo-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  background: var(--muted);
}

.monthly-todo-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
}

.monthly-todo-title i {
  color: var(--primary);
}

.monthly-todo-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--muted-foreground);
}

.todo-count {
  display: flex;
  align-items: center;
}

.completed-count {
  display: flex;
  align-items: center;
  color: var(--success, #22c55e);
}

.monthly-todo-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.monthly-todo-list::-webkit-scrollbar {
  width: 6px;
}

.monthly-todo-list::-webkit-scrollbar-track {
  background: transparent;
}

.monthly-todo-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.monthly-todo-list::-webkit-scrollbar-thumb:hover {
  background: var(--muted-foreground);
}

.monthly-todo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--muted-foreground);
}

.monthly-todo-empty i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.monthly-todo-empty p {
  margin: 0;
  font-size: 14px;
}

/* 右侧日历主体 */
.monthly-calendar-main {
  flex: 1;
  overflow: hidden;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .monthly-todo-sidebar {
    width: 280px;
    min-width: 280px;
  }
}

@media (max-width: 768px) {
  .monthly-view-container {
    flex-direction: column;
  }
  
  .monthly-todo-sidebar {
    width: 100%;
    min-width: unset;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  
  .monthly-calendar-main {
    flex: 1;
  }
}

/* 任务项样式调整 */
.monthly-todo-list :deep(.flat-task-item-wrapper) {
  margin-bottom: 4px;
}

.monthly-todo-list :deep(.flat-task-item) {
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--background);
  transition: all 0.2s ease;
}

.monthly-todo-list :deep(.flat-task-item:hover) {
  border-color: var(--primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.monthly-todo-list :deep(.flat-task-item-completed) {
  opacity: 0.7;
  background: var(--muted);
}

/* 任务状态指示器在侧边栏中的样式 */
.monthly-todo-list :deep(.flat-task-status-indicator) {
  width: 6px;
  height: 6px;
}

/* 任务时间信息在侧边栏中的样式 */
.monthly-todo-list :deep(.flat-task-time-info) {
  margin-top: 4px;
}

.monthly-todo-list :deep(.flat-task-reminder-time) {
  font-size: 11px;
}

.monthly-todo-list :deep(.flat-task-time) {
  font-size: 11px;
}
</style>
