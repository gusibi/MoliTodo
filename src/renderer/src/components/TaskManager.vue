<template>
  <div class="task-manager">
    <!-- 左侧边栏 - 半透明毛玻璃效果 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="user-profile">
          <div class="user-avatar">
            <img src="/tray-icon.png" alt="MoliTodo" />
          </div>
          <span class="user-name">MoliTodo</span>
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <!-- 基础功能项 -->
        <!-- <div class="nav-section">
          <div class="nav-item quick-add" @click="handleAddTask">
            <i class="fas fa-plus-circle"></i>
            <span>快速添加</span>
          </div>
          <div class="nav-item search-item" @click="focusSearch">
            <i class="fas fa-search"></i>
            <span>搜索</span>
          </div>
        </div> -->

        <!-- 任务分类项 -->
        <div class="nav-section">
          <div class="nav-item" :class="{ active: currentCategory === 'inbox' }" @click="switchCategory('inbox')">
            <i class="fas fa-inbox"></i>
            <span>收件箱</span>
            <span class="count">{{ getCategoryCount('inbox') }}</span>
          </div>
          <div class="nav-item" :class="{ active: currentCategory === 'today' }" @click="switchCategory('today')">
            <i class="fas fa-calendar-day"></i>
            <span>今天</span>
            <span class="count">{{ getCategoryCount('today') }}</span>
          </div>
          <div class="nav-item" :class="{ active: currentCategory === 'doing' }" @click="switchCategory('doing')">
            <i class="fas fa-play-circle"></i>
            <span>进行中</span>
            <span class="count">{{ getCategoryCount('doing') }}</span>
          </div>
          <div class="nav-item" :class="{ active: currentCategory === 'paused' }" @click="switchCategory('paused')">
            <i class="fas fa-pause-circle"></i>
            <span>暂停中</span>
            <span class="count">{{ getCategoryCount('paused') }}</span>
          </div>
          <div class="nav-item" :class="{ active: currentCategory === 'planned' }" @click="switchCategory('planned')">
            <i class="fas fa-calendar-week"></i>
            <span>计划中</span>
            <span class="count">{{ getCategoryCount('planned') }}</span>
          </div>
          <div class="nav-item" :class="{ active: currentCategory === 'all' }" @click="switchCategory('all')">
            <i class="fas fa-list"></i>
            <span>所有任务</span>
            <span class="count">{{ getCategoryCount('all') }}</span>
          </div>
          <div class="nav-item" :class="{ active: currentCategory === 'completed' }" @click="switchCategory('completed')">
            <i class="fas fa-check-circle"></i>
            <span>已完成</span>
            <span class="count">{{ getCategoryCount('completed') }}</span>
          </div>
        </div>
        
        <!-- 设置项 -->
        <div class="nav-section nav-section-bottom">
          <div class="nav-item" @click="openSettings">
            <i class="fas fa-cog"></i>
            <span>设置</span>
          </div>
        </div>
      </nav>
    </aside>

    <!-- 主要内容区域 -->
    <main class="main-content">
      <!-- 搜索区域 - 简化版 -->
      <div class="search-section">
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索任务..." 
            @keyup.escape="clearSearch"
            @keydown.enter="performSearch"
            @input="handleSearchInput"
            ref="searchInput"
          />
          <button v-if="searchQuery" class="clear-search" @click="clearSearch">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- 搜索结果统计 -->
        <div v-if="searchQuery" class="search-results-info">
          <span class="search-query">搜索 "{{ searchQuery }}"</span>
          <span class="search-count">找到 {{ displayTasks.length }} 个结果</span>
        </div>
      </div>

      <!-- 任务列表组件 -->
      <TaskList
        :tasks="displayTasks"
        :loading="loading"
        :search-query="searchQuery"
        :selected-tasks="selectedTasks"
        @add-task="handleAddTask"
        @select-task="selectTask"
        @edit-task="handleEditTask"
        @show-tooltip="showTooltip"
        @hide-tooltip="hideTooltip"
      />

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
          <span class="stats-label">暂停中:</span>
          <span class="stats-value">{{ getPausedCount() }}</span>
        </div>
        <div class="stats-item">
          <span class="stats-label">总耗时:</span>
          <span class="stats-value">{{ getTotalDuration() }}</span>
        </div>
      </div>
    </main>

    <!-- 任务表单组件 -->
    <TaskForm
      :show="showTaskForm"
      :task="editingTask"
      :is-edit="isEditMode"
      @submit="handleTaskSubmit"
      @cancel="handleTaskCancel"
      @close="handleTaskCancel"
    />

    <!-- 自定义 Tooltip -->
    <div v-if="tooltip.show" class="custom-tooltip" :style="tooltip.style">
      {{ tooltip.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import TaskList from './TaskList.vue'
import TaskForm from './TaskForm.vue'

const taskStore = useTaskStore()
const currentCategory = ref('inbox')
const showTaskForm = ref(false)
const isEditMode = ref(false)
const editingTask = ref(null)
const searchInput = ref(null)
const updateTimer = ref(null)
const searchQuery = ref('')
const searchOptions = ref({
  content: true,
  status: true,
  date: false,
  caseSensitive: false
})
const selectedTasks = ref([])
const showSearchOptions = ref(false)

// Tooltip 相关
const tooltip = ref({
  show: false,
  text: '',
  style: {}
})

// 计算属性
const loading = computed(() => taskStore.loading)

const displayTasks = computed(() => {
  let tasks = taskStore.tasks // 直接使用 taskStore.tasks
  // 根据分类过滤
  if (currentCategory.value !== 'all') {
    tasks = tasks.filter(task => {
      switch (currentCategory.value) {
        case 'inbox':
          return task.status === 'todo' && !task.reminderTime
        case 'today':
          return isToday(task.reminderTime) || (task.status === 'doing')
        case 'doing':
          return task.status === 'doing'
        case 'paused':
          return task.status === 'paused'
        case 'planned':
          console.log('planned:  ', task.reminderTime, task.reminderTime )
          return task.reminderTime 
        case 'completed':
          return task.status === 'done'
        default:
          return true
      }
    })
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchOptions.value.caseSensitive ? searchQuery.value : searchQuery.value.toLowerCase()
    tasks = tasks.filter(task => {
      let matches = false
      
      if (searchOptions.value.content) {
        const content = searchOptions.value.caseSensitive ? task.content : task.content.toLowerCase()
        const description = searchOptions.value.caseSensitive ? (task.description || '') : (task.description || '').toLowerCase()
        matches = matches || content.includes(query) || description.includes(query)
      }
      
      if (searchOptions.value.status) {
        const statusText = getStatusText(task.status)
        const status = searchOptions.value.caseSensitive ? statusText : statusText.toLowerCase()
        matches = matches || status.includes(query)
      }
      
      if (searchOptions.value.date) {
        const dateTexts = [
          task.createdAt ? formatCreatedTime(task.createdAt) : '',
          task.reminderTime ? formatReminderTime(task.reminderTime) : '',
          task.completedAt ? formatCompletedTime(task.completedAt) : ''
        ]
        
        for (const dateText of dateTexts) {
          const date = searchOptions.value.caseSensitive ? dateText : dateText.toLowerCase()
          if (date.includes(query)) {
            matches = true
            break
          }
        }
      }
      
      return matches
    })
  }

  return tasks
})

// 方法
const loadTasks = async () => {
  try {
    await taskStore.getAllTasks()
    // 不需要再赋值给 allTasks.value，直接使用 taskStore.tasks
  } catch (error) {
    console.error('加载任务失败:', error)
  }
}

const refreshTasks = () => {
  loadTasks()
}

const switchCategory = (category) => {
  currentCategory.value = category
  clearSearch()
}

const getCategoryTitle = () => {
  const titles = {
    inbox: '收件箱',
    today: '今天',
    doing: '进行中',
    paused: '暂停中',
    planned: '计划中',
    all: '所有任务',
    completed: '已完成'
  }
  return titles[currentCategory.value] || '任务管理'
}

const getCategoryCount = (category) => {
  const tasks = taskStore.tasks // 直接使用 taskStore.tasks
  switch (category) {
    case 'inbox':
      return tasks.filter(t => t.status === 'todo' && !t.reminderTime).length
    case 'today':
      return tasks.filter(t => isToday(t.reminderTime) || t.status === 'doing').length
    case 'doing':
      return tasks.filter(t => t.status === 'doing').length
    case 'paused':
      return tasks.filter(t => t.status === 'paused').length
    case 'planned':
      return tasks.filter(t => t.reminderTime ).length
    case 'all':
      return tasks.length
    case 'completed':
      return tasks.filter(t => t.status === 'done').length
    default:
      return 0
  }
}

const handleAddTask = () => {
  isEditMode.value = false
  editingTask.value = null
  showTaskForm.value = true
}

const handleEditTask = (task) => {
  isEditMode.value = true
  editingTask.value = { ...task }
  showTaskForm.value = true
}

const handleTaskSubmit = async (taskData) => {
  try {
    if (isEditMode.value) {
      await taskStore.updateTask(editingTask.value.id, taskData)
    } else {
      await taskStore.createTask(taskData)
    }
    // 不需要手动调用 loadTasks()，taskStore 会自动更新
    showTaskForm.value = false
  } catch (error) {
    console.error('保存任务失败:', error)
  }
}

const handleTaskCancel = () => {
  showTaskForm.value = false
  editingTask.value = null
  isEditMode.value = false
}

const selectTask = (taskId, event) => {
  if (event.ctrlKey || event.metaKey) {
    const index = selectedTasks.value.indexOf(taskId)
    if (index > -1) {
      selectedTasks.value.splice(index, 1)
    } else {
      selectedTasks.value.push(taskId)
    }
  } else {
    selectedTasks.value = [taskId]
  }
}

const toggleTaskComplete = async (task) => {
  try {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    await taskStore.updateTask(task.id, { status: newStatus })
    // 不需要手动调用 loadTasks()，taskStore 会自动更新
  } catch (error) {
    console.error('更新任务状态失败:', error)
  }
}

const deleteTask = async (taskId) => {
  if (confirm('确定要删除这个任务吗？')) {
    try {
      await taskStore.deleteTask(taskId)
      // 不需要手动调用 loadTasks()，taskStore 会自动更新
      selectedTasks.value = selectedTasks.value.filter(id => id !== taskId)
    } catch (error) {
      console.error('删除任务失败:', error)
    }
  }
}

// 搜索相关方法
const focusSearch = () => {
  showSearchOptions.value = true
  nextTick(() => {
    searchInput.value?.focus()
  })
}

const clearSearch = () => {
  searchQuery.value = ''
  showSearchOptions.value = false
}

const performSearch = () => {
  // 搜索逻辑已在 computed 中处理
}

const handleSearchInput = () => {
  // 实时搜索，逻辑已在 computed 中处理
}

// Tooltip 方法
const showTooltip = (data) => {
  // 处理从TaskList传递过来的数据对象
  const event = data.event || data
  const text = data.text || data
  
  // 如果是直接传递的event和text参数（向后兼容）
  if (typeof data === 'object' && data.target) {
    const rect = data.target.getBoundingClientRect()
    tooltip.value = {
      show: true,
      text: text,
      style: {
        position: 'fixed',
        left: rect.left + rect.width / 2 + 'px',
        top: rect.top - 10 + 'px',
        transform: 'translate(-50%, -100%)',
        zIndex: 10000
      }
    }
  } else if (data.event && data.text) {
    // 处理从子组件传递的数据对象
    const rect = data.event.target.getBoundingClientRect()
    tooltip.value = {
      show: true,
      text: data.text,
      style: {
        position: 'fixed',
        left: rect.left + rect.width / 2 + 'px',
        top: rect.top - 10 + 'px',
        transform: 'translate(-50%, -100%)',
        zIndex: 10000
      }
    }
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}

// 统计方法
const getCompletedCount = () => {
  return displayTasks.value.filter(task => task.status === 'done').length
}

const getInProgressCount = () => {
  return displayTasks.value.filter(task => task.status === 'doing').length
}

const getPausedCount = () => {
  return displayTasks.value.filter(task => task.status === 'paused').length
}

const getTotalDuration = () => {
  const total = displayTasks.value.reduce((sum, task) => {
    return sum + (task.totalDuration || 0)
  }, 0)
  return formatDuration(total)
}

// 工具方法
const isToday = (dateString) => {
  if (!dateString) return false
  const today = new Date()
  const date = new Date(dateString)
  return date.toDateString() === today.toDateString()
}

const getStatusText = (status) => {
  const statusMap = {
    'todo': '待办',
    'doing': '进行中',
    'paused': '暂停中',
    'done': '已完成'
  }
  return statusMap[status] || status
}

const formatDuration = (ms) => {
  if (!ms) return '0分钟'
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}天${hours % 24}小时`
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`
  } else {
    return `${minutes}分钟`
  }
}

const formatReminderTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  if (taskDate.getTime() === today.getTime()) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (taskDate.getTime() === tomorrow.getTime()) {
    return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
}

const formatCreatedTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return '今天'
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

const formatCompletedTime = (dateString) => {
  if (!dateString) return ''
  return formatCreatedTime(dateString)
}

const openSettings = () => {
  window.electronAPI.windows.showSettings()
}

// 生命周期
onMounted(() => {
  loadTasks()
  
  // 定时更新任务状态
  updateTimer.value = setInterval(() => {
    loadTasks()
  }, 60000) // 每分钟更新一次
})

onUnmounted(() => {
  if (updateTimer.value) {
    clearInterval(updateTimer.value)
  }
})

// 监听搜索查询变化
watch(searchQuery, (newQuery) => {
  if (!newQuery) {
    showSearchOptions.value = false
  }
})
</script>

<style>
@import '../assets/styles/components/task-manager.css';
</style>