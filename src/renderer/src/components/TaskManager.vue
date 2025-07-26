<template>
  <div class="task-manager">
    <!-- 左侧边栏 - 半透明毛玻璃效果 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="user-profile">
          <div class="user-avatar">
            <i class="fas fa-user"></i>
          </div>
          <span class="user-name">MoliTodo</span>
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-item" @click="handleAddTask">
            <i class="fas fa-plus-circle"></i>
            <span>添加任务</span>
          </div>
          <div class="nav-item" @click="focusSearch">
            <i class="fas fa-search"></i>
            <span>搜索</span>
          </div>
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
        
        <div class="nav-section">
          <div class="nav-item" @click="openSettings">
            <i class="fas fa-cog"></i>
            <span>设置</span>
          </div>
        </div>
      </nav>
    </aside>

    <!-- 主要内容区域 -->
    <main class="main-content">
      <header class="content-header">
        <h1>{{ getCategoryTitle() }}</h1>
        <div class="header-actions">
          <button class="btn-icon" @click="refreshTasks" title="刷新">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button class="btn-icon" @click="handleAddTask" title="添加任务">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </header>

      <!-- 搜索区域 -->
      <div class="search-section" v-if="searchQuery || showSearchOptions">
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索任务内容、状态或日期..." 
            @keyup.escape="clearSearch"
            @keydown.enter="performSearch"
            @input="handleSearchInput"
            ref="searchInput"
          />
          <button v-if="searchQuery" class="clear-search" @click="clearSearch">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- 搜索选项 -->
        <div class="search-options" v-if="searchQuery">
          <label class="search-option">
            <input type="checkbox" v-model="searchOptions.content" />
            <span>内容</span>
          </label>
          <label class="search-option">
            <input type="checkbox" v-model="searchOptions.status" />
            <span>状态</span>
          </label>
          <label class="search-option">
            <input type="checkbox" v-model="searchOptions.date" />
            <span>日期</span>
          </label>
          <label class="search-option">
            <input type="checkbox" v-model="searchOptions.caseSensitive" />
            <span>区分大小写</span>
          </label>
        </div>
        
        <!-- 搜索结果统计 -->
        <div v-if="searchQuery" class="search-results-info">
          <span class="search-query">搜索 "{{ searchQuery }}"</span>
          <span class="search-count">找到 {{ displayTasks.length }} 个结果</span>
          <button class="btn btn-sm btn-secondary" @click="clearSearch">清除搜索</button>
        </div>
      </div>

      <!-- 任务列表 -->
      <div class="task-list-container">
        <div v-if="loading" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <span>加载中...</span>
        </div>
        
        <div v-else-if="displayTasks.length === 0" class="empty-state">
          <div class="empty-icon">
            <i :class="searchQuery ? 'fas fa-search' : 'fas fa-tasks'"></i>
          </div>
          <div class="empty-text">{{ searchQuery ? '未找到匹配的任务' : '暂无任务' }}</div>
          <div v-if="searchQuery" class="empty-suggestion">
            <p>尝试：</p>
            <ul>
              <li>使用不同的关键词</li>
              <li>检查搜索选项设置</li>
              <li>清除搜索条件查看所有任务</li>
            </ul>
          </div>
          <button v-else class="btn btn-primary" @click="handleAddTask">
            <i class="fas fa-plus"></i>
            添加第一个任务
          </button>
        </div>
        
        <div v-else class="task-list">
          <div v-for="task in displayTasks" :key="task.id" 
               :class="['task-row', {
                 completed: task.status === 'done',
                 'in-progress': task.status === 'doing',
                 'paused': task.status === 'paused',
                 selected: selectedTasks.includes(task.id)
               }]" 
               @click="selectTask(task.id, $event)" 
               @dblclick="handleEditTask(task)" 
               @mouseenter="hoveredTask = task.id"
               @mouseleave="hoveredTask = null">
            
            <button class="task-expand" v-if="task.description">
              <i class="fas fa-chevron-right"></i>
            </button>
            <div class="task-expand-placeholder" v-else></div>
            
            <div class="task-checkbox">
              <input type="checkbox" 
                     :id="`task-${task.id}`"
                     :checked="task.status === 'done'" 
                     @change="toggleTaskComplete(task)"
                     @click.stop />
              <label :for="`task-${task.id}`"></label>
            </div>
            
            <div class="task-info">
              <div class="task-title" v-html="highlightSearchTerm(task.content)"></div>
              <div class="task-description" v-if="task.description">{{ task.description }}</div>
              <div class="task-tags">
                <!-- 状态标签 -->
                <span v-if="task.status === 'doing'" class="tag tag-status tag-doing">
                  <i class="fas fa-play"></i>
                  进行中 {{ formatDuration(getTaskCurrentDuration(task)) }}
                </span>
                <span v-else-if="task.status === 'paused'" class="tag tag-status tag-paused">
                  <i class="fas fa-pause"></i>
                  暂停中 {{ formatDuration(task.totalDuration || 0) }}
                </span>
                <span v-else-if="task.status === 'done'" class="tag tag-status tag-completed">
                  <i class="fas fa-check"></i>
                  用时 {{ formatDuration(task.totalDuration || 0) }}
                </span>
                
                <!-- 时间标签 -->
                <span v-if="task.reminderTime" 
                      class="tag tag-reminder tooltip-container" 
                      @mouseenter="showTooltip($event, `提醒时间: ${formatReminderTime(task.reminderTime)}`)"
                      @mouseleave="hideTooltip">
                  <i class="fas fa-calendar"></i>
                  {{ formatReminderTime(task.reminderTime) }}
                </span>
                <span v-else-if="task.createdAt" 
                      class="tag tag-created tooltip-container"
                      @mouseenter="showTooltip($event, `创建时间: ${formatCreatedTime(task.createdAt)}`)"
                      @mouseleave="hideTooltip">
                  <i class="fas fa-clock"></i>
                  {{ formatCreatedTime(task.createdAt) }}
                </span>
                
                <!-- 完成时间标签 -->
                <span v-if="task.completedAt" class="tag tag-completed-time">
                  <i class="fas fa-check-circle"></i>
                  {{ formatCompletedTime(task.completedAt) }}
                </span>
              </div>
            </div>
            
            <!-- 任务操作按钮 - 悬浮时显示 -->
            <div v-show="hoveredTask === task.id || selectedTasks.includes(task.id)" class="task-actions">
              <button v-if="task.status === 'todo'" class="btn-action btn-start" @click.stop="startTask(task.id)" title="开始">
                <i class="fas fa-play"></i>
              </button>
              <button v-if="task.status === 'doing'" class="btn-action btn-pause" @click.stop="pauseTask(task.id)" title="暂停">
                <i class="fas fa-pause"></i>
              </button>
              <button v-if="task.status === 'paused'" class="btn-action btn-resume" @click.stop="resumeTask(task.id)" title="继续">
                <i class="fas fa-play"></i>
              </button>
              <button v-if="task.status === 'doing' || task.status === 'paused'" class="btn-action btn-complete" @click.stop="completeTask(task.id)" title="完成">
                <i class="fas fa-check"></i>
              </button>
              <button v-if="task.status === 'done'" class="btn-action btn-restart" @click.stop="restartTask(task.id)" title="重新开始">
                <i class="fas fa-redo"></i>
              </button>
              <button class="btn-action btn-edit" @click.stop="handleEditTask(task)" title="编辑">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-action btn-delete" @click.stop="deleteTask(task.id)" title="删除">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <button class="add-task-row" @click="handleAddTask">
            <i class="fas fa-plus"></i>
            <span>添加任务</span>
          </button>
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
          <span class="stats-label">暂停中:</span>
          <span class="stats-value">{{ getPausedCount() }}</span>
        </div>
        <div class="stats-item">
          <span class="stats-label">总耗时:</span>
          <span class="stats-value">{{ getTotalDuration() }}</span>
        </div>
      </div>
    </main>

    <!-- 添加任务模态框 -->
    <div v-if="showAddModal" class="modal-overlay show" @click="showAddModal = false">
      <div class="modal modal-content" @click.stop>
        <h3>添加新任务</h3>
        <input v-model="newTaskContent" type="text" placeholder="输入任务内容..." @keyup.enter="addTask" ref="taskInput" />
        <div class="modal-actions">
          <button class="btn btn-primary" @click="addTask">添加</button>
          <button class="btn btn-secondary" @click="showAddModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 编辑任务模态框 -->
    <div v-if="showEditModal" class="modal-overlay show" @click="showEditModal = false">
      <div class="modal modal-content" @click.stop>
        <h3>编辑任务</h3>
        <input v-model="editTaskContent" type="text" placeholder="输入任务内容..." @keyup.enter="saveEditTask"
          ref="editInput" />
        <div class="modal-actions">
          <button class="btn btn-primary" @click="saveEditTask">保存</button>
          <button class="btn btn-secondary" @click="showEditModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 自定义 Tooltip -->
    <div v-if="tooltip.show" class="custom-tooltip" :style="tooltip.style">
      {{ tooltip.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const taskStore = useTaskStore()
const currentCategory = ref('inbox')
const showAddModal = ref(false)
const showEditModal = ref(false)
const newTaskContent = ref('')
const editTaskContent = ref('')
const editingTaskId = ref(null)
const taskInput = ref(null)
const editInput = ref(null)
const searchInput = ref(null)
const allTasks = ref([])
const updateTimer = ref(null)
const searchQuery = ref('')
const searchOptions = ref({
  content: true,
  status: true,
  date: false,
  caseSensitive: false
})
const selectedTasks = ref([])
const hoveredTask = ref(null)

const showSearchOptions = ref(false)

// Tooltip 相关
const tooltip = ref({
  show: false,
  text: '',
  style: {}
})

const loading = computed(() => taskStore.loading)

const filteredTasks = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  switch (currentCategory.value) {
    case 'inbox':
      return allTasks.value.filter(task => 
        task.status === 'todo' && !task.reminderTime
      )
    case 'today':
      return allTasks.value.filter(task => {
        if (task.status === 'done') return false
        
        // 今天创建的任务
        const createdAt = new Date(task.createdAt)
        createdAt.setHours(0, 0, 0, 0)
        const isCreatedToday = createdAt.getTime() === today.getTime()
        
        // 今天需要处理的任务（提醒时间是今天）
        const hasReminderToday = task.reminderTime && 
          new Date(task.reminderTime) >= today && 
          new Date(task.reminderTime) < tomorrow
        
        // 正在进行或暂停的任务也显示在今天
        const isActiveTask = task.status === 'doing' || task.status === 'paused'
        
        return isCreatedToday || hasReminderToday || isActiveTask
      })
    case 'doing':
      return allTasks.value.filter(task => task.status === 'doing')
    case 'paused':
      return allTasks.value.filter(task => task.status === 'paused')
    case 'planned':
      return allTasks.value.filter(task => {
        if (task.status !== 'todo' || !task.reminderTime) return false
        
        // 计划中包含所有有提醒时间的待办任务
        const reminderDate = new Date(task.reminderTime)
        reminderDate.setHours(0, 0, 0, 0)
        
        // 包括今天及以后的计划任务
        return reminderDate.getTime() >= today.getTime()
      })
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
    const query = searchOptions.value.caseSensitive 
      ? searchQuery.value.trim() 
      : searchQuery.value.toLowerCase().trim()
    
    tasks = tasks.filter(task => {
      let matches = false
      
      // 搜索任务内容
      if (searchOptions.value.content) {
        const content = searchOptions.value.caseSensitive 
          ? task.content 
          : task.content.toLowerCase()
        if (content.includes(query)) {
          matches = true
        }
        
        // 也搜索描述（如果存在）
        if (task.description) {
          const description = searchOptions.value.caseSensitive 
            ? task.description 
            : task.description.toLowerCase()
          if (description.includes(query)) {
            matches = true
          }
        }
      }
      
      // 搜索任务状态
      if (searchOptions.value.status) {
        const statusText = getStatusText(task.status || (task.completed ? 'completed' : 'todo'))
        const status = searchOptions.value.caseSensitive 
          ? statusText 
          : statusText.toLowerCase()
        if (status.includes(query)) {
          matches = true
        }
      }
      
      // 搜索日期
      if (searchOptions.value.date) {
        // 搜索创建日期
        if (task.createdAt) {
          const createdDate = new Date(task.createdAt).toLocaleDateString('zh-CN')
          if (createdDate.includes(query)) {
            matches = true
          }
        }
        
        // 搜索完成日期
        if (task.completedAt) {
          const completedDate = new Date(task.completedAt).toLocaleDateString('zh-CN')
          if (completedDate.includes(query)) {
            matches = true
          }
        }
        
        // 搜索提醒时间
        if (task.reminderTime) {
          const reminderDate = new Date(task.reminderTime).toLocaleDateString('zh-CN')
          if (reminderDate.includes(query)) {
            matches = true
          }
        }
      }
      
      return matches
    })
  }

  return tasks
})

