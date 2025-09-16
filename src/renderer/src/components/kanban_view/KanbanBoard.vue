<template>
  <div class="kanban-board">
    <!-- 加载状态 -->
    <div v-if="loading" class="kanban-board-loading">
      <div class="kanban-board-container">
        <div v-for="status in ['todo', 'doing', 'paused', 'done']" :key="status" class="kanban-column">
          <div class="kanban-column-header">
            <div class="kanban-column-title">
              <div class="w-5 h-5 bg-muted animate-pulse rounded"></div>
              <div class="w-16 h-5 bg-muted animate-pulse rounded"></div>
            </div>
            <div class="w-8 h-6 bg-muted animate-pulse rounded-full"></div>
          </div>
          <div class="kanban-column-content space-y-3">
            <div v-for="i in 3" :key="i" class="kanban-card-skeleton">
              <div class="w-full h-4 bg-muted animate-pulse rounded mb-2"></div>
              <div class="w-3/4 h-3 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="kanban-error">
      <div class="kanban-error-content">
        <i class="fas fa-exclamation-triangle kanban-error-icon"></i>
        <h3 class="kanban-error-title">{{ t('common.error') }}</h3>
        <p class="kanban-error-message">{{ error }}</p>
        <button @click="error = null" class="kanban-error-button">
          {{ t('common.retry') }}
        </button>
      </div>
    </div>

    <!-- 看板内容 -->
    <div v-else class="kanban-board-container">
      <!-- 待办列 -->
      <KanbanColumn
        status="todo"
        :tasks="todoTasks"
        :can-add-task="true"
        :list-id="currentListId"
        :time-update-trigger="timeUpdateTrigger"
        :editing-task-id="editingTaskId"
        @task-dropped="debouncedTaskDrop"
        @add-task="handleAddTask"
        @card-click="handleCardClick"
        @card-edit="handleCardEdit"
      />

      <!-- 进行中列 -->
      <KanbanColumn
        status="doing"
        :tasks="doingTasks"
        :can-add-task="false"
        :list-id="currentListId"
        :time-update-trigger="timeUpdateTrigger"
        :editing-task-id="editingTaskId"
        @task-dropped="debouncedTaskDrop"
        @add-task="handleAddTask"
        @card-click="handleCardClick"
        @card-edit="handleCardEdit"
      />

      <!-- 暂停中列 -->
      <KanbanColumn
        status="paused"
        :tasks="pausedTasks"
        :can-add-task="false"
        :list-id="currentListId"
        :time-update-trigger="timeUpdateTrigger"
        :editing-task-id="editingTaskId"
        @task-dropped="debouncedTaskDrop"
        @add-task="handleAddTask"
        @card-click="handleCardClick"
        @card-edit="handleCardEdit"
      />

      <!-- 已完成列 -->
      <KanbanColumn
        status="done"
        :tasks="doneTasks"
        :can-add-task="false"
        :list-id="currentListId"
        :time-update-trigger="timeUpdateTrigger"
        :editing-task-id="editingTaskId"
        @task-dropped="debouncedTaskDrop"
        @add-task="handleAddTask"
        @card-click="handleCardClick"
        @card-edit="handleCardEdit"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted, onMounted } from 'vue'
import KanbanColumn from './KanbanColumn.vue'
import { useI18n } from 'vue-i18n'

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
  currentListId: {
    type: Number,
    default: null
  },
  editingTaskId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['add-task', 'update-task', 'edit-task', 'show-edit-panel'])

const { t } = useI18n()

const error = ref(null)
const isUpdating = ref(false)
const dragTimeout = ref(null)

// 时间更新定时器和响应式更新触发器
let timeUpdateTimer = null
const timeUpdateTrigger = ref(0)

// 防抖处理拖拽操作
const debouncedTaskDrop = (dropData) => {
  if (dragTimeout.value) {
    clearTimeout(dragTimeout.value)
  }
  
  dragTimeout.value = setTimeout(() => {
    handleTaskDropped(dropData)
  }, 100) // 100ms 防抖
}

