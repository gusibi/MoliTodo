<template>
  <div class="weekly-column" :class="{ 'weekly-column-today': isToday }">
    <!-- Day header -->
    <div class="weekly-column-header">
      <div class="weekly-column-day-name">{{ day.dayName }}</div>
      <div class="weekly-column-day-number" :class="{ 'weekly-column-day-number-today': isToday }">
        {{ day.dayNumber }}
      </div>
    </div>
    
    <!-- Time slots container -->
    <div class="weekly-column-time-slots">
      <div 
        v-for="timeSlot in timeSlots" 
        :key="timeSlot.id"
        class="weekly-time-slot"
      >
        <!-- Time slot header -->
        <div class="weekly-time-slot-header">
          <span class="weekly-time-slot-label">{{ timeSlot.label }}</span>
        </div>
        
        <!-- Tasks in this time slot -->
        <div class="weekly-time-slot-tasks">
          <div v-if="timeSlot.tasks.length > 0" class="weekly-time-slot-task-list">
            <!-- Show visible tasks -->
            <WeeklyTaskCard
              v-for="task in getVisibleTasks(timeSlot)"
              :key="task.id"
              :task="task"
              :show-time="true"
              @edit="handleEditTask"
              @show-tooltip="handleShowTooltip"
              @hide-tooltip="handleHideTooltip"
            />
            
            <!-- Show more button if there are hidden tasks -->
            <div 
              v-if="getHiddenTasksCount(timeSlot) > 0"
              class="weekly-time-slot-more"
              @click="toggleTimeSlotExpanded(timeSlot.id)"
            >
              <span v-if="!timeSlot.expanded">
                还有 {{ getHiddenTasksCount(timeSlot) }} 个任务
              </span>
              <span v-else>
                收起
              </span>
            </div>
          </div>
          
          <!-- Empty state for time slot -->
          <div v-else class="weekly-time-slot-empty">
            <span class="weekly-time-slot-empty-text">无任务</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
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

// 每个时间段最多显示的任务数量
const MAX_TASKS_PER_SLOT = 3

// 时间段展开状态
const expandedSlots = ref(new Set())

// 定义时间段（按6小时分割成4个部分）
const timeSlots = computed(() => {
  const slots = [
    { id: 'morning', label: '上午 (06:00-12:00)', start: 6, end: 12 },
    { id: 'afternoon', label: '下午 (12:00-18:00)', start: 12, end: 18 },
    { id: 'evening', label: '晚上 (18:00-24:00)', start: 18, end: 24 },
    { id: 'night', label: '凌晨 (00:00-06:00)', start: 0, end: 6 }
  ]

  return slots.map(slot => {
    const tasks = getTasksForTimeSlot(slot.start, slot.end)
    return {
      ...slot,
      tasks,
      expanded: expandedSlots.value.has(slot.id)
    }
  })
})

// 获取指定时间段内的任务
const getTasksForTimeSlot = (startHour, endHour) => {
  if (!props.day.tasks || props.day.tasks.length === 0) {
    return []
  }

  return props.day.tasks.filter(task => {
    if (!task.reminderTime) {
      // 没有提醒时间的任务放在上午时间段
      return startHour === 6 && endHour === 12
    }

    const reminderDate = new Date(task.reminderTime)
    const hour = reminderDate.getHours()
    
    // 处理跨天的情况（凌晨时间段）
    if (startHour > endHour) {
      return hour >= startHour || hour < endHour
    }
    
    return hour >= startHour && hour < endHour
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

// 获取时间段中可见的任务
const getVisibleTasks = (timeSlot) => {
  if (timeSlot.expanded) {
    return timeSlot.tasks
  }
  return timeSlot.tasks.slice(0, MAX_TASKS_PER_SLOT)
}

// 获取时间段中隐藏的任务数量
const getHiddenTasksCount = (timeSlot) => {
  if (timeSlot.expanded) {
    return 0
  }
  return Math.max(0, timeSlot.tasks.length - MAX_TASKS_PER_SLOT)
}

// 切换时间段展开状态
const toggleTimeSlotExpanded = (slotId) => {
  if (expandedSlots.value.has(slotId)) {
    expandedSlots.value.delete(slotId)
  } else {
    expandedSlots.value.add(slotId)
  }
}

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