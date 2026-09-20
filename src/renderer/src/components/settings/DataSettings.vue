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
            <Button variant="default" class="setting-btn setting-btn-primary" @click="exportData">导出数据</Button>
            <Button variant="default" class="setting-btn setting-btn-primary" @click="importData">导入数据</Button>
            <Button ref="clearBtn" variant="destructive" class="setting-btn setting-btn-danger" @click="requestClear">
              清除所有数据
            </Button>
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

    <!-- 清除所有数据确认 -->
    <AlertDialog :open="clearDialogOpen" :title="t('settings.dataClearTitle')"
      :description="t('settings.dataClearConfirm')" :cancel-label="t('common.cancel')"
      :confirm-label="t('settings.dataClearAction')" confirm-variant="destructive" :loading="clearLoading"
      :error="clearError"
      @update:open="(value) => { if (!value) clearDialogOpen = false }" @confirm="confirmClear"
      @cancel="cancelClear" />
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'
import Button from '../ui/button/Button.vue'
import AlertDialog from '../ui/alert-dialog/AlertDialog.vue'

const { t } = useI18n()
const taskStore = useTaskStore()
const databaseStats = ref(null)

const emit = defineEmits(['show-message'])

const clearBtn = ref(null)
const clearDialogOpen = ref(false)
const clearLoading = ref(false)
const clearError = ref('')

const requestClear = () => {
  clearError.value = ''
  clearLoading.value = false
  clearDialogOpen.value = true
}

// 方法
const exportData = async () => {
  try {
    const result = await taskStore.exportData()
    if (result.success) {
      emit('show-message', `数据已导出到: ${result.path}`, 'success')
    } else if (result.canceled) {
      emit('show-message', '导出已取消', 'info')
    } else {
      emit('show-message', '导出失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('导出数据失败:', error)
    emit('show-message', '导出数据失败', 'error')
  }
}

const importData = async () => {
  try {
    const result = await taskStore.importData()
    if (result.success) {
      emit('show-message', '数据导入成功，应用将重启以应用更改', 'success')
      // 重启应用
      setTimeout(() => {
        if (window.electronAPI && window.electronAPI.app) {
          window.electronAPI.app.restart()
        }
      }, 2000)
    } else if (result.canceled) {
      emit('show-message', '导入已取消', 'info')
    } else {
      emit('show-message', '导入失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('导入数据失败:', error)
    emit('show-message', '导入数据失败', 'error')
  }
}

const confirmClear = async () => {
  if (clearLoading.value) return
  clearLoading.value = true
  clearError.value = ''
  try {
    const result = await taskStore.clearAllData()
    if (!result || result.success === false) {
      clearError.value = '清除失败: ' + (result?.error || '')
      return
    }
    clearDialogOpen.value = false
    emit('show-message', '所有数据已清除，应用将重启', 'success')
    // 重启应用
    setTimeout(() => {
      if (window.electronAPI && window.electronAPI.app) {
        window.electronAPI.app.restart()
      }
    }, 2000)
  } catch (error) {
    console.error('清除数据失败:', error)
    clearError.value = '清除数据失败'
  } finally {
    clearLoading.value = false
  }
}

const cancelClear = () => {
  clearError.value = ''
  nextTick(() => {
    clearBtn.value?.focus?.()
  })
}

const loadDatabaseStats = async () => {
  try {
    databaseStats.value = await taskStore.getDatabaseStats()
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