<template>
  <div class="task-manager">
    <!-- 左侧边栏 - 导航 -->
    <aside class="task-manager-sidebar">
      <SidebarNav :current-category="currentCategory" @category-change="switchCategory" @open-settings="openSettings" />
    </aside>

    <!-- 主要内容区域 -->
    <main class="task-manager-main-content pt-4 flex flex-col">
      <!-- 当前分类标题区域 -->
      <div class="task-manager-category-header">
        <div class="task-manager-category-title" @click="handleEasterEggClick">
          <i :class="getCurrentIcon()" class="task-manager-category-icon" :style="getCurrentIconStyle()"></i>
          <h1 class="task-manager-category-name">{{ getCurrentTitle() }}</h1>
          <span class="task-manager-category-count">{{ $t('tasks.totalTasks', { count: getCurrentCount() }) }}</span>
        </div>

        <!-- 右侧按钮组 -->
        <div class="task-manager-header-actions">
          <!-- 搜索按钮/搜索框 -->
          <div class="task-manager-search-container">
            <!-- 搜索框 -->
            <div v-if="showSearchBox" class="task-manager-inline-search">
              <i class="fas fa-search task-manager-inline-search-icon"></i>
              <input v-model="searchQuery" type="text" :placeholder="$t('common.search')" @keyup.escape="toggleSearch"
                @keydown.enter="performSearch" @input="handleSearchInput" @blur="handleSearchBlur" ref="searchInput"
                class="task-manager-inline-search-input" />
              <button v-if="searchQuery" class="task-manager-inline-clear" @click="clearSearch">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- 搜索按钮 -->
            <button v-else @click="toggleSearch" class="task-manager-action-btn" :title="$t('common.search')">
              <i class="fas fa-search"></i>
            </button>
          </div>

          <!-- 列表视图按钮 -->
          <button v-if="supportsMultipleViews" @click="setViewMode('list')"
            :class="['task-manager-action-btn', { 'active': viewMode === 'list' }]" :title="$t('views.listView')">
            <i class="fas fa-list"></i>
          </button>

          <!-- 看板视图按钮 -->
          <button v-if="supportsMultipleViews" @click="setViewMode('kanban')"
            :class="['task-manager-action-btn', { 'active': viewMode === 'kanban' }]" :title="$t('views.kanbanView')">
            <i class="fas fa-columns"></i>
          </button>



          <!-- 月视图按钮 -->
          <button v-if="supportsMonthlyView" @click="setViewMode('monthly')"
            :class="['task-manager-action-btn', { 'active': viewMode === 'monthly' }]" :title="$t('views.monthlyView')">
            <i class="fas fa-calendar-alt"></i>
          </button>

          <!-- 显示/隐藏已完成任务按钮 -->
          <button v-if="showCompletedTasksButton" @click="toggleCompletedTasks"
            :class="['task-manager-action-btn', { 'active': showCompletedTasks }]"
            :title="showCompletedTasks ? $t('tasks.hideCompleted') : $t('tasks.showCompleted')">
            <i class="fas fa-check-circle"></i>
          </button>
        </div>
      </div>

      <!-- 任务视图组件容器 - 可滚动区域 -->
      <div class="task-manager-views-container flex-1 min-h-0 relative" :class="{
        'overflow-auto': viewMode !== 'monthly' && viewMode !== 'kanban' && !showEditPanel,
        'overflow-hidden': viewMode === 'monthly' || viewMode === 'kanban',
        'task-manager-views-flex': viewMode === 'list'
      }">
        <!-- 视图切换过渡动画 -->
        <Transition name="view-fade" mode="out-in" appear>
          <!-- 列表视图 -->
          <div v-if="viewMode === 'list'" key="list" class="task-list-container" :class="{ 'with-edit-panel': showEditPanel }">
            <FlatTaskList :tasks="displayTasks" :loading="loading" :search-query="searchQuery"
              :editing-task-id="selectedTask?.id"
              @add-task="handleAddTask" @update-task="handleUpdateTask" @edit-task="handleEditTask"
              @show-tooltip="showTooltip" @hide-tooltip="hideTooltip" 
              @show-edit-panel="handleShowEditPanel" @hide-edit-panel="handleHideEditPanel" />
          </div>

          <!-- 月视图 -->
          <MonthlyView v-else-if="viewMode === 'monthly'" key="monthly" :tasks="displayTasks" :loading="loading"
            :search-query="searchQuery" @edit-task="handleEditTask" @create-task="handleAddTask"
            @show-tooltip="showTooltip" @hide-tooltip="hideTooltip" />

          <!-- 看板视图 -->
          <div v-else-if="viewMode === 'kanban'" key="kanban" class="kanban-view-wrapper">
            <!-- 看板内容 - 始终渲染，不受编辑面板影响 -->
            <div class="kanban-content">
              <KanbanBoard 
                :tasks="displayTasks" 
                :loading="loading"
                :search-query="searchQuery"
                :current-list-id="currentListId"
                :editing-task-id="selectedTask?.id"
                @add-task="handleAddTask" 
                @update-task="handleUpdateTaskWithStatusTracking" 
                @edit-task="handleEditTask"
                @show-edit-panel="handleShowEditPanel" 
              />
            </div>

            <!-- 看板视图的覆盖式编辑面板 -->
            <Transition name="kanban-edit-panel" appear>
              <div v-if="showEditPanel" class="kanban-edit-panel-overlay">
                <div class="kanban-edit-panel-backdrop" @click="handleHideEditPanel"></div>
                <div class="kanban-edit-panel-container">
                  <TaskEditVertical 
                    :task="selectedTask" 
                    :is-editing="true" 
                    @update-task="handleUpdateTask" 
                    @cancel-edit="handleHideEditPanel" 
                    @delete-task="handleDeleteTask"
                  />
                </div>
              </div>
            </Transition>
          </div>
        </Transition>

        <!-- 列表视图的右侧编辑面板 - 独立于视图切换动画 -->
        <Transition name="edit-panel-slide" appear>
          <div v-if="showEditPanel && viewMode === 'list'" class="edit-panel-container">
            <TaskEditVertical 
              :task="selectedTask" 
              :is-editing="true" 
              @update-task="handleUpdateTask" 
              @cancel-edit="handleHideEditPanel" 
              @delete-task="handleDeleteTask"
            />
          </div>
        </Transition>
      </div>

      <!-- 统计信息条 - 固定在底部 -->
      <!-- <TaskStatsBar :display-tasks="displayTasks" /> -->
    </main>


    <!-- 自定义 Tooltip -->
    <div v-if="tooltip.show" class="task-manager-custom-tooltip" :style="tooltip.style">
      {{ tooltip.text }}
    </div>

    <!-- 任务详情模态框 -->
    <TaskDetailsModal 
      v-if="showTaskDetailsModal" 
      :tasks="displayTasks" 
      @close="showTaskDetailsModal = false" 
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'
import FlatTaskList from './FlatTaskList.vue'
import MonthlyView from './calender_view/MonthlyView.vue'
import SidebarNav from './SidebarNav.vue'
import TaskEditVertical from './TaskEditVertical.vue'
import KanbanBoard from './kanban_view/KanbanBoard.vue'
import TaskDetailsModal from './TaskDetailsModal.vue'
import { getListIconClass } from '@/utils/icon-utils'


