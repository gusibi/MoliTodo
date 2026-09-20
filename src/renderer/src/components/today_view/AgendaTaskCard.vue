<template>
  <div class="agenda-task-card">
    <FlatTaskItem
      :task="task"
      :search-query="searchQuery"
      :time-update-trigger="timeUpdateTrigger"
      :badges="badges"
      variant="today"
      @task-click="(t) => $emit('task-click', t)"
      @delete-request="(payload) => $emit('delete-request', payload)"
    />
    <Button
      v-if="showSchedule"
      type="button"
      variant="outline"
      size="sm"
      class="agenda-task-schedule-btn"
      @click.stop="$emit('schedule')"
    >
      <CalendarPlus class="h-icon-sm w-icon-sm" aria-hidden="true" />
      <span>{{ $t('today.scheduleAction') }}</span>
    </Button>
  </div>
</template>

<script setup>
import { CalendarPlus } from '@lucide/vue'
import FlatTaskItem from '../FlatTaskItem.vue'
import Button from '../ui/button/Button.vue'

defineProps({
  task: { type: Object, required: true },
  searchQuery: { type: String, default: '' },
  timeUpdateTrigger: { type: Number, default: 0 },
  badges: { type: Array, default: () => [] },
  showSchedule: { type: Boolean, default: false }
})

defineEmits(['task-click', 'schedule', 'delete-request'])
</script>
