<template>
  <div class="flat-task-list-container">
    <!-- 添加任务区域 -->
    <TaskEdit ref="taskEditRef" :task="editingTask" :is-editing="isEditingTask" @add-task="handleAddTask"
      @update-task="handleUpdateTask" @cancel-edit="handleCancelEdit" />

    <!-- 任务列表内容区域 -->
    <div class="flat-task-list-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="flat-task-list-loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!tasks || tasks.length === 0" class="flat-task-list-empty-state">
        <div class="flat-task-list-empty-icon">📝</div>
        <div class="flat-task-list-empty-text">暂无任务</div>
        <div class="flat-task-list-empty-suggestion">
          <p>开始创建您的第一个任务吧！</p>
          <ul>
            <li>• 点击上方输入框添加任务</li>
            <li>• 使用 <kbd>Ctrl + Enter</kbd> 创建任务</li>
            <li>• 设置截止日期和提醒</li>
            <li>• 开始高效管理您的时间</li>
          </ul>
        </div>
        <div class="flat-task-list-empty-hint">
          💡 提示：您可以使用快捷键 {{ getShortcutText() }} 快速添加任务
        </div>
      </div>

      <!-- 扁平化任务列表 -->
      <div v-else class="flat-task-list-items">
        <!-- 按清单分组展示 -->
        <div v-for="group in groupedTasks" :key="group.id" class="flat-task-group">
          <!-- 清单标题 - 只在非清单视图中显示 -->
          <div v-if="!isInListView" class="flat-task-group-header" @click.stop="toggleGroupCollapse(group.id)">
            <div class="flat-task-group-title">
              <div class="flat-task-group-info">
                <i :class="getListIconClass(group.icon)" :style="{ color: group.color }"></i>
                <span :style="{ color: group.color }">{{ group.name }}</span>
                <span class="flat-task-group-count">({{ group.tasks.length }})</span>
              </div>
              <i class="flat-task-group-collapse-icon"
                :class="collapsedGroups.has(group.id) ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"
                :title="collapsedGroups.has(group.id) ? '展开' : '折叠'"></i>
            </div>
          </div>

          <!-- 清单标题 - 在清单视图中显示（不可折叠），只在有多个分组时显示 -->
          <div v-else-if="isInListView && groupedTasks.length > 1" class="flat-task-group-header-static">
            <div class="flat-task-group-title">
              <div class="flat-task-group-info">
                <i :class="getListIconClass(group.icon)" :style="{ color: group.color }"></i>
                <span>{{ group.name }}</span>
                <span class="flat-task-group-count">({{ group.tasks.length }})</span>
              </div>
            </div>
          </div>

          <!-- 该清单下的任务 - 扁平化列表 -->
          <ul class="flat-task-group-items"
            :class="{ 'flat-task-group-collapsed': !isInListView && collapsedGroups.has(group.id) }">
            <div v-for="task in group.tasks" :key="task.id" class="flat-task-item-wrapper">
              <!-- 状态指示小红点 -->
              <div class="flat-task-status-indicator"
                :class="{
                  'flat-task-status-todo': task.status === 'todo',
                  'flat-task-status-doing': task.status === 'doing' && !isTaskOvertime(task),
                  'flat-task-status-overtime': task.status === 'doing' && isTaskOvertime(task),
                  'flat-task-status-paused': task.status === 'paused',
                  'flat-task-status-done': task.status === 'done'
                }">
              </div>
              
              <li class="flat-task-item"
                @dblclick="!isEditingTask && handleTaskEdit(task)"
                @mouseenter="hoveredTaskId = task.id"
                @mouseleave="hoveredTaskId = null">
                
                <!-- 任务左侧部分（包含勾选框和文本） -->
                <div class="flat-task-left">
                  <!-- 圆形勾选框 -->
                <div class="flat-task-checkbox">
                  <input type="checkbox" :id="`flat-task-${task.id}`" :checked="task.status === 'done'"
                    @change="handleToggleComplete(task)" @click.stop />
                  <label :for="`flat-task-${task.id}`" class="flat-checkbox-label"></label>
                </div>
                
                <!-- 任务详情 -->
                <div class="flat-task-details">
                  <div class="flat-task-title" v-html="getHighlightedContent(task)"></div>
                  <div v-if="task.description" class="flat-task-description">{{ task.description }}</div>
                </div>
              </div>

              <!-- 任务右侧标签和操作 - 单行水平对齐 -->
              <div class="flat-task-right">
                <!-- 任务操作按钮 - 悬浮时显示 -->
                <button v-show="hoveredTaskId === task.id || (isEditingTask && editingTask?.id === task.id)" v-if="task.status === 'todo'" class="flat-task-btn flat-task-btn-start"
                  @click.stop="handleStartTask(task)" title="开始">
                  <i class="fas fa-play"></i>
                </button>
                <button v-show="hoveredTaskId === task.id || (isEditingTask && editingTask?.id === task.id)" v-if="task.status === 'doing'" class="flat-task-btn flat-task-btn-pause"
                  @click.stop="handlePauseTask(task)" title="暂停">
                  <i class="fas fa-pause"></i>
                </button>
                <button v-show="hoveredTaskId === task.id || (isEditingTask && editingTask?.id === task.id)" v-if="task.status === 'paused'" class="flat-task-btn flat-task-btn-resume"
                  @click.stop="handleResumeTask(task)" title="继续">
                  <i class="fas fa-play"></i>
                </button>
                <button v-show="hoveredTaskId === task.id || (isEditingTask && editingTask?.id === task.id)" v-if="task.status === 'done'" class="flat-task-btn flat-task-btn-restart"
                  @click.stop="handleRestartTask(task)" title="重新开始">
                  <i class="fas fa-redo"></i>
                </button>
                <button v-show="hoveredTaskId === task.id || (isEditingTask && editingTask?.id === task.id)" v-if="task.status !== 'done'" class="flat-task-btn flat-task-btn-edit" @click.stop="handleTaskEdit(task)"
                  title="编辑">
                  <i class="fas fa-edit"></i>
                </button>
                <button v-show="hoveredTaskId === task.id || (isEditingTask && editingTask?.id === task.id)" class="flat-task-btn flat-task-btn-delete" @click.stop="handleDeleteTask(task)" title="删除">
                  <i class="fas fa-trash"></i>
                </button>

             

                <!-- 提醒时间 -->
                <div class="flat-task-reminder-time" v-if="task.reminderTime" :class="{
                  'flat-task-time-overdue': new Date(task.reminderTime) < new Date() && task.status !== 'done'
                }">
                  <i class="fas fa-calendar"></i>
                  <span>{{ formatReminderTime(task.reminderTime) }}</span>
                </div>
                
                <!-- 进行时间 -->
                <div v-if="task.status === 'doing' && !isTaskOvertime(task)" class="flat-task-time flat-task-time-doing">
                  <i class="fas fa-play"></i>
                  <span>{{ formatDuration(getCurrentDuration(task)) }}</span>
                </div>
                <div v-else-if="task.status === 'doing' && isTaskOvertime(task)" class="flat-task-time flat-task-time-overtime">
                  <i class="fas fa-clock"></i>
                  <span>{{ formatDuration(getCurrentDuration(task)) }}</span>
                </div>
                <div v-else-if="task.status === 'paused'" class="flat-task-time flat-task-time-paused">
                  <i class="fas fa-pause"></i>
                  <span>{{ formatDuration(task.totalDuration || 0) }}</span>
                </div>
                <div v-else-if="task.status === 'done' && task.totalDuration" class="flat-task-time flat-task-time-completed">
                  <i class="fas fa-check"></i>
                  <span>{{ formatDuration(task.totalDuration) }}</span>
                </div>
              </div>
              </li>
            </div>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TaskEdit from './TaskEdit.vue'
