<template>
  <div class="task-panel-container" @mouseenter="handlePanelMouseEnter" @mouseleave="handlePanelMouseLeave">
    <!-- 面板头部 - 固定时可拖动 -->
    <div class="task-panel-header" :class="{ 'draggable': isPinned }" @mousedown="handleHeaderMouseDown">
      <div class="task-panel-title-wrapper">
        <div class="task-panel-dropdown" @click="toggleDropdown" ref="dropdownRef">
          <div class="task-panel-dropdown-trigger">
            <component :is="getCategoryIcon(selectedCategory)" class="category-icon" />
            <span class="category-label">{{ getCategoryLabel(selectedCategory) }}</span>
            <span class="task-panel-count">{{ taskCount }}</span>
            <svg class="dropdown-arrow" :class="{ 'open': showDropdown }" width="12" height="12" viewBox="0 0 24 24"
              fill="none">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </div>
          <div v-if="showDropdown" class="task-panel-dropdown-menu">
            <div v-for="category in categoryOptions" :key="category.value" class="dropdown-item"
              :class="{ 'active': selectedCategory === category.value }" @click.stop="selectCategory(category.value)">
              <component :is="category.icon" class="dropdown-item-icon" />
              <span>{{ category.label }}</span>
              <span class="dropdown-item-count">{{ getCategoryCount(category.value) }}</span>
            </div>
          </div>
        </div>
      </div>
      <!-- 清单过滤下拉 -->
      <div class="task-panel-list-dropdown" @click="toggleListDropdown" ref="listDropdownRef">
        <div class="task-panel-list-trigger">
          <i :class="getListIconClass(selectedListIcon)" :style="getListColorStyle(selectedListColor)"></i>
          <svg class="dropdown-arrow" :class="{ 'open': showListDropdown }" width="12" height="12" viewBox="0 0 24 24"
            fill="none">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </div>
        <div v-if="showListDropdown" class="task-panel-dropdown-menu list-dropdown-menu">
          <div class="dropdown-item" :class="{ 'active': selectedListId === null }" @click.stop="selectList(null)">
            <i class="fas fa-layer-group dropdown-item-icon"></i>
            <span>{{ $t('floatView.allLists') }}</span>
            <span class="dropdown-item-count">{{ getAllListsTaskCount() }}</span>
          </div>
          <div v-for="list in sortedLists" :key="list.id" class="dropdown-item"
            :class="{ 'active': selectedListId === list.id }" @click.stop="selectList(list.id)">
            <i :class="getListIconClass(list.icon)" class="dropdown-item-icon"
              :style="getListColorStyle(list.color)"></i>
            <span>{{ list.name }}</span>
            <span class="dropdown-item-count">{{ getListTaskCount(list.id) }}</span>
          </div>
        </div>
      </div>

      <!-- 固定按钮 -->
      <button :class="['task-panel-pin-btn', { 'pinned': isPinned }]" @click.stop="togglePin"
        :title="isPinned ? $t('floatView.unpinPanel') : $t('floatView.pinPanel')">
        <svg v-if="isPinned" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" fill="currentColor" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" stroke="currentColor" stroke-width="1.5"
            fill="none" />
        </svg>
      </button>
    </div>

    <!-- 快速添加框 -->
    <div class="task-panel-quick-add">
      <div class="task-panel-input-wrapper">
        <input v-model="newTaskContent" type="text" class="task-panel-input" :placeholder="$t('floatView.addNewTask')"
          maxlength="200" @keypress.enter="addTask" ref="quickAddInput">
        <button class="task-panel-add-btn" :class="{ 'active': newTaskContent.trim() }" @click="addTask"
          :title="$t('floatView.addTask')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2v20M2 12h20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="task-panel-list-container">
      <div v-if="tasks.length > 0" class="task-panel-list">
        <div v-for="task in sortedTasks" :key="task.id" :class="[
          'task-panel-card',
          `status-${task.status || (task.completed ? 'done' : 'todo')}`,
          {
            'overtime': (task.status || (task.completed ? 'done' : 'todo')) === 'doing' && task.reminderTime && isReminderOverdue(task.reminderTime)
          }
        ]" :data-task-id="task.id" :data-status="task.status || (task.completed ? 'done' : 'todo')"
          @contextmenu="showTaskContextMenu($event, task)">

          <!-- 主行：checkbox + 内容 + 悬浮按钮 -->
          <div class="task-card-main">
            <!-- 状态指示器 -->
            <button class="task-status-checkbox" :class="`status-${task.status || (task.completed ? 'done' : 'todo')}`"
              @click="cycleTaskStatus(task.id)" :title="$t('floatView.clickToToggleStatus')">
              <span v-if="(task.status || (task.completed ? 'done' : 'todo')) === 'done'" class="check-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
              </span>
              <span v-else-if="(task.status || (task.completed ? 'done' : 'todo')) === 'doing'"
                class="doing-dot"></span>
            </button>

            <!-- 任务内容文本 -->
            <div class="task-card-text-wrapper">
              <div v-if="!isEditing(task.id)" class="task-card-text"
                :class="{ 'completed': (task.status || (task.completed ? 'done' : 'todo')) === 'done' }"
                @dblclick="startEditTask(task.id)" :title="$t('floatView.doubleClickToEdit')">
                {{ task.content }}
              </div>
              <input v-else v-model="editingContent" class="task-card-edit-input" @keydown.enter="saveTaskEdit(task.id)"
                @keydown.esc="cancelTaskEdit" @blur="saveTaskEdit(task.id)" ref="editInput" />
            </div>

            <!-- 悬浮操作按钮 -->
            <div class="task-card-actions">
              <button v-if="(task.status || (task.completed ? 'done' : 'todo')) === 'doing'"
                class="task-action-btn pause" @click="pauseTask(task.id)" :title="$t('floatView.pauseTask')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"
                    fill="currentColor" />
                </svg>
              </button>
              <button class="task-action-btn reminder" @click="showReminderModal(task.id)"
                :title="$t('floatView.setReminder')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
                    fill="currentColor" />
                </svg>
              </button>
              <button class="task-action-btn delete" @click="deleteTask(task.id)" :title="$t('floatView.deleteTask')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 元信息行（占满宽度） -->
          <div class="task-card-meta">
            <!-- 提醒时间 -->
            <div v-if="task.reminderTime && (task.status || (task.completed ? 'done' : 'todo')) !== 'done'"
              :class="['task-meta-tag reminder', { 'overdue': isReminderOverdue(task.reminderTime) }]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
                  fill="currentColor" />
              </svg>
              <span>{{ formatReminderTime(task.reminderTime) }}</span>
            </div>

            <!-- 进行中状态标签 -->
            <div v-if="(task.status || (task.completed ? 'done' : 'todo')) === 'doing'" class="task-meta-tag doing">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                  fill="currentColor" />
              </svg>
              <span>{{ formatDurationCompact(getTaskTotalDuration(task)) }}</span>
            </div>

            <!-- 子任务指示器 -->
            <div v-if="task.metadata?.steps?.length > 0" class="task-meta-tag subtasks">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"
                  fill="currentColor" />
              </svg>
              <span>{{task.metadata.steps.filter(s => s.status === 'done').length}}/{{ task.metadata.steps.length
                }}</span>
            </div>
          </div>

          <!-- 子任务列表 -->
          <div v-if="getIncompleteSteps(task).length > 0" class="task-card-subtasks">
            <div v-for="step in getIncompleteSteps(task)" :key="step.id" class="subtask-item">
              <div class="subtask-checkbox" @click.stop="toggleStepStatus(task.id, step)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                </svg>
              </div>
              <span class="subtask-text">{{ step.content }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="task-panel-empty">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              fill="currentColor" />
          </svg>
        </div>
        <h3 class="empty-title">{{ $t('floatView.excellent') }}</h3>
        <p class="empty-text">{{ $t('floatView.allTasksCompleted') }}</p>
      </div>
    </div>

    <!-- 提醒设置弹窗 -->
    <div v-if="showReminder" class="task-panel-modal-overlay">
      <div class="task-panel-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('floatView.setReminder') }}</h3>
          <button class="modal-close-btn" @click="hideReminderModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="reminder-options-grid">
            <button v-for="reminder in customReminderOptions" :key="reminder.id" class="reminder-option-btn"
              @click="selectCustomReminder(reminder)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
                  fill="currentColor" />
              </svg>
              <span>{{ reminder.label }}</span>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn secondary" @click="hideReminderModal">{{ $t('floatView.cancel') }}</button>
          <button class="modal-btn primary" @click="saveTaskReminder">{{ $t('floatView.save') }}</button>
        </div>
      </div>
    </div>

    <!-- 面板底部 -->
    <div class="task-panel-footer">
      <span class="footer-stats" @click="openTaskManager">{{ footerStats }}</span>
      <span class="footer-link" @click="openTaskManager">→</span>
    </div>

    <!-- 右键菜单 -->
    <div v-if="showContextMenu" class="task-context-menu" :style="contextMenuStyle" @click.stop>
      <div class="context-menu-item" @click="createFloatingTask">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="currentColor" />
        </svg>
        {{ $t('floatView.createFloatingTask') }}
      </div>
    </div>

    <!-- 遮罩层 -->
    <div v-if="showContextMenu" class="context-menu-overlay" @click="hideContextMenu"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, h, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { getListIconClass } from '@/utils/icon-utils'
import '@vuepic/vue-datepicker/dist/main.css'

const taskStore = useTaskStore()
const { customReminderOptions } = storeToRefs(taskStore)
const { t: $t } = useI18n()

// 响应式数据
const tasks = ref([])
const newTaskContent = ref('')
const currentEditingTask = ref(null)
const editingContent = ref('')
const showReminder = ref(false)
const currentReminderTask = ref(null)
const reminderDate = ref('')
const reminderTime = ref('')
const dateTimeValue = ref(null)
const completedTasksCount = ref(0)
const isPinned = ref(false)
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// 下拉选择器相关
const showDropdown = ref(false)
const selectedCategory = ref('today')
const dropdownRef = ref(null)

// 清单下拉选择器相关
const showListDropdown = ref(false)
const selectedListId = ref(null)
const listDropdownRef = ref(null)

// 右键菜单相关
const showContextMenu = ref(false)
const contextMenuStyle = ref({})
const selectedTask = ref(null)

// 分类选项配置
const categoryOptions = computed(() => [
  { value: 'today', label: $t('categories.today'), icon: CalendarDayIcon },
  { value: 'planned', label: $t('categories.planned'), icon: CalendarWeekIcon },
  { value: 'doing', label: $t('categories.doing'), icon: PlayCircleIcon },
  { value: 'paused', label: $t('categories.paused'), icon: PauseCircleIcon },
  { value: 'all', label: $t('categories.all'), icon: ListIcon },
  { value: 'inbox', label: $t('categories.inbox'), icon: InboxIcon },
  { value: 'completed', label: $t('categories.completed'), icon: CheckCircleIcon }
])

// 图标组件
const CalendarDayIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z', fill: 'currentColor' })
])

const CalendarWeekIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7v-5z', fill: 'currentColor' })
])

const PlayCircleIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z', fill: 'currentColor' })
])

const PauseCircleIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z', fill: 'currentColor' })
])

const ListIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z', fill: 'currentColor' })
])

const InboxIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2H19v3zm0-5h-4.99c0 1.1-.9 2-2 2s-2-.9-2-2H5V5h14v9z', fill: 'currentColor' })
])

const CheckCircleIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z', fill: 'currentColor' })
])

// 引用
const quickAddInput = ref(null)
const editInput = ref(null)

// 计算属性
const taskCount = computed(() => tasks.value.length)

const sortedTasks = computed(() => {
  // 直接返回已经排序的任务，因为 taskStore.getSortedTasks 已经处理了排序
  return tasks.value
})

const footerStats = computed(() => {
  const totalCount = taskCount.value + completedTasksCount.value
  if (totalCount === 0) {
    return $t('floatView.noTasks')
  }
  return $t('floatView.taskStats', { total: totalCount, completed: completedTasksCount.value })
})

// 方法
const loadTasks = async () => {
  try {
    // 确保任务数据和清单数据已加载
    await taskStore.getAllTasks()
    await taskStore.getAllLists()

    // 使用选中的清单过滤任务
    const listId = selectedListId.value

    // 对于 completed 分类，显示已完成任务；其他分类不显示已完成任务
    const includeCompleted = selectedCategory.value === 'completed'

    // 获取过滤后的任务
    tasks.value = taskStore.getSortedTasks(selectedCategory.value, listId, includeCompleted)

    // 获取已完成任务的计数
    const stats = taskStore.getCategoryStats(selectedCategory.value, listId)
    completedTasksCount.value = stats.completed
  } catch (error) {
    console.error('加载任务失败:', error)
  }
}

