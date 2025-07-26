<template>
  <div class="task-manager">
    <!-- 自定义标题栏 -->
    <div class="custom-titlebar">
      <div class="titlebar-content">
        <span class="app-title">任务管理 - MoliTodo</span>
        <div class="titlebar-controls">
          <button class="titlebar-btn minimize" @click="minimizeWindow">−</button>
          <button class="titlebar-btn maximize" @click="maximizeWindow">□</button>
          <button class="titlebar-btn close" @click="closeWindow">×</button>
        </div>
      </div>
    </div>

    <div class="task-manager-main">
      <!-- 左侧边栏 - 半透明毛玻璃效果 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <button class="btn btn-primary add-task-btn" @click="showAddModal = true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" />
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" />
            </svg>
            添加任务
          </button>
        </div>

        <nav class="sidebar-nav">
          <div v-for="category in categories" :key="category.key"
            :class="['nav-item', { active: currentCategory === category.key }]" @click="switchCategory(category.key)">
            <span class="nav-icon">{{ category.icon }}</span>
            <span class="nav-label">{{ category.label }}</span>
            <span class="nav-count">{{ getCategoryCount(category.key) }}</span>
          </div>
        </nav>
      </div>

      <!-- 右侧主内容区 - 不透明纯色背景 -->
      <div class="main-content">
        <!-- 搜索框 -->
        <div class="search-section">
          <div class="search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" />
              <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" />
            </svg>
            <input v-model="searchQuery" type="text" placeholder="搜索任务..." @keyup.escape="searchQuery = ''" />
            <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''">×</button>
          </div>
        </div>

        <!-- 任务列表 -->
        <div class="task-list">
          <div v-if="loading" class="loading">加载中...</div>
          <div v-else-if="displayTasks.length === 0" class="empty-state">
            <div class="empty-icon">📝</div>
            <div class="empty-text">{{ searchQuery ? '未找到匹配的任务' : '暂无任务' }}</div>
          </div>
          <div v-else class="task-items">
            <div v-for="task in displayTasks" :key="task.id" :class="['task-item', {
              completed: task.status === 'done',
              'in-progress': task.status === 'doing',
              selected: selectedTasks.includes(task.id)
            }]" @click="selectTask(task.id, $event)" @dblclick="editTask(task)" @mouseenter="hoveredTask = task.id"
              @mouseleave="hoveredTask = null">

              <div class="task-content">
                <input type="checkbox" :checked="task.status === 'done'" @change="toggleTaskComplete(task)"
                  @click.stop />
                <div class="task-main">
                  <span class="task-text">{{ task.content }}</span>

                  <!-- 时间信息显示 -->
                  <div class="task-time-info">
                    <!-- 待办任务：显示创建时间和提醒时间 -->
                    <div v-if="task.status === 'todo'" class="time-details">
                      <span class="created-time">创建于 {{ formatCreatedTime(task.createdAt) }}</span>
                      <span v-if="task.reminderTime" class="reminder-time">
                        提醒: {{ formatReminderTime(task.reminderTime) }}
                      </span>
                    </div>

                    <!-- 进行中任务：显示实时进行时长 -->
                    <div v-else-if="task.status === 'doing'" class="time-details doing">
                      <span class="duration-display">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                          <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2" />
                        </svg>
                        进行中 {{ formatDuration(getTaskCurrentDuration(task)) }}
                      </span>
                    </div>

                    <!-- 已完成任务：显示用时和完成时间 -->
                    <div v-else-if="task.status === 'done'" class="time-details completed">
                      <span class="total-duration">用时 {{ formatDuration(task.totalDuration || 0) }}</span>
                      <span class="completed-time">完成于 {{ formatCompletedTime(task.completedAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 任务操作按钮 - 悬浮时显示 -->
              <div v-show="hoveredTask === task.id || selectedTasks.includes(task.id)" class="task-actions">
                <button v-if="task.status === 'todo'" class="btn btn-sm btn-success" @click.stop="startTask(task.id)">
                  开始
                </button>
                <button v-if="task.status === 'doing'" class="btn btn-sm btn-warning" @click.stop="pauseTask(task.id)">
                  暂停
                </button>
                <button v-if="task.status === 'doing'" class="btn btn-sm btn-primary"
                  @click.stop="completeTask(task.id)">
                  完成
                </button>
                <button v-if="task.status === 'done'" class="btn btn-sm btn-success" @click.stop="restartTask(task.id)">
                  重新开始
                </button>
                <button class="btn btn-sm btn-secondary" @click.stop="editTask(task)">
                  编辑
                </button>
                <button class="btn btn-sm btn-danger" @click.stop="deleteTask(task.id)">
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 统计信息条 -->
        <div class="stats-bar">
          <div class="stats-item">
            <span class="stats-label">总任务:</span>
            <span class="stats-value">{{ displayTasks.length }}</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">已完成:</span>
            <span class="stats-value">{{ getCompletedCount() }}</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">进行中:</span>
            <span class="stats-value">{{ getInProgressCount() }}</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">总耗时:</span>
            <span class="stats-value">{{ getTotalDuration() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加任务模态框 -->
    <div v-if="showAddModal" class="modal-overlay" @click="showAddModal = false">
      <div class="modal" @click.stop>
        <h3>添加新任务</h3>
        <input v-model="newTaskContent" type="text" placeholder="输入任务内容..." @keyup.enter="addTask" ref="taskInput" />
        <div class="modal-actions">
          <button class="btn btn-primary" @click="addTask">添加</button>
          <button class="btn btn-secondary" @click="showAddModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 编辑任务模态框 -->
    <div v-if="showEditModal" class="modal-overlay" @click="showEditModal = false">
      <div class="modal" @click.stop>
        <h3>编辑任务</h3>
        <input v-model="editTaskContent" type="text" placeholder="输入任务内容..." @keyup.enter="saveEditTask"
          ref="editInput" />
        <div class="modal-actions">
          <button class="btn btn-primary" @click="saveEditTask">保存</button>
          <button class="btn btn-secondary" @click="showEditModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const taskStore = useTaskStore()
const currentCategory = ref('today')
const showAddModal = ref(false)
const showEditModal = ref(false)
const newTaskContent = ref('')
const editTaskContent = ref('')
const editingTaskId = ref(null)
const taskInput = ref(null)
const editInput = ref(null)
const allTasks = ref([])
const updateTimer = ref(null)
const searchQuery = ref('')
const selectedTasks = ref([])
const hoveredTask = ref(null)

const categories = [
  { key: 'today', label: '今天', icon: '📅' },
  { key: 'doing', label: '进行中', icon: '⏳' },
  { key: 'planned', label: '计划中', icon: '📋' },
  { key: 'all', label: '所有任务', icon: '📝' },
  { key: 'completed', label: '已完成', icon: '✅' }
]

const loading = computed(() => taskStore.loading)

const filteredTasks = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  switch (currentCategory.value) {
    case 'today':
      return allTasks.value.filter(task => {
        if (task.status === 'done') return false
        const createdAt = new Date(task.createdAt)
        createdAt.setHours(0, 0, 0, 0)
        return createdAt.getTime() === today.getTime() ||
          (task.reminderTime && new Date(task.reminderTime) >= today && new Date(task.reminderTime) < tomorrow)
      })
    case 'doing':
      return allTasks.value.filter(task => task.status === 'doing')
    case 'planned':
      return allTasks.value.filter(task => task.status === 'todo' && task.reminderTime)
    case 'completed':
      return allTasks.value.filter(task => task.status === 'done')
    case 'all':
    default:
      return allTasks.value.filter(task => task.status !== 'done')
  }
})

const displayTasks = computed(() => {
  let tasks = filteredTasks.value

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    tasks = tasks.filter(task =>
      task.content.toLowerCase().includes(query) ||
      (task.description && task.description.toLowerCase().includes(query))
    )
  }

  return tasks
})

const getCategoryCount = (category) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  switch (category) {
    case 'today':
      return allTasks.value.filter(task => {
        if (task.status === 'done') return false
        const createdAt = new Date(task.createdAt)
        createdAt.setHours(0, 0, 0, 0)
        return createdAt.getTime() === today.getTime() ||
          (task.reminderTime && new Date(task.reminderTime) >= today && new Date(task.reminderTime) < tomorrow)
      }).length
    case 'doing':
      return allTasks.value.filter(task => task.status === 'doing').length
    case 'planned':
      return allTasks.value.filter(task => task.status === 'todo' && task.reminderTime).length
    case 'completed':
      return allTasks.value.filter(task => task.status === 'done').length
    case 'all':
      return allTasks.value.filter(task => task.status !== 'done').length
    default:
      return 0
  }
}

const switchCategory = (category) => {
  currentCategory.value = category
  selectedTasks.value = []
  searchQuery.value = ''
}

// 任务选择相关
const selectTask = (taskId, event) => {
  if (event.ctrlKey || event.metaKey) {
    // 多选模式
    const index = selectedTasks.value.indexOf(taskId)
    if (index > -1) {
      selectedTasks.value.splice(index, 1)
    } else {
      selectedTasks.value.push(taskId)
    }
  } else {
    // 单选模式
    selectedTasks.value = [taskId]
  }
}

// 窗口控制
const minimizeWindow = () => {
  if (window.electronAPI && window.electronAPI.window) {
    window.electronAPI.window.minimize()
  }
}

const maximizeWindow = () => {
  if (window.electronAPI && window.electronAPI.window) {
    window.electronAPI.window.toggleMaximize()
  }
}

const closeWindow = () => {
  if (window.electronAPI && window.electronAPI.window) {
    window.electronAPI.window.close()
  }
}

// 统计函数
const getCompletedCount = () => {
  return displayTasks.value.filter(task => task.status === 'done').length
}

const getInProgressCount = () => {
  return displayTasks.value.filter(task => task.status === 'doing').length
}

const getTotalDuration = () => {
  const totalMs = displayTasks.value
    .filter(task => task.status === 'done')
    .reduce((total, task) => total + (task.totalDuration || 0), 0)
  return formatDuration(totalMs)
}

const loadTasks = async () => {
  try {
    allTasks.value = await taskStore.getAllTasks()
  } catch (error) {
    console.error('加载任务失败:', error)
  }
}

const addTask = async () => {
  if (!newTaskContent.value.trim()) {
    return
  }

  try {
    await taskStore.createTask({
      content: newTaskContent.value.trim()
    })
    newTaskContent.value = ''
    showAddModal.value = false
    await loadTasks()
  } catch (error) {
    console.error('添加任务失败:', error)
  }
}

const editTask = (task) => {
  editingTaskId.value = task.id
  editTaskContent.value = task.content
  showEditModal.value = true
}

const saveEditTask = async () => {
  if (!editTaskContent.value.trim() || !editingTaskId.value) {
    return
  }

  try {
    await taskStore.updateTask(editingTaskId.value, {
      content: editTaskContent.value.trim()
    })
    editTaskContent.value = ''
    editingTaskId.value = null
    showEditModal.value = false
    await loadTasks()
  } catch (error) {
    console.error('编辑任务失败:', error)
  }
}

const toggleTaskComplete = async (task) => {
  try {
    if (task.status === 'done') {
      // 重新激活任务
      await taskStore.updateTask(task.id, { status: 'todo' })
    } else {
      // 完成任务
      await taskStore.completeTask(task.id)
    }
    await loadTasks()
  } catch (error) {
    console.error('切换任务状态失败:', error)
  }
}

const startTask = async (taskId) => {
  try {
    await taskStore.startTask(taskId)
    await loadTasks()
    // 重新启动定时器以切换到每秒更新
    startUpdateTimer()
  } catch (error) {
    console.error('开始任务失败:', error)
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

const completeTask = async (taskId) => {
  try {
    await taskStore.completeTask(taskId)
    await loadTasks()
    // 重新启动定时器以调整更新频率
    startUpdateTimer()
  } catch (error) {
    console.error('完成任务失败:', error)
  }
}

const restartTask = async (taskId) => {
  try {
    await taskStore.updateTask(taskId, { status: 'todo' })
    await loadTasks()
  } catch (error) {
    console.error('重新开始任务失败:', error)
  }
}

const deleteTask = async (taskId) => {
  if (!confirm('确定要删除这个任务吗？')) {
    return
  }

  try {
    await taskStore.deleteTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('删除任务失败:', error)
  }
}

// 时间格式化函数
const formatCreatedTime = (createdAt) => {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatReminderTime = (reminderTime) => {
  if (!reminderTime) return ''

  const date = new Date(reminderTime)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (date.toDateString() === tomorrow.toDateString()) {
    return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatCompletedTime = (completedAt) => {
  if (!completedAt) return ''
  const date = new Date(completedAt)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds < 1000) {
    return '0秒'
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // 如果超过一小时，只显示小时和分钟
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  // 如果超过一分钟但不到一小时，显示分钟和秒
  else if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`
  }
  // 如果不到一分钟，只显示秒
  else {
    return `${seconds}秒`
  }
}

const getTaskCurrentDuration = (task) => {
  let totalDuration = task.totalDuration || 0

  // 如果任务正在进行中，加上当前进行时长
  if (task.status === 'doing' && task.startedAt) {
    const currentDuration = Date.now() - new Date(task.startedAt).getTime()
    totalDuration += currentDuration
  }

  return totalDuration
}

// 监听模态框显示，自动聚焦输入框
watch(showAddModal, async (newVal) => {
  if (newVal) {
    await nextTick()
    if (taskInput.value) {
      taskInput.value.focus()
    }
  }
})

watch(showEditModal, async (newVal) => {
  if (newVal) {
    await nextTick()
    if (editInput.value) {
      editInput.value.focus()
    }
  }
})

// 监听任务更新事件
const handleTasksUpdated = () => {
  loadTasks()
}

// 检查是否有进行中的任务在一小时内
const hasRecentDoingTasks = () => {
  return allTasks.value.some(task => {
    if (task.status !== 'doing' || !task.startedAt) return false
    const currentDuration = Date.now() - new Date(task.startedAt).getTime()
    return currentDuration < 60 * 60 * 1000 // 一小时内
  })
}

// 启动定时器更新进行中任务的时长显示
const startUpdateTimer = () => {
  if (updateTimer.value) {
    clearInterval(updateTimer.value)
  }

  const updateDisplay = () => {
    // 强制更新进行中任务的时长显示
    allTasks.value = [...allTasks.value]

    // 重新设置定时器间隔
    const interval = hasRecentDoingTasks() ? 1000 : 60000 // 一小时内每秒更新，否则每分钟更新

    if (updateTimer.value) {
      clearInterval(updateTimer.value)
    }
    updateTimer.value = setInterval(updateDisplay, interval)
  }

  // 初始设置
  const initialInterval = hasRecentDoingTasks() ? 1000 : 60000
  updateTimer.value = setInterval(updateDisplay, initialInterval)
}

const stopUpdateTimer = () => {
  if (updateTimer.value) {
    clearInterval(updateTimer.value)
    updateTimer.value = null
  }
}

// 键盘快捷键处理
const handleKeydown = (event) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'n':
        event.preventDefault()
        showAddModal.value = true
        break
    }
  } else {
    switch (event.key) {
      case 'Escape':
        selectedTasks.value = []
        searchQuery.value = ''
        break
      case 'Delete':
      case 'Backspace':
        if (selectedTasks.value.length > 0 && !event.target.matches('input')) {
          event.preventDefault()
          selectedTasks.value.forEach(taskId => deleteTask(taskId))
        }
        break
      case ' ':
        if (selectedTasks.value.length === 1 && !event.target.matches('input')) {
          event.preventDefault()
          const task = allTasks.value.find(t => t.id === selectedTasks.value[0])
          if (task) {
            toggleTaskComplete(task)
          }
        }
        break
    }
  }
}

onMounted(async () => {
  await loadTasks()
  startUpdateTimer()
  window.electronAPI.events.on('tasks-updated', handleTasksUpdated)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  stopUpdateTimer()
  window.electronAPI.events.removeAllListeners('tasks-updated')
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* Component-specific styles that override or extend base styles */

/* Custom titlebar styles specific to TaskManager */
.custom-titlebar {
  height: 32px;
  background: var(--bg-secondary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-medium);
  -webkit-app-region: drag;
  user-select: none;
}

.titlebar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 var(--spacing-lg);
}

.app-title {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.titlebar-controls {
  display: flex;
  gap: var(--spacing-sm);
  -webkit-app-region: no-drag;
}

.titlebar-btn {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  font-size: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.titlebar-btn.close {
  background: #ff5f57;
  color: transparent;
}

.titlebar-btn.close:hover {
  color: #4d0000;
}

.titlebar-btn.minimize {
  background: #ffbd2e;
  color: transparent;
}

.titlebar-btn.minimize:hover {
  color: #995700;
}

.titlebar-btn.maximize {
  background: #28ca42;
  color: transparent;
}

.titlebar-btn.maximize:hover {
  color: #0d4f1c;
}

/* Sidebar specific styles */
.sidebar {
  width: 240px;
  background: var(--bg-secondary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--border-medium);
  display: flex;
  flex-direction: column;
  padding: var(--spacing-xl) 0;
}

.sidebar-header {
  padding: 0 var(--spacing-xl) var(--spacing-xl);
  border-bottom: 1px solid var(--border-medium);
  margin-bottom: var(--spacing-xl);
}

.add-task-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 10px var(--spacing-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.sidebar-nav {
  flex: 1;
  padding: 0 var(--spacing-md);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 10px var(--spacing-lg);
  margin-bottom: var(--spacing-xs);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.nav-item:hover {
  background: var(--bg-hover);
}

.nav-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.nav-icon {
  font-size: var(--font-size-lg);
  width: 20px;
  text-align: center;
}

.nav-label {
  flex: 1;
}

.nav-count {
  background: var(--bg-active);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  padding: 2px var(--spacing-sm);
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.nav-item.active .nav-count {
  background: rgba(102, 126, 234, 0.2);
  color: var(--color-primary);
}

/* Search section specific styles */
.search-section {
  padding: var(--spacing-xl) var(--spacing-2xl);
  border-bottom: 1px solid var(--border-light);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--spacing-md);
  color: var(--text-muted);
  z-index: 1;
}

.search-box input {
  width: 100%;
  padding: 10px var(--spacing-md) 10px 36px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.search-box input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--bg-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.clear-search {
  position: absolute;
  right: var(--spacing-sm);
  width: 20px;
  height: 20px;
  border: none;
  background: var(--text-muted);
  color: var(--text-white);
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-search:hover {
  background: var(--text-secondary);
}

/* Task list specific styles */
.task-items {
  display: flex;
  flex-direction: column;
}

.task-item.selected {
  background: var(--color-primary-light);
  margin: 0 calc(-1 * var(--spacing-2xl));
  padding: var(--spacing-lg) var(--spacing-2xl);
}

.task-item.completed .task-text {
  text-decoration: line-through;
  color: var(--text-disabled);
}

.task-item.in-progress {
  background: rgba(245, 158, 11, 0.05);
  border-left: 3px solid var(--status-doing);
  margin: 0 calc(-1 * var(--spacing-2xl));
  padding: var(--spacing-lg) var(--spacing-2xl) var(--spacing-lg) 21px;
}

.task-content {
  display: flex;
  align-items: flex-start;
  flex: 1;
  gap: var(--spacing-md);
}

.task-content input[type="checkbox"] {
  margin-top: 2px;
  width: 16px;
  height: 16px;
}

.task-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.task-text {
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.4;
  font-weight: var(--font-weight-normal);
}

.task-time-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.time-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--font-size-sm);
}

.time-details.doing {
  color: var(--status-doing);
}

.time-details.completed {
  color: var(--status-done);
}

.created-time {
  color: var(--text-muted);
}

.reminder-time {
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.duration-display {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-weight: var(--font-weight-medium);
  color: var(--status-doing);
}

.duration-display svg {
  color: var(--status-doing);
}

/* Stats bar specific styles */
.stats-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-2xl);
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-light);
  font-size: 13px;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.stats-label {
  color: var(--text-muted);
}

.stats-value {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

/* Modal specific styles */
.modal {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  min-width: 400px;
  box-shadow: var(--shadow-modal);
}

.modal h3 {
  margin: 0 0 var(--spacing-lg) 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.modal input {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  font-size: 15px;
  margin-bottom: var(--spacing-xl);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.modal input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--bg-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}
</style>