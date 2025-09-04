<template>
  <div>
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

    <LogoSelector 
      :config="config" 
      @update:config="handleLogoConfigUpdate" 
    />

    <FloatingIconSettings 
      :config="config" 
      @update-config="updateConfig" 
      @show-message="showMessage" 
    />
  </div>
</template>

<script setup>
import ThemeSwitcher from './ThemeSwitcher.vue'
import ColorThemeSwitcher from './ColorThemeSwitcher.vue'
import LogoSelector from './LogoSelector.vue'
import FloatingIconSettings from './FloatingIconSettings.vue'

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:config', 'show-message'])

// 处理Logo配置更新
const handleLogoConfigUpdate = async (updatedConfig) => {
  try {
    // 更新本地配置
    Object.assign(props.config, updatedConfig)
    
    // 保存selectedLogo到配置文件
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.set('selectedLogo', updatedConfig.selectedLogo)
    }
    emit('update:config', 'selectedLogo', updatedConfig.selectedLogo)
  } catch (error) {
    console.error('更新Logo配置失败:', error)
    emit('show-message', '更新Logo配置失败', 'error')
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

const showMessage = (text, type) => {
  emit('show-message', text, type)
}
</script>

<style scoped>
@import '@/assets/styles/components/settings.css';
</style>