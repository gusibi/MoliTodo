<template>
  <div class="task-manager-main-content">
    <div class="min-h-0 flex-1">
      <HealthReminderView v-if="tool === 'health'" />
      <FocusView v-else-if="tool === 'focus'" />
      <GardenView v-else-if="tool === 'garden'" />
    </div>
  </div>
</template>

<script setup>
import HealthReminderView from './HealthReminderView.vue'
import FocusView from './FocusView.vue'
import GardenView from './GardenView.vue'

defineProps({
  tool: {
    type: String,
    required: true
  }
})
</script>

<style>
@import '@/assets/styles/components/tool-views.css';
</style>