import { useTaskStore } from '@/store/taskStore'

// 定义 props
const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'add-task',
  'update-task',
  'edit-task',
  'show-tooltip',
  'hide-tooltip'
])

// 编辑状态管理
const editingTask = ref(null)
const isEditingTask = ref(false)
const hoveredTaskId = ref(null)

// TaskEdit组件引用
const taskEditRef = ref(null)

// 折叠状态管理
const collapsedGroups = ref(new Set())

// 从本地存储加载折叠状态
const loadCollapsedState = () => {
  try {
    const saved = localStorage.getItem('flatTaskList-collapsedGroups')
    if (saved) {
      const collapsedArray = JSON.parse(saved)
      collapsedGroups.value = new Set(collapsedArray)
    }
  } catch (error) {
    console.warn('加载折叠状态失败:', error)
  }
}

// 保存折叠状态到本地存储
const saveCollapsedState = () => {
  try {
    const collapsedArray = Array.from(collapsedGroups.value)
    localStorage.setItem('flatTaskList-collapsedGroups', JSON.stringify(collapsedArray))
  } catch (error) {
    console.warn('保存折叠状态失败:', error)
  }
}

// 时间更新定时器和响应式更新触发器
let timeUpdateTimer = null
const timeUpdateTrigger = ref(0)

