<template>
  <div class="task-list-container">
    <!-- 添加任务区域 -->
    <TaskEdit ref="taskEditRef" :task="editingTask" :is-editing="isEditingTask" @add-task="handleAddTask"
      @update-task="handleUpdateTask" @cancel-edit="handleCancelEdit" />

    <!-- 任务列表内容区域 -->
    <div class="task-list-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="task-list-loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!tasks || tasks.length === 0" class="task-list-empty-state">
        <div class="task-list-empty-icon">📝</div>
        <div class="task-list-empty-text">暂无任务</div>
        <div class="task-list-empty-suggestion">
          <p>开始创建您的第一个任务吧！</p>
          <ul>
            <li>• 点击上方输入框添加任务</li>
            <li>• 使用 <kbd>Ctrl + Enter</kbd> 创建任务</li>
            <li>• 设置截止日期和提醒</li>
            <li>• 开始高效管理您的时间</li>
          </ul>
        </div>
        <div class="task-list-empty-hint">
          💡 提示：您可以使用快捷键 {{ getShortcutText() }} 快速添加任务
        </div>
      </div>

      <!-- 任务列表 -->
      <div v-else class="task-list-items">
        <!-- 控制按钮区域 -->
        <div v-if="!isInListView && (hasMultipleGroups || taskStore.recurringTasks.length > 0)" class="task-list-controls">
          <div class="task-list-controls-buttons">
            <!-- 全部展开/折叠控制 - 只在非清单视图且有多个分组时显示 -->
            <template v-if="hasMultipleGroups">
              <button @click="expandAllGroups" class="task-list-control-btn"
                :title="`全部展开 (${getShortcutText('expand')})`">
                <i class="fas fa-expand-alt"></i>
                全部展开
              </button>
              <button @click="collapseAllGroups" class="task-list-control-btn"
                :title="`全部折叠 (${getShortcutText('collapse')})`">
                <i class="fas fa-compress-alt"></i>
                全部折叠
              </button>
            </template>
            
            <!-- 重复任务实例显示控制 -->
            <!-- <button v-if="taskStore.recurringTasks.length > 0" @click="toggleRecurringInstances" class="task-list-control-btn task-list-recurring-toggle" :class="{ 'active': taskStore.showRecurringInstances }">
              <i class="fas fa-repeat"></i>
              {{ taskStore.showRecurringInstances ? '隐藏重复实例' : '显示重复实例' }}
            </button> -->
            
            <!-- <div v-if="collapsedGroups.size > 0" class="task-list-collapse-indicator">
              {{ collapsedGroups.size }} 个分组已折叠
            </div> -->
          </div>
        </div>

        <!-- 按清单分组展示 -->
        <div v-for="group in groupedTasks" :key="group.id" class="task-group">
          <!-- 清单标题 - 只在非清单视图中显示 -->
          <div v-if="!isInListView" class="task-group-header" @click.stop="toggleGroupCollapse(group.id)">
            <div class="task-group-title">
              <div class="task-group-info">
                <i :class="getListIconClass(group.icon)" :style="{ color: group.color }"></i>
                <span :style="{ color: group.color }">{{ group.name }}</span>
                <span class="task-group-count">({{ group.tasks.length }})</span>
              </div>
              <i class="task-group-collapse-icon"
                :class="collapsedGroups.has(group.id) ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"
                :title="collapsedGroups.has(group.id) ? '展开' : '折叠'"></i>
            </div>
          </div>

          <!-- 清单标题 - 在清单视图中显示（不可折叠），只在有多个分组时显示 -->
          <div v-else-if="isInListView && groupedTasks.length > 1" class="task-group-header-static">
            <div class="task-group-title">
              <div class="task-group-info">
                <i :class="getListIconClass(group.icon)" :style="{ color: group.color }"></i>
                <span>{{ group.name }}</span>
                <span class="task-group-count">({{ group.tasks.length }})</span>
              </div>
            </div>
          </div>

          <!-- 该清单下的任务 -->
          <div class="task-group-items"
            :class="{ 'task-group-collapsed': !isInListView && collapsedGroups.has(group.id) }">
            <TaskItem v-for="task in group.tasks" :key="task.id" :task="task"
              :current-duration="getCurrentDuration(task)" :is-editing="isEditingTask && editingTask?.id === task.id"
              @edit="handleTaskEdit" @show-tooltip="handleShowTooltip" @hide-tooltip="handleHideTooltip" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TaskItem from './TaskItem.vue'
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