const getCategoryCount = (category) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  switch (category) {
    case 'inbox':
      return allTasks.value.filter(task => 
        task.status === 'todo' && !task.reminderTime
      ).length
    case 'today':
      return allTasks.value.filter(task => {
        if (task.status === 'done') return false
        
        // 今天创建的任务
        const createdAt = new Date(task.createdAt)
        createdAt.setHours(0, 0, 0, 0)
        const isCreatedToday = createdAt.getTime() === today.getTime()
        
        // 今天需要处理的任务（提醒时间是今天）
        const hasReminderToday = task.reminderTime && 
          new Date(task.reminderTime) >= today && 
          new Date(task.reminderTime) < tomorrow
        
        // 正在进行或暂停的任务也显示在今天
        const isActiveTask = task.status === 'doing' || task.status === 'paused'
        
        return isCreatedToday || hasReminderToday || isActiveTask
      }).length
    case 'doing':
      return allTasks.value.filter(task => task.status === 'doing').length
    case 'paused':
      return allTasks.value.filter(task => task.status === 'paused').length
    case 'planned':
      return allTasks.value.filter(task => {
        if (task.status !== 'todo' || !task.reminderTime) return false
        
        // 计划中包含所有有提醒时间的待办任务
        const reminderDate = new Date(task.reminderTime)
        reminderDate.setHours(0, 0, 0, 0)
        
        // 包括今天及以后的计划任务
        return reminderDate.getTime() >= today.getTime()
      }).length
    case 'completed':
      return allTasks.value.filter(task => task.status === 'done').length
    case 'all':
      return allTasks.value.filter(task => task.status !== 'done').length
    default:
      return 0
  }
}

