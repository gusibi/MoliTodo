<template>
  <div class="task-panel" @mouseenter="handlePanelMouseEnter" @mouseleave="handlePanelMouseLeave">
    <!-- 面板头部 -->
    <div class="task-panel-header">
      <h2 class="task-panel-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
        </svg>
        今日任务
        <span class="task-panel-count">{{ taskCount }} 个任务</span>
      </h2>
    </div>

    <!-- 快速添加框 -->
    <div class="task-panel-quick-add">
      <div class="task-panel-input-container">
        <input v-model="newTaskContent" type="text" class="task-panel-input" placeholder="添加新任务..." maxlength="200"
          @keypress.enter="addTask" ref="quickAddInput">
        <button class="task-panel-add-btn" @click="addTask" title="添加任务">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2v20M2 12h20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="task-panel-list-container">
      <div v-if="tasks.length > 0" class="task-panel-list">
        <div v-for="task in sortedTasks" :key="task.id"
          :class="[
            'task-panel-item', 
            (task.status || (task.completed ? 'done' : 'todo')) === 'doing' && task.reminderTime && isReminderOverdue(task.reminderTime) 
              ? 'overtime' 
              : task.status || (task.completed ? 'done' : 'todo')
          ]" 
          :data-task-id="task.id"
          :data-status="task.status || (task.completed ? 'done' : 'todo')"
          @contextmenu="showTaskContextMenu($event, task)">
          <div class="task-panel-status-indicator" @click="cycleTaskStatus(task.id)" :title="'点击切换状态'">
            <component :is="getStatusIcon(task.status || (task.completed ? 'done' : 'todo'))" />
          </div>

          <div class="task-panel-content">
            <div class="task-panel-main-row">
              <div class="task-panel-text-container">
                <div v-if="!isEditing(task.id)" class="task-panel-text" @dblclick="startEditTask(task.id)"
                  :title="'双击编辑'">
                  {{ task.content }}
                </div>
                <input v-else v-model="editingContent" class="task-panel-edit-input"
                  @keydown.enter="saveTaskEdit(task.id)" @keydown.esc="cancelTaskEdit" @blur="saveTaskEdit(task.id)"
                  ref="editInput" />
              </div>

              <div class="task-panel-actions">
                <button v-if="(task.status || (task.completed ? 'done' : 'todo')) === 'doing'"
                  class="task-panel-action-btn pause-btn" @click="pauseTask(task.id)" title="暂停任务">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill="currentColor" />
                  </svg>
                </button>
                <button class="task-panel-action-btn reminder-btn" @click="showReminderModal(task.id)" title="设置提醒">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
                      fill="currentColor" />
                  </svg>
                </button>
                <button class="task-panel-action-btn delete-btn" @click="deleteTask(task.id)" title="删除任务">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 元信息占满整行 -->
            <div :class="['task-panel-meta', { 'compact': shouldUseCompactMode(task) }]">
              <span :class="['task-panel-status', `status-${task.status || (task.completed ? 'done' : 'todo')}`]">
                {{ getStatusText(task.status || (task.completed ? 'done' : 'todo')) }}
              </span>

              <!-- 提醒时间信息 -->
              <div v-if="task.reminderTime"
                :class="['task-panel-reminder', { 'overdue': isReminderOverdue(task.reminderTime) }]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
                    fill="currentColor" />
                </svg>
                {{ formatReminderTime(task.reminderTime) }}
              </div>

              <!-- 时间追踪信息（仅显示进行中任务） -->
              <div v-if="(task.status || (task.completed ? 'done' : 'todo')) === 'doing'" class="task-panel-duration">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                  <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2" />
                </svg>
                进行中 {{ formatDurationCompact(getTaskTotalDuration(task)) }}
              </div>

              <!-- 占位元素，推动内容向右对齐 -->
              <div class="task-panel-meta-spacer"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="task-panel-empty show">
        <div class="task-panel-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              fill="currentColor" />
          </svg>
        </div>
        <h3>太棒了！</h3>
        <p>所有任务都已完成</p>
      </div>
    </div>

    <!-- 提醒设置弹窗 -->
    <div v-if="showReminder" class="task-panel-reminder-modal show">
      <div class="task-panel-modal-content" @click.stop>
        <div class="modal-header">
          <h3>设置提醒</h3>
          <button class="modal-close-button" @click="hideReminderModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="reminderDate">日期</label>
            <input v-model="reminderDate" type="date" id="reminderDate" class="form-input">
          </div>
          <div class="form-group">
            <label for="reminderTime">时间</label>
            <input v-model="reminderTime" type="time" id="reminderTime" class="form-input">
          </div>
          <div class="task-panel-quick-time-buttons">
            <button class="task-panel-quick-time-btn" @click="setQuickTime(15)">15分钟后</button>
            <button class="task-panel-quick-time-btn" @click="setQuickTime(60)">1小时后</button>
            <button class="task-panel-quick-time-btn" @click="setQuickTime(24 * 60)">明天</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="hideReminderModal">取消</button>
          <button class="btn btn-primary" @click="saveTaskReminder">保存</button>
        </div>
      </div>
    </div>

    <!-- 面板底部 -->
    <div class="task-panel-footer">
      <div class="task-panel-footer-stats" @click="openTaskManager" title="点击打开任务管理">{{ footerStats }}</div>
    </div>

    <!-- 右键菜单 -->
    <div v-if="showContextMenu" class="task-context-menu" :style="contextMenuStyle" @click.stop>
      <div class="context-menu-item" @click="createFloatingTask">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="currentColor" />
        </svg>
        创建悬浮任务
      </div>
    </div>

    <!-- 遮罩层，用于关闭右键菜单 -->
    <div v-if="showContextMenu" class="context-menu-overlay" @click="hideContextMenu"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, h, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const taskStore = useTaskStore()

