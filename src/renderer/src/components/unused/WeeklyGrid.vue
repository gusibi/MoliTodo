<template>
  <div class="weekly-grid-container">
    <!-- Headers (fixed at top) -->
    <div class="weekly-grid-headers">
      <!-- Time column header -->
      <div class="weekly-time-column-header" ref="timeColumnHeader">时间</div>
      <!-- Day headers -->
      <div class="weekly-days-header" ref="daysHeader">
        <div 
          v-for="(day, index) in formattedWeekDays"
          :key="`header-${day.date.getTime()}-${index}`"
          class="weekly-day-header"
          :class="{ 'weekly-day-header-today': day.isToday }"
        >
          <div class="weekly-day-name">{{ day.dayName }}</div>
          <div class="weekly-day-number" :class="{ 'weekly-day-number-today': day.isToday }">
            {{ day.dayNumber }}
          </div>
        </div>
      </div>
    </div>

    <!-- Scrollable content area -->
    <div class="weekly-grid-content">
      <div 
        v-for="timeSlot in timeSlots" 
        :key="`slot-${timeSlot.id}`"
        class="weekly-time-slot-row"
        :class="{ 'expanded': isAnySlotExpanded(timeSlot.id) }"
        :ref="el => setTimeSlotRef(el, timeSlot.id)"
      >
        <!-- Time slot label (left column) -->
        <div class="weekly-time-slot-label">{{ timeSlot.label }}</div>
        
        <!-- Day slots (right columns) -->
        <div class="weekly-day-slots">
          <div 
            v-for="(day, dayIndex) in formattedWeekDays"
            :key="`${timeSlot.id}-${day.date.getTime()}-${dayIndex}`"
            class="weekly-day-slot"
            :class="{ 'weekly-day-slot-today': day.isToday }"
          >
            <div class="weekly-day-slot-tasks">
              <div v-if="getTasksForDayAndSlot(day, timeSlot).length > 0" class="weekly-day-slot-task-list">
                <!-- Show visible tasks -->
                <WeeklyTaskCard
                  v-for="task in getVisibleTasksForDayAndSlot(day, timeSlot)"
                  :key="task.id"
                  :task="task"
                  :show-time="true"
                  @edit="handleEditTask"
                  @show-tooltip="handleShowTooltip"
                  @hide-tooltip="handleHideTooltip"
                />
                
                <!-- Show more button if there are hidden tasks -->
                <div 
                  v-if="getHiddenTasksCountForDayAndSlot(day, timeSlot) > 0"
                  class="weekly-day-slot-more"
                  @click="toggleTimeSlotExpanded(timeSlot.id)"
                >
                  <span v-if="!expandedSlots.has(timeSlot.id)">
                    +{{ getHiddenTasksCountForDayAndSlot(day, timeSlot) }}
                  </span>
                  <span v-else>
                    收起
                  </span>
                </div>
              </div>
              
              <!-- Empty state for day slot -->
              <div v-else class="weekly-day-slot-empty">
                <!-- Empty placeholder -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, watch } from 'vue'
import WeeklyTaskCard from './WeeklyTaskCard.vue'

const props = defineProps({
  weekDays: {
    type: Array,
    required: true,
    validator: (days) => {
      return Array.isArray(days) && days.length === 7
    }
  },
  currentWeekStart: {
    type: Date,
    required: true
  }
})

const emit = defineEmits([
  'edit-task',
  'show-tooltip',
  'hide-tooltip'
])

// 每个时间段最多显示的任务数量
const MAX_TASKS_PER_SLOT = 3

// 时间段展开状态
const expandedSlots = ref(new Set())

// 存储时间列和日期列的DOM引用
const timeSlotRefs = ref(new Map())
const timeColumnHeader = ref(null)
const daysHeader = ref(null)

// 定义时间段（凌晨在最上，按6小时分割成4个部分）
const timeSlots = [
  { id: 'night', label: '凌晨 (00:00-06:00)', start: 0, end: 6 },
  { id: 'morning', label: '上午 (06:00-12:00)', start: 6, end: 12 },
  { id: 'afternoon', label: '下午 (12:00-18:00)', start: 12, end: 18 },
  { id: 'evening', label: '晚上 (18:00-24:00)', start: 18, end: 24 }
]