const getCategoryTitle = () => {
  const titles = {
    'inbox': '收件箱',
    'today': '今天',
    'doing': '进行中',
    'paused': '暂停中',
    'planned': '计划中',
    'all': '所有任务',
    'completed': '已完成'
  }
  return titles[currentCategory.value] || '任务管理'
}

const switchCategory = (category) => {
  currentCategory.value = category
  selectedTasks.value = []
  searchQuery.value = ''
}

const handleAddTask = () => {
  console.log('handleAddTask called')
  showAddModal.value = true
  console.log('showAddModal set to:', showAddModal.value)
}

const handleEditTask = (task) => {
  console.log('handleEditTask called with task:', task)
  editingTaskId.value = task.id
  editTaskContent.value = task.content
  showEditModal.value = true
  console.log('showEditModal set to:', showEditModal.value)
}

const focusSearch = () => {
  showSearchOptions.value = true
  nextTick(() => {
    if (searchInput.value) {
      searchInput.value.focus()
    }
  })
}

const openSettings = async () => {
  console.log('openSettings called')
  try {
    console.log('Calling window.electronAPI.windows.showSettings()')
    await window.electronAPI.windows.showSettings()
    console.log('showSettings() call completed successfully')
  } catch (error) {
    console.error('打开设置窗口失败:', error)
  }
}