// 响应式数据
const tasks = ref([])
const newTaskContent = ref('')
const currentEditingTask = ref(null)
const editingContent = ref('')
const showReminder = ref(false)
const currentReminderTask = ref(null)
const reminderDate = ref('')
const reminderTime = ref('')
const completedTasksCount = ref(0)

// 右键菜单相关
const showContextMenu = ref(false)
const contextMenuStyle = ref({})
const selectedTask = ref(null)

// 引用
const quickAddInput = ref(null)
const editInput = ref(null)

// 计算属性
const taskCount = computed(() => tasks.value.length)

const sortedTasks = computed(() => {
  return [...tasks.value].sort((a, b) => {
    // 有提醒时间的任务优先
    if (a.reminderTime && b.reminderTime) {
      return new Date(a.reminderTime) - new Date(b.reminderTime)
    }
    if (a.reminderTime && !b.reminderTime) return -1
    if (!a.reminderTime && b.reminderTime) return 1

    // 按创建时间排序
    return new Date(a.createdAt) - new Date(b.createdAt)
  })
})

const footerStats = computed(() => {
  const totalCount = taskCount.value + completedTasksCount.value
  if (totalCount === 0) {
    return '暂无任务'
  }
  return `共 ${totalCount} 个任务，已完成 ${completedTasksCount.value} 个`
})

// 方法
const loadTasks = async () => {
  try {
    // 根据当前分类获取任务
    const currentCategory = taskStore.currentCategory
    const currentListId = taskStore.currentListId
    
    if (currentCategory === 'today') {
      // 获取今天的任务：今天创建的或者今天提醒到期的任务，以及正在进行中的任务
      const allTasks = await taskStore.getAllTasks()
      
      // 根据清单过滤
      let filteredTasks = currentListId ? allTasks.filter(task => task.listId === currentListId) : allTasks
      
      // 应用today分类逻辑：今天创建的 OR 今天提醒到期的 OR 正在进行中的任务
      const todayTasks = filteredTasks.filter(task => {
        const isToday = (date) => {
          if (!date) return false
          const today = new Date()
          const targetDate = new Date(date)
          return today.toDateString() === targetDate.toDateString()
        }
        return isToday(task.reminderTime) || isToday(task.createdAt) || task.status === 'doing'
      })
      
      tasks.value = todayTasks.filter(task => task.status !== 'done')
      completedTasksCount.value = todayTasks.filter(task => task.status === 'done').length
    } else {
      // 其他分类保持原有逻辑
      tasks.value = await taskStore.getIncompleteTasks()
      const completedTasks = await taskStore.getCompletedTasks()
      completedTasksCount.value = completedTasks.length
    }
  } catch (error) {
    console.error('加载任务失败:', error)
  }
}

const addTask = async () => {
  const content = newTaskContent.value.trim()
  if (!content) return

  try {
    await taskStore.createTask({ content })
    newTaskContent.value = ''

    // 重新加载任务列表以显示新添加的任务
    await loadTasks()

    if (quickAddInput.value) {
      quickAddInput.value.focus()
    }
  } catch (error) {
    console.error('添加任务失败:', error)
  }
}

const cycleTaskStatus = async (taskId) => {
  try {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const currentStatus = task.status || (task.completed ? 'done' : 'todo')

    switch (currentStatus) {
      case 'todo':
        await taskStore.startTask(taskId)
        break
      case 'doing':
        await taskStore.completeTask(taskId)
        break
      case 'done':
        await taskStore.updateTask(taskId, { status: 'todo' })
        break
      default:
        await taskStore.startTask(taskId)
    }

    await loadTasks()
    // 重新启动定时器以调整更新频率
    startUpdateTimer()
  } catch (error) {
    console.error('更新任务状态失败:', error)
  }
}

const deleteTask = async (taskId) => {
  try {
    await taskStore.deleteTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('删除任务失败:', error)
  }
}