const { t, locale } = useI18n()
const taskStore = useTaskStore()
const isEditMode = ref(false)
const editingTask = ref(null)
const searchInput = ref(null)
const updateTimer = ref(null)
const showSearchOptions = ref(false)

// 新增状态
const showSearchBox = ref(false)
const viewMode = ref('list') // 'list', 'kanban', 或 'weekly'

// 编辑面板相关状态
const showEditPanel = ref(false)
const selectedTask = ref(null)
// 计算属性：根据当前分类和视图模式获取对应的显示已完成任务状态
const showCompletedTasks = computed({
  get: () => {
    if (currentCategory.value === 'all') {
      return taskStore.showCompletedInAll
    } else if (currentCategory.value === 'today') {
      return taskStore.showCompletedInToday
    } else if (viewMode.value === 'monthly') {
      return taskStore.showCompletedInMonthly
    }
    return false
  },
  set: (value) => {
    if (currentCategory.value === 'all') {
      taskStore.setShowCompletedInAll(value)
    } else if (currentCategory.value === 'today') {
      taskStore.setShowCompletedInToday(value)
    } else if (viewMode.value === 'monthly') {
      taskStore.setShowCompletedInMonthly(value)
    }
  }
})

// Tooltip 相关
const tooltip = ref({
  show: false,
  text: '',
  style: {}
})

// 彩蛋功能相关
const easterEggClickCount = ref(0)
const easterEggTimer = ref(null)
const showTaskDetailsModal = ref(false)

// 计算属性
const loading = computed(() => taskStore.loading)
const displayTasks = computed(() => {
  // 使用 taskStore 的统一过滤方法
  const currentCategory = taskStore.currentCategory
  const currentListId = taskStore.currentListId

  // 根据当前分类和是否显示已完成任务来获取任务
  const includeCompleted = showCompletedTasks.value
  return taskStore.getSortedTasks(currentCategory, currentListId, includeCompleted)
})
const currentCategory = computed(() => taskStore.currentCategory)
const currentListId = computed(() => taskStore.currentListId)
const currentList = computed(() => taskStore.currentList)

