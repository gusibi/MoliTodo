<template>
  <div>
    <h1 class="setting-page-title">数据管理</h1>
    <p class="setting-page-description">管理应用数据，包括备份、恢复和清除</p>

    <div class="setting-group">
      <h3 class="setting-group-title">数据操作</h3>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">数据备份与恢复</div>
          <div class="setting-item-description">导出或导入任务数据，清除所有数据</div>
        </div>
        <div class="setting-item-control">
          <div class="setting-button-group">
            <button class="setting-btn setting-btn-primary" @click="exportData">导出数据</button>
            <button class="setting-btn setting-btn-primary" @click="importData">导入数据</button>
            <button class="setting-btn setting-btn-danger" @click="clearAllData">清除所有数据</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="databaseStats" class="setting-stats-container">
      <h3 class="setting-stats-title">数据库信息</h3>
      <div class="setting-stats-item">
        <span class="setting-stats-label">任务数量:</span>
        <span class="setting-stats-value">{{ databaseStats.taskCount }}</span>
      </div>
      <div class="setting-stats-item">
        <span class="setting-stats-label">数据库大小:</span>
        <span class="setting-stats-value">{{ formatFileSize(databaseStats.fileSize) }}</span>
      </div>
      <div class="setting-stats-item">
        <span class="setting-stats-label">数据库路径:</span>
        <span class="setting-stats-value">{{ databaseStats.path }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const taskStore = useTaskStore()
const databaseStats = ref(null)

const emit = defineEmits(['show-message'])

// 方法
const exportData = async () => {
  try {
    if (window.electronAPI && window.electronAPI.data) {
      const result = await window.electronAPI.data.exportData()
      if (result.success) {
        emit('show-message', `数据已导出到: ${result.path}`, 'success')
      } else {
        emit('show-message', '导出失败: ' + result.error, 'error')
      }
    }
  } catch (error) {
    console.error('导出数据失败:', error)
    emit('show-message', '导出数据失败', 'error')
  }
}

const importData = async () => {
  try {
    if (window.electronAPI && window.electronAPI.data) {
      const result = await window.electronAPI.data.importData()
      if (result.success) {
        emit('show-message', '数据导入成功，应用将重启以应用更改', 'success')
        // 重启应用
        setTimeout(() => {
          if (window.electronAPI && window.electronAPI.app) {
            window.electronAPI.app.restart()
          }
        }, 2000)
      } else {
        emit('show-message', '导入失败: ' + result.error, 'error')
      }
    }
  } catch (error) {
    console.error('导入数据失败:', error)
    emit('show-message', '导入数据失败', 'error')
  }
}

const clearAllData = async () => {
  try {
    if (window.electronAPI && window.electronAPI.data) {
      if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
        const result = await window.electronAPI.data.clearAllData()
        if (result.success) {
          emit('show-message', '所有数据已清除，应用将重启', 'success')
          // 重启应用
          setTimeout(() => {
            if (window.electronAPI && window.electronAPI.app) {
              window.electronAPI.app.restart()
            }
          }, 2000)
        } else {
          emit('show-message', '清除失败: ' + result.error, 'error')
        }
      }
    }
  } catch (error) {
    console.error('清除数据失败:', error)
    emit('show-message', '清除数据失败', 'error')
  }
}

const loadDatabaseStats = async () => {
  try {
    if (window.electronAPI && window.electronAPI.data) {
      databaseStats.value = await window.electronAPI.data.getStats()
    }
  } catch (error) {
    console.error('加载数据库统计信息失败:', error)
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 初始化
loadDatabaseStats()
</script>
<style scoped>
@import '@/assets/styles/components/settings.css';
</style>