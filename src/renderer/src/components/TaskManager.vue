<template>
  <div class="task-manager">
    <!-- 左侧边栏 - 导航 -->
    <aside class="task-manager-sidebar">
      <SidebarNav 
        :current-category="currentCategory"
        :category-counts="categoryCounts"
        @category-change="switchCategory"
        @open-settings="openSettings"
      />
    </aside>

    <!-- 主要内容区域 -->
    <main class="task-manager-main-content pt-4">
      <!-- 当前分类标题区域 -->
      <div class="task-manager-category-header">
        <div class="task-manager-category-title">
          <i :class="getCurrentIcon()" class="task-manager-category-icon" :style="getCurrentIconStyle()"></i>
          <h1 class="task-manager-category-name">{{ getCurrentTitle() }}</h1>
          <span class="task-manager-category-count">{{ getCurrentCount() }} 个任务</span>
        </div>
        
        <!-- 右侧按钮组 -->
        <div class="task-manager-header-actions">
          <!-- 搜索按钮/搜索框 -->
          <div class="task-manager-search-container">
            <!-- 搜索框 -->
            <div v-if="showSearchBox" class="task-manager-inline-search">
              <i class="fas fa-search task-manager-inline-search-icon"></i>
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="搜索任务..." 
                @keyup.escape="toggleSearch"
                @keydown.enter="performSearch"
                @input="handleSearchInput"
                @blur="handleSearchBlur"
                ref="searchInput"
                class="task-manager-inline-search-input"
              />
              <button v-if="searchQuery" class="task-manager-inline-clear" @click="clearSearch">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <!-- 搜索按钮 -->
            <button 
              v-else
              @click="toggleSearch" 
              class="task-manager-action-btn"
              title="搜索"
            >
              <i class="fas fa-search"></i>
            </button>
          </div>
          
          <!-- 列表视图按钮 -->
          <button 
          v-if="currentCategory === 'all'"
            @click="setViewMode('list')" 
            :class="['task-manager-action-btn', { 'active': viewMode === 'list' }]"
            title="列表视图"
          >
            <i class="fas fa-list"></i>
          </button>
          
          <!-- 看板视图按钮 -->
          <button 
          v-if="currentCategory === 'all'"
            @click="setViewMode('kanban')" 
            :class="['task-manager-action-btn', { 'active': viewMode === 'kanban' }]"
            title="看板视图"
          >
            <i class="fas fa-columns"></i>
          </button>
          
          <!-- 显示/隐藏已完成任务按钮 (仅在 all 分类下显示) -->
          <button 
            v-if="currentCategory === 'all' || currentCategory === 'today'"
            @click="toggleCompletedTasks" 
            :class="['task-manager-action-btn', { 'active': showCompletedTasks }]"
            :title="showCompletedTasks ? '隐藏已完成任务' : '显示已完成任务'"
          >
            <i class="fas fa-check-circle"></i>
          </button>
        </div>
      </div>

      <!-- 任务列表组件 -->
      <TaskList
        :tasks="displayTasks"
        :loading="loading"
        :search-query="searchQuery"
        @add-task="handleAddTask"
        @update-task="handleUpdateTask"
        @edit-task="handleEditTask"
        @show-tooltip="showTooltip"
        @hide-tooltip="hideTooltip"
      />

      <!-- 统计信息条 -->
      <div class="task-manager-stats-bar">
        <div class="task-manager-stats-item">
          <span class="task-manager-stats-label">总任务:</span>
          <span class="task-manager-stats-value">{{ displayTasks.length }}</span>
        </div>
        <div class="task-manager-stats-item">
          <span class="task-manager-stats-label">已完成:</span>
          <span class="task-manager-stats-value">{{ taskStore.statusCounts.done }}</span>
        </div>
        <div class="task-manager-stats-item">
          <span class="task-manager-stats-label">进行中:</span>
          <span class="task-manager-stats-value">{{ taskStore.statusCounts.doing }}</span>
        </div>
        <div class="task-manager-stats-item">
          <span class="task-manager-stats-label">暂停中:</span>
          <span class="task-manager-stats-value">{{ taskStore.statusCounts.paused }}</span>
        </div>
        <div class="task-manager-stats-item">
          <span class="task-manager-stats-label">总耗时:</span>
          <span class="task-manager-stats-value">{{ taskStore.formatDuration(taskStore.totalDuration) }}</span>
        </div>
      </div>
    </main>


    <!-- 自定义 Tooltip -->
    <div v-if="tooltip.show" class="task-manager-custom-tooltip" :style="tooltip.style">
      {{ tooltip.text }}
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import TaskList from './TaskList.vue'
import SidebarNav from './SidebarNav.vue'


const taskStore = useTaskStore()
const isEditMode = ref(false)
const editingTask = ref(null)
const searchInput = ref(null)
const updateTimer = ref(null)
const showSearchOptions = ref(false)

// 新增状态
const showSearchBox = ref(false)
const viewMode = ref('list') // 'list' 或 'kanban'
// 计算属性：根据当前分类获取对应的显示已完成任务状态
const showCompletedTasks = computed({
  get: () => {
    if (currentCategory.value === 'all') {
      return taskStore.showCompletedInAll
    } else if (currentCategory.value === 'today') {
      return taskStore.showCompletedInToday
    }
    return false
  },
  set: (value) => {
    if (currentCategory.value === 'all') {
      taskStore.setShowCompletedInAll(value)
    } else if (currentCategory.value === 'today') {
      taskStore.setShowCompletedInToday(value)
    }
  }
})

// Tooltip 相关
const tooltip = ref({
  show: false,
  text: '',
  style: {}
})

