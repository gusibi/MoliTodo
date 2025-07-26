<template>
  <div class="custom-titlebar" :class="{ 'titlebar-macos': isMacOS }" @dblclick="handleDoubleClick">
    <!-- 左侧：应用图标和标题 -->
    <div class="titlebar-left">
      <div class="app-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
        </svg>
      </div>
      <div class="app-title">{{ title }}</div>
    </div>

    <!-- 中间：拖拽区域 -->
    <div class="titlebar-drag-region"></div>

    <!-- 右侧：窗口控制按钮（在 macOS 上隐藏，因为系统提供原生按钮） -->
    <div v-if="!isMacOS" class="titlebar-controls">
      <button 
        class="titlebar-button minimize-button" 
        @click="minimizeWindow"
        title="最小化"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
        </svg>
      </button>
      
      <button 
        v-if="showMaximize"
        class="titlebar-button maximize-button" 
        @click="maximizeWindow"
        :title="isMaximized ? '还原' : '最大化'"
      >
        <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="3" width="6" height="6" stroke="currentColor" stroke-width="1" fill="none"/>
          <rect x="4" y="1" width="6" height="6" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
      </button>
      
      <button 
        class="titlebar-button titlebar-close-button" 
        @click="closeWindow"
        title="关闭"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'MoliTodo'
  },
  windowType: {
    type: String,
    required: true
  },
  showMaximize: {
    type: Boolean,
    default: true
  }
})

const isMaximized = ref(false)

// 平台检测
const isMacOS = ref(false)

// 检测当前平台
const detectPlatform = () => {
  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()
  
  if (platform.includes('mac') || userAgent.includes('mac')) {
    isMacOS.value = true
  }
}

// 检查窗口是否最大化
const checkMaximizedState = async () => {
  try {
    isMaximized.value = await window.electronAPI.windows.isMaximized(props.windowType)
  } catch (error) {
    console.error('检查窗口最大化状态失败:', error)
  }
}

// 最小化窗口
const minimizeWindow = async () => {
  try {
    await window.electronAPI.windows.minimize(props.windowType)
  } catch (error) {
    console.error('最小化窗口失败:', error)
  }
}

// 最大化/还原窗口
const maximizeWindow = async () => {
  try {
    await window.electronAPI.windows.maximize(props.windowType)
    // 切换状态
    isMaximized.value = !isMaximized.value
  } catch (error) {
    console.error('最大化窗口失败:', error)
  }
}

// 关闭窗口
const closeWindow = async () => {
  try {
    await window.electronAPI.windows.close(props.windowType)
  } catch (error) {
    console.error('关闭窗口失败:', error)
  }
}

// 双击标题栏最大化/还原
const handleDoubleClick = () => {
  if (props.showMaximize) {
    maximizeWindow()
  }
}

onMounted(() => {
  // 检测平台
  detectPlatform()
  
  // 检查窗口最大化状态
  checkMaximizedState()
  
  // 定期检查最大化状态（处理用户通过其他方式改变窗口状态的情况）
  const interval = setInterval(checkMaximizedState, 1000)
  
  // 组件卸载时清理定时器
  return () => {
    clearInterval(interval)
  }
})
</script>

<style scoped>
.custom-titlebar {
  display: flex;
  align-items: center;
  height: 32px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-medium);
  user-select: none;
  -webkit-user-select: none;
  position: relative;
  z-index: 1000;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-lg);
  flex-shrink: 0;
}

.app-icon {
  width: 16px;
  height: 16px;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-title {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  white-space: nowrap;
}

.titlebar-drag-region {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
  /* 在 Windows 和 Linux 上启用拖拽 */
  app-region: drag;
}

.titlebar-controls {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.titlebar-button {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  font-size: 0; /* 隐藏可能的文本 */
}

.titlebar-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.titlebar-button:active {
  background: var(--bg-active);
}

/* 关闭按钮特殊样式 */
.titlebar-close-button:hover {
  background: #e81123;
  color: white;
}

.titlebar-close-button:active {
  background: #c50e1f;
  color: white;
}

/* macOS 样式适配 - 通过 JavaScript 动态添加类名 */
.custom-titlebar.titlebar-macos {
  padding-left: 78px; /* 为 macOS 的红绿灯按钮留出空间 */
}

.custom-titlebar.titlebar-macos .titlebar-left {
  /* 在 macOS 上，标题和图标需要避开系统按钮 */
  margin-left: 0;
}

.custom-titlebar.titlebar-macos .titlebar-drag-region {
  /* 确保拖拽区域不覆盖系统按钮 */
  margin-left: 0;
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .titlebar-button {
    border: 1px solid var(--border-strong);
  }
  
  .titlebar-button:hover {
    border-color: var(--color-primary);
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .titlebar-button {
    transition: none;
  }
}

/* 焦点样式 */
.titlebar-button:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* 禁用状态 */
.titlebar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.titlebar-button:disabled:hover {
  background: transparent;
  color: var(--text-secondary);
}
</style>