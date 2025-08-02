<template>
  <div class="floating-icon-container">
    <div class="floating-icon" :class="{ alert: isAlert }" @click="handleClick" @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave" @mousedown="handleMouseDown">
      <!-- 默认图标 -->
      <div class="icon-content default-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
        </svg>
      </div>

      <!-- 提醒状态图标 -->
      <div class="icon-content alert-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
            fill="currentColor" />
        </svg>
      </div>

      <!-- 任务数量角标 -->
      <div class="badge" :class="{ show: taskCount > 0 }">
        <span>{{ taskCount > 99 ? '99+' : taskCount }}</span>
      </div>

      <!-- 进行中任务指示器 -->
      <div v-if="hasInProgressTasks" class="progress-indicator"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const taskStore = useTaskStore()
const taskCount = ref(0)
const hasInProgressTasks = ref(false)
const isAlert = ref(false)
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// 悬停和面板状态
const isHovering = ref(false)
const isPanelHovering = ref(false)
const panelVisible = ref(false)
let hoverTimeout = null
let hideTimeout = null

const handleClick = () => {
  // 如果面板可见，则隐藏面板
  if (panelVisible.value) {
    console.log('面板可见，点击收起面板')
    hideTaskPanel()

    // 清除相关定时器
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
  } else {
    console.log('面板不可见，点击无操作')
  }
}

const handleMouseEnter = () => {
  console.log('鼠标进入悬浮图标')
  isHovering.value = true

  // 清除隐藏定时器
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
    console.log('清除隐藏定时器')
  }

  // 清除提醒状态
  if (isAlert.value) {
    console.log('清除提醒状态')
    isAlert.value = false
  }

  // 延迟显示任务面板
  console.log('设置任务面板显示定时器 (300ms)')
  hoverTimeout = setTimeout(() => {
    console.log('显示定时器触发！检查状态...', {
      isHovering: isHovering.value,
      panelVisible: panelVisible.value
    })
    if (isHovering.value && !panelVisible.value) {
      console.log('条件满足，开始显示任务面板')
      showTaskPanel()
    }
  }, 300)
}

const handleMouseLeave = () => {
  console.log('鼠标离开悬浮图标')
  isHovering.value = false

  // 清除悬停定时器
  if (hoverTimeout) {
    console.log('清除悬停定时器')
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }

  // 延迟隐藏任务面板，但要考虑面板悬停状态
  console.log('设置任务面板隐藏定时器')
  hideTimeout = setTimeout(() => {
    if (!isHovering.value && !isPanelHovering.value && panelVisible.value) {
      console.log('定时器触发，隐藏任务面板')
      hideTaskPanel()
    }
  }, 300)
}

const showTaskPanel = async () => {
  console.log('开始显示任务面板')
  if (panelVisible.value) {
    console.log('任务面板已经可见，跳过显示')
    return
  }

  try {
    console.log('调用API显示任务面板')
    await window.electronAPI.windows.showTaskPanel()
    panelVisible.value = true
    console.log('任务面板状态设置为可见')
  } catch (error) {
    console.error('显示任务面板失败:', error)
  }
}

const hideTaskPanel = async () => {
  console.log('开始隐藏任务面板')
  if (!panelVisible.value) {
    console.log('任务面板已经隐藏，跳过隐藏')
    return
  }

  try {
    console.log('调用API隐藏任务面板')
    await window.electronAPI.windows.hideTaskPanel()
    panelVisible.value = false
    console.log('任务面板状态设置为隐藏')
  } catch (error) {
    console.error('隐藏任务面板失败:', error)
  }
}

