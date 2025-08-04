<template>
  <div class="weekly-grid">
    <WeeklyColumn
      v-for="(day, index) in formattedWeekDays"
      :key="`${day.date.getTime()}-${index}`"
      :day="day"
      :is-today="day.isToday"
      @edit-task="handleEditTask"
      @show-tooltip="handleShowTooltip"
      @hide-tooltip="handleHideTooltip"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import WeeklyColumn from './WeeklyColumn.vue'

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