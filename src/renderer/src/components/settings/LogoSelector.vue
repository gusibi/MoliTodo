<template>
  <div class="setting-group">
    <h3 class="setting-group-title">应用图标</h3>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-label">选择应用图标</div>
        <div class="setting-item-description">自定义应用的图标样式</div>
      </div>
      <div class="setting-item-control">
        <div class="logo-preview">
          <img :src="currentLogoPath" :alt="currentLogo.name" class="logo-preview-image" />
          <span class="logo-preview-name">{{ currentLogo.name }}</span>
        </div>
      </div>
    </div>
    
    <div class="logo-grid">
      <div 
        v-for="logo in logoOptions" 
        :key="logo.id"
        class="logo-option"
        :class="{ 'logo-option-active': props.config.selectedLogo === logo.id }"
        @click="selectLogo(logo.id)"
      >
        <img :src="logo.path.replace('resources/', '/')" :alt="logo.name" class="logo-option-image" />
        <span class="logo-option-name">{{ logo.name }}</span>
        <div v-if="props.config.selectedLogo === logo.id" class="logo-option-check">
          <svg class="logo-check-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Props
const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

// Emits
const emit = defineEmits(['update:config'])

// 可用的logo选项
const logoOptions = ref([
  {
    id: 'default',
    name: '默认图标',
    path: 'resources/icon.png'
  },
  {
    id: 'icon-v1',
    name: '经典版本',
    path: 'resources/icon-v1.png'
  },
  {
    id: 'icon-v2',
    name: '现代版本',
    path: 'resources/icon-v2.png'
  },
  {
    id: 'icon-1',
    name: '简约风格',
    path: 'resources/icon-1.png'
  },
  {
    id: 'icon-2',
    name: '彩色版本',
    path: 'resources/icon-2.png'
  },
  {
    id: 'icon-3',
    name: '蓝色主题',
    path: 'resources/icon-3.png'
  },
  {
    id: 'icon-4',
    name: '绿色主题',
    path: 'resources/icon-4.png'
  }
])

// 计算属性
const currentLogo = computed(() => {
  return logoOptions.value.find(logo => logo.id === props.config.selectedLogo) || logoOptions.value[0]
})

const currentLogoPath = computed(() => {
  return currentLogo.value.path.replace('resources/', '/')
})

// 方法
const selectLogo = (logoId) => {
  const selectedLogo = logoOptions.value.find(logo => logo.id === logoId)
  if (selectedLogo) {
    // 更新配置
    const updatedConfig = {
      ...props.config,
      selectedLogo: logoId
    }
    emit('update:config', updatedConfig)
    
    // 更新应用图标
    try {
      window.electronAPI?.app?.updateAppIcon(selectedLogo.path)
    } catch (error) {
      console.error('更新应用图标失败:', error)
    }
  }
}


</script>

<style scoped>
@import '@/assets/styles/components/settings.css';
</style>