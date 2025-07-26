<template>
  <div class="task-manager">
    <!-- 左侧边栏 - 半透明毛玻璃效果 -->
    <aside class="task-manager-sidebar">
      <div class="task-manager-sidebar-header">
        <div class="task-manager-user-profile">
          <div class="task-manager-user-avatar">
            <img src="/tray-icon.png" alt="MoliTodo" />
          </div>
          <span class="task-manager-user-name">MoliTodo</span>
        </div>
      </div>
      
      <SidebarNav 
        :current-category="currentCategory"
        :category-counts="categoryCounts"
        @category-change="switchCategory"
        @open-settings="openSettings"
      />
    </aside>

    <!-- 主要内容区域 -->
    <main class="task-manager-main-content">
      <!-- 搜索区域 - 简化版 -->
      <div class="task-manager-search-section">
        <div class="task-manager-search-box">
          <i class="fas fa-search task-manager-search-icon"></i>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索任务..." 
            @keyup.escape="clearSearch"
            @keydown.enter="performSearch"
            @input="handleSearchInput"
            ref="searchInput"
            class="task-manager-search-input"
          />
          <button v-if="searchQuery" class="task-manager-clear-search" @click="clearSearch">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- 搜索结果统计 -->
        <div v-if="searchQuery" class="task-manager-search-results-info">
          <span class="task-manager-search-query">搜索 "{{ searchQuery }}"</span>
          <span class="task-manager-search-count">找到 {{ displayTasks.length }} 个结果</span>
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
    <div v-if="tooltip.show" class="task-manager-custom-tooltip" :style="tooltip.style">
      {{ tooltip.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import TaskList from './TaskList.vue'
import TaskForm from './TaskForm.vue'
import SidebarNav from './SidebarNav.vue'

const taskStore = useTaskStore()
const showTaskForm = ref(false)
const isEditMode = ref(false)
const editingTask = ref(null)
const searchInput = ref(null)
const updateTimer = ref(null)
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
const displayTasks = computed(() => taskStore.filteredTasks)
const categoryCounts = computed(() => taskStore.categoryCounts)
const currentCategory = computed(() => taskStore.currentCategory)
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
  taskStore.clearSearch()
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
onMounted(() => {
  loadTasks()
  
  // 监听任务更新事件
  window.electronAPI.events.on('tasks-updated', loadTasks)
  
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
})

// 监听搜索查询变化
watch(() => taskStore.searchQuery, (newQuery) => {
  if (!newQuery) {
    showSearchOptions.value = false
  }
})
</script>

<style>
@import '../assets/styles/components/task-manager.css';
</style>