// 设置时间列的ref
const setTimeSlotRef = (el, slotId) => {
  if (el) {
    timeSlotRefs.value.set(slotId, el)
  } else {
    timeSlotRefs.value.delete(slotId)
  }
}

// 同步时间列和日期列的高度
const syncSlotHeights = async () => {
  await nextTick()
  
  // 同步头部高度
  if (timeColumnHeader.value && daysHeader.value) {
    const daysHeaderHeight = daysHeader.value.offsetHeight
    timeColumnHeader.value.style.height = `${daysHeaderHeight}px`
  }
}

// Generate day headers with proper formatting
const formattedWeekDays = computed(() => {
  return props.weekDays.map((day) => {
    // Use the day data directly from WeeklyView
    return {
      ...day,
      // Ensure all required properties are present
      date: day.date,
      dayName: day.dayName,
      dayNumber: day.dayNumber,
      isToday: day.isToday,
      tasks: day.tasks || []
    }
  })
})

// 监听任务数据变化，同步高度
watch(() => props.weekDays, () => {
  syncSlotHeights()
}, { deep: true })

// 监听展开状态变化，同步高度
watch(expandedSlots, () => {
  syncSlotHeights()
}, { deep: true })

// 获取指定天和时间段内的任务
const getTasksForDayAndSlot = (day, timeSlot) => {
  if (!day.tasks || day.tasks.length === 0) {
    return []
  }

  return day.tasks.filter(task => {
    if (!task.reminderTime) {
      // 没有提醒时间的任务放在上午时间段
      return timeSlot.start === 6 && timeSlot.end === 12
    }

    const reminderDate = new Date(task.reminderTime)
    const hour = reminderDate.getHours()
    
    // 处理跨天的情况（凌晨时间段）
    if (timeSlot.start > timeSlot.end) {
      return hour >= timeSlot.start || hour < timeSlot.end
    }
    
    return hour >= timeSlot.start && hour < timeSlot.end
  }).sort((a, b) => {
    // 按提醒时间排序
    if (a.reminderTime && b.reminderTime) {
      return new Date(a.reminderTime) - new Date(b.reminderTime)
    }
    
    // 有提醒时间的任务优先
    if (a.reminderTime && !b.reminderTime) return -1
    if (!a.reminderTime && b.reminderTime) return 1
    
    // 都没有提醒时间时按创建时间排序
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  })
}

// 获取指定天和时间段中可见的任务
const getVisibleTasksForDayAndSlot = (day, timeSlot) => {
  const tasks = getTasksForDayAndSlot(day, timeSlot)
  if (expandedSlots.value.has(timeSlot.id)) {
    return tasks
  }
  return tasks.slice(0, MAX_TASKS_PER_SLOT)
}

// 获取指定天和时间段中隐藏的任务数量
const getHiddenTasksCountForDayAndSlot = (day, timeSlot) => {
  const tasks = getTasksForDayAndSlot(day, timeSlot)
  if (expandedSlots.value.has(timeSlot.id)) {
    return 0
  }
  return Math.max(0, tasks.length - MAX_TASKS_PER_SLOT)
}

// 检查某个时间段是否有任何一天被展开
const isAnySlotExpanded = (slotId) => {
  return expandedSlots.value.has(slotId)
}

// 切换时间段展开状态
const toggleTimeSlotExpanded = (slotId) => {
  if (expandedSlots.value.has(slotId)) {
    expandedSlots.value.delete(slotId)
  } else {
    expandedSlots.value.add(slotId)
  }
  
  // 触发高度同步
  syncSlotHeights()
}

// 处理任务编辑
const handleEditTask = (task) => {
  emit('edit-task', task)
}

// 处理显示工具提示
const handleShowTooltip = (data) => {
  emit('show-tooltip', data)
}

// 处理隐藏工具提示
const handleHideTooltip = () => {
  emit('hide-tooltip')
}
</script>

<style>
@import '@/assets/styles/components/weekly-view.css';
</style>