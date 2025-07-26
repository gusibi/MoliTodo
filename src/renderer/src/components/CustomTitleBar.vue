<template>
  <div 
    class="flex items-center h-8  select-none  z-50 transition-all "
    :class="{ 'pl-20': isMacOS }" 
    @dblclick="handleDoubleClick"
  >
    <!-- 左侧：应用图标和标题 -->
    <div class="flex items-center gap-3 px-4 flex-shrink-0">
      <div class="w-6 h-6 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
        <img src="/tray-icon.png" alt="MoliTodo" class="w-5 h-5 object-contain" />
      </div>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
        MoliTodo
      </span>
    </div>

    <!-- 中间：拖拽区域 -->
    <div class="flex-1 h-full drag-region"></div>

    <!-- 右侧：窗口控制按钮（在 macOS 上隐藏，因为系统提供原生按钮） -->
    <div v-if="!isMacOS" class="flex items-center flex-shrink-0 no-drag">
      <button 
        class="w-12 h-8 border-0 bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        @click="minimizeWindow"
        title="最小化"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
        </svg>
      </button>
      
      <button 
        v-if="showMaximize"
        class="w-12 h-8 border-0 bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
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
        class="w-12 h-8 border-0 bg-transparent text-gray-500 hover:text-white hover:bg-red-500 cursor-pointer flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset"
        @click="closeWindow"
        title="关闭"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <!-- macOS 上的占位符，保持布局平衡 -->
    <div v-else class="flex items-center flex-shrink-0 w-12"></div>
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
/* 拖拽区域样式 */
.drag-region {
  -webkit-app-region: drag;
  app-region: drag;
}

/* 禁用拖拽区域样式 */
.no-drag {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .w-12.h-8 {
    @apply border border-gray-400;
  }
  
  .w-12.h-8:hover {
    @apply border-blue-500;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .transition-all {
    transition: none;
  }
}

/* 禁用状态 */
.w-12.h-8:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.w-12.h-8:disabled:hover {
  @apply bg-transparent text-gray-500;
}
</style>