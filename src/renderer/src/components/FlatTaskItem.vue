<template>
  <div class="flat-task-item-wrapper">
    <li class="flat-task-item"
      :class="{ 
        'flat-task-item-completed': task.status === 'done',
        'flat-task-item-editing': isEditing,
        'flat-task-item-hovered': isHovered
      }"
      @click="handleTaskClick"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')">
      
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
      
      <!-- 任务左侧部分（包含勾选框和文本） -->
      <div class="flat-task-left">
        <!-- 圆形勾选框 -->
        <div class="flat-task-checkbox">
          <input type="checkbox" :id="`flat-task-${task.id}`" :checked="task.status === 'done'"
            @change="handleToggleComplete" @click.stop />
          <label :for="`flat-task-${task.id}`" class="flat-checkbox-label" @click.stop></label>
        </div>
        
        <!-- 任务详情 -->
        <div class="flat-task-details">
          <div class="flat-task-title" v-html="getHighlightedContent(task)"></div>
          <div v-if="task.description" class="flat-task-description">{{ task.description }}</div>
          
          <!-- 时间信息 -->
          <div class="flat-task-time-info">
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
        </div>
      </div>

      <!-- 任务右侧标签和操作 - 单行水平对齐 -->
      <div class="flat-task-right">
        <!-- 任务操作按钮 -->
        <button v-if="task.status === 'todo'" class="flat-task-btn flat-task-btn-start"
          @click.stop="handleStartTask" title="开始">
          <i class="fas fa-play"></i>
        </button>
        <button v-if="task.status === 'doing'" class="flat-task-btn flat-task-btn-pause"
          @click.stop="handlePauseTask" title="暂停">
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
          <button v-if="task.status === 'done'" class="flat-task-btn flat-task-btn-delete" @click.stop="handleDeleteTask" title="删除">
        <i class="fas fa-trash"></i>
      </button>
      </div>
    </li>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { isTaskOvertime, formatDuration } from '../utils/task-utils'
import { useTaskStore } from '@/store/taskStore'

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
  }
})

// 定义事件
const emit = defineEmits([
  'task-click',
  'mouseenter',
  'mouseleave'
])

// 使用 taskStore
const taskStore = useTaskStore()

// 获取任务当前持续时间
const getCurrentDuration = (task) => {
  props.timeUpdateTrigger // 触发响应式更新
  if (task.status !== 'doing' || !task.startedAt) return 0
  return Date.now() - new Date(task.startedAt).getTime() + (task.totalDuration || 0)
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
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  if (taskDate.getTime() === today.getTime()) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (taskDate.getTime() === tomorrow.getTime()) {
    return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
}

// 事件处理函数
const handleTaskClick = () => {
  emit('task-click', props.task)
}

// 任务操作方法 - 直接调用 taskStore
const handleToggleComplete = async () => {
  try {
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
    console.log('开始任务 - 当前状态:', props.task.status, '任务ID:', props.task.id)
    await taskStore.startTask(props.task.id)
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const handlePauseTask = async () => {
  try {
    console.log('暂停任务 - 当前状态:', props.task.status, '任务ID:', props.task.id)
    await taskStore.pauseTask(props.task.id)
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const handleResumeTask = async () => {
  try {
    console.log('继续任务 - 当前状态:', props.task.status, '任务ID:', props.task.id)
    await taskStore.startTask(props.task.id) // resume 实际上就是重新开始
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
  if (confirm('确定要删除这个任务吗？')) {
    await taskStore.deleteTask(props.task.id)
  }
}
</script>

<style>
@import '../assets/styles/components/flat-task-list.css';
</style>