const refreshTasks = async () => {
  await loadTasks()
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

// 窗口控制方法已移至 TaskManagerView

// 统计函数
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

// 原来的 editTask 方法已经被 handleEditTask 替代

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

const resumeTask = async (taskId) => {
  try {
    await taskStore.startTask(taskId)
    await loadTasks()
    // 重新启动定时器以切换到每秒更新
    startUpdateTimer()
  } catch (error) {
    console.error('继续任务失败:', error)
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

// Tooltip 相关方法
const showTooltip = (event, text) => {
  const rect = event.target.getBoundingClientRect()
  tooltip.value = {
    show: true,
    text: text,
    style: {
      position: 'fixed',
      left: `${rect.left + rect.width / 2}px`,
      top: `${rect.top - 35}px`,
      transform: 'translateX(-50%)',
      zIndex: 1000
    }
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
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

// 搜索相关方法
const handleSearchInput = () => {
  // 实时搜索，可以添加防抖逻辑
  // 这里暂时直接触发搜索
}

const performSearch = () => {
  // 按回车键执行搜索（当前是实时搜索，所以这里可以为空或添加其他逻辑）
  if (searchInput.value) {
    searchInput.value.blur() // 失去焦点
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  // 重置搜索选项为默认值
  searchOptions.value = {
    content: true,
    status: true,
    date: false,
    caseSensitive: false
  }
  // 可选：重新聚焦搜索框
  if (searchInput.value) {
    searchInput.value.focus()
  }
}

const highlightSearchTerm = (text) => {
  if (!searchQuery.value.trim() || !searchOptions.value.content) {
    return text
  }
  
  const query = searchQuery.value.trim()
  const flags = searchOptions.value.caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(`(${escapeRegExp(query)})`, flags)
  return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const getStatusText = (status) => {
  const statusMap = {
    'todo': '待办',
    'doing': '进行中', 
    'completed': '已完成',
    'done': '已完成'
  }
  return statusMap[status] || '待办'
}

// 键盘快捷键处理
const handleKeydown = (event) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'n':
        event.preventDefault()
        handleAddTask()
        break
      case 'f':
        event.preventDefault()
        if (searchInput.value) {
          searchInput.value.focus()
          searchInput.value.select()
        }
        break
    }
  } else {
    switch (event.key) {
      case 'Escape':
        if (searchQuery.value) {
          clearSearch()
        } else {
          selectedTasks.value = []
        }
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
/* TaskManager 组件样式 - 参考现代项目管理工具设计 */

.task-manager {
  display: flex;
  flex-direction: row; /* 确保水平布局 */
  height: 100%;
  background: var(--bg-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

/* 左侧边栏 - 半透明毛玻璃效果 */
.sidebar {
  width: 280px;
  background: rgba(248, 249, 250, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

[data-theme="dark"] .sidebar {
  background: rgba(30, 30, 30, 0.8);
  border-right-color: rgba(255, 255, 255, 0.08);
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .sidebar-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-nav {
  flex: 1;
  padding: 0;
}

.nav-section {
  padding: 0 16px;
  margin-bottom: 24px;
}

.nav-section:last-child {
  margin-top: auto;
  margin-bottom: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 16px;
}

[data-theme="dark"] .nav-section:last-child {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  margin-bottom: 2px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  color: #6b7280;
  position: relative;
}

.nav-item:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #374151;
}

[data-theme="dark"] .nav-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #d1d5db;
}

.nav-item.active {
  background: #3b82f6;
  color: white;
  font-weight: 500;
}

.nav-item i {
  width: 16px;
  font-size: 14px;
  text-align: center;
}

.nav-item span {
  flex: 1;
}

.count {
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.nav-item.active .count {
  color: rgba(255, 255, 255, 0.9);
}

[data-theme="dark"] .nav-item {
  color: #9ca3af;
}

[data-theme="dark"] .nav-item:hover {
  color: #d1d5db;
}

[data-theme="dark"] .count {
  background: rgba(255, 255, 255, 0.1);
  color: #9ca3af;
}

/* 主内容区 - 不透明纯色背景 */
.main-content {
  flex: 1;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

[data-theme="dark"] .main-content {
  background: #1f2937;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .content-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.content-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #374151;
}

[data-theme="dark"] .btn-icon {
  color: #9ca3af;
}

[data-theme="dark"] .btn-icon:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #d1d5db;
}

/* 搜索区域 */
.search-section {
  padding: 16px 32px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: #f9fafb;
}

[data-theme="dark"] .search-section {
  background: #111827;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #9ca3af;
  z-index: 1;
}

.search-box input {
  width: 100%;
  padding: 10px 40px 10px 36px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.search-box input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

[data-theme="dark"] .search-box input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

[data-theme="dark"] .search-box input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.clear-search {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.clear-search:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #6b7280;
}

[data-theme="dark"] .clear-search:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #d1d5db;
}

/* 搜索选项 */
.search-options {
  display: flex;
  gap: var(--spacing-lg);
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) 0;
}

.search-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.search-option input[type="checkbox"] {
  margin: 0;
  width: 14px;
  height: 14px;
}

.search-option:hover {
  color: var(--text-primary);
}

/* 搜索结果统计 */
.search-results-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.search-query {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.search-count {
  color: var(--text-secondary);
}

/* 搜索高亮 */
.search-highlight {
  background: rgba(255, 235, 59, 0.3);
  color: var(--text-primary);
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: var(--font-weight-medium);
}

/* 深色主题下的搜索高亮 */
[data-theme="dark"] .search-highlight {
  background: rgba(255, 193, 7, 0.2);
  color: var(--text-primary);
}

/* 空状态建议 */
.empty-suggestion {
  margin-top: var(--spacing-md);
  text-align: left;
}

.empty-suggestion p {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-xs);
}

.empty-suggestion ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.empty-suggestion li {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  padding: 2px 0;
  position: relative;
  padding-left: var(--spacing-md);
}

.empty-suggestion li::before {
  content: '•';
  color: var(--color-primary);
  position: absolute;
  left: 0;
}

/* 任务列表容器 */
.task-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  padding-bottom: 60px; /* 为统计栏留出空间 */
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  color: #6b7280;
  gap: 12px;
}

.loading-state i {
  font-size: 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  color: #d1d5db;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 18px;
  color: #6b7280;
  margin-bottom: 24px;
}

.empty-suggestion {
  margin-top: 16px;
  text-align: left;
  max-width: 300px;
}

.empty-suggestion p {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 8px;
}

.empty-suggestion ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.empty-suggestion li {
  color: #9ca3af;
  font-size: 14px;
  padding: 2px 0;
  position: relative;
  padding-left: 16px;
}

.empty-suggestion li::before {
  content: '•';
  color: #3b82f6;
  position: absolute;
  left: 0;
}

/* 任务列表 */
.task-list {
  padding: 0;
}

.task-row {
  display: flex;
  align-items: flex-start;
  padding: 12px 32px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.task-row:hover {
  background: rgba(0, 0, 0, 0.02);
}

.task-row.selected {
  background: rgba(59, 130, 246, 0.05);
}

.task-row.completed {
  opacity: 0.6;
}

.task-row.in-progress {
  background: rgba(245, 158, 11, 0.05);
  border-left: 3px solid #f59e0b;
}

.task-row.paused {
  background: rgba(107, 114, 128, 0.05);
  border-left: 3px solid #6b7280;
}

[data-theme="dark"] .task-row {
  border-bottom-color: rgba(255, 255, 255, 0.04);
}

[data-theme="dark"] .task-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

[data-theme="dark"] .task-row.selected {
  background: rgba(59, 130, 246, 0.1);
}

.task-expand,
.task-expand-placeholder {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  margin-right: 8px;
  margin-top: 2px;
}

.task-expand:hover {
  color: #6b7280;
}

.task-checkbox {
  margin-right: 12px;
  margin-top: 2px;
}

.task-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
}

.task-checkbox label {
  cursor: pointer;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 4px;
  word-wrap: break-word;
}

.task-description {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.3;
  margin-bottom: 8px;
}

.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
}

.tag i {
  font-size: 10px;
}

.tag-status {
  color: white;
}

.tag-doing {
  background: #f59e0b;
}

.tag-paused {
  background: #6b7280;
}

.tag-completed {
  background: #10b981;
}

.tag-reminder {
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
  font-weight: 500;
  border: 1px solid rgba(59, 130, 246, 0.2);
  cursor: help;
  transition: all 0.2s ease;
}

.tag-reminder:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.tag-created {
  background: rgba(107, 114, 128, 0.08);
  color: #9ca3af;
  font-size: 11px;
  opacity: 0.8;
  cursor: help;
  transition: all 0.2s ease;
}

.tag-created:hover {
  background: rgba(107, 114, 128, 0.12);
  opacity: 1;
  transform: translateY(-1px);
}

.tag-completed-time {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.task-actions {
  display: flex;
  gap: 4px;
  margin-left: 12px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.task-row:hover .task-actions,
.task-row.selected .task-actions {
  opacity: 1;
}

.btn-action {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s ease;
}

.btn-start {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.btn-start:hover {
  background: rgba(16, 185, 129, 0.2);
}

.btn-pause {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.btn-pause:hover {
  background: rgba(245, 158, 11, 0.2);
}

.btn-resume {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.btn-resume:hover {
  background: rgba(59, 130, 246, 0.2);
}

.btn-complete {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.btn-complete:hover {
  background: rgba(16, 185, 129, 0.2);
}

.btn-restart {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.btn-restart:hover {
  background: rgba(107, 114, 128, 0.2);
}

.btn-edit {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.btn-edit:hover {
  background: rgba(59, 130, 246, 0.2);
}

.btn-delete {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.2);
}

.add-task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
}

.add-task-row:hover {
  background: rgba(0, 0, 0, 0.02);
  color: #374151;
}

[data-theme="dark"] .add-task-row:hover {
  background: rgba(255, 255, 255, 0.02);
  color: #d1d5db;
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

/* 统计信息条 */
.stats-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 32px;
  background: #f9fafb;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 13px;
  z-index: 10;
}

[data-theme="dark"] .stats-bar {
  background: #111827;
  border-top-color: rgba(255, 255, 255, 0.08);
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stats-label {
  color: #6b7280;
}

.stats-value {
  color: var(--text-primary);
  font-weight: 600;
}

/* 模态框样式 - 覆盖全局样式 */
.task-manager .modal-overlay {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5) !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
  z-index: 9999 !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto;
}

.task-manager .modal {
  background: white !important;
  border-radius: 12px;
  padding: 24px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  position: relative;
  z-index: 10000;
  transform: scale(1) !important;
}

[data-theme="dark"] .task-manager .modal {
  background: #374151 !important;
}

.task-manager .modal h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.task-manager .modal input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 20px;
  background: white;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.task-manager .modal input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

[data-theme="dark"] .task-manager .modal input {
  background: #4b5563;
  border-color: #6b7280;
  color: #f9fafb;
}

[data-theme="dark"] .task-manager .modal input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.task-manager .modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.task-manager .btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.task-manager .btn-primary {
  background: #3b82f6;
  color: white;
}

.task-manager .btn-primary:hover {
  background: #2563eb;
}

.task-manager .btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.task-manager .btn-secondary:hover {
  background: #e5e7eb;
}

[data-theme="dark"] .task-manager .btn-secondary {
  background: #4b5563;
  color: #d1d5db;
}

[data-theme="dark"] .task-manager .btn-secondary:hover {
  background: #6b7280;
}

.task-manager .btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

/* 自定义 Tooltip 样式 */
.custom-tooltip {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  animation: tooltip-fade-in 0.2s ease-out;
}

.custom-tooltip::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

@keyframes tooltip-fade-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

[data-theme="dark"] .custom-tooltip {
  background: rgba(255, 255, 255, 0.95);
  color: #1f2937;
}

[data-theme="dark"] .custom-tooltip::before {
  border-top-color: rgba(255, 255, 255, 0.95);
}
</style>