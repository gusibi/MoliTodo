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
          <span
            v-if="category.id === 'about' && hasPendingUpdate"
            class="ml-auto h-2 w-2 rounded-full bg-primary"
            aria-hidden="true"
          />
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

          <!-- 本地接口 -->
          <div v-if="activeCategory === 'api'">
            <ApiServerSettings
              :config="config"
              @update:config="updateConfig"
              @show-message="showMessage"
            />
          </div>

          <!-- 统计信息 -->
          <div v-if="activeCategory === 'statistics'">
            <StatisticsSettings />
          </div>

          <!-- 关于 -->
          <div v-if="activeCategory === 'about'">
            <AboutSettings @show-message="showMessage" />
          </div>

        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="setting-actions">
        <Button ref="resetBtn" variant="secondary" class="setting-btn setting-btn-secondary" @click="requestReset">
          {{ $t('settings.resetDefaults') }}
        </Button>
        <Button variant="default" class="setting-btn setting-btn-primary" @click="saveAllSettings">
          {{ $t('settings.saveSettings') }}
        </Button>
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

    <!-- 恢复默认设置确认 -->
    <AlertDialog :open="resetDialogOpen" :title="$t('settings.resetDefaults')"
      :description="$t('settings.confirmReset')" :cancel-label="$t('common.cancel')"
      :confirm-label="$t('settings.resetDefaults')" confirm-variant="destructive" :loading="resetLoading"
      :error="resetError"
      @update:open="(value) => { if (!value) resetDialogOpen = false }" @confirm="confirmReset"
      @cancel="cancelReset" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { BarChart3, Bell, Bot, Database, Info, Palette, Plug, Settings as SettingsIcon } from '@lucide/vue'
import AISettings from './AISettings.vue'
import GeneralSettings from './GeneralSettings.vue'
import AppearanceSettings from './AppearanceSettings.vue'
import DataSettings from './DataSettings.vue'
import ReminderSettings from './ReminderSettings.vue'
import StatisticsSettings from './StatisticsSettings.vue'
import AboutSettings from './AboutSettings.vue'
import ApiServerSettings from './ApiServerSettings.vue'

import { useTaskStore } from '@/store/taskStore'
import Button from '../ui/button/Button.vue'
import AlertDialog from '../ui/alert-dialog/AlertDialog.vue'

// 使用 i18n 和 taskStore
const { t, locale } = useI18n()
const taskStore = useTaskStore()

// 响应式数据
const activeCategory = ref('general')
const config = reactive({
  autoStart: false,
  showNotifications: true,
  apiServer: {
    enabled: false,
    host: '127.0.0.1',
    port: 1234
  },
  language: 'zh', // 默认语言
  notificationSound: {
    enabled: true,
    soundFile: 'ding-126626.mp3',
    volume: 50
  },
  selectedLogo: 'b1',
  floatingIcon: {
    visible: true,
    size: 60,
    opacity: 80
  },
  focusWidget: {
    visible: false,
    x: null,
    y: null
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
const message = reactive({
  visible: false,
  text: '',
  type: 'info'
})

// 关于页的更新状态：有待安装的更新时在导航上给出提示
const pendingUpdateStatus = ref('idle')
let unsubscribeUpdateState = null
const hasPendingUpdate = computed(() =>
  ['available', 'downloading', 'ready'].includes(pendingUpdateStatus.value)
)



// 设置分类
const settingsCategories = computed(() => [
  {
    id: 'general',
    name: t('settings.general'),
    icon: SettingsIcon
  },
  {
    id: 'appearance',
    name: t('settings.appearance'),
    icon: Palette
  },
  {
    id: 'data',
    name: t('settings.data'),
    icon: Database
  },
  {
    id: 'reminders',
    name: t('settings.reminders'),
    icon: Bell
  },
  {
    id: 'ai',
    name: t('settings.aiTitle'),
    icon: Bot
  },
  {
    id: 'api',
    name: t('settings.api.title'),
    icon: Plug
  },
  {
    id: 'statistics',
    name: t('settings.statistics'),
    icon: BarChart3
  },
  {
    id: 'about',
    name: t('settings.aboutName'),
    icon: Info
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



const resetBtn = ref(null)
const resetDialogOpen = ref(false)
const resetLoading = ref(false)
const resetError = ref('')

const requestReset = () => {
  resetError.value = ''
  resetLoading.value = false
  resetDialogOpen.value = true
}

const confirmReset = async () => {
  if (resetLoading.value) return
  resetLoading.value = true
  resetError.value = ''
  try {
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.reset()
      await loadConfig()
      resetDialogOpen.value = false
      showMessage(t('settings.resetSuccess'), 'success')
    }
  } catch (error) {
    console.error('Failed to reset settings:', error)
    resetError.value = t('settings.resetFailed')
  } finally {
    resetLoading.value = false
  }
}

const cancelReset = () => {
  resetError.value = ''
  nextTick(() => {
    resetBtn.value?.focus?.()
  })
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

  if (window.electronAPI && window.electronAPI.updates) {
    unsubscribeUpdateState = window.electronAPI.updates.onStateChange((state) => {
      pendingUpdateStatus.value = (state && state.status) || 'idle'
    })
    try {
      const state = await window.electronAPI.updates.getState()
      pendingUpdateStatus.value = (state && state.status) || 'idle'
    } catch (error) {
      console.error('Failed to load update state:', error)
    }
  }
})

onUnmounted(() => {
  if (unsubscribeUpdateState) {
    unsubscribeUpdateState()
    unsubscribeUpdateState = null
  }
})
</script>

<style scoped>
@import '@/assets/styles/components/settings.css';
</style>