const pauseTask = async (taskId) => {
  try {
    await taskStore.pauseTask(taskId)
    await loadTasks()
    // 重新启动定时器以调整更新频率
    startUpdateTimer()
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const isEditing = (taskId) => {
  return currentEditingTask.value === taskId
}

const startEditTask = (taskId) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  currentEditingTask.value = taskId
  editingContent.value = task.content

  nextTick(() => {
    if (editInput.value && editInput.value[0]) {
      editInput.value[0].focus()
      editInput.value[0].select()
    }
  })
}

const saveTaskEdit = async (taskId) => {
  const newContent = editingContent.value.trim()
  if (!newContent) {
    cancelTaskEdit()
    return
  }

  try {
    await taskStore.updateTask(taskId, { content: newContent })
    currentEditingTask.value = null
    editingContent.value = ''
    await loadTasks()
  } catch (error) {
    console.error('更新任务失败:', error)
    cancelTaskEdit()
  }
}

const cancelTaskEdit = () => {
  currentEditingTask.value = null
  editingContent.value = ''
}

const showReminderModal = (taskId) => {
  currentReminderTask.value = taskId
  const task = tasks.value.find(t => t.id === taskId)

  if (task && task.reminderTime) {
    const reminderDateTime = new Date(task.reminderTime)
    // 使用本地时区格式化日期和时间
    const year = reminderDateTime.getFullYear()
    const month = String(reminderDateTime.getMonth() + 1).padStart(2, '0')
    const day = String(reminderDateTime.getDate()).padStart(2, '0')
    const hours = String(reminderDateTime.getHours()).padStart(2, '0')
    const mins = String(reminderDateTime.getMinutes()).padStart(2, '0')

    reminderDate.value = `${year}-${month}-${day}`
    reminderTime.value = `${hours}:${mins}`
  } else {
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000)
    // 使用本地时区格式化默认时间
    const year = defaultTime.getFullYear()
    const month = String(defaultTime.getMonth() + 1).padStart(2, '0')
    const day = String(defaultTime.getDate()).padStart(2, '0')
    const hours = String(defaultTime.getHours()).padStart(2, '0')
    const mins = String(defaultTime.getMinutes()).padStart(2, '0')

    reminderDate.value = `${year}-${month}-${day}`
    reminderTime.value = `${hours}:${mins}`
  }

  showReminder.value = true
}

const hideReminderModal = () => {
  showReminder.value = false
  currentReminderTask.value = null
}

const setQuickTime = (minutes) => {
  const now = new Date()
  let targetTime

  if (minutes === 24 * 60) {
    // 明天9点提醒
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    targetTime = tomorrow
  } else {
    // 从当前时间开始计算提醒时间（15分钟后、1小时后）
    targetTime = new Date(now.getTime() + minutes * 60 * 1000)
  }

  // 使用本地时区格式化日期和时间
  const year = targetTime.getFullYear()
  const month = String(targetTime.getMonth() + 1).padStart(2, '0')
  const day = String(targetTime.getDate()).padStart(2, '0')
  const hours = String(targetTime.getHours()).padStart(2, '0')
  const mins = String(targetTime.getMinutes()).padStart(2, '0')

  reminderDate.value = `${year}-${month}-${day}`
  reminderTime.value = `${hours}:${mins}`
}

const saveTaskReminder = async () => {
  if (!currentReminderTask.value) return

  const date = reminderDate.value
  const time = reminderTime.value

  if (!date || !time) {
    alert('请选择提醒时间')
    return
  }

  // 使用本地时区创建日期对象
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  const reminderDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0)

  console.log("本地时区提醒时间:", reminderDateTime)
  if (reminderDateTime <= new Date()) {
    alert('提醒时间不能是过去的时间')
    return
  }

  try {
    await window.electronAPI.tasks.setReminder(currentReminderTask.value, reminderDateTime.toISOString())
    hideReminderModal()
    await loadTasks()
  } catch (error) {
    console.error('设置提醒失败:', error)
    alert('设置提醒失败')
  }
}

const getStatusText = (status) => {
  return taskStore.getStatusText(status)
}

const getStatusIcon = (status) => {
  const iconComponents = {
    'todo': () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, stroke: 'currentColor', 'stroke-width': 2 })
    ]),
    'doing': () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, fill: 'currentColor' }),
      h('circle', { cx: 12, cy: 12, r: 4, fill: 'white' })
    ]),
    'done': () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, fill: 'currentColor' }),
      h('path', { d: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z', fill: 'white' })
    ])
  }
  return iconComponents[status] || iconComponents['todo']
}

const getTaskTotalDuration = (task) => {
  let totalDuration = task.totalDuration || 0

  // 如果任务正在进行中，加上当前进行时长
  if (task.status === 'doing' && task.startedAt) {
    const currentDuration = Date.now() - new Date(task.startedAt).getTime()
    totalDuration += currentDuration
  }

  return totalDuration
}

