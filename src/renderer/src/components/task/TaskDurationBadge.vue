<template>
  <span v-if="badge" class="today-task-time" :class="badge.className">
    <component :is="badge.icon" class="h-2.5 w-2.5" aria-hidden="true" />
    <span>{{ badge.text }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { Check, Clock, Pause, Play } from '@lucide/vue'
import { formatDuration, getCurrentDuration, isTaskOvertime } from '@/utils/task-utils'

/**
 * Today 行耗时徽标：收起态元信息行与展开态标题行共用。
 * 进行中读取 timeUpdateTrigger 以按秒刷新，其余状态读取任务累计耗时。
 */
const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  timeUpdateTrigger: {
    type: Number,
    default: 0
  }
})

const status = computed(() => props.task.status || (props.task.completed ? 'done' : 'todo'))

const badge = computed(() => {
  if (status.value === 'doing') {
    props.timeUpdateTrigger
    const overtime = isTaskOvertime(props.task)
    return {
      className: overtime ? 'today-task-time-overtime' : 'today-task-time-doing',
      icon: overtime ? Clock : Play,
      text: formatDuration(getCurrentDuration(props.task))
    }
  }
  if (status.value === 'paused') {
    return {
      className: 'today-task-time-paused',
      icon: Pause,
      text: formatDuration(props.task.totalDuration || 0)
    }
  }
  if (status.value === 'done' && props.task.totalDuration) {
    return {
      className: 'today-task-time-completed',
      icon: Check,
      text: formatDuration(props.task.totalDuration)
    }
  }
  return null
})
</script>
