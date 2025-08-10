<template>
  <div class="flex flex-col gap-3 p-4 border-b border-gray-200 bg-white">
    <div class="flex items-center justify-between">
      <button 
        @click="navigatePrevious"
        :disabled="!canNavigateBack"
        title="上一月"
        class="flex items-center justify-center w-8 h-8 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      
      <div class="flex-1 text-center">
        <h2 class="text-lg font-semibold text-gray-900">{{ monthTitle }}</h2>
      </div>
      
      <button 
        @click="navigateNext"
        :disabled="!canNavigateForward"
        title="下一月"
        class="flex items-center justify-center w-8 h-8 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
    
    <div class="flex justify-center">
      <button 
        @click="goToToday"
        :class="[
          'px-3 py-1 text-sm rounded-md transition-all duration-200',
          isCurrentMonth 
            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
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