<template>
  <div
    class="today-task-row"
    :class="{
      'is-done': status === 'done',
      'is-doing': status === 'doing',
      'is-dragging': isDragging,
      'is-expanded': expanded
    }"
    :data-status="status"
    :draggable="!expanded"
    @click="handleRowClick"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <!-- 主行：状态圆圈（纯展示）+ 标题/备注摘要 + hover 动作（图标即动作） -->
    <div class="today-task-main">
      <span v-if="!expanded" class="today-task-status">
        <TaskStatusCircle :status="status" />
      </span>

      <div v-if="!expanded" class="today-task-content">
        <button
          class="today-task-title"
          type="button"
          :class="{ 'is-completed': status === 'done' }"
          :aria-label="expanded ? $t('today.collapseTask') : $t('today.expandTask')"
          v-html="highlightedTitle"
          :aria-expanded="expanded"
          @click.stop="$emit('detail', task)"
        ></button>
        <div v-if="task.metadata?.note" class="today-task-note" v-html="highlightedNote"></div>
      </div>

      <div class="today-task-actions">
        <IconButton
          v-if="status === 'todo' || status === 'paused'"
          size="icon-sm"
          class="today-task-action-btn"
          :label="status === 'paused' ? $t('tasks.resume') : $t('tasks.start')"
          @click.stop="handleStart"
        >
          <Play class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          v-if="status === 'doing'"
          size="icon-sm"
          class="today-task-action-btn"
          :label="$t('tasks.pause')"
          @click.stop="handlePause"
        >
          <Pause class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          v-if="status !== 'done'"
          size="icon-sm"
          class="today-task-action-btn"
          :label="$t('floatView.completeTask')"
          @click.stop="handleComplete"
        >
          <CircleCheck class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          v-if="status === 'done'"
          size="icon-sm"
          class="today-task-action-btn"
          :label="$t('tasks.restart')"
          @click.stop="handleRedo"
        >
          <RotateCcw class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          size="icon-sm"
          class="today-task-action-btn"
          :label="expanded ? $t('today.collapseTask') : $t('today.expandTask')"
          :aria-expanded="expanded"
          ref="expandButton"
          @click.stop="$emit('detail', task)"
        >
          <ChevronUp v-if="expanded" class="h-icon-sm w-icon-sm" />
          <ChevronDown v-else class="h-icon-sm w-icon-sm" />
        </IconButton>
        <IconButton
          v-if="!expanded"
          size="icon-sm"
          class="today-task-action-btn today-task-action-danger"
          :label="$t('tasks.deleteTask')"
          @click.stop="handleDelete"
        >
          <Trash2 class="h-icon-sm w-icon-sm" />
        </IconButton>
      </div>
    </div>

    <!-- 元信息行：When chip + 提醒 pill + 循环图标 + 分组徽标 + 计时 -->
    <div v-if="!expanded" class="today-task-meta">
      <TaskWhenBubble v-if="status !== 'done'" :task="task" />
      <TaskReminderBubble v-if="status !== 'done'" :task="task" />

      <!-- 循环任务图标（模板或实例，纯标识） -->
      <span
        v-if="task.recurrence || task.seriesId"
        class="today-task-meta-item"
        :title="$t('today.badge.recurring')"
      >
        <Repeat class="h-2.5 w-2.5" aria-hidden="true" />
      </span>

      <!-- 附加徽标（分组原因 / 重复任务等） -->
      <span
        v-for="(badge, index) in badges"
        :key="index"
        class="flat-task-badge"
        :class="badge.tone ? `flat-task-badge-${badge.tone}` : ''"
      >
        {{ badge.text }}
      </span>

      <!-- 进行 / 暂停 / 完成耗时 -->
      <span v-if="status === 'doing' && !isOvertime" class="today-task-time today-task-time-doing">
        <Play class="h-2.5 w-2.5" aria-hidden="true" />
        <span>{{ formatDuration(getCurrentDurationWithTrigger(task)) }}</span>
      </span>
      <span v-else-if="status === 'doing' && isOvertime" class="today-task-time today-task-time-overtime">
        <Clock class="h-2.5 w-2.5" aria-hidden="true" />
        <span>{{ formatDuration(getCurrentDurationWithTrigger(task)) }}</span>
      </span>
      <span v-else-if="status === 'paused'" class="today-task-time today-task-time-paused">
        <Pause class="h-2.5 w-2.5" aria-hidden="true" />
        <span>{{ formatDuration(task.totalDuration || 0) }}</span>
      </span>
      <span v-else-if="status === 'done' && task.totalDuration" class="today-task-time today-task-time-completed">
        <Check class="h-2.5 w-2.5" aria-hidden="true" />
        <span>{{ formatDuration(task.totalDuration) }}</span>
      </span>
    </div>

    <TodayTaskExpanded
      :task="task"
      :open="expanded"
      @close="handleCloseExpanded"
      @delete-task="handleEditorDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { Check, ChevronDown, ChevronUp, CircleCheck, Clock, Pause, Play, Repeat, RotateCcw, Trash2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'
