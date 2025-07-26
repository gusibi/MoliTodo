<template>
  <div class="task-list-container">
    <!-- 添加任务区域 -->
    <TaskEdit 
      :task="editingTask"
      :is-editing="isEditingTask"
      @add-task="handleAddTask"
      @update-task="handleUpdateTask"
      @cancel-edit="handleCancelEdit"
    />

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
        <TaskItem
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :is-selected="selectedTasks.includes(task.id)"
          :current-duration="getCurrentDuration(task)"
          :is-editing="isEditingTask && editingTask?.id === task.id"
          @select="handleTaskSelect"
          @edit="handleTaskEdit"
          @show-tooltip="handleShowTooltip"
          @hide-tooltip="handleHideTooltip"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import TaskItem from './TaskItem.vue'
import TaskEdit from './TaskEdit.vue'

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
  },
  selectedTasks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'add-task',
  'update-task',
  'select-task',
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

// 任务选择处理
const handleTaskSelect = (taskId, event) => {
  emit('select-task', taskId, event)
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
onMounted(() => {
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