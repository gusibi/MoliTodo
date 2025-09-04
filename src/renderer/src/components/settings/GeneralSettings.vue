<template>
  <div>
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
</template>

<script setup>
import { onMounted } from 'vue'
import { playNotificationSound, getAvailableSounds } from '@/utils/notificationSound.js'

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:config', 'show-message'])

// 可用的音效列表
const availableSounds = getAvailableSounds()

// 方法
const toggleAutoStart = async () => {
  try {
    props.config.autoStart = !props.config.autoStart
    if (window.electronAPI && window.electronAPI.app) {
      await window.electronAPI.app.setAutoStart(props.config.autoStart)
    }
    await updateConfig('autoStart', props.config.autoStart)
  } catch (error) {
    console.error('设置自启动失败:', error)
    emit('show-message', '设置自启动失败', 'error')
  }
}

const toggleNotifications = async () => {
  props.config.showNotifications = !props.config.showNotifications
  await updateConfig('showNotifications', props.config.showNotifications)
}

const toggleNotificationSound = async () => {
  props.config.notificationSound.enabled = !props.config.notificationSound.enabled
  await updateConfig('notificationSound.enabled', props.config.notificationSound.enabled)
}

const updateNotificationSound = async () => {
  try {
    await updateConfig('notificationSound.soundFile', props.config.notificationSound.soundFile)
  } catch (error) {
    console.error('更新音效失败:', error)
    emit('show-message', '设置失败', 'error')
  }
}

const testNotificationSound = async () => {
  const success = await playNotificationSound(
    props.config.notificationSound.soundFile,
    props.config.notificationSound.volume
  )

  if (!success) {
    emit('show-message', '播放失败', 'error')
  }
}

const updateConfig = async (key, value) => {
  try {
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.set(key, value)
    }
    emit('update:config', key, value)
  } catch (error) {
    console.error('更新配置失败:', error)
    throw error
  }
}
</script>
<style scoped>
@import '@/assets/styles/components/settings.css';
</style>