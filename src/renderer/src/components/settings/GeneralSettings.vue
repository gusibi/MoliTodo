<template>
  <div>
    <h1 class="setting-page-title">{{ $t('settings.general') }}</h1>
    <p class="setting-page-description">{{ $t('settings.generalDescription') }}</p>

    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.startupSettings') }}</h3>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.autoStart') }}</div>
          <div class="setting-item-description">{{ $t('settings.autoStartDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <Switch :model-value="config.autoStart" :label="$t('settings.autoStart')"
            @update:model-value="toggleAutoStart" />
        </div>
      </div>
    </div>

    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.notificationSettings') }}</h3>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.showNotifications') }}</div>
          <div class="setting-item-description">{{ $t('settings.showNotificationsDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <Switch :model-value="config.showNotifications" :label="$t('settings.showNotifications')"
            @update:model-value="toggleNotifications" />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.notificationSound') }}</div>
          <div class="setting-item-description">{{ $t('settings.notificationSoundDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <Switch :model-value="config.notificationSound.enabled" :label="$t('settings.notificationSound')"
            @update:model-value="toggleNotificationSound" />
        </div>
      </div>

      <div v-if="config.notificationSound.enabled" class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.soundSelection') }}</div>
          <div class="setting-item-description">{{ $t('settings.soundSelectionDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <div class="setting-sound-selector">
            <select v-model="config.notificationSound.soundFile" @change="updateNotificationSound"
              class="setting-select">
              <option v-for="sound in availableSounds" :key="sound.value" :value="sound.value">
                {{ sound.label }}
              </option>
            </select>
            <Button variant="secondary" size="sm" @click="testNotificationSound">
              {{ $t('settings.testSound') }}
            </Button>
          </div>
        </div>
      </div>

      <div v-if="config.notificationSound.enabled" class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.volume') }}</div>
          <div class="setting-item-description">{{ $t('settings.volumeDescription') }}</div>
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

    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.languageSettings.title') }}</h3>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.language') }}</div>
          <div class="setting-item-description">{{ $t('settings.languageSettings.description') }}</div>
        </div>
        <div class="setting-item-control">
          <select 
            :value="currentLanguage" 
            @change="changeLanguage($event.target.value)"
            class="setting-select language-select"
          >
            <option 
              v-for="lang in languages" 
              :key="lang.code" 
              :value="lang.code"
            >
              {{ lang.name }} ({{ lang.nativeName }})
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { playNotificationSound, getAvailableSounds } from '@/utils/notificationSound.js'
import { useLanguage } from '@/composables/useLanguage'
import Switch from '../ui/switch/Switch.vue'
import Button from '../ui/button/Button.vue'

const { t, locale } = useI18n()
const { switchLanguage } = useLanguage()

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:config', 'show-message'])

// 可用的音效列表
const availableSounds = getAvailableSounds()

// 可用的语言列表
const languages = [
  {
    code: 'zh',
    name: '中文',
    nativeName: '简体中文'
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English'
  }
]

const currentLanguage = computed(() => props.config.language || locale.value)

// 方法
const toggleAutoStart = async (value) => {
  try {
    props.config.autoStart = value
    if (window.electronAPI && window.electronAPI.app) {
      await window.electronAPI.app.setAutoStart(value)
    }
    await updateConfig('autoStart', value)
  } catch (error) {
    console.error('Failed to set auto start:', error)
    props.config.autoStart = !value
    emit('show-message', t('settings.autoStartFailed'), 'error')
  }
}

const toggleNotifications = async (value) => {
  props.config.showNotifications = value
  await updateConfig('showNotifications', value)
}

const toggleNotificationSound = async (value) => {
  props.config.notificationSound.enabled = value
  await updateConfig('notificationSound.enabled', value)
}

const updateNotificationSound = async () => {
  try {
    await updateConfig('notificationSound.soundFile', props.config.notificationSound.soundFile)
  } catch (error) {
    console.error('Failed to update sound:', error)
    emit('show-message', t('settings.settingsFailed'), 'error')
  }
}

const testNotificationSound = async () => {
  const success = await playNotificationSound(
    props.config.notificationSound.soundFile,
    props.config.notificationSound.volume
  )

  if (!success) {
    emit('show-message', t('settings.playFailed'), 'error')
  }
}

const changeLanguage = async (langCode) => {
  if (langCode === currentLanguage.value) return
  
  try {
    // 使用全局语言管理切换语言
    await switchLanguage(langCode)
    
    // 更新本地配置状态，确保与持久化配置同步
    await updateConfig('language', langCode)
    
    emit('show-message', locale.value === 'zh' ? '语言切换成功' : 'Language changed successfully', 'success')
  } catch (error) {
    console.error('Failed to change language:', error)
    emit('show-message', locale.value === 'zh' ? '语言切换失败' : 'Language change failed', 'error')
  }
}

const updateConfig = async (key, value) => {
  try {
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.set(key, value)
    }
    emit('update:config', key, value)
  } catch (error) {
    console.error('Failed to update config:', error)
    throw error
  }
}
</script>
<style scoped>
@import '@/assets/styles/components/settings.css';
</style>