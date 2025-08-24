<template>
  <UnifiedCalendar
    :tasks="tasks"
    :loading="loading"
    :search-query="searchQuery"
    initial-view="month"
    @edit-task="handleEditTask"
    @create-task="handleCreateTask"
    @show-tooltip="handleShowTooltip"
    @hide-tooltip="handleHideTooltip"
  />
</template>

<script setup>
import UnifiedCalendar from './UnifiedCalendar.vue'

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
</script>

