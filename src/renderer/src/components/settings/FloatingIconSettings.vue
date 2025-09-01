<template>
  <div class="setting-group">
    <h3 class="setting-group-title">悬浮图标</h3>
    
    <!-- 显示悬浮图标开关 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-label">显示悬浮图标</div>
        <div class="setting-item-description">在桌面显示任务管理悬浮图标</div>
      </div>
      <div class="setting-item-control">
        <button 
          class="setting-toggle" 
          :class="{ 'setting-toggle-active': floatingIconConfig.visible }"
          @click="toggleFloatingIcon"
        >
          <span class="setting-toggle-button"></span>
        </button>
      </div>
    </div>

    <!-- 图标大小调节 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-label">图标大小</div>
        <div class="setting-item-description">调整悬浮图标的显示大小</div>
      </div>
      <div class="setting-item-control">
        <div class="setting-slider-group">
          <input 
            type="range" 
            class="setting-slider" 
            min="40" 
            max="120" 
            v-model="floatingIconConfig.size"
            @input="updateFloatingIconSize"
          />
          <span class="setting-slider-value">{{ floatingIconConfig.size }}px</span>
        </div>
      </div>
    </div>

    <!-- 透明度调节 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-label">透明度</div>
        <div class="setting-item-description">调整悬浮图标的透明度</div>
      </div>
      <div class="setting-item-control">
        <div class="setting-slider-group">
          <input 
            type="range" 
            class="setting-slider" 
            min="20" 
            max="100" 
            v-model="floatingIconConfig.opacity"
            @input="updateFloatingIconOpacity"
          />
          <span class="setting-slider-value">{{ floatingIconConfig.opacity }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, defineEmits } from 'vue'

// 定义 props
const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

// 定义 emits
const emit = defineEmits(['update-config', 'show-message'])

// 响应式数据 - 直接使用 props 中的 floatingIcon 配置
const floatingIconConfig = reactive(props.config.floatingIcon)

// 方法
const toggleFloatingIcon = async () => {
  try {
    floatingIconConfig.visible = !floatingIconConfig.visible
    await updateConfig('floatingIcon.visible', floatingIconConfig.visible)
    emit('show-message', floatingIconConfig.visible ? '已显示悬浮图标' : '已隐藏悬浮图标', 'success')
  } catch (error) {
    console.error('切换悬浮图标失败:', error)
    emit('show-message', '设置失败', 'error')
  }
}

const updateFloatingIconSize = async () => {
  try {
    await updateConfig('floatingIcon.size', parseInt(floatingIconConfig.size))
  } catch (error) {
    console.error('更新图标大小失败:', error)
    emit('show-message', '设置失败', 'error')
  }
}

const updateFloatingIconOpacity = async () => {
  try {
    await updateConfig('floatingIcon.opacity', parseInt(floatingIconConfig.opacity))
  } catch (error) {
    console.error('更新图标透明度失败:', error)
    emit('show-message', '设置失败', 'error')
  }
}

const updateConfig = async (key, value) => {
  emit('update-config', key, value)
}
</script>

<style scoped>
/* 组件样式继承自父组件的全局样式 */
</style>