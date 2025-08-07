<template>
  <div class="floating-task-container">
    <!-- 拖拽区域 -->
    <div class="floating-task-drag-area"></div>

    <!-- 任务卡片 -->
    <div :class="['floating-task-item', {
      'task-completed': currentStatus === 'done',
      'task-in-progress': currentStatus === 'doing' && !isTaskOvertime,
      'task-overtime': currentStatus === 'doing' && isTaskOvertime,
      'task-paused': currentStatus === 'paused',
      'task-reminder-overdue': isReminderOverdue,
      'animate-pulse': isReminderOverdue
    }]">

      <!-- 关闭按钮 -->
      <button class="floating-task-close" @click="closeFloatingTask">
        <i class="fas fa-times"></i>
      </button>


      <!-- 任务信息 -->
      <div class="task-info">
        <div class="task-title">{{ task?.content || '任务' }}</div>
        <div class="task-tags">
          <!-- 提醒时间标签 -->
          <span v-if="task?.reminderTime" :class="['task-tag', 'task-tag-reminder', {
            'task-tag-overdue': isReminderOverdue,
            'animate-bounce': isReminderOverdue
          }]">
            <i class="fas fa-calendar"></i>
            {{ formatReminderTime(task.reminderTime) }}
          </span>
          <!-- 状态标签 -->
          <span v-if="currentStatus === 'doing' && !isTaskOvertime" class="task-tag task-tag-status task-tag-doing">
            <i class="fas fa-play"></i>
            {{ formatDuration(currentDuration) }}
          </span>
          <span v-else-if="currentStatus === 'doing' && isTaskOvertime" class="task-tag task-tag-status task-tag-overtime">
            <i class="fas fa-clock"></i>
            {{ formatDuration(currentDuration) }}
          </span>
          <span v-else-if="currentStatus === 'paused'" class="task-tag task-tag-status task-tag-paused">
            <i class="fas fa-pause"></i>
            {{ formatDuration(task?.totalDuration || 0) }}
          </span>
          <span v-else-if="currentStatus === 'done'" class="task-tag task-tag-status task-tag-completed">
            <i class="fas fa-check"></i>
            用时 {{ formatDuration(task?.totalDuration || 0) }}
          </span>


        </div>
      </div>

      <!-- 任务操作按钮 -->
      <div class="task-actions">
        <button v-if="currentStatus === 'todo'" class="task-btn-action task-btn-start" @click="startTask" title="开始">
          <i class="fas fa-play"></i>
        </button>
        <button v-if="currentStatus === 'doing'" class="task-btn-action task-btn-pause" @click="pauseTask" title="暂停">
          <i class="fas fa-pause"></i>
        </button>
        <button v-if="currentStatus === 'paused'" class="task-btn-action task-btn-resume" @click="startTask" title="继续">
          <i class="fas fa-play"></i>
        </button>
        <button v-if="currentStatus === 'doing' || currentStatus === 'paused'" class="task-btn-action task-btn-complete"
          @click="completeTask" title="完成">
          <i class="fas fa-check"></i>
        </button>
        <button v-if="currentStatus === 'done'" class="task-btn-action task-btn-restart" @click="restartTask"
          title="重新开始">
          <i class="fas fa-redo"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const props = defineProps({
  taskId: {
    type: String,
    required: true
  }
})

const taskStore = useTaskStore()

// 响应式数据
const task = ref(null)
const currentDuration = ref(0)

// 计算属性
const currentStatus = computed(() => {
  return task.value?.status || (task.value?.completed ? 'done' : 'todo')
})

const isReminderOverdue = computed(() => {
  if (!task.value?.reminderTime) return false
  return new Date(task.value.reminderTime) < new Date() && (currentStatus.value === 'paused' || currentStatus.value === 'todo')
})

// 判断任务是否超时（进行中且已超过提醒时间）
const isTaskOvertime = computed(() => {
  if (currentStatus.value !== 'doing' || !task.value?.reminderTime) return false
  return new Date(task.value.reminderTime) < new Date()
})

// 移除了拖拽相关代码，现在使用CSS的-webkit-app-region实现原生拖拽

// 任务操作方法
const loadTask = async () => {
  try {
    console.log('FloatingTask: 开始加载任务，ID:', props.taskId)
    const tasks = await taskStore.getAllTasks()
    const foundTask = tasks.find(t => t.id === props.taskId)

    if (foundTask) {
      task.value = foundTask
      console.log('FloatingTask: 任务加载成功', foundTask)
      updateDuration()
    } else {
      console.warn('FloatingTask: 未找到任务，ID:', props.taskId)
      // 任务可能已被删除，关闭悬浮窗口
      if (window.electronAPI && window.electronAPI.windows) {
        window.electronAPI.windows.closeFloatingTask(props.taskId)
      }
    }
  } catch (error) {
    console.error('FloatingTask: 加载任务失败:', error)
    // 可以考虑显示错误状态或重试
  }
}

