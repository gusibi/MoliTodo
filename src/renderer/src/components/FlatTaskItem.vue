<template>
  <div class="flat-task-item-wrapper">
    <li class="flat-task-item" :class="{
      'flat-task-item-completed': task.status === 'done',
      'flat-task-item-editing': isEditing,
      'flat-task-item-hovered': isHovered,
      'flat-task-item-dragging': isDragging,
      'flat-task-item-selected': isSelected
    }" 
    @click="handleTaskClick" 
    @mouseenter="$emit('mouseenter')" 
    @mouseleave="$emit('mouseleave')"
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd">

      <!-- 状态指示小红点 -->
      <div class="flat-task-status-indicator" :class="{
        'flat-task-status-todo': task.status === 'todo',
        'flat-task-status-doing': task.status === 'doing' && !isTaskOvertime(task),
        'flat-task-status-overtime': task.status === 'doing' && isTaskOvertime(task),
        'flat-task-status-paused': task.status === 'paused',
        'flat-task-status-done': task.status === 'done'
      }">
      </div>

      <!-- 任务左侧部分（包含勾选框和文本） -->
      <div class="flat-task-left">
        <!-- 多选模式下且显示选择复选框时 -->
        <div v-if="showSelectCheckbox" class="flat-task-select-checkbox" @click.stop>
          <input 
            type="checkbox" 
            :id="`select-task-${task.id}`" 
            :checked="isSelected"
            @change="$emit('select-change')"
          />
          <label :for="`select-task-${task.id}`" class="flat-select-checkbox-label"></label>
        </div>
        <!-- 圆形勾选框 - 默认显示完成状态 -->
        <div v-else class="flat-task-checkbox">
          <input type="checkbox" :id="`flat-task-${task.id}`" :checked="task.status === 'done'"
            @change="handleToggleComplete" @click.stop />
          <label :for="`flat-task-${task.id}`" class="flat-checkbox-label" @click.stop></label>
        </div>

        <!-- 任务详情 -->
        <div class="flat-task-details">
          <div class="flat-task-title" v-html="getHighlightedContent(task)"></div>
          <div v-if="task.metadata?.note" class="flat-task-description" v-html="getHighlightedNote(task)"></div>

          <!-- 时间信息 -->
          <div class="flat-task-time-info">
            <!-- 重复任务图标（模板或实例） -->
            <div v-if="task.recurrence || task.seriesId" class="flat-task-recurring-icon">
              <i class="fas fa-repeat"></i>
            </div>
            
            <!-- 安排 / 截止时间 -->
            <div class="flat-task-reminder-time" v-if="formatTaskTimeInfo(task)" :class="{
              'flat-task-time-overdue': isTaskTimeOverdue(task)
            }">
              <i class="fas fa-calendar"></i>
              <span>{{ formatTaskTimeInfo(task) }}</span>
            </div>

            <!-- 附加徽标（分组原因 / 重复任务等） -->
            <span v-for="(badge, index) in badges" :key="index" class="flat-task-badge"
              :class="badge.tone ? `flat-task-badge-${badge.tone}` : ''">
              {{ badge.text }}
            </span>

            <!-- 进行时间 -->
            <div v-if="task.status === 'doing' && !isTaskOvertime(task)" class="flat-task-time flat-task-time-doing">
              <i class="fas fa-play"></i>
              <span>{{ formatDuration(getCurrentDurationWithTrigger(task)) }}</span>
            </div>
            <div v-else-if="task.status === 'doing' && isTaskOvertime(task)"
              class="flat-task-time flat-task-time-overtime">
              <i class="fas fa-clock"></i>
              <span>{{ formatDuration(getCurrentDurationWithTrigger(task)) }}</span>
            </div>
            <div v-else-if="task.status === 'paused'" class="flat-task-time flat-task-time-paused">
              <i class="fas fa-pause"></i>
              <span>{{ formatDuration(task.totalDuration || 0) }}</span>
            </div>
            <div v-else-if="task.status === 'done' && task.totalDuration"
              class="flat-task-time flat-task-time-completed">
              <i class="fas fa-check"></i>
              <span>{{ formatDuration(task.totalDuration) }}</span>
            </div>

          </div>
        </div>
      </div>

      <!-- 任务右侧标签和操作 - 单行水平对齐 -->
      <div class="flat-task-right">
        <!-- 任务操作按钮 -->
        <button v-if="task.status === 'todo'" class="flat-task-btn flat-task-btn-start" @click.stop="handleStartTask"
          title="开始">
          <i class="fas fa-play"></i>
        </button>
        <button v-if="task.status === 'doing'" class="flat-task-btn flat-task-btn-pause" @click.stop="handlePauseTask"
          title="暂停">
          <i class="fas fa-pause"></i>
        </button>
        <button v-if="task.status === 'paused'" class="flat-task-btn flat-task-btn-resume"
          @click.stop="handleResumeTask" title="继续">
          <i class="fas fa-play"></i>
        </button>
        <button v-if="task.status === 'done'" class="flat-task-btn flat-task-btn-restart"
          @click.stop="handleRestartTask" title="重新开始">
          <i class="fas fa-redo"></i>
        </button>
        <button v-if="task.status === 'done'" class="flat-task-btn flat-task-btn-delete" @click.stop="handleDeleteTask"
          title="删除">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </li>
  </div>
</template>

<script setup>

import { isTaskOvertime, formatDuration, formatReminderTime, getCurrentDuration } from '../utils/task-utils'
import { useTaskStore } from '@/store/taskStore'
import { ref, computed } from 'vue'
import { isVirtualInstance } from '../../../domain/services/today-agenda.js'

