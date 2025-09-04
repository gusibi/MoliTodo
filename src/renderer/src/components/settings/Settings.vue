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
import LogoSelector from './LogoSelector.vue'
import GeneralSettings from './GeneralSettings.vue'
import AppearanceSettings from './AppearanceSettings.vue'
import DataSettings from './DataSettings.vue'
import ReminderSettings from './ReminderSettings.vue'
import StatisticsSettings from './StatisticsSettings.vue'
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
const settingsCategories = [
  {
    id: 'general',
    name: '通用',
    icon: h('i', { class: 'fas fa-cog' })
  },
  {
    id: 'appearance',
    name: '外观',
    icon: h('i', { class: 'fas fa-palette' })
  },
  {
    id: 'data',
    name: '数据管理',
    icon: h('i', { class: 'fas fa-database' })
  },
  {
    id: 'reminders',
    name: '提醒设置',
    icon: h('i', { class: 'fas fa-bell' })
  },
  {
    id: 'ai',
    name: 'AI 配置',
    icon: h('i', { class: 'fas fa-robot' })
  },
  {
    id: 'statistics',
    name: '统计信息',
    icon: h('i', { class: 'fas fa-chart-bar' })
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