// 计算属性：判断当前分类是否支持多种视图
const supportsMultipleViews = computed(() => {
  return ['all', 'planned'].includes(currentCategory.value)
})

// 计算属性：判断当前分类是否支持月视图
const supportsMonthlyView = computed(() => {
  return ['all', 'planned'].includes(currentCategory.value)
})

// 计算属性：判断是否显示已完成任务按钮
const showCompletedTasksButton = computed(() => {
  return currentCategory.value === 'all' ||
    currentCategory.value === 'today' ||
    (viewMode.value === 'monthly' && supportsMonthlyView.value)
})

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

  // 切换分类时关闭编辑面板
  handleHideEditPanel()

  // 如果切换到不支持特殊视图的分类，则自动切换到列表视图
  if (viewMode.value === 'monthly' && !['all', 'planned'].includes(category)) {
    viewMode.value = 'list'
  }
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


const handleDeleteTask = async (task) => {
  if (confirm(t('tasks.confirmDelete'))) {
    try {
      await taskStore.deleteTask(task.id)
      
      // 删除成功后，自动选择列表中的第一个任务
      const availableTasks = displayTasks.value.filter(t => t.status !== 'done')
      if (availableTasks.length > 0) {
        selectedTask.value = availableTasks[0]
        showEditPanel.value = true
      } else {
        // 如果没有可用任务，隐藏编辑面板
        handleHideEditPanel()
      }
    } catch (error) {
      console.error('删除任务失败:', error)
    }
  }
}


const handleUpdateTask = async (taskData) => {
  try {
    await taskStore.updateTask(taskData.id, taskData)
  } catch (error) {
    console.error('更新任务失败:', error)
  }
}

