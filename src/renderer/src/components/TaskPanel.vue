<template>
  <div class="task-panel" @mouseenter="handlePanelMouseEnter" @mouseleave="handlePanelMouseLeave">
    <!-- 面板头部 -->
    <div class="panel-header">
      <h2 class="panel-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
        </svg>
        待办事项
      </h2>
      <div class="task-count">{{ taskCount }} 个任务</div>
    </div>

    <!-- 快速添加框 -->
    <div class="quick-add-section">
      <div class="input-container">
        <input v-model="newTaskContent" type="text" class="quick-add-input" placeholder="添加新任务..." maxlength="200"
          @keypress.enter="addTask" ref="quickAddInput">
        <button class="add-button" @click="addTask" title="添加任务">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2v20M2 12h20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="task-list-container">
      <div v-if="tasks.length > 0" class="task-list">
        <div v-for="task in sortedTasks" :key="task.id"
          :class="['task-item', task.status || (task.completed ? 'done' : 'todo')]" :data-task-id="task.id"
          :data-status="task.status || (task.completed ? 'done' : 'todo')">
          <div class="task-status-indicator" @click="cycleTaskStatus(task.id)" :title="'点击切换状态'">
            <component :is="getStatusIcon(task.status || (task.completed ? 'done' : 'todo'))" />
          </div>

          <div class="task-content">
            <div v-if="!isEditing(task.id)" class="task-text" @dblclick="startEditTask(task.id)" :title="'双击编辑'">
              {{ task.content }}
            </div>
            <input v-else v-model="editingContent" class="task-edit-input" @keydown.enter="saveTaskEdit(task.id)"
              @keydown.esc="cancelTaskEdit" @blur="saveTaskEdit(task.id)" ref="editInput" />

            <div class="task-meta">
              <span :class="['task-status', `status-${task.status || (task.completed ? 'done' : 'todo')}`]">
                {{ getStatusText(task.status || (task.completed ? 'done' : 'todo')) }}
              </span>

              <!-- 时间追踪信息（仅显示进行中任务） -->
              <div v-if="(task.status || (task.completed ? 'done' : 'todo')) === 'doing'" class="task-duration">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                    fill="currentColor" />
                </svg>
                {{ formatDurationCompact(getTaskTotalDuration(task)) }}
              </div>

              <!-- 提醒时间 -->
              <div v-if="task.reminderTime"
                :class="['task-reminder', { overdue: isReminderOverdue(task.reminderTime) }]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
                    fill="currentColor" />
                </svg>
                {{ formatReminderTime(new Date(task.reminderTime)) }}
              </div>
            </div>
          </div>

          <div class="task-actions">
            <button class="action-button reminder-btn" @click="showReminderModal(task.id)" title="设置提醒">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
                  fill="currentColor" />
              </svg>
            </button>
            <button class="action-button delete-btn" @click="deleteTask(task.id)" title="删除任务">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state show">
        <div class="empty-icon">
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
    <div v-if="showReminder" class="reminder-modal show">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>设置提醒</h3>
          <button class="close-button" @click="hideReminderModal">
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
          <div class="quick-time-buttons">
            <button class="quick-time-btn" @click="setQuickTime(15)">15分钟后</button>
            <button class="quick-time-btn" @click="setQuickTime(60)">1小时后</button>
            <button class="quick-time-btn" @click="setQuickTime(24 * 60)">明天</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="hideReminderModal">取消</button>
          <button class="btn btn-primary" @click="saveTaskReminder">保存</button>
        </div>
      </div>
    </div>

    <!-- 面板底部 -->
    <div class="panel-footer">
      <div class="footer-stats">{{ footerStats }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, h } from 'vue'
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
    tasks.value = await taskStore.getIncompleteTasks()
    const completedTasks = await taskStore.getCompletedTasks()
    completedTasksCount.value = completedTasks.length
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
    const reminderDate = new Date(task.reminderTime)
    reminderDate.value = reminderDate.toISOString().split('T')[0]
    reminderTime.value = reminderDate.toTimeString().slice(0, 5)
  } else {
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000)
    reminderDate.value = defaultTime.toISOString().split('T')[0]
    reminderTime.value = defaultTime.toTimeString().slice(0, 5)
  }

  showReminder.value = true
}

const hideReminderModal = () => {
  showReminder.value = false
  currentReminderTask.value = null
}

const setQuickTime = (minutes) => {
  const targetTime = new Date(Date.now() + minutes * 60 * 1000)
  reminderDate.value = targetTime.toISOString().split('T')[0]
  reminderTime.value = targetTime.toTimeString().slice(0, 5)
}

