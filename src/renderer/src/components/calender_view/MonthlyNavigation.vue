<template>
  <div class="monthly-navigation">
    <div class="monthly-navigation-header">
      <button 
        @click="navigatePrevious"
        :disabled="!canNavigateBack"
        title="上一月"
        class="monthly-nav-btn"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      
      <div class="monthly-title">
        <h2 class="monthly-title-text">{{ monthTitle }}</h2>
      </div>
      
      <button 
        @click="navigateNext"
        :disabled="!canNavigateForward"
        title="下一月"
        class="monthly-nav-btn"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
    
    <div class="monthly-navigation-actions">
      <button 
        @click="goToToday"
        :class="[
          'monthly-today-btn',
          isCurrentMonth ? 'monthly-today-btn-current' : 'monthly-today-btn-normal'
        ]"
      >
        今天
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentMonth: {
    type: Date,
    required: true
  },
  canNavigateBack: {
    type: Boolean,
    default: true
  },
  canNavigateForward: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'navigate-month',
  'go-to-today'
])

// Format month title
const monthTitle = computed(() => {
  const year = props.currentMonth.getFullYear()
  const month = props.currentMonth.getMonth() + 1
  return `${year}年${month}月`
})

// Check if current month is today's month
const isCurrentMonth = computed(() => {
  const today = new Date()
  return props.currentMonth.getFullYear() === today.getFullYear() &&
         props.currentMonth.getMonth() === today.getMonth()
})

// Navigation methods
const navigatePrevious = () => {
  if (props.canNavigateBack) {
    emit('navigate-month', -1)
  }
}

const navigateNext = () => {
  if (props.canNavigateForward) {
    emit('navigate-month', 1)
  }
}

const goToToday = () => {
  emit('go-to-today')
}
</script>

<style>
@import '@/assets/styles/components/monthly-calendar.css';
</style>