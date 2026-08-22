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

    <div v-if="showMacIconTip" class="icon-tip">
      <div class="icon-tip-content">
        <svg class="icon-tip-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clip-rule="evenodd" />
        </svg>
        <div class="icon-tip-text">
          <strong>macOS 用户提示：</strong>
          <p>Dock 图标已更新，下次启动会继续使用当前选择。启动台和应用程序文件仍使用安装包的默认图标。</p>
        </div>
        <button @click="showMacIconTip = false" class="icon-tip-close">×</button>
      </div>
    </div>

    <div class="logo-grid">
      <div v-for="logo in logoOptions" :key="logo.id" class="logo-option"
        :class="{ 'logo-option-active': selectedLogoId === logo.id }" @click="selectLogo(logo.id)">
        <img :src="logo.displayPath" :alt="logo.name" class="logo-option-image" />
        <!-- <span class="logo-option-name">{{ logo.name }}</span> -->
        <div v-if="selectedLogoId === logo.id" class="logo-option-check">
          <svg class="logo-check-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
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
const emit = defineEmits(['update:config', 'update-error'])

// 响应式数据
const showMacIconTip = ref(false)

// 可用的logo选项
const logoOptions = ref([
  {
    id: 'a1',
    name: 'A1 暖杏天蓝',
    displayPath: './logos/A1.png',
    resourcePath: 'resources/logos/A1.png'
  },
  {
    id: 'a2',
    name: 'A2 奶油薄荷',
    displayPath: './logos/A2.png',
    resourcePath: 'resources/logos/A2.png'
  },
  {
    id: 'a3',
    name: 'A3 金赭珊瑚',
    displayPath: './logos/A3.png',
    resourcePath: 'resources/logos/A3.png'
  },
  {
    id: 'a4',
    name: 'A4 奶油薰衣草',
    displayPath: './logos/A4.png',
    resourcePath: 'resources/logos/A4.png'
  },
  {
    id: 'b1',
    name: 'B1 经典歪头',
    displayPath: './logos/B1.png',
    resourcePath: 'resources/logos/B1.png'
  },
  {
    id: 'b2',
    name: 'B2 托腮思考',
    displayPath: './logos/B2.png',
    resourcePath: 'resources/logos/B2.png'
  },
  {
    id: 'b3',
    name: 'B3 正面忠诚',
    displayPath: './logos/B3.png',
    resourcePath: 'resources/logos/B3.png'
  },
  {
    id: 'b4',
    name: 'B4 忧郁大眼',
    displayPath: './logos/B4.png',
    resourcePath: 'resources/logos/B4.png'
  }
])

// 计算属性
const selectedLogoId = computed(() => {
  return logoOptions.value.some(logo => logo.id === props.config.selectedLogo)
    ? props.config.selectedLogo
    : 'b1'
})

const currentLogo = computed(() => {
  return logoOptions.value.find(logo => logo.id === selectedLogoId.value)
})

const currentLogoPath = computed(() => {
  return currentLogo.value.displayPath
})

// 方法
const selectLogo = async (logoId) => {
  const selectedLogo = logoOptions.value.find(logo => logo.id === logoId)
  if (selectedLogo) {
    try {
      const iconUpdateResult = await window.electronAPI?.app?.updateAppIcon(selectedLogo.resourcePath)
      if (!iconUpdateResult?.success) {
        throw new Error(iconUpdateResult?.error || '应用图标更新失败')
      }

      await window.electronAPI.config.update('selectedLogo', logoId)

      emit('update:config', {
        ...props.config,
        selectedLogo: logoId
      })

      // 在 macOS 上显示提示
      if (window.electronAPI.app.platform === 'darwin') {
        showMacIconTip.value = true
        // 5秒后自动隐藏提示
        setTimeout(() => {
          showMacIconTip.value = false
        }, 5000)
      }
    } catch (error) {
      console.error('更新应用图标失败:', error)
      emit('update-error', error.message)
    }
  }
}


</script>

<style scoped>
@import '@/assets/styles/components/settings.css';

.icon-tip {
  margin-top: 12px;
  padding: 12px;
  background-color: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 8px;
  animation: slideIn 0.3s ease-out;
}

.icon-tip-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.icon-tip-icon {
  width: 20px;
  height: 20px;
  color: #0ea5e9;
  flex-shrink: 0;
  margin-top: 2px;
}

.icon-tip-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.4;
}

.icon-tip-text strong {
  color: #0369a1;
  display: block;
  margin-bottom: 4px;
}

.icon-tip-text p {
  margin: 0;
  color: #0c4a6e;
}

.icon-tip-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.icon-tip-close:hover {
  background-color: #e2e8f0;
  color: #475569;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .icon-tip {
    background-color: #0f172a;
    border-color: #0ea5e9;
  }

  .icon-tip-text strong {
    color: #38bdf8;
  }

  .icon-tip-text p {
    color: #cbd5e1;
  }

  .icon-tip-close:hover {
    background-color: #334155;
    color: #cbd5e1;
  }
}
</style>