const addTask = async () => {
  const content = newTaskContent.value.trim()
  if (!content) return

  try {
    await taskStore.createTask({ content })
    newTaskContent.value = ''

    // 重新加载任务列表以显示新添加的任务
    await loadTasks()

    if (quickAddInput.value) {
      quickAddInput.value.focus()
    }
  } catch (error) {
    console.error('添加任务失败:', error)
  }
}

const cycleTaskStatus = async (taskId) => {
  try {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const currentStatus = task.status || (task.completed ? 'done' : 'todo')

    switch (currentStatus) {
      case 'todo':
        await taskStore.startTask(taskId)
        break
      case 'doing':
        await taskStore.completeTask(taskId)
        break
      case 'done':
        await taskStore.updateTask(taskId, { status: 'todo' })
        break
      default:
        await taskStore.startTask(taskId)
    }

    await loadTasks()
    // 重新启动定时器以调整更新频率
    startUpdateTimer()
  } catch (error) {
    console.error('更新任务状态失败:', error)
  }
}

const deleteTask = async (taskId) => {
  try {
    await taskStore.deleteTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('删除任务失败:', error)
  }
}

const pauseTask = async (taskId) => {
  try {
    await taskStore.pauseTask(taskId)
    await loadTasks()
    // 重新启动定时器以调整更新频率
    startUpdateTimer()
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const isEditing = (taskId) => {
  return currentEditingTask.value === taskId
}

const startEditTask = (taskId) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  currentEditingTask.value = taskId
  editingContent.value = task.content

  nextTick(() => {
    if (editInput.value && editInput.value[0]) {
      editInput.value[0].focus()
      editInput.value[0].select()
    }
  })
}

const saveTaskEdit = async (taskId) => {
  const newContent = editingContent.value.trim()
  if (!newContent) {
    cancelTaskEdit()
    return
  }

  try {
    await taskStore.updateTask(taskId, { content: newContent })
    currentEditingTask.value = null
    editingContent.value = ''
    await loadTasks()
  } catch (error) {
    console.error('更新任务失败:', error)
    cancelTaskEdit()
  }
}

const cancelTaskEdit = () => {
  currentEditingTask.value = null
  editingContent.value = ''
}

const showReminderModal = (taskId) => {
  currentReminderTask.value = taskId
  const task = tasks.value.find(t => t.id === taskId)

  if (task && task.reminderTime) {
    const reminderDateTime = new Date(task.reminderTime)
    // 使用本地时区格式化日期和时间
    const year = reminderDateTime.getFullYear()
    const month = String(reminderDateTime.getMonth() + 1).padStart(2, '0')
    const day = String(reminderDateTime.getDate()).padStart(2, '0')
    const hours = String(reminderDateTime.getHours()).padStart(2, '0')
    const mins = String(reminderDateTime.getMinutes()).padStart(2, '0')

    reminderDate.value = `${year}-${month}-${day}`
    reminderTime.value = `${hours}:${mins}`
    dateTimeValue.value = reminderDateTime
  } else {
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000)
    // 使用本地时区格式化默认时间
    const year = defaultTime.getFullYear()
    const month = String(defaultTime.getMonth() + 1).padStart(2, '0')
    const day = String(defaultTime.getDate()).padStart(2, '0')
    const hours = String(defaultTime.getHours()).padStart(2, '0')
    const mins = String(defaultTime.getMinutes()).padStart(2, '0')

    reminderDate.value = `${year}-${month}-${day}`
    reminderTime.value = `${hours}:${mins}`
    dateTimeValue.value = defaultTime
  }

  showReminder.value = true
}