// 按状态分组任务（优化：使用单次遍历）
const taskGroups = computed(() => {
  const groups = {
    todo: [],
    doing: [],
    paused: [],
    done: []
  }
  
  // 单次遍历分组，提高性能
  for (const task of props.tasks) {
    if (groups[task.status]) {
      groups[task.status].push(task)
    }
  }
  
  return groups
})

const todoTasks = computed(() => taskGroups.value.todo)
const doingTasks = computed(() => taskGroups.value.doing)
const pausedTasks = computed(() => taskGroups.value.paused)
const doneTasks = computed(() => taskGroups.value.done)

// 事件处理
const handleTaskDropped = async (dropData) => {
  const { taskId, fromStatus, toStatus } = dropData
  console.log('🔍 [KanbanBoard] 处理拖拽事件:', dropData)
  console.log('🔍 [KanbanBoard] 任务ID:', taskId, '类型:', typeof taskId)
  
  if (isUpdating.value) return // 防止重复操作
  
  try {
    isUpdating.value = true
    error.value = null
    
    // 找到要移动的任务
    console.log('🔍 [KanbanBoard] 在任务列表中查找任务...')
    console.log('🔍 [KanbanBoard] 任务列表长度:', props.tasks.length)
    console.log('🔍 [KanbanBoard] 前3个任务的ID:', props.tasks.slice(0, 3).map(t => ({ id: t.id, type: typeof t.id })))
    
    const task = props.tasks.find(t => t.id === taskId)
    console.log('🔍 [KanbanBoard] 找到的任务:', task)
    
    if (!task) {
      console.error('🔍 [KanbanBoard] 未找到任务，所有任务ID:', props.tasks.map(t => t.id))
      throw new Error('未找到要移动的任务')
    }

    // 发出更新事件，让父组件处理具体的状态管理逻辑
    const updateData = {
      id: taskId,
      status: toStatus,
      _statusChange: {
        from: fromStatus,
        to: toStatus
      }
    }
    
    console.log('🔍 [KanbanBoard] 发送更新事件:', updateData)
    emit('update-task', updateData)
  } catch (err) {
    console.error('移动任务失败:', err)
    error.value = err.message || '移动任务失败，请重试'
    
    // 显示错误提示（可以使用 toast 或其他提示方式）
    if (window.electronAPI && window.electronAPI.showErrorDialog) {
      window.electronAPI.showErrorDialog('移动任务失败', err.message)
    }
  } finally {
    isUpdating.value = false
  }
}

const handleAddTask = async (taskData) => {
  try {
    error.value = null
    emit('add-task', taskData)
  } catch (err) {
    console.error('添加任务失败:', err)
    error.value = err.message || '添加任务失败，请重试'
  }
}

const handleCardClick = (task) => {
  emit('show-edit-panel', task)
}

const handleCardEdit = (task) => {
  emit('edit-task', task)
}

// 启动时间更新定时器和滚动条交互
onMounted(() => {
  timeUpdateTimer = setInterval(() => {
    const hasDoingTasks = props.tasks.some(task => task.status === 'doing')
    if (hasDoingTasks) {
      timeUpdateTrigger.value++
    }
  }, 1000)

  // 添加滚动条交互
  const kanbanContainer = document.querySelector('.kanban-board-container')
  const columnContents = document.querySelectorAll('.kanban-column-content')
  
  // 处理水平滚动条
  if (kanbanContainer) {
    let scrollTimeout
    kanbanContainer.addEventListener('scroll', () => {
      kanbanContainer.classList.add('scrolling')
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        kanbanContainer.classList.remove('scrolling')
      }, 1000)
    })
  }
  
  // 处理垂直滚动条
  columnContents.forEach(content => {
    let scrollTimeout
    content.addEventListener('scroll', () => {
      content.classList.add('scrolling')
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        content.classList.remove('scrolling')
      }, 1000)
    })
  })
})

// 清理函数
const cleanup = () => {
  if (dragTimeout.value) {
    clearTimeout(dragTimeout.value)
    dragTimeout.value = null
  }
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
    timeUpdateTimer = null
  }
}

// 组件卸载时清理
onUnmounted(() => {
  cleanup()
})
</script>

<style>
@import '@/assets/styles/components/kanban-board.css';
</style>