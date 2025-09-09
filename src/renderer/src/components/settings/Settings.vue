<template>
  <div class="setting-main-container">
    <!-- 左侧导航栏 -->
    <div class="setting-sidebar">
      <h2 class="setting-sidebar-title">{{ $t('settings.title') }}</h2>
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
            <GeneralSettings 
              :config="config" 
              @update:config="updateConfig" 
              @show-message="showMessage" 
            />
          </div>

          <!-- 外观设置 -->
          <div v-if="activeCategory === 'appearance'">
            <AppearanceSettings 
              :config="config" 
              @update:config="updateConfig" 
              @show-message="showMessage" 
            />
          </div>

          <!-- 数据管理 -->
          <div v-if="activeCategory === 'data'">
            <DataSettings @show-message="showMessage" />
          </div>

          <!-- 提醒设置 -->
          <div v-if="activeCategory === 'reminders'">
            <ReminderSettings 
              :config="config" 
              @update:config="updateConfig" 
              @show-message="showMessage"
            />
          </div>

          <!-- AI 配置 -->
          <div v-if="activeCategory === 'ai'">
            <AISettings />
          </div>

          <!-- 统计信息 -->
          <div v-if="activeCategory === 'statistics'">
            <StatisticsSettings />
          </div>


        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="setting-actions">
        <button class="setting-btn setting-btn-secondary" @click="resetToDefaults">{{ $t('settings.resetDefaults') }}</button>
        <button class="setting-btn setting-btn-primary" @click="saveAllSettings">{{ $t('settings.saveSettings') }}</button>
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
import { ref, reactive, onMounted, h, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ThemeSwitcher from './ThemeSwitcher.vue'
import ColorThemeSwitcher from './ColorThemeSwitcher.vue'
import AISettings from './AISettings.vue'
import FloatingIconSettings from './FloatingIconSettings.vue'
import LogoSelector from './LogoSelector.vue'
import GeneralSettings from './GeneralSettings.vue'
import AppearanceSettings from './AppearanceSettings.vue'
import DataSettings from './DataSettings.vue'
import ReminderSettings from './ReminderSettings.vue'
import StatisticsSettings from './StatisticsSettings.vue'

import { playNotificationSound, getAvailableSounds } from '@/utils/notificationSound.js'
import { useTaskStore } from '@/store/taskStore'
import { formatDuration } from '@/utils/task-utils.js'

// 使用 i18n 和 taskStore
const { t, locale } = useI18n()
const taskStore = useTaskStore()

// 响应式数据
const activeCategory = ref('general')
const config = reactive({
  autoStart: false,
  showNotifications: true,
  language: 'zh', // 默认语言
  notificationSound: {
    enabled: true,
    soundFile: 'ding-126626.mp3',
    volume: 50
  },
  selectedLogo: 'default',
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
const settingsCategories = computed(() => [
  {
    id: 'general',
    name: t('settings.general'),
    icon: h('i', { class: 'fas fa-cog' })
  },
  {
    id: 'appearance',
    name: t('settings.appearance'),
    icon: h('i', { class: 'fas fa-palette' })
  },
  {
    id: 'data',
    name: t('settings.data'),
    icon: h('i', { class: 'fas fa-database' })
  },
  {
    id: 'reminders',
    name: t('settings.reminders'),
    icon: h('i', { class: 'fas fa-bell' })
  },
  {
    id: 'ai',
    name: t('settings.ai'),
    icon: h('i', { class: 'fas fa-robot' })
  },
  {
    id: 'statistics',
    name: t('settings.statistics'),
    icon: h('i', { class: 'fas fa-chart-bar' })
  }
])

// 方法
const showMessage = (text, type = 'info') => {
  message.text = text
  message.type = type
  message.visible = true
  setTimeout(() => {
    message.visible = false
  }, 3000)
}




const updateConfig = async (key, value) => {
  try {
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.set(key, value)
    }
    
    // 同步更新本地配置状态
    if (key.includes('.')) {
      // 处理嵌套属性，如 'notificationSound.volume'
      const keys = key.split('.')
      let target = config
      for (let i = 0; i < keys.length - 1; i++) {
        target = target[keys[i]]
      }
      target[keys[keys.length - 1]] = value
    } else {
      // 处理顶级属性
      config[key] = value
    }
  } catch (error) {
    console.error('Failed to update config:', error)
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
    console.error('Failed to load config:', error)
  }
}

const loadDatabaseStats = async () => {
  try {
    if (window.electronAPI && window.electronAPI.data) {
      databaseStats.value = await window.electronAPI.data.getStats()
    }
  } catch (error) {
    console.error('Failed to load database stats:', error)
  }
}

const loadTaskStats = async () => {
  try {
    if (window.electronAPI && window.electronAPI.tasks) {
      taskStats.value = await window.electronAPI.tasks.getStats()
    }
  } catch (error) {
    console.error('Failed to load task stats:', error)
  }
}



const resetToDefaults = async () => {
  if (confirm(t('settings.confirmReset'))) {
    try {
      if (window.electronAPI && window.electronAPI.config) {
        await window.electronAPI.config.reset()
        await loadConfig()
        showMessage(t('settings.resetSuccess'), 'success')
      }
    } catch (error) {
      console.error('Failed to reset settings:', error)
      showMessage(t('settings.resetFailed'), 'error')
    }
  }
}

const saveAllSettings = async () => {
  try {
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.save()
      showMessage(t('settings.saveSuccess'), 'success')
    }
  } catch (error) {
    console.error('Failed to save settings:', error)
    showMessage(t('settings.saveFailed'), 'error')
  }
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