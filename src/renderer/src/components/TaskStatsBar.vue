<template>
  <div class="task-manager-stats-bar flex-shrink-0">
    <div class="task-manager-stats-item">
      <span class="task-manager-stats-label">总任务:</span>
      <span class="task-manager-stats-value">{{ displayTasks.length }}</span>
    </div>
    <div class="task-manager-stats-item">
      <span class="task-manager-stats-label">已完成:</span>
      <span class="task-manager-stats-value">{{ doneCount }}</span>
    </div>
    <div class="task-manager-stats-item">
      <span class="task-manager-stats-label">进行中:</span>
      <span class="task-manager-stats-value">{{ doingCount }}</span>
    </div>
    <div class="task-manager-stats-item">
      <span class="task-manager-stats-label">暂停中:</span>
      <span class="task-manager-stats-value">{{ pausedCount }}</span>
    </div>
    <div class="task-manager-stats-item">
      <span class="task-manager-stats-label">总耗时:</span>
      <span class="task-manager-stats-value">{{ formattedTotalDuration }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatDurationEn, getTaskStatusCounts, calculateTotalDuration } from '../utils/task-utils'

const props = defineProps({
  displayTasks: {
    type: Array,
    required: true
  }
})

// 基于displayTasks计算各种统计信息
const statusCounts = computed(() => {
  return getTaskStatusCounts(props.displayTasks)
})

const doneCount = computed(() => statusCounts.value.done)
const doingCount = computed(() => statusCounts.value.doing)
const pausedCount = computed(() => statusCounts.value.paused)

const totalDuration = computed(() => {
  return calculateTotalDuration(props.displayTasks)
})

const formattedTotalDuration = computed(() => {
  return formatDurationEn(totalDuration.value)
})
</script>

<style scoped>
/* 样式已在 task-manager.css 中定义 */
</style>