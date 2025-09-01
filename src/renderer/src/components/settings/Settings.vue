<template>
  <div class="setting-main-container">
    <!-- 左侧导航栏 -->
    <div class="setting-sidebar">
      <h2 class="setting-sidebar-title">设置</h2>
      <nav class="setting-nav-list">
        <div v-for="category in settingsCategories" :key="category.id" class="setting-nav-item"
          :class="{ 'setting-nav-item-active': activeCategory === category.id }" @click="activeCategory = category.id">
          <component :is="category.icon" class="setting-nav-icon" />
          {{ category.name }}
        </div>
      </nav>
    </div>

    <!-- 右侧主设置区域 -->
    <div class="setting-main-area">
      <div class="setting-content-area">
        <div class="setting-content-inner">
          <!-- 通用设置 -->
          <div v-if="activeCategory === 'general'">
            <h1 class="setting-page-title">通用</h1>
            <p class="setting-page-description">应用的基本设置和行为配置</p>

            <div class="setting-group">
              <h3 class="setting-group-title">启动设置</h3>
              <div class="setting-item">
                <div class="setting-item-info">
                  <div class="setting-item-label">开机自启动</div>
                  <div class="setting-item-description">系统启动时自动运行应用</div>
                </div>
                <div class="setting-item-control">
                  <button class="setting-toggle" :class="{ 'setting-toggle-active': config.autoStart }"
                    @click="toggleAutoStart">
                    <span class="setting-toggle-button"></span>
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-group">
              <h3 class="setting-group-title">通知设置</h3>
              <div class="setting-item">
                <div class="setting-item-info">
                  <div class="setting-item-label">显示通知</div>
                  <div class="setting-item-description">接收任务提醒和系统通知</div>
                </div>
                <div class="setting-item-control">
                  <button class="setting-toggle" :class="{ 'setting-toggle-active': config.showNotifications }"
                    @click="toggleNotifications">
                    <span class="setting-toggle-button"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-info">
                  <div class="setting-item-label">通知音效</div>
                  <div class="setting-item-description">通知时播放提示音</div>
                </div>
                <div class="setting-item-control">
                  <button class="setting-toggle" :class="{ 'setting-toggle-active': config.notificationSound.enabled }"
                    @click="toggleNotificationSound">
                    <span class="setting-toggle-button"></span>
                  </button>
                </div>
              </div>

              <div v-if="config.notificationSound.enabled" class="setting-item">
                <div class="setting-item-info">
                  <div class="setting-item-label">音效选择</div>
                  <div class="setting-item-description">选择通知音效</div>
                </div>
                <div class="setting-item-control">
                  <div class="setting-sound-selector">
                    <select v-model="config.notificationSound.soundFile" @change="updateNotificationSound"
                      class="setting-select">
                      <option v-for="sound in availableSounds" :key="sound.value" :value="sound.value">
                        {{ sound.label }}
                      </option>
                    </select>
                    <button class="setting-btn setting-btn-small" @click="testNotificationSound">
                      试听
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="config.notificationSound.enabled" class="setting-item">
                <div class="setting-item-info">
                  <div class="setting-item-label">音量</div>
                  <div class="setting-item-description">调整通知音效音量</div>
                </div>
                <div class="setting-item-control">
                  <div class="setting-slider-group">
                    <input type="range" class="setting-slider" min="0" max="100"
                      v-model="config.notificationSound.volume"
                      @input="updateConfig('notificationSound.volume', parseInt(config.notificationSound.volume))" />
                    <span class="setting-slider-value">{{ config.notificationSound.volume }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 外观设置 -->
          <div v-if="activeCategory === 'appearance'">
            <h1 class="setting-page-title">外观</h1>
            <p class="setting-page-description">自定义应用的外观和主题</p>

            <div class="setting-group">
              <h3 class="setting-group-title">主题设置</h3>
              <div class="setting-item">
                <div class="setting-item-info">
                  <div class="setting-item-label">主题模式</div>
                  <div class="setting-item-description">选择浅色或深色模式</div>
                </div>
                <div class="setting-item-control">
                  <ThemeSwitcher />
                </div>
              </div>
            </div>

            <div class="setting-group">
              <ColorThemeSwitcher />
            </div>

            <FloatingIconSettings 
              :config="config" 
              @update-config="updateConfig" 
              @show-message="showMessage" 
            />
          </div>

          <!-- 数据管理 -->
          <div v-if="activeCategory === 'data'">
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

          <!-- 提醒设置 -->
          <div v-if="activeCategory === 'reminders'">
            <h1 class="setting-page-title">提醒设置</h1>
            <p class="setting-page-description">自定义任务提醒的快捷选项</p>

            <div class="setting-group">
              <h3 class="setting-group-title">自定义提醒选项</h3>
              <p class="setting-group-description">配置在添加任务时可以快速选择的提醒时间</p>

              <div class="custom-reminders-list">
                <div v-for="(reminder, index) in config.customReminders" :key="reminder.id"
                  class="custom-reminder-item">
                  <div class="custom-reminder-info">
                    <input v-model="reminder.label" class="custom-reminder-label-input" placeholder="提醒标签"
                      @input="updateCustomReminder(index)" />
                    <div class="custom-reminder-config">
                      <select v-model="reminder.type" class="custom-reminder-type-select"
                        @change="updateCustomReminder(index)">
                        <option value="relative">相对时间</option>
                        <option value="absolute">绝对时间</option>
                      </select>

                      <!-- 相对时间配置 -->
                      <template v-if="reminder.type === 'relative'">
                        <input v-model="reminder.value" type="number" min="1" class="custom-reminder-value-input"
                          @input="updateCustomReminder(index)" />
                        <select v-model="reminder.unit" class="custom-reminder-unit-select"
                          @change="updateCustomReminder(index)">
                          <option value="minutes">分钟后</option>
                          <option value="hours">小时后</option>
                          <option value="days">天后</option>
                        </select>
                      </template>

                      <!-- 绝对时间配置 -->
                      <template v-if="reminder.type === 'absolute'">
                        <input v-model="reminder.time" type="time" class="custom-reminder-time-input"
                          @input="updateCustomReminder(index)" />
                        <input v-model="reminder.dayOffset" type="number" min="0" max="365"
                          class="custom-reminder-value-input" placeholder="天数" @input="updateCustomReminder(index)" />
                        <span class="custom-reminder-unit-label">天后</span>
                      </template>
                    </div>
                  </div>
                  <div class="custom-reminder-actions">
                    <button class="custom-reminder-delete-btn" @click="deleteCustomReminder(index)" title="删除">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>

              <button class="setting-btn setting-btn-primary add-reminder-btn" @click="addCustomReminder">
                <i class="fas fa-plus"></i>
                添加新的提醒选项
              </button>
            </div>
          </div>

          <!-- AI 配置 -->
          <div v-if="activeCategory === 'ai'">
            <AISettings />
          </div>

          <!-- 统计信息 -->
          <div v-if="activeCategory === 'statistics'">
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
        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="setting-actions">
        <button class="setting-btn setting-btn-secondary" @click="resetToDefaults">恢复默认</button>
        <button class="setting-btn setting-btn-primary" @click="saveAllSettings">保存设置</button>
      </div>
    </div>

    <!-- 消息提示 -->
    <div v-if="message.visible" class="setting-message" :class="{
      'setting-message-success': message.type === 'success',
      'setting-message-error': message.type === 'error',
      'setting-message-info': message.type === 'info'
    }">
      {{ message.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, h } from 'vue'
import ThemeSwitcher from './ThemeSwitcher.vue'
import ColorThemeSwitcher from './ColorThemeSwitcher.vue'
import AISettings from './AISettings.vue'
import FloatingIconSettings from './FloatingIconSettings.vue'
import { playNotificationSound, getAvailableSounds } from '@/utils/notificationSound.js'
import { useTaskStore } from '@/store/taskStore'
import { formatDuration } from '@/utils/task-utils.js'

// 使用 taskStore
const taskStore = useTaskStore()

// 响应式数据
const activeCategory = ref('general')
const config = reactive({
  autoStart: false,
  showNotifications: true,
  notificationSound: {
    enabled: true,
    soundFile: 'ding-126626.mp3',
    volume: 50
  },
  floatingIcon: {
    visible: true,
    size: 60,
    opacity: 80
  },
  
  customReminders: [
    { id: 1, label: '30分钟后', type: 'relative', value: 30, unit: 'minutes' },
    { id: 2, label: '1小时后', type: 'relative', value: 1, unit: 'hours' },
    { id: 3, label: '2小时后', type: 'relative', value: 2, unit: 'hours' },
    { id: 4, label: '1天后', type: 'relative', value: 1, unit: 'days' },
    { id: 5, label: '下周', type: 'relative', value: 7, unit: 'days' },
    { id: 6, label: '今天下午4点', type: 'absolute', time: '16:00', dayOffset: 0 },
    { id: 7, label: '明天9点', type: 'absolute', time: '09:00', dayOffset: 1 },
    { id: 8, label: '3天后上午10点', type: 'absolute', time: '10:00', dayOffset: 3 }
  ]
})

const databaseStats = ref(null)
const taskStats = ref(null)
const availableSounds = ref(getAvailableSounds())
const message = reactive({
  visible: false,
  text: '',
  type: 'info'
})

// 设置分类
const settingsCategories = [
  {
    id: 'general',
    name: '通用',
    icon: h('svg', {
      class: 'w-5 h-5',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
      }),
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
      })
    ])
  },
  {
    id: 'appearance',
    name: '外观',
    icon: h('svg', {
      class: 'w-5 h-5',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z'
      })
    ])
  },
  {
    id: 'data',
    name: '数据管理',
    icon: h('svg', {
      class: 'w-5 h-5',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'
      })
    ])
  },
  {
    id: 'reminders',
    name: '提醒设置',
    icon: h('svg', {
      class: 'w-5 h-5',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M15 17h5l-5 5v-5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
      })
    ])
  },
  {
    id: 'ai',
    name: 'AI 配置',
    icon: h('svg', {
      class: 'w-5 h-5',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
      })
    ])
  },
  {
    id: 'statistics',
    name: '统计信息',
    icon: h('svg', {
      class: 'w-5 h-5',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
      })
    ])
  }
]

