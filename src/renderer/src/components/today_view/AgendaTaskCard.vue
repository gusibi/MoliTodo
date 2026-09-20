<template>
  <div class="agenda-task-card">
    <FlatTaskItem :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
      :badges="badges" @task-click="(t) => $emit('task-click', t)" />
    <button v-if="showSchedule" type="button" class="agenda-task-schedule-btn"
      :title="$t('today.scheduleAction')" @click.stop="$emit('schedule')">
      <i class="fas fa-calendar-plus"></i>
      <span>{{ $t('today.scheduleAction') }}</span>
    </button>
  </div>
</template>

<script setup>
import FlatTaskItem from '../FlatTaskItem.vue'

defineProps({
  task: { type: Object, required: true },
  searchQuery: { type: String, default: '' },
  timeUpdateTrigger: { type: Number, default: 0 },
  badges: { type: Array, default: () => [] },
  showSchedule: { type: Boolean, default: false }
})

defineEmits(['task-click', 'schedule'])
</script>
