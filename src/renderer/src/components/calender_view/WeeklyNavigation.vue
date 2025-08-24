<template>
  <div class="weekly-navigation">
    <!-- Previous week button -->
    <button 
      class="weekly-nav-btn weekly-nav-prev"
      @click="navigatePrevious"
      title="上一周"
    >
      <i class="fas fa-chevron-left"></i>
    </button>
    
    <!-- Week range display -->
    <div class="weekly-nav-range">
      <span class="weekly-nav-range-text">{{ weekRangeText }}</span>
    </div>
    
    <!-- Today button -->
    <button 
      class="weekly-nav-btn weekly-nav-today"
      @click="goToToday"
      :class="{ 'weekly-nav-today-active': isCurrentWeek }"
      title="回到本周"
    >
      今天
    </button>
    
    <!-- Next week button -->
    <button 
      class="weekly-nav-btn weekly-nav-next"
      @click="navigateNext"
      title="下一周"
    >
      <i class="fas fa-chevron-right"></i>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentWeekStart: {
    type: Date,
    required: true
  },
  currentWeekEnd: {
    type: Date,
    required: true
  }
})

const emit = defineEmits([
  'navigate-week',
  'go-to-current'
])

// Format week range text
const weekRangeText = computed(() => {
  const startMonth = props.currentWeekStart.getMonth() + 1
  const startDay = props.currentWeekStart.getDate()
  const endMonth = props.currentWeekEnd.getMonth() + 1
  const endDay = props.currentWeekEnd.getDate()
  const year = props.currentWeekStart.getFullYear()
  
  // If same month
  if (startMonth === endMonth) {
    return `${year}年${startMonth}月${startDay}-${endDay}日`
  } else {
    return `${year}年${startMonth}月${startDay}日-${endMonth}月${endDay}日`
  }
})

// Check if current week is this week
const isCurrentWeek = computed(() => {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  
  // Get start of this week (Monday)
  const thisWeekStart = new Date(todayStart)
  const dayOfWeek = thisWeekStart.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  thisWeekStart.setDate(thisWeekStart.getDate() - daysToMonday)
  
  return props.currentWeekStart.getTime() === thisWeekStart.getTime()
})

// Navigate to previous week
const navigatePrevious = () => {
  emit('navigate-week', -1)
}

// Navigate to next week
const navigateNext = () => {
  emit('navigate-week', 1)
}

// Go to current week
const goToToday = () => {
  emit('go-to-current')
}
</script>

<style>
@import '@/assets/styles/components/weekly-view.css';
</style>