// 方法
const showMessage = (text, type = 'info') => {
  message.text = text
  message.type = type
  message.visible = true
  setTimeout(() => {
    message.visible = false
  }, 3000)
}

const toggleAutoStart = async () => {
  try {
    config.autoStart = !config.autoStart
    await updateConfig('autoStart', config.autoStart)
    showMessage(config.autoStart ? '已启用开机自启动' : '已禁用开机自启动', 'success')
  } catch (error) {
    console.error('切换自启动失败:', error)
    showMessage('设置失败', 'error')
  }
}

const toggleNotifications = async () => {
  try {
    config.showNotifications = !config.showNotifications
    await updateConfig('showNotifications', config.showNotifications)
    showMessage(config.showNotifications ? '已启用通知' : '已禁用通知', 'success')
  } catch (error) {
    console.error('切换通知失败:', error)
    showMessage('设置失败', 'error')
  }
}

const toggleNotificationSound = async () => {
  try {
    config.notificationSound.enabled = !config.notificationSound.enabled
    await updateConfig('notificationSound.enabled', config.notificationSound.enabled)
    showMessage(config.notificationSound.enabled ? '已启用通知音效' : '已禁用通知音效', 'success')
  } catch (error) {
    console.error('切换通知音效失败:', error)
    showMessage('设置失败', 'error')
  }
}