const hideReminderModal = () => {
  showReminder.value = false
  currentReminderTask.value = null
  dateTimeValue.value = null
  reminderDate.value = ''
  reminderTime.value = ''
}

const selectCustomReminder = async (reminderOption) => {
  const now = new Date()
  let reminderTime = null

  if (reminderOption.type === 'relative') {
    // 相对时间计算
    let milliseconds = 0
    switch (reminderOption.unit) {
      case 'minutes':
        milliseconds = reminderOption.value * 60 * 1000
        break
      case 'hours':
        milliseconds = reminderOption.value * 60 * 60 * 1000
        break
      case 'days':
        milliseconds = reminderOption.value * 24 * 60 * 60 * 1000
        break
    }
    reminderTime = new Date(now.getTime() + milliseconds)
  } else if (reminderOption.type === 'absolute') {
    // 绝对时间计算
    const targetDate = new Date(now)
    targetDate.setDate(now.getDate() + reminderOption.dayOffset)

    const [hours, minutes] = reminderOption.time.split(':').map(Number)
    targetDate.setHours(hours, minutes, 0, 0)

    // 如果计算出的时间已经过去，则设置为明天的同一时间
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1)
    }

    reminderTime = targetDate
  }

  if (reminderTime && currentReminderTask.value) {
    try {
      await window.electronAPI.tasks.setReminder(currentReminderTask.value, reminderTime.toISOString())
      hideReminderModal()
      await loadTasks()
    } catch (error) {
      console.error('设置提醒失败:', error)
      alert('设置提醒失败')
    }
  }
}