// 计算属性
const loading = computed(() => taskStore.loading)
const displayTasks = computed(() => taskStore.filteredTasks)
const categoryCounts = computed(() => taskStore.categoryCounts)
const currentCategory = computed(() => taskStore.currentCategory)
const currentListId = computed(() => taskStore.currentListId)
const currentList = computed(() => taskStore.currentList)
const searchQuery = computed({
  get: () => taskStore.searchQuery,
  set: (value) => taskStore.setSearchQuery(value)
})

// 方法
const loadTasks = async () => {
  try {
    await taskStore.getAllTasks()
  } catch (error) {
    console.error('加载任务失败:', error)
  }
}

const switchCategory = (category) => {
  taskStore.setCurrentCategory(category)
  taskStore.setCurrentListId(null) // 切换智能分类时清除清单选择
  taskStore.clearSearch()
}

const handleAddTask = async (taskData) => {
  try {
    // 如果传入的是字符串（向后兼容），转换为对象
    if (typeof taskData === 'string') {
      taskData = { content: taskData }
    }
    
    // 如果当前选中了清单，将任务添加到该清单
    if (currentListId.value !== null) {
      taskData.listId = currentListId.value
    }
    
    // 直接创建任务，不打开表单
    await taskStore.createTask(taskData)
  } catch (error) {
    console.error('添加任务失败:', error)
  }
}

const handleUpdateTask = async (taskData) => {
  try {
    await taskStore.updateTask(taskData.id, taskData)
  } catch (error) {
    console.error('更新任务失败:', error)
  }
}

const handleEditTask = (task) => {
  isEditMode.value = true
  editingTask.value = { ...task }
}



const clearSearch = () => {
  taskStore.clearSearch()
  showSearchOptions.value = false
}

const performSearch = () => {
  // 搜索逻辑已在 store 中处理
}

const handleSearchInput = () => {
  // 实时搜索，逻辑已在 store 中处理
}

const handleSearchBlur = () => {
  // 如果搜索框为空且失去焦点，则收起搜索框
  if (!searchQuery.value) {
    setTimeout(() => {
      showSearchBox.value = false
    }, 100) // 延迟一点时间，避免点击清除按钮时立即收起
  }
}

// 新增方法
const toggleSearch = () => {
  showSearchBox.value = !showSearchBox.value
  if (showSearchBox.value) {
    // 展开搜索框时自动聚焦
    nextTick(() => {
      if (searchInput.value) {
        searchInput.value.focus()
      }
    })
  } else {
    // 收起搜索框时清空搜索
    clearSearch()
  }
}

const setViewMode = (mode) => {
  viewMode.value = mode
  // 这里可以添加视图模式切换的逻辑
  console.log('切换到视图模式:', mode)
}

const toggleCompletedTasks = () => {
  showCompletedTasks.value = !showCompletedTasks.value
}

// 分类信息方法
const getCategoryName = (category) => {
  const categoryNames = {
    inbox: '收件箱',
    today: '今天',
    doing: '进行中',
    paused: '暂停中',
    planned: '计划中',
    all: '所有任务',
    completed: '已完成'
  }
  return categoryNames[category] || '未知分类'
}

const getCategoryIcon = (category) => {
  const categoryIcons = {
    inbox: 'fas fa-inbox',
    today: 'fas fa-calendar-day',
    doing: 'fas fa-play-circle',
    paused: 'fas fa-pause-circle',
    planned: 'fas fa-calendar-week',
    all: 'fas fa-list',
    completed: 'fas fa-check-circle'
  }
  return categoryIcons[category] || 'fas fa-folder'
}

const getCategoryCount = (category) => {
  return categoryCounts.value[category] || 0
}

// 新增：获取当前视图的标题、图标和计数
const getCurrentTitle = () => {
  if (currentListId.value !== null && currentList.value) {
    return currentList.value.name
  }
  return getCategoryName(currentCategory.value)
}

const getCurrentIcon = () => {
  if (currentListId.value !== null && currentList.value) {
    return `icon-${currentList.value.icon}`
  }
  return getCategoryIcon(currentCategory.value)
}

const getCurrentIconStyle = () => {
  if (currentListId.value !== null && currentList.value) {
    return { color: currentList.value.color }
  }
  return {}
}

const getCurrentCount = () => {
  if (currentListId.value !== null) {
    // 显示当前清单的任务数量
    return displayTasks.value.length
  }
  return getCategoryCount(currentCategory.value)
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

const openSettings = () => {
  window.electronAPI.windows.showSettings()
}

// 生命周期
onMounted(async () => {
  // 加载清单和任务数据
  await Promise.all([
    taskStore.getAllLists(),
    loadTasks()
  ])
  
  // 监听任务和清单更新事件
  window.electronAPI.events.on('tasks-updated', loadTasks)
  window.electronAPI.events.on('lists-updated', () => {
    taskStore.getAllLists()
  })
  
  // 定时更新任务状态
  updateTimer.value = setInterval(() => {
    loadTasks()
  }, 60000) // 每分钟更新一次
})

onUnmounted(() => {
  if (updateTimer.value) {
    clearInterval(updateTimer.value)
  }
  
  // 清理事件监听器
  window.electronAPI.events.removeAllListeners('tasks-updated')
  window.electronAPI.events.removeAllListeners('lists-updated')
})

// 监听搜索查询变化
watch(() => taskStore.searchQuery, (newQuery) => {
  if (!newQuery) {
    showSearchOptions.value = false
  }
})

// 不需要监听分类变化来重置状态，因为每个分类都有独立的状态
</script>

<style>
@import '../assets/styles/components/task-manager.css';
</style>