const updateNotificationSound = async () => {
  try {
    await updateConfig('notificationSound.soundFile', config.notificationSound.soundFile)
    showMessage('音效已更新', 'success')
  } catch (error) {
    console.error('更新音效失败:', error)
    showMessage('设置失败', 'error')
  }
}

const testNotificationSound = async () => {
  const success = await playNotificationSound(
    config.notificationSound.soundFile,
    config.notificationSound.volume
  )

  if (!success) {
    showMessage('播放失败', 'error')
  }
}



const updateConfig = async (key, value) => {
  try {
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.set(key, value)
    }
  } catch (error) {
    console.error('更新配置失败:', error)
    throw error
  }
}

const loadConfig = async () => {
  try {
    if (window.electronAPI && window.electronAPI.config) {
      const loadedConfig = await window.electronAPI.config.getAll()
      Object.assign(config, loadedConfig)
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

const loadDatabaseStats = async () => {
  try {
    if (window.electronAPI && window.electronAPI.data) {
      databaseStats.value = await window.electronAPI.data.getStats()
    }
  } catch (error) {
    console.error('加载数据库统计失败:', error)
  }
}

const loadTaskStats = async () => {
  try {
    if (window.electronAPI && window.electronAPI.tasks) {
      taskStats.value = await window.electronAPI.tasks.getStats()
    }
  } catch (error) {
    console.error('加载任务统计失败:', error)
  }
}

const exportData = async () => {
  try {
    if (window.electronAPI && window.electronAPI.data) {
      await window.electronAPI.data.export()
      showMessage('数据导出成功', 'success')
    }
  } catch (error) {
    console.error('导出数据失败:', error)
    showMessage('导出失败', 'error')
  }
}

const importData = async () => {
  try {
    if (window.electronAPI && window.electronAPI.data) {
      await window.electronAPI.data.import()
      showMessage('数据导入成功', 'success')
      await loadDatabaseStats()
      await loadTaskStats()
    }
  } catch (error) {
    console.error('导入数据失败:', error)
    showMessage('导入失败', 'error')
  }
}

const clearAllData = async () => {
  if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
    try {
      if (window.electronAPI && window.electronAPI.data) {
        await window.electronAPI.data.clear()
        showMessage('数据已清除', 'success')
        await loadDatabaseStats()
        await loadTaskStats()
      }
    } catch (error) {
      console.error('清除数据失败:', error)
      showMessage('清除失败', 'error')
    }
  }
}

const resetToDefaults = async () => {
  if (confirm('确定要恢复默认设置吗？')) {
    try {
      if (window.electronAPI && window.electronAPI.config) {
        await window.electronAPI.config.reset()
        await loadConfig()
        showMessage('已恢复默认设置', 'success')
      }
    } catch (error) {
      console.error('恢复默认设置失败:', error)
      showMessage('恢复失败', 'error')
    }
  }
}

const saveAllSettings = async () => {
  try {
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.save()
      showMessage('设置已保存', 'success')
    }
  } catch (error) {
    console.error('保存设置失败:', error)
    showMessage('保存失败', 'error')
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// formatDuration 已从 task-utils 导入

// 自定义提醒管理方法
const addCustomReminder = async () => {
  const newId = Math.max(...config.customReminders.map(r => r.id), 0) + 1
  config.customReminders.push({
    id: newId,
    label: '新提醒',
    type: 'relative',
    value: 30,
    unit: 'minutes'
  })
  // 创建一个干净的副本，移除Vue的响应式属性
  const cleanReminders = config.customReminders.map(reminder => ({
    id: reminder.id,
    label: reminder.label,
    type: reminder.type,
    value: reminder.value,
    unit: reminder.unit,
    time: reminder.time,
    dayOffset: reminder.dayOffset
  }))
  await updateConfig('customReminders', cleanReminders)
  // 通知 taskStore 更新自定义提醒选项
  await taskStore.refreshCustomReminderOptions()
}

const deleteCustomReminder = async (index) => {
  if (config.customReminders.length > 1) {
    config.customReminders.splice(index, 1)
    // 创建一个干净的副本，移除Vue的响应式属性
    const cleanReminders = config.customReminders.map(reminder => ({
      id: reminder.id,
      label: reminder.label,
      type: reminder.type,
      value: reminder.value,
      unit: reminder.unit,
      time: reminder.time,
      dayOffset: reminder.dayOffset
    }))
    await updateConfig('customReminders', cleanReminders)
    // 通知 taskStore 更新自定义提醒选项
    await taskStore.refreshCustomReminderOptions()
    showMessage('提醒选项已删除', 'success')
  } else {
    showMessage('至少需要保留一个提醒选项', 'error')
  }
}

const updateCustomReminder = (index) => {
  // 延迟更新，避免频繁保存
  setTimeout(async () => {
    // 创建一个干净的副本，移除Vue的响应式属性
    const cleanReminders = config.customReminders.map(reminder => ({
      id: reminder.id,
      label: reminder.label,
      type: reminder.type,
      value: reminder.value,
      unit: reminder.unit,
      time: reminder.time,
      dayOffset: reminder.dayOffset
    }))
    await updateConfig('customReminders', cleanReminders)
    // 通知 taskStore 更新自定义提醒选项
    await taskStore.refreshCustomReminderOptions()
  }, 500)
}



// 生命周期
onMounted(async () => {
  await loadConfig()
  await loadDatabaseStats()
  await loadTaskStats()
})
</script>

<style scoped>
@import '@/assets/styles/components/settings.css';
</style>