const saveTaskReminder = async () => {
  if (!currentReminderTask.value) return

  let reminderDateTime = null

  // 优先使用 VueDatePicker 的值
  if (dateTimeValue.value) {
    reminderDateTime = new Date(dateTimeValue.value)
  } else {
    // 回退到手动输入的日期时间
    const date = reminderDate.value
    const time = reminderTime.value

    if (!date || !time) {
      alert('请选择提醒时间')
      return
    }

    // 使用本地时区创建日期对象
    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes] = time.split(':').map(Number)
    reminderDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0)
  }

  console.log("本地时区提醒时间:", reminderDateTime)
  if (reminderDateTime <= new Date()) {
    alert('提醒时间不能是过去的时间')
    return
  }

  try {
    await window.electronAPI.tasks.setReminder(currentReminderTask.value, reminderDateTime.toISOString())
    hideReminderModal()
    await loadTasks()
  } catch (error) {
    console.error('设置提醒失败:', error)
    alert('设置提醒失败')
  }
}




const getStatusText = (status) => {
  return taskStore.getStatusText(status)
}

const getStatusIcon = (status) => {
  const iconComponents = {
    'todo': () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, stroke: 'currentColor', 'stroke-width': 2 })
    ]),
    'doing': () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, fill: 'currentColor' }),
      h('circle', { cx: 12, cy: 12, r: 4, fill: 'white' })
    ]),
    'done': () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 10, fill: 'currentColor' }),
      h('path', { d: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z', fill: 'white' })
    ])
  }
  return iconComponents[status] || iconComponents['todo']
}

