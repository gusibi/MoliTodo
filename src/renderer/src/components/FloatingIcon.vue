<template>
  <div class="w-full h-full flex justify-center items-center">
    <div
      class="floating-icon relative flex items-center justify-center cursor-grab transition-all duration-300 ease-out w-12 h-12 md:w-11 md:h-11 rounded-full shadow-lg hover:shadow-xl hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      :class="[
        isAlert ? 'bg-gradient-to-br from-red-500 to-orange-600 floating-icon--alert' : 'bg-gradient-to-br from-indigo-500 to-purple-600',
        {
          'floating-icon--dragging': isDragging
        }
      ]" @click="handleClick" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave"
      @mousedown="handleMouseDown">
      <!-- 默认图标 -->
      <div class="icon-content absolute flex items-center justify-center text-white transition-all duration-300" :class="[
        'default-icon',
        { 'in-progress': hasInProgressTasks }
      ]">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
        </svg>
      </div>

      <!-- 提醒状态图标 -->
      <div
        class="icon-content alert-icon absolute flex items-center justify-center text-white transition-all duration-300 opacity-0">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
            fill="currentColor" />
        </svg>
      </div>

      <!-- 任务数量角标 -->
      <div
        class="badge absolute -top-1 -right-1 min-w-5 h-5 md:min-w-4 md:h-4 bg-red-500 rounded-full flex items-center justify-center text-xs md:text-xs font-bold text-white border-2 border-transparent transition-all duration-300"
        :class="taskCount > 0 ? 'badge--show opacity-100 scale-100' : 'opacity-0 scale-0'">
        <span class="leading-none px-1">{{ taskCount > 99 ? '99+' : taskCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import '@/assets/styles/components/floating-icon.css'

const taskStore = useTaskStore()
const taskCount = computed(() => taskStore.categoryCounts.today)
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
  }, 100)
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
  floatingIcon.classList.add('floating-icon--pending')

  // 获取当前窗口位置
  window.electronAPI.drag.getWindowPosition().then(pos => {
    initialWindowPos = pos
    floatingIcon.classList.remove('floating-icon--pending')
    console.log('Initial window position received:', pos)
  }).catch(error => {
    console.error('获取窗口位置失败:', error)
    floatingIcon.classList.remove('floating-icon--pending')
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
        floatingIcon.classList.add('floating-icon--dragging')
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
          floatingIcon.classList.remove('floating-icon--dragging')

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
          floatingIcon.classList.remove('floating-icon--dragging')
        }
      } else {
        // 如果没有初始位置，直接清理样式
        floatingIcon.style.transform = ''
        floatingIcon.classList.remove('floating-icon--dragging')
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
    floatingIcon.classList.remove('floating-icon--pending', 'floating-icon--dragging')

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
    // 刷新任务数据以确保计数准确
    await taskStore.getAllTasks()

    // 检查是否有进行中的任务
    hasInProgressTasks.value = taskStore.categoryCounts.doing > 0
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
  // 初始化任务数据
  await taskStore.getAllTasks()
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
