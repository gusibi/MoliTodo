<template>
  <div class="task-list-container">
    <!-- 悬浮的添加任务输入框 -->
    <div class="task-list-floating-add">
      <div class="task-list-add-input-container">
        <input
          ref="addTaskInput"
          v-model="newTaskContent"
          type="text"
          placeholder="添加新任务..."
          class="task-list-add-input"
          @keyup.enter="handleAddTask"
          @blur="handleInputBlur"
        />
        <button 
          v-if="newTaskContent.trim()"
          class="task-list-add-btn"
          @click="handleAddTask"
          title="添加任务"
        >
          <i class="fas fa-plus"></i>
        </button>
      </div>
    </div>

    <!-- 任务列表内容区域 -->
    <div class="task-list-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="task-list-loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载中...</span>
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="tasks.length === 0" class="task-list-empty-state">
        <div class="task-list-empty-icon">
          <i :class="searchQuery ? 'fas fa-search' : 'fas fa-tasks'"></i>
        </div>
        <div class="task-list-empty-text">{{ searchQuery ? '未找到匹配的任务' : '暂无任务' }}</div>
        <div v-if="searchQuery" class="task-list-empty-suggestion">
          <p>尝试：</p>
          <ul>
            <li>使用不同的关键词</li>
            <li>检查搜索选项设置</li>
            <li>清除搜索条件查看所有任务</li>
          </ul>
        </div>
        <div v-else class="task-list-empty-hint">
          在上方输入框中输入任务内容并按回车键添加任务
        </div>
      </div>
      
      <!-- 任务列表 -->
      <div v-else class="task-list-items">
        <TaskItem
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :is-selected="selectedTasks.includes(task.id)"
          :search-query="searchQuery"
          :current-duration="getCurrentDuration(task)"
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
  'select-task',
  'edit-task',
  'show-tooltip',
  'hide-tooltip'
])

// 新任务输入相关
const newTaskContent = ref('')
const addTaskInput = ref(null)

// 时间更新定时器和响应式更新触发器
let timeUpdateTimer = null
const timeUpdateTrigger = ref(0)

// 处理添加任务
const handleAddTask = () => {
  const content = newTaskContent.value.trim()
  if (content) {
    emit('add-task', { content })
    newTaskContent.value = ''
    // 保持输入框焦点
    setTimeout(() => {
      addTaskInput.value?.focus()
    }, 100)
  }
}

// 处理输入框失焦
const handleInputBlur = () => {
  // 可以在这里添加失焦时的逻辑，比如自动保存草稿等
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
  emit('edit-task', task)
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