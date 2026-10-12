<template>
  <div class="floating-icon-container">
    <Button ref="floatingIconRef" variant="ghost" style="width: 100vw; height: 100vh; border-radius: 20%" :class="[
      'floating-icon p-0',
      isAlert ? 'floating-icon--alert' : 'floating-icon--normal',
      isDragging ? 'floating-icon--dragging' : '',
      isPending ? 'floating-icon--pending' : ''
    ]" @mousedown="handleMouseDown" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave"
      @click="handleButtonClick" :title="isAlert ? $t('floatView.reminderState') : taskCount > 0 ? $t('floatView.pendingState', { count: taskCount }) : $t('floatView.clearedState')" :aria-label="$t('app.title')" :disabled="isPending">
      <div class="floating-icon-content">
        <div class="floating-icon-calendar" aria-hidden="true">
          <div class="floating-icon-calendar-header">{{ calendarWeekday }}</div>
          <div class="floating-icon-calendar-body">
            <AlarmClock v-if="isAlert" class="floating-icon-calendar-alarm" :stroke-width="2.5" />
            <template v-else-if="taskCount > 0">
              <span class="floating-icon-calendar-count">{{ taskCount > 99 ? '99+' : taskCount }}</span>
              <span class="floating-icon-calendar-dot" />
            </template>
            <Check v-else class="floating-icon-calendar-check" :stroke-width="3" />
          </div>
        </div>
      </div>
    </Button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlarmClock, Check } from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import Button from '../ui/button/Button.vue'
import { usePendingReminders } from '@/composables/usePendingReminders'
import '@/assets/styles/components/floating-icon.css'

const { locale } = useI18n()
const taskStore = useTaskStore()
const taskCount = computed(() => taskStore.tasks.filter(task => task.status !== 'done' && task.status !== 'deleted' && taskStore.isTodayTask(task)).length)
const { pendingReminders } = usePendingReminders()
const isAlert = computed(() => pendingReminders.value.length > 0)

// 头带星期：跟随应用语言（zh=周五 / en=Fri），跨天自动刷新
const calendarWeekday = ref('')
const updateCalendarDate = () => {
  const now = new Date()
  const tag = locale.value === 'en' ? 'en-US' : 'zh-CN'
  calendarWeekday.value = new Intl.DateTimeFormat(tag, { weekday: 'short' }).format(now)
}
watch(locale, updateCalendarDate)
let calendarDateTimer = null

const isDragging = ref(false)
const isPending = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const floatingIconRef = ref(null)

// 悬停和面板状态
const isHovering = ref(false)
const isPanelHovering = ref(false)
const panelVisible = ref(false)
let hoverTimeout = null
let hideTimeout = null

// 鼠标穿透状态（issue #11）
// 悬浮窗是方形，可见图标是带圆角的方形，窗口里图标之外的区域（含四个圆角外
// 的小角）必须让鼠标事件穿透，否则会挡住下面应用的按钮。当前是否处于穿透态。
let isIgnoringMouse = null

const setIgnoreMouse = (ignore) => {
  if (isIgnoringMouse === ignore) return
  isIgnoringMouse = ignore
  try {
    window.electronAPI.windows.setFloatingIconIgnoreMouse(ignore)
  } catch (error) {
    console.error('设置鼠标穿透失败:', error)
  }
}

// 判断光标是否落在可见圆角方形图标内（圆角外的四个小角穿透）
const isPointInIcon = (clientX, clientY) => {
  const el = floatingIconRef.value?.el
  if (!el) return false

  const rect = el.getBoundingClientRect()
  const pad = 1 // 容差，避免边缘抖动
  const x = clientX - rect.left
  const y = clientY - rect.top
  if (x < -pad || y < -pad || x > rect.width + pad || y > rect.height + pad) return false

  // 与 CSS rounded-[20%] 保持一致的圆角半径
  const radius = Math.min(rect.width, rect.height) * 0.20
  const nearestX = Math.min(Math.max(x, radius), rect.width - radius)
  const nearestY = Math.min(Math.max(y, radius), rect.height - radius)
  const dx = x - nearestX
  const dy = y - nearestY

  return dx * dx + dy * dy <= radius * radius
}

const handleWindowMouseMove = (event) => {
  // 拖动过程中必须保持可交互，否则会中途丢失鼠标
  if (isDragging.value) {
    setIgnoreMouse(false)
    return
  }

  setIgnoreMouse(!isPointInIcon(event.clientX, event.clientY))
}


const handleButtonClick = (event) => {
  if (event.detail === 0) handleClick()
}

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
    showTaskPanel()
  }
}

const handleMouseEnter = () => {
  isHovering.value = true

  // 清除隐藏定时器
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
    console.log('清除隐藏定时器')
  }

  // 延迟显示任务面板
  console.log('设置任务面板显示定时器 (300ms)')
  hoverTimeout = setTimeout(() => {
    console.log('显示定时器触发！检查状态...', {
      isHovering: isHovering.value,
      panelVisible: panelVisible.value
    })
    if (isHovering.value && !panelVisible.value) {
      // console.log('条件满足，开始显示任务面板')
      showTaskPanel()
    }
  }, 100)
}

