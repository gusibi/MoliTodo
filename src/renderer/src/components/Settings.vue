<template>
  <div class="settings-container">
    <div class="settings-header">
      <h1 class="settings-title">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/>
        </svg>
        设置
      </h1>
    </div>
    
    <div class="settings-content">
      <!-- 外观设置 -->
      <div class="settings-section">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" stroke="currentColor" stroke-width="2"/>
          </svg>
          外观设置
        </h2>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">主题模式</div>
            <div class="setting-description">选择应用的外观主题</div>
          </div>
          <div class="setting-control">
            <ThemeSwitcher />
          </div>
        </div>
      </div>

      <!-- 基本设置 -->
      <div class="settings-section">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2"/>
          </svg>
          基本设置
        </h2>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">开机自启动</div>
            <div class="setting-description">系统启动时自动运行应用</div>
          </div>
          <div class="setting-control">
            <div 
              class="toggle-switch" 
              :class="{ active: config.autoStart }"
              @click="toggleAutoStart"
            ></div>
          </div>
        </div>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">显示通知</div>
            <div class="setting-description">接收任务提醒和系统通知</div>
          </div>
          <div class="setting-control">
            <div 
              class="toggle-switch" 
              :class="{ active: config.showNotifications }"
              @click="toggleNotifications"
            ></div>
          </div>
        </div>
      </div>

      <!-- 悬浮图标设置 -->
      <div class="settings-section">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
          </svg>
          悬浮图标
        </h2>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">显示悬浮图标</div>
            <div class="setting-description">在桌面显示任务管理悬浮图标</div>
          </div>
          <div class="setting-control">
            <div 
              class="toggle-switch" 
              :class="{ active: config.floatingIcon.visible }"
              @click="toggleFloatingIcon"
            ></div>
          </div>
        </div>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">图标大小</div>
            <div class="setting-description">调整悬浮图标的显示大小</div>
          </div>
          <div class="setting-control">
            <div class="number-input-group">
              <input 
                type="number"
                class="number-input"
                min="40" 
                max="100" 
                v-model="config.floatingIcon.size"
                @input="updateConfig('floatingIcon.size', parseInt(config.floatingIcon.size))"
              />
              <span class="unit-label">px</span>
            </div>
          </div>
        </div>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">透明度</div>
            <div class="setting-description">调整悬浮图标的透明度</div>
          </div>
          <div class="setting-control">
            <div class="number-input-group">
              <input 
                type="number"
                class="number-input"
                min="20" 
                max="100" 
                v-model="config.floatingIcon.opacity"
                @input="updateConfig('floatingIcon.opacity', parseInt(config.floatingIcon.opacity))"
              />
              <span class="unit-label">%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据管理 -->
      <div class="settings-section">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2"/>
            <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2"/>
            <polyline points="10,9 9,9 8,9" stroke="currentColor" stroke-width="2"/>
          </svg>
          数据管理
        </h2>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">数据备份与恢复</div>
            <div class="setting-description">导出或导入任务数据，清除所有数据</div>
          </div>
          <div class="setting-control">
            <div class="button-group">
              <button class="btn btn-primary" @click="exportData">导出数据</button>
              <button class="btn btn-primary" @click="importData">导入数据</button>
              <button class="btn btn-danger" @click="clearAllData">清除所有数据</button>
            </div>
          </div>
        </div>
        
        <div v-if="databaseStats" class="database-stats">
          <h3>数据库信息</h3>
          <p>任务数量: {{ databaseStats.taskCount }}</p>
          <p>数据库大小: {{ formatFileSize(databaseStats.fileSize) }}</p>
          <p>数据库路径: {{ databaseStats.path }}</p>
        </div>
      </div>

      <!-- 任务统计 -->
      <div class="settings-section">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 11H7l5-8 5 8h-2l-3 7-3-7z" stroke="currentColor" stroke-width="2"/>
          </svg>
          任务统计
        </h2>
        
        <div v-if="taskStats" class="task-stats">
          <div class="stat-item">
            <span class="stat-label">已完成任务:</span>
            <span class="stat-value">{{ taskStats.totalCompletedTasks }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总工作时间:</span>
            <span class="stat-value">{{ formatDuration(taskStats.totalWorkTime) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">进行中任务:</span>
            <span class="stat-value">{{ taskStats.inProgressTasksCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均任务时间:</span>
            <span class="stat-value">{{ formatDuration(taskStats.averageTaskTime) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-actions">
      <button class="btn btn-secondary" @click="resetToDefaults">恢复默认</button>
      <button class="btn btn-primary" @click="saveAllSettings">保存设置</button>
    </div>

    <!-- 消息提示 -->
    <div v-if="message.visible" class="message" :class="message.type">
      {{ message.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import { useTheme } from '@/composables/useTheme'
import ThemeSwitcher from './ThemeSwitcher.vue'

const taskStore = useTaskStore()
const { currentTheme } = useTheme()

const config = ref({
  autoStart: false,
  showNotifications: true,
  theme: 'system',
  floatingIcon: {
    visible: true,
    size: 60,
    opacity: 100
  }
})

const databaseStats = ref(null)
const taskStats = ref(null)
const message = ref({
  visible: false,
  text: '',
  type: 'info'
})

const loadConfig = async () => {
  try {
    const loadedConfig = await window.electronAPI.config.get()
    config.value = { ...config.value, ...loadedConfig }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

const updateConfig = async (key, value) => {
  try {
    await window.electronAPI.config.update(key, value)
    showMessage('设置已保存', 'success')
  } catch (error) {
    console.error('保存设置失败:', error)
    showMessage('保存失败', 'error')
  }
}

// Toggle methods for better UX
const toggleAutoStart = () => {
  config.value.autoStart = !config.value.autoStart
  updateConfig('autoStart', config.value.autoStart)
}

const toggleNotifications = () => {
  config.value.showNotifications = !config.value.showNotifications
  updateConfig('showNotifications', config.value.showNotifications)
}

const toggleFloatingIcon = () => {
  config.value.floatingIcon.visible = !config.value.floatingIcon.visible
  updateConfig('floatingIcon.visible', config.value.floatingIcon.visible)
}

const resetToDefaults = async () => {
  if (!confirm('确定要恢复默认设置吗？')) {
    return
  }
  
  try {
    await window.electronAPI.config.reset()
    await loadConfig()
    showMessage('已恢复默认设置', 'success')
  } catch (error) {
    console.error('恢复默认设置失败:', error)
    showMessage('恢复失败', 'error')
  }
}

const saveAllSettings = () => {
  showMessage('所有设置已保存', 'success')
}

const loadDatabaseStats = async () => {
  try {
    databaseStats.value = await window.electronAPI.data.getStats()
  } catch (error) {
    console.error('加载数据库统计失败:', error)
  }
}

const loadTaskStats = async () => {
  try {
    await taskStore.getAllTasks()
    const stats = taskStore.fullStatistics
    
    taskStats.value = {
      totalWorkTime: stats.duration.total,
      totalCompletedTasks: stats.status.done,
      currentActiveTime: 0, // 当前活动时间需要单独计算
      inProgressTasksCount: stats.status.doing,
      averageTaskTime: stats.duration.average
    }
  } catch (error) {
    console.error('加载任务统计失败:', error)
  }
}

const exportData = async () => {
  try {
    const result = await window.electronAPI.data.export()
    if (result.success) {
      showMessage('数据导出成功', 'success')
    } else if (!result.canceled) {
      showMessage(result.error || '导出失败', 'error')
    }
  } catch (error) {
    console.error('导出数据失败:', error)
    showMessage('导出失败', 'error')
  }
}

const importData = async () => {
  try {
    const result = await window.electronAPI.data.import()
    if (result.success) {
      showMessage(`成功导入 ${result.taskCount} 个任务`, 'success')
      await loadDatabaseStats()
      await loadTaskStats()
    } else if (!result.canceled) {
      showMessage(result.error || '导入失败', 'error')
    }
  } catch (error) {
    console.error('导入数据失败:', error)
    showMessage('导入失败', 'error')
  }
}

const clearAllData = async () => {
  if (!confirm('确定要清除所有数据吗？此操作无法撤销！')) {
    return
  }

  try {
    const result = await window.electronAPI.data.clear()
    if (result.success) {
      showMessage('所有数据已清除', 'success')
      await loadDatabaseStats()
      await loadTaskStats()
    } else {
      showMessage(result.error || '清除失败', 'error')
    }
  } catch (error) {
    console.error('清除数据失败:', error)
    showMessage('清除失败', 'error')
  }
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds < 1000) return '0分钟'
  
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`
  } else {
    return `${minutes}分钟`
  }
}

const showMessage = (text, type = 'info') => {
  message.value = {
    visible: true,
    text,
    type
  }
  
  setTimeout(() => {
    message.value.visible = false
  }, 3000)
}

onMounted(async () => {
  await loadConfig()
  await loadDatabaseStats()
  await loadTaskStats()
})
</script>

<style scoped>
/* Component-specific styles that override or extend base styles */

.button-group {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.database-stats, .task-stats {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
}

.database-stats h3 {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.database-stats p {
  margin: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-base);
}

.stat-label {
  color: var(--text-secondary);
}

.stat-value {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.message {
  position: fixed;
  top: var(--spacing-xl);
  right: var(--spacing-xl);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-sm);
  color: var(--text-white);
  font-size: var(--font-size-base);
  z-index: var(--z-tooltip);
  box-shadow: var(--shadow-lg);
}

.message.success {
  background: var(--color-success);
}

.message.error {
  background: var(--color-danger);
}

.message.info {
  background: var(--color-info);
}
</style>