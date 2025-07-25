<template>
  <div class="settings">
    <div class="settings-header">
      <h1>设置</h1>
    </div>
    
    <div class="settings-content">
      <!-- 基本设置 -->
      <div class="settings-section">
        <h2>基本设置</h2>
        
        <div class="setting-item">
          <label>
            <input 
              type="checkbox" 
              v-model="config.autoStart"
              @change="updateConfig('autoStart', config.autoStart)"
            />
            开机自启动
          </label>
        </div>
        
        <div class="setting-item">
          <label>
            <input 
              type="checkbox" 
              v-model="config.showNotifications"
              @change="updateConfig('showNotifications', config.showNotifications)"
            />
            显示通知
          </label>
        </div>
        
        <div class="setting-item">
          <label>主题</label>
          <select 
            v-model="config.theme"
            @change="updateConfig('theme', config.theme)"
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
      </div>

      <!-- 悬浮图标设置 -->
      <div class="settings-section">
        <h2>悬浮图标</h2>
        
        <div class="setting-item">
          <label>
            <input 
              type="checkbox" 
              v-model="config.floatingIcon.visible"
              @change="updateConfig('floatingIcon.visible', config.floatingIcon.visible)"
            />
            显示悬浮图标
          </label>
        </div>
        
        <div class="setting-item">
          <label>图标大小</label>
          <input 
            type="range" 
            min="40" 
            max="100" 
            v-model="config.floatingIcon.size"
            @input="updateConfig('floatingIcon.size', parseInt(config.floatingIcon.size))"
          />
          <span>{{ config.floatingIcon.size }}px</span>
        </div>
        
        <div class="setting-item">
          <label>透明度</label>
          <input 
            type="range" 
            min="20" 
            max="100" 
            v-model="config.floatingIcon.opacity"
            @input="updateConfig('floatingIcon.opacity', parseInt(config.floatingIcon.opacity))"
          />
          <span>{{ config.floatingIcon.opacity }}%</span>
        </div>
      </div>

      <!-- 数据管理 -->
      <div class="settings-section">
        <h2>数据管理</h2>
        
        <div class="setting-item">
          <div class="button-group">
            <button class="btn btn-primary" @click="exportData">导出数据</button>
            <button class="btn btn-primary" @click="importData">导入数据</button>
            <button class="btn btn-danger" @click="clearAllData">清除所有数据</button>
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
        <h2>任务统计</h2>
        
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

    <!-- 消息提示 -->
    <div v-if="message.visible" class="message" :class="message.type">
      {{ message.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const taskStore = useTaskStore()

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

const loadDatabaseStats = async () => {
  try {
    databaseStats.value = await window.electronAPI.data.getStats()
  } catch (error) {
    console.error('加载数据库统计失败:', error)
  }
}

const loadTaskStats = async () => {
  try {
    taskStats.value = await taskStore.getTaskStats()
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
.settings {
  width: 100%;
  height: 100vh;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.settings-header {
  padding: 20px 24px;
  background: white;
  border-bottom: 1px solid #e1e8ed;
}

.settings-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.settings-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.settings-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.settings-section h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  color: #555;
  margin-bottom: 8px;
}

.setting-item input[type="checkbox"] {
  margin-right: 8px;
}

.setting-item input[type="range"] {
  flex: 1;
  margin: 0 12px;
}

.setting-item select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-left: 12px;
}

.button-group {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.database-stats, .task-stats {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.database-stats h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.database-stats p {
  margin: 4px 0;
  font-size: 13px;
  color: #666;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.stat-label {
  color: #666;
}

.stat-value {
  font-weight: 600;
  color: #333;
}

.message {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 16px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  z-index: 1000;
}

.message.success {
  background: #28a745;
}

.message.error {
  background: #dc3545;
}

.message.info {
  background: #17a2b8;
}
</style>