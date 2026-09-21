<template>
  <div ref="cardEl" :data-task-id="task.id" :class="[
    'kanban-card',
    `kanban-card--${task.status}`,
    {
      'kanban-card--dragging': isDragging,
      'kanban-card--editing': isEditing
    }
  ]" :draggable="true" @dragstart="handleDragStart" @dragend="handleDragEnd" tabindex="0" @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick" @contextmenu.prevent="handleRightClick">
    <!-- 卡片头部 -->
    <div class="kanban-card-header">
      <div class="kanban-card-content" v-html="getFormattedContent()">
      </div>
    </div>

    <!-- 任务描述 -->
    <div v-if="task.metadata?.note" class="kanban-card-description">
      {{ task.metadata.note }}
    </div>

    <!-- 时间信息 -->
    <div v-if="hasTimeInfo" class="kanban-card-time-info">
      <!-- 提醒时间和任务状态时间在同一行 -->
      <div class="kanban-card-time-row">
        <!-- 重复任务图标 -->
        <div v-if="task.recurrence" class="kanban-card-recurring-icon">
          <Repeat class="h-icon-sm w-icon-sm" aria-hidden="true" />
        </div>
        
        <!-- 提醒时间 -->
        <div v-if="task.reminderTime" class="kanban-card-reminder-time" :class="{
          'kanban-card-time-overdue': new Date(task.reminderTime) < new Date() && task.status !== 'done'
        }">
          <Calendar class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>{{ getFormattedReminderTime() }}</span>
        </div>

        <!-- 进行时间 -->
        <div v-if="task.status === 'doing' && !isTaskOvertime(task)" class="kanban-card-time kanban-card-time-doing">
          <Play class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>{{ getFormattedDuration() }}</span>
        </div>
        <div v-else-if="task.status === 'doing' && isTaskOvertime(task)"
          class="kanban-card-time kanban-card-time-overtime">
          <Clock class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>{{ getFormattedDuration() }}</span>
        </div>
        <div v-else-if="task.status === 'paused'" class="kanban-card-time kanban-card-time-paused">
          <Pause class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>{{ getFormattedDuration() }}</span>
        </div>
        <div v-else-if="task.status === 'done' && task.totalDuration"
          class="kanban-card-time kanban-card-time-completed">
          <Check class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>{{ getFormattedDuration() }}</span>
        </div>
      </div>
    </div>

  </div>

  <!-- 右键菜单 - 渲染在卡片外部 -->
  <Teleport to="body">
    <div v-if="showContextMenu" class="context-menu-overlay" @click="closeContextMenu">
      <div class="kanban-card-context-menu" :style="contextMenuStyle" @click.stop>
        <div class="context-menu-item" @click="handleContextEdit">
          <Pencil class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>编辑</span>
        </div>
        <div class="context-menu-item context-menu-item-danger" @click="handleContextDelete">
          <Trash2 class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>删除</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Calendar, Check, Clock, Pause, Pencil, Play, Repeat, Trash2 } from '@lucide/vue'
import { formatReminderTime, formatDuration, getCurrentDuration, isTaskOvertime } from '@/utils/task-utils'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  isDragging: {
    type: Boolean,
    default: false
  },
  timeUpdateTrigger: {
    type: Number,
    default: 0
  },
  isEditing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['drag-start', 'drag-end', 'click', 'edit', 'delete-request'])

const isDragging = ref(false)
const cardEl = ref(null)

// 右键菜单相关状态
const showContextMenu = ref(false)
const contextMenuStyle = ref({})

// 监听全局点击事件来关闭右键菜单
const closeContextMenu = () => {
  showContextMenu.value = false
}

// 计算属性
const hasTimeInfo = computed(() => {
  return props.task.reminderTime ||
    props.task.status === 'doing' ||
    props.task.status === 'paused' ||
    (props.task.status === 'done' && props.task.totalDuration)
})

// 方法
const handleDragStart = (event) => {
  console.log('🔍 [KanbanCard] 拖拽开始 - 任务ID:', props.task.id, '类型:', typeof props.task.id)
  console.log('🔍 [KanbanCard] 完整任务对象:', props.task)
  
  const dragData = {
    taskId: props.task.id,  // 修正：使用 taskId 而不是 id
    status: props.task.status
  }
  
  console.log('🔍 [KanbanCard] 拖拽数据:', dragData)
  
  event.dataTransfer.setData('application/json', JSON.stringify(dragData))
  event.dataTransfer.effectAllowed = 'move'
  
  emit('drag-start', props.task)
}

const handleDragEnd = () => {
  isDragging.value = false
  emit('drag-end')
}

const handleClick = () => {
  emit('click', props.task)
}

// 右键菜单处理
const handleRightClick = (event) => {
  event.preventDefault()
  event.stopPropagation()

  // 计算菜单位置 - 使用鼠标点击位置
  const menuWidth = 120 // 菜单宽度
  const menuHeight = 80 // 菜单高度

  let left = event.clientX
  let top = event.clientY

  // 防止菜单超出视窗
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10
  }
  if (top + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 10
  }

  contextMenuStyle.value = {
    left: `${left}px`,
    top: `${top}px`
  }

  showContextMenu.value = true
}

const handleContextEdit = () => {
  closeContextMenu()
  // 使用和左键点击相同的逻辑
  handleClick()
}

const handleContextDelete = () => {
  closeContextMenu()
  handleDeleteTask()
}

// 获取任务当前持续时间（包含响应式更新触发器）
const getCurrentDurationWithTrigger = (task) => {
  props.timeUpdateTrigger // 触发响应式更新
  return getCurrentDuration(task)
}

const getFormattedReminderTime = () => {
  if (!props.task.reminderTime) return ''
  return formatReminderTime(props.task.reminderTime)
}

const getFormattedDuration = () => {
  return formatDuration(getCurrentDurationWithTrigger(props.task))
}

const handleDeleteTask = () => {
  // 删除统一由看板宿主处理，携带触发卡片以便取消/成功后恢复焦点
  emit('delete-request', { task: props.task, trigger: cardEl.value })
}

const getFormattedContent = () => {
  if (!props.task.content) return ''
  // 将换行符转换为 HTML 换行标签，并转义其他 HTML 字符
  return props.task.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
}
</script>

<style>
@import '@/assets/styles/components/kanban-card.css';
</style>