const saveTaskReminder = async () => {
  if (!currentReminderTask.value) return

  const date = reminderDate.value
  const time = reminderTime.value

  if (!date || !time) {
    alert('请选择提醒时间')
    return
  }

  const reminderDateTime = new Date(`${date}T${time}`)

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
  const statusMap = { 'todo': '待办', 'doing': '进行中', 'done': '已完成' }
  return statusMap[status] || '待办'
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
  if (milliseconds < 60000) {
    return '0m'
  }

  const minutes = Math.floor(milliseconds / 60000)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h${minutes % 60}m`
  } else {
    return `${minutes}m`
  }
}

const formatReminderTime = (date) => {
  const now = new Date()
  const today = now.toDateString()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()

  if (date.toDateString() === today) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (date.toDateString() === tomorrow) {
    return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
}

const isReminderOverdue = (reminderTime) => {
  return new Date(reminderTime) < new Date()
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

// 生命周期
onMounted(async () => {
  await loadTasks()

  if (quickAddInput.value) {
    quickAddInput.value.focus()
  }

  // 监听任务更新事件
  window.electronAPI.events.on('tasks-updated', handleTasksUpdated)

  // 定时更新进行中任务的显示
  const updateTimer = setInterval(() => {
    // 强制更新进行中任务的时长显示
    tasks.value = [...tasks.value]
  }, 30000)

  onUnmounted(() => {
    clearInterval(updateTimer)
    window.electronAPI.events.removeAllListeners('tasks-updated')
  })
})
</script>

<style scoped>
/* 导入原版样式，稍作调整以适应 Vue 组件 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.task-panel {
  width: 320px;
  min-height: 200px;
  max-height: 80vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  user-select: none;
  -webkit-user-select: none;
}

/* 面板头部 */
.panel-header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.8);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.panel-title svg {
  color: #667eea;
}

.task-count {
  font-size: 12px;
  color: #666;
  font-weight: 400;
}

/* 快速添加区域 */
.quick-add-section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.input-container {
  display: flex;
  gap: 8px;
  align-items: center;
}

.quick-add-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.9);
  transition: all 0.2s ease;
  outline: none;
}

.quick-add-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.quick-add-input::placeholder {
  color: #999;
}

.add-button {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #667eea;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.add-button:hover {
  background: #5a67d8;
  transform: scale(1.05);
}

.add-button:active {
  transform: scale(0.95);
}

/* 任务列表容器 */
.task-list-container {
  flex: 1;
  min-height: 100px;
  max-height: calc(80vh - 200px);
  overflow-y: auto;
  position: relative;
}

.task-list {
  padding: 8px 0;
}

/* 任务项 */
.task-item {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.task-item:hover {
  background: rgba(102, 126, 234, 0.05);
}

.task-item:last-child {
  border-bottom: none;
}

.task-item.todo {
  border-left: 3px solid #94a3b8;
}

.task-item.doing {
  border-left: 3px solid #f59e0b;
  background: rgba(245, 158, 11, 0.05);
}

.task-item.done {
  border-left: 3px solid #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.task-status-indicator {
  width: 20px;
  height: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-top: 2px;
  border-radius: 50%;
}

.task-status-indicator:hover {
  transform: scale(1.1);
  background: rgba(102, 126, 234, 0.1);
}

.task-item.todo .task-status-indicator {
  color: #94a3b8;
}

.task-item.doing .task-status-indicator {
  color: #f59e0b;
}

.task-item.done .task-status-indicator {
  color: #10b981;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-text {
  font-size: 14px;
  color: #1a1a1a;
  line-height: 1.4;
  word-wrap: break-word;
  margin-bottom: 4px;
  cursor: pointer;
}

.task-text:hover {
  background: rgba(102, 126, 234, 0.05);
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px 2px -4px;
}

.task-item.done .task-text {
  text-decoration: line-through;
  color: #94a3b8;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.task-status {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.task-status.status-todo {
  background: rgba(148, 163, 184, 0.2);
  color: #64748b;
}

.task-status.status-doing {
  background: rgba(245, 158, 11, 0.2);
  color: #d97706;
}

.task-status.status-done {
  background: rgba(16, 185, 129, 0.2);
  color: #059669;
}

.task-edit-input {
  font-size: 14px;
  color: #1a1a1a;
  line-height: 1.4;
  border: 1px solid #667eea;
  border-radius: 4px;
  padding: 2px 4px;
  margin-bottom: 4px;
  background: white;
  outline: none;
  width: 100%;
  font-family: inherit;
}

.task-edit-input:focus {
  border-color: #5a67d8;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.task-reminder {
  font-size: 12px;
  color: #667eea;
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-reminder.overdue {
  color: #ff4757;
}

.task-reminder svg {
  width: 12px;
  height: 12px;
}

.task-duration {
  font-size: 12px;
  color: #f59e0b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-duration svg {
  width: 12px;
  height: 12px;
}

.task-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.task-item:hover .task-actions {
  opacity: 1;
}

.action-button {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: rgba(0, 0, 0, 0.1);
}

.action-button.reminder-btn {
  color: #667eea;
}

.action-button.delete-btn {
  color: #ff4757;
}

/* 空状态 */
.empty-state {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #666;
}

.empty-state.show {
  display: flex;
}

.empty-icon {
  margin-bottom: 16px;
  color: #667eea;
  opacity: 0.6;
}

.empty-state h3 {
  font-size: 16px;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.empty-state p {
  font-size: 14px;
  color: #666;
}

/* 提醒设置弹窗 */
.reminder-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  border-radius: 16px;
}

.reminder-modal.show {
  display: flex;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 260px;
  max-width: 85%;
  max-height: 80%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  overflow-y: auto;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.close-button {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.05);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  border-color: #667eea;
}

.quick-time-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.quick-time-btn {
  padding: 6px 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 16px;
  background: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-time-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: rgba(0, 0, 0, 0.05);
  color: #666;
}

.btn-secondary:hover {
  background: rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5a67d8;
}

/* 面板底部 */
.panel-footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.8);
}

.footer-stats {
  font-size: 12px;
  color: #666;
  text-align: center;
}

/* 滚动条样式 */
.task-list-container::-webkit-scrollbar {
  width: 4px;
}

.task-list-container::-webkit-scrollbar-track {
  background: transparent;
}

.task-list-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.task-list-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 动画效果 */
.task-item {
  animation: slideIn 0.3s ease;
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
</style>