const handleMouseDown = (event) => {
  if (event.button !== 0) return // 只处理左键

  let hasMoved = false
  let startTime = Date.now()
  let initialWindowPos = null
  let lastIpcTime = 0
  let pendingUpdate = false
  const ipcThrottle = 40 // IPC调用节流，25fps
  const floatingIcon = document.querySelector('.floating-icon')

  isDragging.value = true
  dragStartPos.value = { x: event.screenX, y: event.screenY }

  // 阻止显示面板的定时器
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
    console.log('清除悬停显示定时器')
  }

  // 添加pending状态，改善初始延迟体验
  floatingIcon.classList.add('pending-drag')
  
  // 获取当前窗口位置
  window.electronAPI.drag.getWindowPosition().then(pos => {
    initialWindowPos = pos
    floatingIcon.classList.remove('pending-drag')
    console.log('Initial window position received:', pos)
  }).catch(error => {
    console.error('获取窗口位置失败:', error)
    floatingIcon.classList.remove('pending-drag')
  })

  const handleMouseMove = (moveEvent) => {
    if (!isDragging.value) return
    
    // 如果初始位置还没获取到，暂时不处理
    if (!initialWindowPos) return

    const deltaX = moveEvent.screenX - dragStartPos.value.x
    const deltaY = moveEvent.screenY - dragStartPos.value.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // 如果移动距离超过阈值，认为是拖拽
    if (distance > 5) {
      if (!hasMoved) {
        console.log('开始拖拽模式')
        hasMoved = true
        // 添加拖拽样式
        floatingIcon.classList.add('dragging')
        // 确保开始时没有残留的transform
        floatingIcon.style.transform = ''
      }

      // 1. 立即更新视觉反馈 - 60fps丝滑体验
      floatingIcon.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.15)`

      // 2. 节流的IPC调用 - 让真实窗口跟上视觉元素
      if (initialWindowPos) {
        const now = Date.now()
        if (now - lastIpcTime >= ipcThrottle && !pendingUpdate) {
          lastIpcTime = now
          pendingUpdate = true

          const newPosition = {
            x: initialWindowPos.x + deltaX,
            y: initialWindowPos.y + deltaY
          }

          // 异步更新真实窗口位置，不阻塞UI
          window.electronAPI.drag.dragWindow(newPosition)
            .then(() => {
              pendingUpdate = false
            })
            .catch((error) => {
              console.error('窗口位置更新失败:', error)
              pendingUpdate = false
            })
        }
      }
    }
  }

  const handleMouseUp = async (upEvent) => {
    if (!isDragging.value) return

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log('mouseup事件触发', { hasMoved, duration })

    isDragging.value = false

    if (hasMoved) {
      // 拖拽操作完成
      console.log('拖拽操作完成')
      
      // 计算最终位移
      const finalDeltaX = upEvent.screenX - dragStartPos.value.x
      const finalDeltaY = upEvent.screenY - dragStartPos.value.y
      
      // 3. 发送最终精确位置，确保视觉和实际位置对齐
      if (initialWindowPos) {
        const finalPosition = {
          x: initialWindowPos.x + finalDeltaX,
          y: initialWindowPos.y + finalDeltaY
        }

        try {
          // 先同步最终位置
          await window.electronAPI.drag.dragWindow(finalPosition)
          console.log('最终位置已同步', finalPosition)
          
          // 位置同步后，平滑地移除transform
          floatingIcon.style.transition = 'transform 0.15s ease-out'
          floatingIcon.style.transform = ''
          
          // 移除拖拽样式
          floatingIcon.classList.remove('dragging')
          
          // 短暂延迟后移除transition，恢复默认
          setTimeout(() => {
            if (floatingIcon) {
              floatingIcon.style.transition = ''
            }
          }, 150)
          
        } catch (error) {
          console.error('最终位置同步失败:', error)
          // 如果失败，也要清理样式
          floatingIcon.style.transform = ''
          floatingIcon.classList.remove('dragging')
        }
      } else {
        // 如果没有初始位置，直接清理样式
        floatingIcon.style.transform = ''
        floatingIcon.classList.remove('dragging')
      }
      
      try {
        await window.electronAPI.drag.endDrag()
      } catch (error) {
        console.error('结束拖拽失败:', error)
      }
    } else if (duration < 500) {
      // 这是点击操作（短时间且没有移动）
      console.log('检测到点击操作')
      handleClick()
    }

    // 重置状态
    hasMoved = false
    initialWindowPos = null
    pendingUpdate = false
    
    // 清理所有可能的样式类
    floatingIcon.classList.remove('pending-drag', 'dragging')

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)

  // 防止默认的拖拽行为
  event.preventDefault()
}

const updateTaskCount = async () => {
  try {
    const count = await window.electronAPI.tasks.getCount()
    taskCount.value = count

    // 暂时简化，直接通过 API 检查是否有进行中的任务
    try {
      const allTasks = await window.electronAPI.tasks.getAll()
      if (Array.isArray(allTasks)) {
        hasInProgressTasks.value = allTasks.some(task => task.status === 'doing')
      } else {
        hasInProgressTasks.value = false
      }
    } catch (taskError) {
      console.warn('获取任务列表失败，设置进行中任务为 false:', taskError)
      hasInProgressTasks.value = false
    }
  } catch (error) {
    console.error('更新任务数量失败:', error)
    hasInProgressTasks.value = false
  }
}

const handleTaskReminder = (event, task) => {
  console.log('收到任务提醒事件:', event, task)
  isAlert.value = true
  console.log('设置提醒状态为 true，isAlert.value =', isAlert.value)
  
  // 不自动清除提醒状态，只有用户悬浮到图标上时才清除
  // 提醒状态将持续显示直到用户交互
}

const handleConfigUpdate = (event, config) => {
  console.log('配置更新:', config)
  // 这里可以根据配置更新图标样式
}

// 面板鼠标事件处理
const handlePanelMouseEnter = () => {
  console.log('收到面板鼠标进入事件')
  isPanelHovering.value = true
  // 清除隐藏定时器
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
    console.log('清除面板隐藏定时器')
  }
}

const handlePanelMouseLeave = () => {
  console.log('收到面板鼠标离开事件')
  isPanelHovering.value = false
  // 延迟隐藏面板
  hideTimeout = setTimeout(() => {
    if (!isHovering.value && !isPanelHovering.value && panelVisible.value) {
      console.log('面板隐藏定时器触发，隐藏任务面板')
      hideTaskPanel()
    }
  }, 300)
}

onMounted(async () => {
  await updateTaskCount()

  // 监听事件
  window.electronAPI.events.on('tasks-updated', updateTaskCount)
  window.electronAPI.events.on('task-reminder', handleTaskReminder)
  window.electronAPI.events.on('config-updated', handleConfigUpdate)

  // 监听面板鼠标事件
  window.electronAPI.events.on('panel-mouse-enter', handlePanelMouseEnter)
  window.electronAPI.events.on('panel-mouse-leave', handlePanelMouseLeave)
})

onUnmounted(() => {
  // 清理定时器
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }

  // 清理事件监听器
  window.electronAPI.events.removeAllListeners('tasks-updated')
  window.electronAPI.events.removeAllListeners('task-reminder')
  window.electronAPI.events.removeAllListeners('config-updated')
  window.electronAPI.events.removeAllListeners('panel-mouse-enter')
  window.electronAPI.events.removeAllListeners('panel-mouse-leave')
})
</script>



<style scoped>
/* 悬浮图标样式 */

/* 悬浮图标特定样式 */

.floating-icon-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  /* 移除容器的阴影，让图标本身处理阴影 */
}

.floating-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* 图标本身的阴影效果 */
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  /* 恢复app-region设置，但通过JS控制拖拽 */
  -webkit-app-region: no-drag;
  /* 只有图标本身接收鼠标事件 */
  pointer-events: auto;
}

.floating-icon:hover {
  transform: scale(1.1);
  /* 悬停时增强阴影效果 */
  filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.25));
}

/* 图标内容 */
.icon-content {
  color: white;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.default-icon {
  opacity: 1;
}

.alert-icon {
  opacity: 0;
  position: absolute;
}

/* 提醒状态样式 */
.floating-icon.alert {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  animation: alertPulse 2s infinite;
}

.floating-icon.alert .default-icon {
  opacity: 0;
}

.floating-icon.alert .alert-icon {
  opacity: 1;
}

/* 提醒动画 */
@keyframes alertPulse {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.05);
  }
}

/* 角标样式 */
.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 20px;
  height: 20px;
  background: #ff4757;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  color: white;
  border: 2px solid transparent;
  opacity: 0;
  transform: scale(0);
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.badge.show {
  opacity: 1;
  transform: scale(1);
}

.badge span {
  line-height: 1;
  padding: 0 4px;
}

/* 悬停效果 */
.floating-icon:hover .badge {
  transform: scale(1.1);
}

/* 等待拖拽状态 */
.floating-icon.pending-drag {
  cursor: grabbing;
  opacity: 0.8;
}

/* 拖拽状态 */
.floating-icon.dragging {
  /* 拖拽时使用更强烈的阴影效果 */
  filter: drop-shadow(0 8px 25px rgba(0, 0, 0, 0.4));
  z-index: 1000;
  /* 拖拽时禁用过渡动画，让移动更跟手 */
  transition: none;
  cursor: grabbing;
  /* 确保transform变换的原点在中心 */
  transform-origin: center;
}

.progress-indicator {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: #2ed573;
  border-radius: 50%;
  animation: blink 2s infinite;
  z-index: 10;
  /* 确保指示器在最上层 */
  pointer-events: none;
  /* 防止指示器干扰点击 */
}

@keyframes blink {

  0%,
  50% {
    opacity: 1;
  }

  51%,
  100% {
    opacity: 0.3;
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .floating-icon {
    width: 45px;
    height: 45px;
  }

  .badge {
    min-width: 18px;
    height: 18px;
    font-size: 10px;
  }
}

/* 无障碍支持 */
.floating-icon:focus {
  outline: 2px solid #4285f4;
  outline-offset: 2px;
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .floating-icon {
    border: 2px solid #000;
  }

  .badge {
    border: 2px solid transparent;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {

  .floating-icon,
  .badge,
  .icon-content {
    transition: none;
  }

  .floating-icon.alert {
    animation: none;
  }
}
</style>