// 使用任务存储
const taskStore = useTaskStore()

// 计算属性：是否在清单视图中
const isInListView = computed(() => taskStore.currentListId !== null)

// 获取清单图标类名
const getListIconClass = (icon) => {
  const iconMap = {
    'list': 'fas fa-list',
    'inbox': 'fas fa-inbox',
    'star': 'fas fa-star',
    'heart': 'fas fa-heart',
    'bookmark': 'fas fa-bookmark',
    'flag': 'fas fa-flag',
    'folder': 'fas fa-folder',
    'briefcase': 'fas fa-briefcase',
    'home': 'fas fa-home',
    'user': 'fas fa-user',
    'calendar': 'fas fa-calendar',
    'clock': 'fas fa-clock',
    'target': 'fas fa-bullseye',
    'trophy': 'fas fa-trophy',
    'book': 'fas fa-book',
    'music': 'fas fa-music'
  }
  return iconMap[icon] || 'fas fa-list'
}

// 按 list 分组任务
const groupedTasks = computed(() => {
  const allTasks = props.tasks
  
  if (!allTasks || allTasks.length === 0) {
    return []
  }

  // 创建分组对象
  const groups = {}

  allTasks.forEach(task => {
    const listId = task.listId || task.list_id || 0
    const list = taskStore.getListById(listId)
    const listName = list ? list.name : '未知清单'
    const listIcon = list ? list.icon : 'list'
    const listColor = list ? list.color : '#007AFF'

    if (!groups[listId]) {
      groups[listId] = {
        id: listId,
        name: listName,
        icon: listIcon,
        color: listColor,
        tasks: []
      }
    }

    groups[listId].tasks.push(task)
  })

  // 转换为数组并排序
  return Object.values(groups).sort((a, b) => {
    // 默认清单排在最前面
    if (a.id === 0) return -1
    if (b.id === 0) return 1
    return a.name.localeCompare(b.name)
  })
})

// 计算属性：是否有多个分组
const hasMultipleGroups = computed(() => groupedTasks.value.length > 1)

// 获取任务当前持续时间
const getCurrentDuration = (task) => {
  timeUpdateTrigger.value // 触发响应式更新
  if (task.status !== 'doing' || !task.startedAt) return 0
  return Date.now() - new Date(task.startedAt).getTime() + (task.totalDuration || 0)
}

// 判断任务是否超时
const isTaskOvertime = (task) => {
  if (task.status !== 'doing' || !task.startedAt) return false
  const currentDuration = getCurrentDuration(task)
  return currentDuration > 2 * 60 * 60 * 1000 // 超过2小时
}

// 获取高亮内容
const getHighlightedContent = (task) => {
  if (!props.searchQuery) return task.content
  const regex = new RegExp(`(${props.searchQuery})`, 'gi')
  return task.content.replace(regex, '<mark>$1</mark>')
}



// 格式化提醒时间
const formatReminderTime = (reminderTime) => {
  const date = new Date(reminderTime)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  const diffDays = Math.floor((taskDate - today) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays === 1) {
    return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays === -1) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
}

// 格式化创建时间
const formatCreatedTime = (createdAt) => {
  const date = new Date(createdAt)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? '刚刚' : `${diffMinutes}分钟前`
    }
    return `${diffHours}小时前`
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

// 格式化持续时间
const formatDuration = (duration) => {
  if (!duration) return '0分钟'
  
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  }
  return `${minutes}分钟`
}

// 获取重复任务提示
const getRecurrenceTooltip = (recurrence) => {
  const typeMap = {
    'daily': '每日重复',
    'weekly': '每周重复',
    'monthly': '每月重复',
    'yearly': '每年重复'
  }
  return typeMap[recurrence.type] || '重复任务'
}

// 任务操作方法
const handleToggleComplete = async (task) => {
  try {
    if (task.status === 'done') {
      // 如果已完成，重新开始任务
      await taskStore.updateTask(task.id, { status: 'todo', completedAt: null })
    } else {
      // 如果未完成，标记为完成
      await taskStore.completeTask(task.id)
    }
  } catch (error) {
    console.error('切换任务完成状态失败:', error)
  }
}