import { isTaskOvertime, formatDuration, getCurrentDuration } from '@/utils/task-utils'
import { isVirtualInstance, materializeVirtualInstance } from '@/utils/today-agenda'
import TaskStatusCircle from '../task/TaskStatusCircle.vue'
import TaskWhenBubble from '../task/TaskWhenBubble.vue'
import TaskReminderBubble from '../task/TaskReminderBubble.vue'
import IconButton from '../ui/button/IconButton.vue'
import TodayTaskExpanded from './TodayTaskExpanded.vue'

/**
 * Today 页专用任务行（Things 式就地交互）：
 * - 状态圆圈纯展示；动作全部在 hover 动作区，图标即点击后的动作
 * - When chip / 提醒 pill 点击弹气泡就地改期、设提醒（共享悬浮窗组件）
 * - 单击任务正文在原位展开，标题、备注、步骤及全部属性共用一套编辑流程
 * - 元信息摘要和 When / 提醒捷径仍留在浏览态，行上动作不会顺带展开
 * 不改 FlatTaskItem：普通列表与月视图继续使用旧行组件。
 */
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
  badges: {
    type: Array,
    default: () => []
  },
  expanded: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['detail', 'delete-request', 'collapse-request'])

const { t: $t } = useI18n()
const taskStore = useTaskStore()

// 行状态简写
const status = computed(() => props.task.status || (props.task.completed ? 'done' : 'todo'))

// 虚拟重复实例：操作需路由到重复实例接口（先物化再执行状态机）
const isVirtual = computed(() => isVirtualInstance(props.task))

// ---------- 拖拽（保持既有行为：行拖到侧边栏清单移动归属） ----------

const isDragging = ref(false)

const handleDragStart = (event) => {
  isDragging.value = true
  event.dataTransfer.setData('application/json', JSON.stringify({
    taskId: props.task.id,
    taskContent: props.task.content,
    currentListId: props.task.listId
  }))
  event.dataTransfer.effectAllowed = 'move'
}

const handleDragEnd = () => {
  isDragging.value = false
}

// ---------- 计时显示 ----------

const isOvertime = computed(() => isTaskOvertime(props.task))

// 读取触发器以保证进行中时长随秒刷新
const getCurrentDurationWithTrigger = (task) => {
  props.timeUpdateTrigger
  return getCurrentDuration(task)
}

// ---------- 搜索高亮 ----------

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[char])

const getHighlightedContent = (content) => {
  const text = String(content || '')
  if (!props.searchQuery) return escapeHtml(text)
  const query = props.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${query})`, 'gi')
  return text.split(regex).map((part, index) => index % 2
    ? `<mark>${escapeHtml(part)}</mark>`
    : escapeHtml(part)).join('')
}

const getHighlightedNote = (note) => {
  if (!note) return ''
  return getHighlightedContent(note)
}

const highlightedTitle = computed(() => getHighlightedContent(props.task.content))
const highlightedNote = computed(() => getHighlightedNote(props.task.metadata?.note))

// ---------- 展开与编辑 ----------

const expandButton = ref(null)

function handleRowClick(event) {
  if (event.target.closest('button, input, textarea, select, [role="button"], [contenteditable="true"]')) return
  emit('detail', props.task)
}

function handleCloseExpanded(options = {}) {
  const restoreFocus = options?.restoreFocus !== false
  emit('collapse-request', { task: props.task, restoreFocus })
  if (restoreFocus) nextTick(() => expandButton.value?.focus())
}

function handleEditorDelete(task) {
  emit('delete-request', { task, trigger: document.activeElement })
}

// ---------- 状态动作（图标即动作） ----------

const handleStart = async () => {
  try {
    const target = await materializeVirtualInstance(taskStore, props.task)
    if (!target) return
    await taskStore.startTask(target.id)
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const handlePause = async () => {
  try {
    const target = await materializeVirtualInstance(taskStore, props.task)
    if (!target) return
    await taskStore.pauseTask(target.id)
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const handleComplete = async () => {
  try {
    if (isVirtual.value) {
      // 虚拟重复实例：直接走完成实例链路（虚拟实例总是未完成）
      await taskStore.completeRecurringInstance(props.task.seriesId, props.task.occurrenceDate)
      return
    }
    await taskStore.completeTask(props.task.id)
  } catch (error) {
    console.error('完成任务失败:', error)
  }
}

const handleRedo = async () => {
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

// 删除统一走外部 AlertDialog，携带触发控件以便成功/取消后恢复焦点
const handleDelete = (event) => {
  emit('delete-request', { task: props.task, trigger: event?.currentTarget || null })
}
</script>

<style>
@import '@/assets/styles/components/today-task-row.css';
</style>