// TaskEdit组件引用
const taskEditRef = ref(null)

// 折叠状态管理
const collapsedGroups = ref(new Set())

// 从本地存储加载折叠状态
const loadCollapsedState = () => {
  try {
    const saved = localStorage.getItem('taskList-collapsedGroups')
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
    localStorage.setItem('taskList-collapsedGroups', JSON.stringify(collapsedArray))
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
  // 获取展开后的任务
  const allTasks =  props.tasks
  
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

// 添加任务处理
const handleAddTask = (taskData) => {
  emit('add-task', taskData)
}

// 获取任务当前持续时间
const getCurrentDuration = (task) => {
  // 使用timeUpdateTrigger来触发响应式更新
  timeUpdateTrigger.value // 这行代码确保函数依赖于响应式变量

  if (task.status !== 'doing' || !task.startedAt) return 0
  return Date.now() - new Date(task.startedAt).getTime() + (task.totalDuration || 0)
}

// 任务编辑处理
const handleTaskEdit = (task) => {
  // 如果任务已完成，不允许编辑
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

// Tooltip 处理
const handleShowTooltip = (data) => {
  emit('show-tooltip', data)
}

const handleHideTooltip = () => {
  emit('hide-tooltip')
}

// 快捷键处理
const handleKeydown = (event) => {
  // 检查是否按下了 Ctrl+N (Windows/Linux) 或 Cmd+N (Mac)
  const isCtrlOrCmd = event.ctrlKey || event.metaKey

  if (isCtrlOrCmd && event.key === 'n') {
    event.preventDefault() // 阻止浏览器默认行为
    focusAddTaskInput()
  }

  // Ctrl/Cmd + E: 展开所有分组 (只在非清单视图中)
  if (isCtrlOrCmd && event.key === 'e' && hasMultipleGroups.value && !isInListView.value) {
    event.preventDefault()
    expandAllGroups()
  }

  // Ctrl/Cmd + Shift + E: 折叠所有分组 (只在非清单视图中)
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

// 防抖处理，避免快速点击导致的问题
let toggleTimeout = null
const isToggling = ref(false)

// 切换清单组折叠状态
const toggleGroupCollapse = (groupId) => {
  // 在清单视图中不允许折叠
  if (isInListView.value) {
    return
  }

  // 防止在动画过程中重复触发
  if (isToggling.value) {
    return
  }

  isToggling.value = true

  if (collapsedGroups.value.has(groupId)) {
    collapsedGroups.value.delete(groupId)
  } else {
    collapsedGroups.value.add(groupId)
  }

  // 触发响应式更新
  collapsedGroups.value = new Set(collapsedGroups.value)
  // 保存状态
  saveCollapsedState()

  // 等待动画完成后重置状态
  setTimeout(() => {
    isToggling.value = false
  }, 300) // 与 CSS 动画时长匹配
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

// 切换重复任务实例显示
const toggleRecurringInstances = () => {
  taskStore.toggleRecurringInstances()
}

// 计算属性：是否有多个分组
const hasMultipleGroups = computed(() => groupedTasks.value.length > 1)

// 启动时间更新定时器
const startTimeUpdateTimer = () => {
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
  }

  timeUpdateTimer = setInterval(() => {
    // 检查是否有进行中的任务，如果有则触发重新渲染
    const hasDoingTasks = props.tasks.some(task => task.status === 'doing')
    if (hasDoingTasks) {
      // 通过修改响应式变量来触发getCurrentDuration的重新计算
      timeUpdateTrigger.value++
    }
  }, 1000) // 每秒更新一次
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
  // 确保清单数据已加载
  if (taskStore.lists.length === 0) {
    await taskStore.getAllLists()
  }

  // 加载折叠状态
  loadCollapsedState()

  startTimeUpdateTimer()

  // 添加快捷键监听器
  document.addEventListener('keydown', handleKeydown)
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopTimeUpdateTimer()

  // 重置切换状态
  isToggling.value = false

  // 移除快捷键监听器
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style>
@import '../assets/styles/components/task-list.css';
</style>