const handleStartTask = async (task) => {
  try {
    console.log('开始任务 - 当前状态:', task.status, '任务ID:', task.id)
    await taskStore.startTask(task.id)
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const handlePauseTask = async (task) => {
  try {
    console.log('暂停任务 - 当前状态:', task.status, '任务ID:', task.id)
    await taskStore.pauseTask(task.id)
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const handleResumeTask = async (task) => {
  try {
    console.log('继续任务 - 当前状态:', task.status, '任务ID:', task.id)
    await taskStore.startTask(task.id) // resume 实际上就是重新开始
  } catch (error) {
    console.error('继续任务失败:', error)
  }
}

const handleCompleteTask = async (task) => {
  try {
    await taskStore.completeTask(task.id)
  } catch (error) {
    console.error('完成任务失败:', error)
  }
}

const handleRestartTask = async (task) => {
  try {
    await taskStore.updateTask(task.id, {
      status: 'todo',
      completedAt: null,
      startTime: null,
      totalDuration: 0
    })
  } catch (error) {
    console.error('重新开始任务失败:', error)
  }
}

const handleDeleteTask = async (task) => {
  if (confirm('确定要删除这个任务吗？')) {
    try {
      await taskStore.deleteTask(task.id)
    } catch (error) {
      console.error('删除任务失败:', error)
    }
  }
}

// 添加任务处理
const handleAddTask = (taskData) => {
  emit('add-task', taskData)
}

// 任务编辑处理
const handleTaskEdit = (task) => {
  if (task.status === 'done') {
    return
  }
  editingTask.value = task
  isEditingTask.value = true
}

// 更新任务处理
const handleUpdateTask = (taskData) => {
  emit('update-task', taskData)
  handleCancelEdit()
}

// 取消编辑处理
const handleCancelEdit = () => {
  editingTask.value = null
  isEditingTask.value = false
}

// 快捷键处理
const handleKeydown = (event) => {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey

  if (isCtrlOrCmd && event.key === 'n') {
    event.preventDefault()
    focusAddTaskInput()
  }

  if (isCtrlOrCmd && event.key === 'e' && hasMultipleGroups.value && !isInListView.value) {
    event.preventDefault()
    expandAllGroups()
  }

  if (isCtrlOrCmd && event.shiftKey && event.key === 'E' && hasMultipleGroups.value && !isInListView.value) {
    event.preventDefault()
    collapseAllGroups()
  }
}

// 聚焦到添加任务输入框
const focusAddTaskInput = () => {
  if (taskEditRef.value && taskEditRef.value.focusInput) {
    taskEditRef.value.focusInput()
  }
}

// 获取快捷键文本
const getShortcutText = (type = 'add') => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'Cmd' : 'Ctrl'

  switch (type) {
    case 'add':
      return `${cmdKey}+N`
    case 'expand':
      return `${cmdKey}+E`
    case 'collapse':
      return `${cmdKey}+Shift+E`
    default:
      return `${cmdKey}+N`
  }
}

// 切换清单组折叠状态
const toggleGroupCollapse = (groupId) => {
  if (isInListView.value) {
    return
  }

  if (collapsedGroups.value.has(groupId)) {
    collapsedGroups.value.delete(groupId)
  } else {
    collapsedGroups.value.add(groupId)
  }

  collapsedGroups.value = new Set(collapsedGroups.value)
  saveCollapsedState()
}

// 全部展开
const expandAllGroups = () => {
  collapsedGroups.value.clear()
  saveCollapsedState()
}

// 全部折叠
const collapseAllGroups = () => {
  const allGroupIds = groupedTasks.value.map(group => group.id)
  collapsedGroups.value = new Set(allGroupIds)
  saveCollapsedState()
}

// 启动时间更新定时器
const startTimeUpdateTimer = () => {
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
  }

  timeUpdateTimer = setInterval(() => {
    const hasDoingTasks = props.tasks.some(task => task.status === 'doing')
    if (hasDoingTasks) {
      timeUpdateTrigger.value++
    }
  }, 1000)
}

// 停止时间更新定时器
const stopTimeUpdateTimer = () => {
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
    timeUpdateTimer = null
  }
}

// 组件挂载时启动定时器
onMounted(async () => {
  if (taskStore.lists.length === 0) {
    await taskStore.getAllLists()
  }

  loadCollapsedState()
  startTimeUpdateTimer()
  document.addEventListener('keydown', handleKeydown)
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopTimeUpdateTimer()
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style>
@import '../assets/styles/components/flat-task-list.css';
</style>