const getTaskTotalDuration = (task) => {
  let totalDuration = task.totalDuration || 0

  // 如果任务正在进行中，加上当前进行时长
  if (task.status === 'doing' && task.startedAt) {
    const currentDuration = Date.now() - new Date(task.startedAt).getTime()
    totalDuration += currentDuration
  }

  return totalDuration
}

const formatDurationCompact = (milliseconds) => {
  if (!milliseconds || milliseconds < 1000) {
    return '0s'
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // 如果超过一小时，显示小时和分钟
  if (hours > 0) {
    return `${hours}h${minutes}m`
  }
  // 如果超过一分钟但不到一小时，显示分钟和秒
  else if (minutes > 0) {
    return `${minutes}m${seconds}s`
  }
  // 如果不到一分钟，只显示秒
  else {
    return `${seconds}s`
  }
}

const formatReminderTime = (date) => {
  return taskStore.formatTimeDisplay(date, 'reminder')
}

const isReminderOverdue = (reminderTime) => {
  return new Date(reminderTime) < new Date()
}

// 判断是否需要使用紧凑模式
const shouldUseCompactMode = (task) => {
  // 计算当前任务的元信息项数量
  let itemCount = 1 // 状态标签总是存在

  if (task.reminderTime) {
    itemCount++
  }

  if ((task.status || (task.completed ? 'done' : 'todo')) === 'doing') {
    itemCount++
  }

  // 如果有3个或更多项目，或者任务内容很长，使用紧凑模式
  return itemCount >= 3 || (task.content && task.content.length > 30)
}

// 获取任务的未完成步骤
const getIncompleteSteps = (task) => {
  const steps = task.metadata?.steps || []
  return steps.filter(step => step.status !== 'done')
}

// 切换步骤状态
const toggleStepStatus = async (taskId, step) => {
  try {
    await taskStore.toggleTaskStepStatus(taskId, step.id)
    await loadTasks()
  } catch (error) {
    console.error('切换步骤状态失败:', error)
  }
}

// 下拉选择器方法
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
  // 关闭清单下拉
  showListDropdown.value = false
}

const selectCategory = (category) => {
  selectedCategory.value = category
  showDropdown.value = false
  loadTasks()
}

const getCategoryLabel = (category) => {
  const option = categoryOptions.value.find(opt => opt.value === category)
  return option ? option.label : $t('categories.unknown')
}

const getCategoryIcon = (category) => {
  const option = categoryOptions.value.find(opt => opt.value === category)
  return option ? option.icon : CalendarDayIcon
}

const getCategoryCount = (category) => {
  const stats = taskStore.getCategoryStats(category, selectedListId.value)
  if (category === 'completed') {
    return stats.completed
  }
  return stats.total - stats.completed
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showDropdown.value = false
  }
  if (listDropdownRef.value && !listDropdownRef.value.contains(event.target)) {
    showListDropdown.value = false
  }
}

// 清单下拉选择器方法
const toggleListDropdown = () => {
  showListDropdown.value = !showListDropdown.value
  // 关闭分类下拉
  showDropdown.value = false
}

const selectList = (listId) => {
  selectedListId.value = listId
  showListDropdown.value = false
  loadTasks()
}

// 获取排序后的清单列表
const sortedLists = computed(() => {
  return taskStore.sortedLists
})

// 获取选中清单的图标
const selectedListIcon = computed(() => {
  if (selectedListId.value === null) {
    return 'fas fa-layer-group'
  }
  const list = sortedLists.value.find(l => l.id === selectedListId.value)
  return list?.icon || 'fas fa-list'
})