const handleUpdateTaskWithStatusTracking = async (taskData) => {
  console.log('🔍 [TaskManager] 处理任务状态更新:', taskData)
  console.log('🔍 [TaskManager] 任务ID:', taskData.id, '类型:', typeof taskData.id)
  
  try {
    // 如果包含状态变化信息，使用状态追踪更新
    if (taskData._statusChange) {
      const { from, to } = taskData._statusChange
      console.log('🔍 [TaskManager] 状态变化:', from, '->', to)
      await taskStore.updateTaskStatusWithTracking(taskData.id, to, from)
    } else {
      // 否则使用普通更新
      console.log('🔍 [TaskManager] 普通更新')
      await taskStore.updateTask(taskData.id, taskData)
    }
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
  // 切换视图时隐藏编辑面板
  handleHideEditPanel()
  // 这里可以添加视图模式切换的逻辑
  console.log('切换到视图模式:', mode)
}

const toggleCompletedTasks = () => {
  showCompletedTasks.value = !showCompletedTasks.value
}

// 编辑面板相关方法
const handleShowEditPanel = (task) => {
  selectedTask.value = task
  showEditPanel.value = true
}

const handleHideEditPanel = () => {
  showEditPanel.value = false
  selectedTask.value = null
}

// 分类信息方法
const getCategoryName = (category) => {
  const categoryNames = {
    inbox: t('categories.inbox'),
    today: t('categories.today'),
    doing: t('categories.doing'),
    paused: t('categories.paused'),
    planned: t('categories.planned'),
    all: t('categories.all'),
    completed: t('categories.completed')
  }
  return categoryNames[category] || t('categories.unknown')
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
  return taskStore.getCategoryCount(category)
}

// 新增：获取当前视图的标题、图标和计数
const getCurrentTitle = () => {
  if (currentListId.value !== null && currentList.value) {
    return currentList.value.name
  }
  return getCategoryName(currentCategory.value)
}

const getCurrentIcon = () => {
  if (currentList.value !== null && currentList.value) {
    return getListIconClass(currentList.value.icon)
  }
  return getCategoryIcon(currentCategory.value)
}

const getCurrentIconStyle = () => {
  if (currentListId.value !== null && currentList.value) {
    return { color: currentList.value.color }
  }
  return {}
}

// 彩蛋功能：连续点击5次显示任务详情表格
const handleEasterEggClick = () => {
  easterEggClickCount.value++
  
  // 清除之前的定时器
  if (easterEggTimer.value) {
    clearTimeout(easterEggTimer.value)
  }
  
  // 如果达到5次点击，显示模态框
  if (easterEggClickCount.value >= 5) {
    showTaskDetailsModal.value = true
    easterEggClickCount.value = 0
    return
  }
  
  // 2秒后重置点击计数
  easterEggTimer.value = setTimeout(() => {
    easterEggClickCount.value = 0
  }, 2000)
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

  let rect

  // 如果是直接传递的event和text参数（向后兼容）
  if (typeof data === 'object' && data.target) {
    rect = data.target.getBoundingClientRect()
  } else if (data.event && data.text) {
    // 处理从子组件传递的数据对象
    rect = data.event.target.getBoundingClientRect()
  } else {
    return
  }

  // 获取窗口尺寸
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight

  // 估算tooltip的尺寸（基于文本长度）
  const tooltipWidth = Math.min(300, Math.max(120, (data.text || text).length * 8))
  const tooltipHeight = 60 // 预估高度，支持多行

  // 计算最佳位置
  let left = rect.left + rect.width / 2
  let top = rect.top - 10
  let transform = 'translate(-50%, -100%)'

  // 水平位置调整
  if (left - tooltipWidth / 2 < 10) {
    // 左侧空间不足，左对齐
    left = rect.left
    transform = 'translate(0, -100%)'
  } else if (left + tooltipWidth / 2 > windowWidth - 10) {
    // 右侧空间不足，右对齐
    left = rect.right
    transform = 'translate(-100%, -100%)'
  }

  // 垂直位置调整
  if (top - tooltipHeight < 10) {
    // 上方空间不足，显示在下方
    top = rect.bottom + 10
    if (transform.includes('-100%')) {
      transform = transform.replace('-100%', '0')
    } else {
      transform = transform.replace('-100%', '0')
    }
  }

  tooltip.value = {
    show: true,
    text: data.text || text,
    style: {
      position: 'fixed',
      left: left + 'px',
      top: top + 'px',
      transform: transform,
      zIndex: 10000
    }
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}

const openSettings = () => {
  window.electronAPI.windows.showSettings()
}

// 最后更新时间缓存，用于检测数据变化
const lastUpdatedTime = ref(null)

// 智能加载任务（只有数据变化时才更新）
const smartLoadTasks = async () => {
  try {
    // 获取任务表的最新更新时间
    const timeResult = await window.electronAPI.tasks.getLastUpdatedTime()
    
    if (!timeResult.success) {
      console.error('获取最新更新时间失败:', timeResult.error)
      return
    }
    
    // 处理跨平台兼容性：将ISO字符串转换为Date对象
    const newLastUpdatedTime = timeResult.lastUpdatedTime ? new Date(timeResult.lastUpdatedTime) : null
    
    // 比较更新时间，只有数据真正变化时才更新
    const hasChanged = !lastUpdatedTime.value || 
                      !newLastUpdatedTime || 
                      newLastUpdatedTime.getTime() !== lastUpdatedTime.value.getTime()
    
    if (hasChanged) {
      console.log('🔄 检测到任务数据变化，更新界面', {
        oldTime: lastUpdatedTime.value?.toISOString(),
        newTime: newLastUpdatedTime?.toISOString()
      })
      
      // 获取最新任务数据并更新
      const result = await window.electronAPI.tasks.getAll()
      taskStore.setTasks(result)
      lastUpdatedTime.value = newLastUpdatedTime
    } else {
      console.log('✅ 任务数据无变化，跳过更新', {
        lastUpdated: newLastUpdatedTime?.toISOString()
      })
    }
  } catch (error) {
    console.error('❌ 智能加载任务失败:', error)
  }
}

// 生命周期
onMounted(async () => {
  // 加载清单和任务数据，以及自定义提醒选项
  await Promise.all([
    taskStore.getAllLists(),
    taskStore.loadCustomReminderOptions(),
    taskStore.getRecurringTasks(), // 加载重复任务数据
    loadTasks()
  ])

  // 初始化最后更新时间
  const timeResult = await window.electronAPI.tasks.getLastUpdatedTime()
  if (timeResult.success && timeResult.lastUpdatedTime) {
    lastUpdatedTime.value = new Date(timeResult.lastUpdatedTime)
  }

  // 监听任务和清单更新事件
  window.electronAPI.events.on('tasks-updated', loadTasks)
  window.electronAPI.events.on('lists-updated', () => {
    taskStore.getAllLists()
  })

  // 定时智能更新任务状态
  updateTimer.value = setInterval(() => {
    smartLoadTasks()
  }, 60000) // 每分钟检查一次
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

// 监听列表切换，关闭编辑面板
watch(() => taskStore.currentListId, () => {
  handleHideEditPanel()
})

// 监听语言变化，确保组件正确响应
watch(() => locale.value, (newLocale) => {
  console.log('TaskManager: 语言已切换到', newLocale)
  // Vue 的响应式系统会自动更新使用 t() 函数的文本
  // 这里可以添加其他需要在语言切换时执行的逻辑
})

// 不需要监听分类变化来重置状态，因为每个分类都有独立的状态
</script>

<style>
@import '@/assets/styles/components/task-manager.css';
</style>