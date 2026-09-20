<template>
  <div :class="[
    'kanban-column',
    { 'kanban-column--drag-over': isDragOver }
  ]" @dragover.prevent="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop">
    <!-- 列头部 -->
    <div class="kanban-column-header">
      <div class="kanban-column-title">
        <component :is="columnConfig.icon" class="kanban-column-icon h-icon-md w-icon-md"
          :class="`kanban-column-icon--${status}`" aria-hidden="true" />
        <span>{{ columnConfig.title }}</span>
      </div>
      <div class="kanban-column-count">
        {{ tasks.length }}
      </div>
    </div>

    <!-- 列内容 -->
    <div class="kanban-column-content">
      <!-- 任务列表 -->
      <TransitionGroup v-if="tasks.length > 0" name="kanban-card" tag="div" class="space-y-3">
        <KanbanCard v-for="task in tasks" :key="task.id" :task="task" 
          :time-update-trigger="timeUpdateTrigger"
          :is-editing="editingTaskId === task.id"
          @drag-start="handleCardDragStart"
          @drag-end="handleCardDragEnd" @click="handleCardClick" @edit="handleCardEdit"
          @delete-request="(payload) => emit('delete-request', payload)" />
      </TransitionGroup>

      <!-- 空状态 -->
      <div v-else class="kanban-column-empty">
        <div class="text-center">
          <component :is="columnConfig.icon" class="h-icon-lg w-icon-lg mb-2 opacity-50" aria-hidden="true" />
          <p>{{ t('kanban.noTasks') }}</p>
        </div>
      </div>
    </div>

    <!-- 添加任务 -->
    <KanbanAddTask v-if="canAddTask" :status="status" :list-id="listId" @add-task="handleAddTask" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { CircleCheck, CirclePause, CirclePlay, Inbox } from '@lucide/vue'
import KanbanCard from './KanbanCard.vue'
import KanbanAddTask from './KanbanAddTask.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  status: {
    type: String,
    required: true,
    validator: (value) => ['todo', 'doing', 'paused', 'done'].includes(value)
  },
  tasks: {
    type: Array,
    default: () => []
  },
  canAddTask: {
    type: Boolean,
    default: false
  },
  listId: {
    type: Number,
    default: null
  },
  timeUpdateTrigger: {
    type: Number,
    default: 0
  },
  editingTaskId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['task-dropped', 'add-task', 'card-click', 'card-edit', 'delete-request'])

const { t } = useI18n()

const isDragOver = ref(false)
const draggedTask = ref(null)

// 列配置
const columnConfigs = {
  todo: {
    title: t('kanban.todo'),
    icon: Inbox,
    color: 'blue'
  },
  doing: {
    title: t('kanban.doing'),
    icon: CirclePlay,
    color: 'orange'
  },
  paused: {
    title: t('kanban.paused'),
    icon: CirclePause,
    color: 'yellow'
  },
  done: {
    title: t('kanban.done'),
    icon: CircleCheck,
    color: 'green'
  }
}

const columnConfig = computed(() => {
  return columnConfigs[props.status] || columnConfigs.todo
})

// 拖拽处理
const handleDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  isDragOver.value = true
}

const handleDragLeave = (event) => {
  // 只有当离开整个列时才取消高亮
  if (!event.currentTarget.contains(event.relatedTarget)) {
    isDragOver.value = false
  }
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false

  try {
    const taskData = JSON.parse(event.dataTransfer.getData('application/json'))
    console.log('🔍 [KanbanColumn] 接收到拖拽数据:', taskData)
    console.log('🔍 [KanbanColumn] 任务ID:', taskData.taskId, '类型:', typeof taskData.taskId)

    // 如果任务已经在当前列，不需要移动
    if (taskData.status === props.status) {
      console.log('🔍 [KanbanColumn] 任务已在当前列，跳过移动')
      return
    }

    const dropData = {
      taskId: taskData.taskId,  // 修正：使用 taskId 字段
      fromStatus: taskData.status,
      toStatus: props.status
    }
    
    console.log('🔍 [KanbanColumn] 发送拖拽事件:', dropData)
    emit('task-dropped', dropData)
  } catch (error) {
    console.error('处理拖拽数据失败:', error)
  }
}

// 卡片事件处理
const handleCardDragStart = (task) => {
  draggedTask.value = task
}

const handleCardDragEnd = () => {
  draggedTask.value = null
}

const handleCardClick = (task) => {
  emit('card-click', task)
}

const handleCardEdit = (task) => {
  emit('card-edit', task)
}

const handleAddTask = (taskData) => {
  emit('add-task', taskData)
}


</script>

<style>
@import '@/assets/styles/components/kanban-board.css';
</style>