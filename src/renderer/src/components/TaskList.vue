<template>
  <div class="task-list-container">
    <!-- 添加任务区域 -->
    <TaskEdit :task="editingTask" :is-editing="isEditingTask" @add-task="handleAddTask" @update-task="handleUpdateTask"
      @cancel-edit="handleCancelEdit" />

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
            <li>• 设置截止日期和提醒</li>
            <li>• 开始高效管理您的时间</li>
          </ul>
        </div>
        <div class="task-list-empty-hint">
          💡 提示：您可以使用快捷键 Ctrl+N (Windows) 或 Cmd+N (Mac) 快速添加任务
        </div>
      </div>

      <!-- 任务列表 -->
      <div v-else class="task-list-items">
        <!-- 按清单分组展示 -->
        <div v-for="group in groupedTasks" :key="group.id" class="task-group">
          <!-- 清单标题 - 只在非清单视图中显示 -->
          <div v-if="!isInListView" class="task-group-header">
            <div class="task-group-title">
              <i :class="getListIconClass(group.icon)" :style="{ color: group.color }"></i>
              <span>{{ group.name }}</span>
              <span class="task-group-count">({{ group.tasks.length }})</span>
            </div>
          </div>

          <!-- 该清单下的任务 -->
          <div class="task-group-items">
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
  if (!props.tasks || props.tasks.length === 0) {
    return []
  }

  // 创建分组对象
  const groups = {}

  props.tasks.forEach(task => {
    const listId = task.listId || 0
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
  startTimeUpdateTimer()
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopTimeUpdateTimer()
})
</script>

<style>
@import '../assets/styles/components/task-list.css';
</style>