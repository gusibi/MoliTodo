<template>
  <div>
    <h1 class="setting-page-title">统计信息</h1>
    <p class="setting-page-description">查看任务完成情况和使用统计</p>

    <!-- 活跃度热力图 -->
    <ActivityHeatmap 
      :data="activityData" 
      title="任务活跃度" 
      class="mb-6"
    />

    <!-- 每日状态趋势图表 -->
    <DailyStatusTrendChart class="mb-6" />


    <!-- 刷新按钮 -->
    <div class="setting-stats-actions">
      <button class="setting-btn setting-btn-primary" @click="refreshAllStats" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新统计' }}
      </button>
      <button class="setting-btn setting-btn-secondary" @click="cleanupOldLogs">
        清理过期日志
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { formatDuration } from '@/utils/task-utils.js'
import { useTaskStore } from '@/store/taskStore.js'
import ActivityHeatmap from '@/components/charts/ActivityHeatmap.vue'
import DailyStatusTrendChart from '@/components/charts/DailyStatusTrendChart.vue'

// 使用 store
const taskStore = useTaskStore()

// 响应式数据
const taskStats = ref(null)
const statusChangeStats = ref(null)
const completionStats = ref(null)
const efficiencyStats = ref(null)
const logStats = ref(null)
const activityData = ref([])
const loading = ref(false)

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

const loadStatusChangeStats = async () => {
  try {
    statusChangeStats.value = await taskStore.getStatusChangeStatistics()
  } catch (error) {
    console.error('加载状态变化统计失败:', error)
    statusChangeStats.value = null
  }
}

const loadCompletionStats = async () => {
  try {
    completionStats.value = await taskStore.getCompletionStatistics()
  } catch (error) {
    console.error('加载完成统计失败:', error)
    completionStats.value = null
  }
}

const loadEfficiencyStats = async () => {
  try {
    efficiencyStats.value = await taskStore.getTaskEfficiencyStats()
  } catch (error) {
    console.error('加载效率统计失败:', error)
    efficiencyStats.value = null
  }
}

const loadLogStats = async () => {
  try {
    logStats.value = await taskStore.getLogStatistics()
  } catch (error) {
    console.error('加载日志统计失败:', error)
    logStats.value = null
  }
}

const loadActivityData = async () => {
  try {
    // console.log('StatisticsSettings - 开始加载活跃度数据')
    const result = await taskStore.getDailyActivityData(365)
    // console.log('StatisticsSettings - 获取到的活跃度数据:', result)
    activityData.value = result
  } catch (error) {
    console.error('加载活跃度数据失败:', error)
    activityData.value = []
  }
}

const refreshAllStats = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadTaskStats(),
      loadStatusChangeStats(),
      loadCompletionStats(),
      loadEfficiencyStats(),
      loadLogStats(),
      loadActivityData()
    ])
  } finally {
    loading.value = false
  }
}

const cleanupOldLogs = async () => {
  try {
    const result = await taskStore.cleanupOldLogs(90)
    alert(`已清理 ${result} 条过期日志记录`)
    await loadLogStats() // 重新加载日志统计
  } catch (error) {
    console.error('清理过期日志失败:', error)
    alert('清理过期日志失败')
  }
}

// 辅助方法
const formatTransition = (transition) => {
  const [from, to] = transition.split('->')
  const statusMap = {
    'null': '新建',
    'todo': '待办',
    'doing': '进行中',
    'pause': '暂停',
    'done': '已完成'
  }
  return `${statusMap[from] || from} → ${statusMap[to] || to}`
}

const formatDateTime = (dateString) => {
  if (!dateString) return '无'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 生命周期
onMounted(async () => {
  await refreshAllStats()
})
</script>
<style scoped>
@import '@/assets/styles/components/settings.css';

.setting-stats-subtitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 12px 0 8px 0;
}

.setting-stats-transitions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.setting-stats-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.setting-stats-actions .setting-btn {
  flex: 0 0 auto;
}

.setting-stats-container + .setting-stats-container {
  margin-top: 24px;
}
</style>