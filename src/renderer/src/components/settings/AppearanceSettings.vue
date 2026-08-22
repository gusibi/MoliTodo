<template>
  <div>
    <h1 class="setting-page-title">{{ $t('settings.appearance') }}</h1>
    <p class="setting-page-description">{{ $t('settings.appearanceDescription') }}</p>

    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.themeSettings') }}</h3>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.themeMode') }}</div>
          <div class="setting-item-description">{{ $t('settings.themeModeDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <ThemeSwitcher />
        </div>
      </div>
    </div>

    <div class="setting-group">
      <ColorThemeSwitcher />
    </div>

    <LogoSelector 
      :config="config" 
      @update:config="handleLogoConfigUpdate"
      @update-error="handleLogoUpdateError"
    />

    <FloatingIconSettings 
      :config="config" 
      @update-config="updateConfig" 
      @show-message="showMessage" 
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import ThemeSwitcher from './ThemeSwitcher.vue'
import ColorThemeSwitcher from './ColorThemeSwitcher.vue'
import LogoSelector from './LogoSelector.vue'
import FloatingIconSettings from './FloatingIconSettings.vue'

const { t } = useI18n()

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:config', 'show-message'])

// 处理Logo配置更新
const handleLogoConfigUpdate = (updatedConfig) => {
  Object.assign(props.config, updatedConfig)
}

const handleLogoUpdateError = () => {
  emit('show-message', t('settings.logoUpdateFailed'), 'error')
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

const showMessage = (text, type) => {
  emit('show-message', text, type)
}
</script>

<style scoped>
@import '@/assets/styles/components/settings.css';
</style>