// 获取选中清单的颜色
const selectedListColor = computed(() => {
  if (selectedListId.value === null) {
    return null // 使用 CSS 默认颜色
  }
  const list = sortedLists.value.find(l => l.id === selectedListId.value)
  return list?.color || null // 使用 CSS 默认颜色
})

// 获取清单颜色样式（处理暗色模式兼容）
const getListColorStyle = (color) => {
  if (!color) return {}
  return { color }
}



// 获取清单任务数量
const getListTaskCount = (listId) => {
  const stats = taskStore.getCategoryStats(selectedCategory.value, listId)
  if (selectedCategory.value === 'completed') {
    return stats.completed
  }
  return stats.total - stats.completed
}

// 获取所有清单的任务数量
const getAllListsTaskCount = () => {
  const stats = taskStore.getCategoryStats(selectedCategory.value, null)
  if (selectedCategory.value === 'completed') {
    return stats.completed
  }
  return stats.total - stats.completed
}

// 打开任务管理页面
const openTaskManager = async () => {
  try {
    await window.electronAPI.windows.showTaskManager()
  } catch (error) {
    console.error('打开任务管理窗口失败:', error)
  }
}

// 右键菜单相关方法
const showTaskContextMenu = (event, task) => {
  event.preventDefault()
  selectedTask.value = task

  const rect = event.currentTarget.getBoundingClientRect()
  contextMenuStyle.value = {
    position: 'fixed',
    left: `${event.clientX}px`,
    top: `${event.clientY}px`,
    zIndex: 1000
  }

  showContextMenu.value = true
}

const hideContextMenu = () => {
  showContextMenu.value = false
  selectedTask.value = null
}

const createFloatingTask = async () => {
  if (!selectedTask.value) return

  try {
    await window.electronAPI.windows.createFloatingTask(selectedTask.value.id)
    hideContextMenu()
  } catch (error) {
    console.error('创建悬浮任务失败:', error)
  }
}

// 面板鼠标事件处理
const handlePanelMouseEnter = () => {
  // 如果已固定，不需要发送鼠标事件
  if (isPinned.value) return

  console.log('面板鼠标进入')
  try {
    window.electronAPI.windows.panelMouseEnter()
  } catch (error) {
    console.error('发送面板鼠标进入事件失败:', error)
  }
}

const handlePanelMouseLeave = () => {
  // 如果已固定，不需要发送鼠标事件
  if (isPinned.value) return

  console.log('面板鼠标离开')
  try {
    window.electronAPI.windows.panelMouseLeave()
  } catch (error) {
    console.error('发送面板鼠标离开事件失败:', error)
  }
}

// 固定/取消固定面板
const togglePin = async () => {
  try {
    const newPinned = !isPinned.value
    isPinned.value = newPinned
    await window.electronAPI.windows.setPanelPinned(newPinned)
    console.log('面板固定状态:', newPinned)

    // 如果取消固定，直接隐藏面板
    if (!newPinned) {
      await window.electronAPI.windows.hideTaskPanel()
    }
  } catch (error) {
    console.error('切换固定状态失败:', error)
    // 回滚状态
    isPinned.value = !isPinned.value
  }
}