const formatDurationCompact = (milliseconds) => {
  if (!milliseconds || milliseconds < 1000) {
    return '0s'
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // 如果超过一小时，显示小时和分钟
  if (hours > 0) {
    return `${hours}h${minutes}m`
  }
  // 如果超过一分钟但不到一小时，显示分钟和秒
  else if (minutes > 0) {
    return `${minutes}m${seconds}s`
  }
  // 如果不到一分钟，只显示秒
  else {
    return `${seconds}s`
  }
}

const formatReminderTime = (date) => {
  return taskStore.formatTimeDisplay(date, 'reminder')
}

const isReminderOverdue = (reminderTime) => {
  return new Date(reminderTime) < new Date()
}

// 判断是否需要使用紧凑模式
const shouldUseCompactMode = (task) => {
  // 计算当前任务的元信息项数量
  let itemCount = 1 // 状态标签总是存在

  if (task.reminderTime) {
    itemCount++
  }

  if ((task.status || (task.completed ? 'done' : 'todo')) === 'doing') {
    itemCount++
  }

  // 如果有3个或更多项目，或者任务内容很长，使用紧凑模式
  return itemCount >= 3 || (task.content && task.content.length > 30)
}

// 打开任务管理页面
const openTaskManager = async () => {
  try {
    await window.electronAPI.windows.showTaskManager()
  } catch (error) {
    console.error('打开任务管理窗口失败:', error)
  }
}

// 右键菜单相关方法
const showTaskContextMenu = (event, task) => {
  event.preventDefault()
  selectedTask.value = task

  const rect = event.currentTarget.getBoundingClientRect()
  contextMenuStyle.value = {
    position: 'fixed',
    left: `${event.clientX}px`,
    top: `${event.clientY}px`,
    zIndex: 1000
  }

  showContextMenu.value = true
}

const hideContextMenu = () => {
  showContextMenu.value = false
  selectedTask.value = null
}

const createFloatingTask = async () => {
  if (!selectedTask.value) return

  try {
    await window.electronAPI.windows.createFloatingTask(selectedTask.value.id)
    hideContextMenu()
  } catch (error) {
    console.error('创建悬浮任务失败:', error)
  }
}

// 面板鼠标事件处理
const handlePanelMouseEnter = () => {
  console.log('面板鼠标进入')
  try {
    window.electronAPI.windows.panelMouseEnter()
  } catch (error) {
    console.error('发送面板鼠标进入事件失败:', error)
  }
}

const handlePanelMouseLeave = () => {
  console.log('面板鼠标离开')
  try {
    window.electronAPI.windows.panelMouseLeave()
  } catch (error) {
    console.error('发送面板鼠标离开事件失败:', error)
  }
}

// 监听任务更新事件
const handleTasksUpdated = () => {
  loadTasks()
}

// 检查是否有进行中的任务在一小时内
const hasRecentDoingTasks = () => {
  return tasks.value.some(task => {
    if (task.status !== 'doing' || !task.startedAt) return false
    const currentDuration = Date.now() - new Date(task.startedAt).getTime()
    return currentDuration < 60 * 60 * 1000 // 一小时内
  })
}

// 定时器引用
let updateTimer = null

// 启动定时器更新进行中任务的时长显示
const startUpdateTimer = () => {
  if (updateTimer) {
    clearInterval(updateTimer)
  }

  const updateDisplay = () => {
    // 强制更新进行中任务的时长显示
    tasks.value = [...tasks.value]

    // 重新设置定时器间隔
    const interval = hasRecentDoingTasks() ? 1000 : 30000 // 一小时内每秒更新，否则每30秒更新

    if (updateTimer) {
      clearInterval(updateTimer)
    }
    updateTimer = setInterval(updateDisplay, interval)
  }

  // 初始设置
  const initialInterval = hasRecentDoingTasks() ? 1000 : 30000
  updateTimer = setInterval(updateDisplay, initialInterval)
}

const stopUpdateTimer = () => {
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = null
  }
}

// 生命周期
onMounted(async () => {
  await loadTasks()

  if (quickAddInput.value) {
    quickAddInput.value.focus()
  }

  // 监听任务更新事件
  window.electronAPI.events.on('tasks-updated', handleTasksUpdated)

  // 启动定时器
  startUpdateTimer()

  onUnmounted(() => {
    stopUpdateTimer()
    window.electronAPI.events.removeAllListeners('tasks-updated')
  })
})

// 监听分类和清单变化，重新加载任务
watch(() => [taskStore.currentCategory, taskStore.currentListId], () => {
  loadTasks()
}, { immediate: false })
</script>

<style scoped>
@import '@/assets/styles/components/task-panel.css';
</style>