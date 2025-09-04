<template>
  <div>
    <h1 class="setting-page-title">统计信息</h1>
    <p class="setting-page-description">查看任务完成情况和使用统计</p>

    <div v-if="taskStats" class="setting-stats-container">
      <h3 class="setting-stats-title">任务统计</h3>
      <div class="setting-stats-item">
        <span class="setting-stats-label">已完成任务:</span>
        <span class="setting-stats-value">{{ taskStats.totalCompletedTasks }}</span>
      </div>
      <div class="setting-stats-item">
        <span class="setting-stats-label">总工作时间:</span>
        <span class="setting-stats-value">{{ formatDuration(taskStats.totalWorkTime) }}</span>
      </div>
      <div class="setting-stats-item">
        <span class="setting-stats-label">进行中任务:</span>
        <span class="setting-stats-value">{{ taskStats.inProgressTasksCount }}</span>
      </div>
      <div class="setting-stats-item">
        <span class="setting-stats-label">平均任务时间:</span>
        <span class="setting-stats-value">{{ formatDuration(taskStats.averageTaskTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { formatDuration } from '@/utils/task-utils.js'

const taskStats = ref(null)

// 方法
const loadTaskStats = async () => {
  try {
    if (window.electronAPI && window.electronAPI.stats) {
      taskStats.value = await window.electronAPI.stats.getTaskStats()
    }
  } catch (error) {
    console.error('加载任务统计信息失败:', error)
  }
}

// 生命周期
onMounted(async () => {
  await loadTaskStats()
})
</script>
<style scoped>
@import '@/assets/styles/components/settings.css';
</style>