const toggleComplete = async () => {
  try {
    if (currentStatus.value === 'done') {
      await taskStore.updateTask(props.taskId, { status: 'todo', completedAt: null })
    } else {
      await taskStore.completeTask(props.taskId)
    }
    await loadTask()
  } catch (error) {
    console.error('切换完成状态失败:', error)
  }
}

const startTask = async () => {
  try {
    await taskStore.startTask(props.taskId)
    await loadTask()
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const pauseTask = async () => {
  try {
    await taskStore.pauseTask(props.taskId)
    await loadTask()
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const completeTask = async () => {
  try {
    await taskStore.completeTask(props.taskId)
    await loadTask()
  } catch (error) {
    console.error('完成任务失败:', error)
  }
}

const restartTask = async () => {
  try {
    await taskStore.updateTask(props.taskId, {
      status: 'todo',
      completedAt: null,
      startTime: null,
      totalDuration: 0
    })
    await loadTask()
  } catch (error) {
    console.error('重新开始任务失败:', error)
  }
}

const closeFloatingTask = () => {
  window.electronAPI.windows.closeFloatingTask(props.taskId)
}

// 状态相关方法
const getStatusText = (status) => {
  const statusMap = {
    'todo': '待办',
    'doing': '进行中',
    'done': '已完成'
  }
  return statusMap[status] || '待办'
}

const getStatusIcon = (status) => {
  const iconComponents = {
    'todo': () => h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, stroke: 'currentColor', 'stroke-width': 2 })
    ]),
    'doing': () => h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, fill: 'currentColor' }),
      h('circle', { cx: 12, cy: 12, r: 4, fill: 'white' })
    ]),
    'done': () => h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, fill: 'currentColor' }),
      h('path', { d: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z', fill: 'white' })
    ])
  }
  return iconComponents[status] || iconComponents['todo']
}

const updateDuration = () => {
  if (!task.value) return

  let totalDuration = task.value.totalDuration || 0

  if (task.value.status === 'doing' && task.value.startedAt) {
    const currentSessionDuration = Date.now() - new Date(task.value.startedAt).getTime()
    totalDuration += currentSessionDuration
  }

  currentDuration.value = totalDuration
}

const formatDuration = (milliseconds) => {
  if (!milliseconds) return '0分钟'

  const hours = Math.floor(milliseconds / 3600000)
  const minutes = Math.floor((milliseconds % 3600000) / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`
  } else {
    return `${seconds}秒`
  }
}

const formatReminderTime = (timestamp) => {
  return taskStore.formatTimeDisplay(timestamp, 'reminder')
}

// 定时器
let updateTimer = null

const startUpdateTimer = () => {
  updateTimer = setInterval(() => {
    if (currentStatus.value === 'doing') {
      updateDuration()
    }
  }, 1000)
}

const stopUpdateTimer = () => {
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = null
  }
}

// 监听任务更新
const handleTasksUpdated = () => {
  console.log('FloatingTask: 收到 tasks-updated 事件')
  loadTask()
}

// 监听单个任务更新
const handleTaskUpdated = (taskData) => {
  console.log('FloatingTask: 收到 task-updated 事件', taskData)
  if (taskData && taskData.id === props.taskId) {
    task.value = taskData
    updateDuration()
  }
}

// 生命周期
onMounted(async () => {
  console.log('FloatingTask: 组件挂载，任务ID:', props.taskId)
  await loadTask()
  startUpdateTimer()

  // 监听任务更新事件
  if (window.electronAPI && window.electronAPI.events) {
    window.electronAPI.events.on('tasks-updated', handleTasksUpdated)
    window.electronAPI.events.on('task-updated', handleTaskUpdated)
    console.log('FloatingTask: 事件监听器已设置')
  } else {
    console.error('FloatingTask: electronAPI.events 不可用')
  }

  // 设置定期刷新作为备用方案
  const refreshInterval = setInterval(() => {
    loadTask()
  }, 5000) // 每5秒刷新一次

  // 保存interval引用以便清理
  window.floatingTaskRefreshInterval = refreshInterval
})

onUnmounted(() => {
  console.log('FloatingTask: 组件卸载')
  stopUpdateTimer()

  // 清理事件监听器
  if (window.electronAPI && window.electronAPI.events) {
    window.electronAPI.events.removeAllListeners('tasks-updated')
    window.electronAPI.events.removeAllListeners('task-updated')
  }

  // 清理定期刷新
  if (window.floatingTaskRefreshInterval) {
    clearInterval(window.floatingTaskRefreshInterval)
    delete window.floatingTaskRefreshInterval
  }
})
</script>

<style scoped>
@import '@/assets/styles/components/floating-task.css';
</style>