// 头部拖动处理
const handleHeaderMouseDown = (event) => {
  // 只有固定状态才能拖动
  if (!isPinned.value) return
  // 只处理左键
  if (event.button !== 0) return
  // 如果点击的是按钮，不处理拖动
  if (event.target.closest('button')) return

  let hasMoved = false
  let initialWindowPos = null
  let lastIpcTime = 0
  let pendingUpdate = false
  const ipcThrottle = 40 // IPC调用节流

  isDragging.value = true
  dragStartPos.value = { x: event.screenX, y: event.screenY }

  // 获取当前窗口位置
  window.electronAPI.drag.getWindowPosition().then(pos => {
    initialWindowPos = pos
  }).catch(error => {
    console.error('获取窗口位置失败:', error)
  })

  const handleMouseMove = (moveEvent) => {
    if (!isDragging.value) return
    if (!initialWindowPos) return

    const deltaX = moveEvent.screenX - dragStartPos.value.x
    const deltaY = moveEvent.screenY - dragStartPos.value.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance > 5) {
      if (!hasMoved) {
        hasMoved = true
      }

      // 节流的IPC调用
      const now = Date.now()
      if (now - lastIpcTime >= ipcThrottle && !pendingUpdate) {
        lastIpcTime = now
        pendingUpdate = true

        const newPosition = {
          x: initialWindowPos.x + deltaX,
          y: initialWindowPos.y + deltaY
        }

        window.electronAPI.drag.dragWindow(newPosition)
          .then(() => {
            pendingUpdate = false
          })
          .catch((error) => {
            console.error('窗口位置更新失败:', error)
            pendingUpdate = false
          })
      }
    }
  }

  const handleMouseUp = async (upEvent) => {
    if (!isDragging.value) return

    isDragging.value = false

    if (hasMoved && initialWindowPos) {
      const finalDeltaX = upEvent.screenX - dragStartPos.value.x
      const finalDeltaY = upEvent.screenY - dragStartPos.value.y
      const finalPosition = {
        x: initialWindowPos.x + finalDeltaX,
        y: initialWindowPos.y + finalDeltaY
      }

      try {
        await window.electronAPI.drag.dragWindow(finalPosition)
        await window.electronAPI.drag.endDrag()
      } catch (error) {
        console.error('最终位置同步失败:', error)
      }
    }

    hasMoved = false
    initialWindowPos = null
    pendingUpdate = false

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)

  event.preventDefault()
}

// 监听任务更新事件
const handleTasksUpdated = () => {
  loadTasks()
}

// 检查是否有进行中的任务在一小时内
const hasRecentDoingTasks = () => {
  return tasks.value.some(task => {
    if (task.status !== 'doing' || !task.startedAt) return false
    const currentDuration = Date.now() - new Date(task.startedAt).getTime()
    return currentDuration < 60 * 60 * 1000 // 一小时内
  })
}

// 定时器引用
let updateTimer = null

// 启动定时器更新进行中任务的时长显示
const startUpdateTimer = () => {
  if (updateTimer) {
    clearInterval(updateTimer)
  }

  const updateDisplay = () => {
    // 强制更新进行中任务的时长显示
    tasks.value = [...tasks.value]

    // 重新设置定时器间隔
    const interval = hasRecentDoingTasks() ? 1000 : 30000 // 一小时内每秒更新，否则每30秒更新

    if (updateTimer) {
      clearInterval(updateTimer)
    }
    updateTimer = setInterval(updateDisplay, interval)
  }

  // 初始设置
  const initialInterval = hasRecentDoingTasks() ? 1000 : 30000
  updateTimer = setInterval(updateDisplay, initialInterval)
}

const stopUpdateTimer = () => {
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = null
  }
}

// 生命周期
onMounted(async () => {
  await loadTasks()

  // 加载自定义提醒选项
  if (!customReminderOptions.value || customReminderOptions.value.length === 0) {
    await taskStore.loadCustomReminderOptions()
  }

  if (quickAddInput.value) {
    quickAddInput.value.focus()
  }

  // 监听任务更新事件
  window.electronAPI.events.on('tasks-updated', handleTasksUpdated)

  // 监听点击外部关闭下拉菜单
  document.addEventListener('click', handleClickOutside)

  // 启动定时器
  startUpdateTimer()

  onUnmounted(() => {
    stopUpdateTimer()
    document.removeEventListener('click', handleClickOutside)
    window.electronAPI.events.removeAllListeners('tasks-updated')
  })
})

// 监听清单变化，重新加载任务
watch(() => taskStore.currentListId, () => {
  loadTasks()
}, { immediate: false })
</script>

<style scoped>
@import '@/assets/styles/components/task-panel.css';
</style>