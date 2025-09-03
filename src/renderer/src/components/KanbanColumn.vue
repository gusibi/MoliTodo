<template>
  <div :class="[
    'kanban-column',
    { 'kanban-column--drag-over': isDragOver }
  ]" @dragover.prevent="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop">
    <!-- 列头部 -->
    <div class="kanban-column-header">
      <div class="kanban-column-title">
        <i :class="[columnConfig.icon, 'kanban-column-icon', `kanban-column-icon--${status}`]"></i>
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
          @drag-start="handleCardDragStart"
          @drag-end="handleCardDragEnd" @click="handleCardClick" @edit="handleCardEdit" />
      </TransitionGroup>

      <!-- 空状态 -->
      <div v-else class="kanban-column-empty">
        <div class="text-center">
          <i :class="columnConfig.icon" class="text-2xl mb-2 opacity-50"></i>
          <p>{{ getEmptyMessage() }}</p>
        </div>
      </div>
    </div>

    <!-- 添加任务 -->
    <KanbanAddTask v-if="canAddTask" :status="status" :list-id="listId" @add-task="handleAddTask" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import KanbanCard from './KanbanCard.vue'
import KanbanAddTask from './KanbanAddTask.vue'

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
  }
})

const emit = defineEmits(['task-dropped', 'add-task', 'card-click', 'card-edit'])

const isDragOver = ref(false)
const draggedTask = ref(null)

// 列配置
const columnConfigs = {
  todo: {
    title: '待办',
    icon: 'fas fa-inbox',
    color: 'blue'
  },
  doing: {
    title: '进行中',
    icon: 'fas fa-play-circle',
    color: 'orange'
  },
  paused: {
    title: '暂停中',
    icon: 'fas fa-pause-circle',
    color: 'yellow'
  },
  done: {
    title: '已完成',
    icon: 'fas fa-check-circle',
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

    // 如果任务已经在当前列，不需要移动
    if (taskData.status === props.status) {
      return
    }

    emit('task-dropped', {
      taskId: taskData.id,
      fromStatus: taskData.status,
      toStatus: props.status
    })
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

// 获取空状态消息
const getEmptyMessage = () => {
  const messages = {
    todo: '暂无待办任务',
    doing: '暂无进行中任务',
    paused: '暂无暂停任务',
    done: '暂无已完成任务'
  }
  return messages[props.status] || '暂无任务'
}
</script>

<style>
@import '@/assets/styles/components/kanban-board.css';
</style>