const handleMouseLeave = () => {
  // console.log('鼠标离开悬浮图标')
  isHovering.value = false

  // 清除悬停定时器
  if (hoverTimeout) {
    // console.log('清除悬停定时器')
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }

  // 延迟隐藏任务面板，但要考虑面板悬停状态
  // console.log('设置任务面板隐藏定时器')
  hideTimeout = setTimeout(() => {
    if (!isHovering.value && !isPanelHovering.value && panelVisible.value) {
      console.log('定时器触发，隐藏任务面板')
      hideTaskPanel()
    }
  }, 300)
}

const showTaskPanel = async () => {
  // console.log('开始显示任务面板')
  if (panelVisible.value) {
    console.log('任务面板已经可见，跳过显示')
    return
  }

  try {
    // console.log('调用API显示任务面板')
    await window.electronAPI.windows.showTaskPanel()
    panelVisible.value = true
    // console.log('任务面板状态设置为可见')
  } catch (error) {
    console.error('显示任务面板失败:', error)
  }
}

const hideTaskPanel = async () => {
  // console.log('开始隐藏任务面板')
  if (!panelVisible.value) {
    // console.log('任务面板已经隐藏，跳过隐藏')
    return
  }

  try {
    // console.log('调用API隐藏任务面板')
    await window.electronAPI.windows.hideTaskPanel()
    panelVisible.value = false
    // console.log('任务面板状态设置为隐藏')
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
    // console.log('清除悬停显示定时器')
  }

  // 添加pending状态，改善初始延迟体验
  floatingIcon.classList.add('floating-icon--pending')

  // 获取当前窗口位置
  window.electronAPI.drag.getWindowPosition().then(pos => {
    initialWindowPos = pos
    floatingIcon.classList.remove('floating-icon--pending')
    // console.log('Initial window position received:', pos)
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

      // 1. 立即更新视觉反馈（只位移不放大：窗口已铺满，放大边缘会被裁切）
      floatingIcon.style.transform = `translate(${deltaX}px, ${deltaY}px)`

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
  } catch (error) {
    console.error('更新任务数量失败:', error)
  }
}

const handleTaskReminder = () => {
  updateTaskCount()
}

// 让图标边长跟随设置里的图标大小，并占满整个窗口。
// macOS 26+ 会给透明窗口垫一层圆角白色衬底，只有内容完全铺满窗口才能把它
// 盖住（用户反馈的"白底外框"），因此不再给 badge/hover 留缩放边距。
const applyIconSize = (size) => {
  const windowSize = Number(size) || 50
  document.documentElement.style.setProperty('--floating-icon-size', `${windowSize}px`)
}

const handleConfigUpdate = (event, config) => {
  if (config && config.size) {
    applyIconSize(config.size)
  }
}

// 面板鼠标事件处理
const handlePanelMouseEnter = () => {
  // console.log('收到面板鼠标进入事件')
  isPanelHovering.value = true
  // 清除隐藏定时器
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
    // console.log('清除面板隐藏定时器')
  }
}

const handlePanelMouseLeave = () => {
  // console.log('收到面板鼠标离开事件')
  isPanelHovering.value = false
  // 延迟隐藏面板
  hideTimeout = setTimeout(() => {
    if (!isHovering.value && !isPanelHovering.value && panelVisible.value) {
      console.log('面板隐藏定时器触发，隐藏任务面板')
      hideTaskPanel()
    }
  }, 300)
}

// 处理面板取消固定事件
const handlePanelUnpinned = () => {
  console.log('面板取消固定，隐藏任务面板')
  panelVisible.value = false
}

onMounted(async () => {
  // 初始化头带星期，跨天自动刷新
  updateCalendarDate()
  calendarDateTimer = setInterval(updateCalendarDate, 30 * 1000)

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
  
  // 监听面板取消固定事件
  window.electronAPI.events.on('panel-unpinned', handlePanelUnpinned)

  // 应用图标大小配置
  try {
    const config = await window.electronAPI.config.get()
    applyIconSize(config?.floatingIcon?.size)
  } catch (error) {
    console.error('读取悬浮图标配置失败:', error)
  }

  // 圆角方形命中区域：静止时让窗口空白区域穿透鼠标事件
  window.addEventListener('mousemove', handleWindowMouseMove)
  setIgnoreMouse(true)
})

onUnmounted(() => {
  // 清理定时器
  if (calendarDateTimer) {
    clearInterval(calendarDateTimer)
    calendarDateTimer = null
  }
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
  window.electronAPI.events.removeAllListeners('panel-unpinned')

  window.removeEventListener('mousemove', handleWindowMouseMove)
  // 恢复可交互，避免窗口残留在穿透状态
  setIgnoreMouse(false)
})
</script>