// 任务时间展示：优先安排（开始[-结束]），其次截止（有具体时刻显示时刻，否则只显示日期）
const formatTaskTimeInfo = (task) => {
  if (!task) return ''
  if (task.scheduledStartAt) {
    let text = formatReminderTime(task.scheduledStartAt)
    if (task.scheduledEndAt) {
      const end = new Date(task.scheduledEndAt)
      const start = new Date(task.scheduledStartAt)
      const sameDay = start.toDateString() === end.toDateString()
      text += sameDay
        ? ` – ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
        : ` – ${end.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    }
    return text
  }
  if (task.dueDate) {
    if (task.dueTime) {
      return `截止 ${formatReminderTime(`${task.dueDate}T${task.dueTime}:00`)}`
    }
    const date = new Date(`${task.dueDate}T00:00:00`)
    return `截止 ${date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}`
  }
  return ''
}

const isTaskTimeOverdue = (task) => {
  if (!task || task.status === 'done' || !task.dueDate) return false
  let boundary
  if (task.dueTime) {
    boundary = new Date(`${task.dueDate}T${task.dueTime}:00`)
  } else {
    boundary = new Date(`${task.dueDate}T00:00:00`)
    boundary.setDate(boundary.getDate() + 1)
  }
  return new Date() >= boundary
}

// 定义 props
const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  timeUpdateTrigger: {
    type: Number,
    default: 0
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  isHovered: {
    type: Boolean,
    default: false
  },
  isMultiSelectMode: {
    type: Boolean,
    default: false
  },
  showSelectCheckbox: {
    type: Boolean,
    default: false
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  badges: {
    type: Array,
    default: () => []
  }
})

// 定义事件
const emit = defineEmits([
  'task-click',
  'select-change',
  'mouseenter',
  'mouseleave',
  'drag-start',
  'drag-end'
])

// 使用 taskStore
const taskStore = useTaskStore()

// 虚拟重复实例：操作需路由到重复实例接口（先物化再执行状态机）
const isVirtual = computed(() => isVirtualInstance(props.task))

// 物化当前虚拟实例并返回真实任务行
const materializeVirtual = async () => {
  const result = await taskStore.updateRecurringInstance(
    props.task.seriesId,
    props.task.occurrenceDate,
    {}
  )
  return result && result.success ? result.task : null
}

// 拖拽相关响应式数据
const isDragging = ref(false)

// 拖拽事件处理
const handleDragStart = (event) => {
  isDragging.value = true
  // 设置拖拽数据
  event.dataTransfer.setData('application/json', JSON.stringify({
    taskId: props.task.id,
    taskContent: props.task.content,
    currentListId: props.task.listId
  }))
  event.dataTransfer.effectAllowed = 'move'
  
  // 发送拖拽开始事件
  emit('drag-start', props.task)
}

const handleDragEnd = (event) => {
  isDragging.value = false
  // 发送拖拽结束事件
  emit('drag-end', props.task)
}

// 获取任务当前持续时间（包含响应式更新触发器）
const getCurrentDurationWithTrigger = (task) => {
  props.timeUpdateTrigger // 触发响应式更新
  return getCurrentDuration(task)
}



// 获取高亮内容
const getHighlightedContent = (task) => {
  if (!props.searchQuery) return task.content
  const regex = new RegExp(`(${props.searchQuery})`, 'gi')
  return task.content.replace(regex, '<mark>$1</mark>')
}

// 获取高亮备注内容
const getHighlightedNote = (task) => {
  if (!task.metadata?.note || !props.searchQuery) return task.metadata?.note || ''
  const regex = new RegExp(`(${props.searchQuery})`, 'gi')
  return task.metadata.note.replace(regex, '<mark>$1</mark>')
}



// 事件处理函数
const handleTaskClick = () => {
  emit('task-click', props.task)
}

// 任务操作方法 - 直接调用 taskStore
const handleToggleComplete = async () => {
  try {
    if (isVirtual.value) {
      // 虚拟重复实例：取消完成不存在（虚拟实例总是未完成）
      await taskStore.completeRecurringInstance(props.task.seriesId, props.task.occurrenceDate)
      return
    }
    if (props.task.status === 'done') {
      // 如果已完成，重新开始任务
      await taskStore.updateTask(props.task.id, { status: 'todo', completedAt: null })
    } else {
      // 如果未完成，标记为完成
      await taskStore.completeTask(props.task.id)
    }
  } catch (error) {
    console.error('切换任务完成状态失败:', error)
  }
}

const handleStartTask = async () => {
  try {
    if (isVirtual.value) {
      const materialized = await materializeVirtual()
      if (materialized) await taskStore.startTask(materialized.id)
      return
    }
    await taskStore.startTask(props.task.id)
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const handlePauseTask = async () => {
  try {
    if (isVirtual.value) {
      const materialized = await materializeVirtual()
      if (materialized) await taskStore.pauseTask(materialized.id)
      return
    }
    await taskStore.pauseTask(props.task.id)
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const handleResumeTask = async () => {
  try {
    await handleStartTask()
  } catch (error) {
    console.error('继续任务失败:', error)
  }
}

const handleRestartTask = async () => {
  try {
    await taskStore.updateTask(props.task.id, {
      status: 'todo',
      completedAt: null,
      startTime: null,
      totalDuration: 0
    })
  } catch (error) {
    console.error('重新开始任务失败:', error)
  }
}

const handleDeleteTask = async () => {
  if (!confirm('确定要删除这个任务吗？')) return
  if (isVirtual.value) {
    await taskStore.deleteRecurringInstance(props.task.seriesId, props.task.occurrenceDate)
    return
  }
  await taskStore.deleteTask(props.task.id)
}
</script>

<style>
@import '@/assets/styles/components/flat-task-list.css';
</style>