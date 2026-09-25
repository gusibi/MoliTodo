<template>
  <!-- 竖向任务编辑区域 -->
  <div class="task-edit-vertical-container" :class="{ 'is-inline': inline }" ref="taskEditContainer">
    <div class="task-edit-vertical" :class="{ 'active': isAddingTask }">
      <!-- 可滚动内容区域 -->
      <div class="task-content-scrollable">
        <!-- 任务标题区域 -->
        <div class="task-header">
          <div class="task-header-title-wrapper">
            <!-- 复选框 -->
            <div class="flat-task-checkbox">
              <Checkbox :id="`task-edit-${task?.id || 'new'}`" :model-value="task?.status === 'done'"
                :label="t('today.taskStatusLabel')" indicator-class="flat-checkbox-label"
                @update:model-value="handleToggleComplete(task)" @click.stop />
            </div>

            <!-- 任务标题输入 -->
            <div class="task-title-input-wrapper">
              <textarea ref="addTaskInput" v-model="newTaskContent" :aria-label="t('today.taskTitleLabel')"
                :aria-invalid="!!titleError" :aria-describedby="titleError ? 'today-task-title-error' : undefined"
                :placeholder="props.isEditing ? '编辑任务...' : '添加新任务...'" class="task-title-input" maxlength="1000"
                rows="1" :style="{ minHeight: '1.5rem', maxHeight: '15rem' }" @focus="handleStartAdding"
                @blur="handleInputBlur" @keydown="handleTitleKeydown"
                @input="autoResize"></textarea>
              <p v-if="titleError" id="today-task-title-error" class="task-field-error" role="alert">{{ titleError }}</p>
              <div class="task-input-counter" v-if="isAddingTask">
                {{ newTaskContent.length }}/1000
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤区域 -->
        <div v-if="isAddingTask" class="task-steps">
          <div v-if="steps.length > 0" class="steps-list">
            <div v-for="(step, index) in steps" :key="step.id" class="step-item">
              <div class="flat-task-checkbox">
                <Checkbox :id="`step-${step.id}`" :model-value="step.status === 'done'"
                  :label="t('today.toggleStepStatus', { index: index + 1 })" indicator-class="flat-checkbox-label"
                  @update:model-value="toggleStepStatus(step)" @click.stop />
              </div>
              <input v-if="editingStepId === step.id" v-model="editingStepContent" type="text"
                class="step-content-input" :aria-label="t('today.editStepLabel', { index: index + 1 })"
                :aria-invalid="!!stepError" @blur="saveStepEdit(step)"
                @keydown="(event) => handleStepEditKeydown(event, step)" ref="stepEditInput" />
              <Button v-else variant="ghost" class="step-content"
                :class="{ 'completed': step.status === 'done' }"
                :aria-label="t('today.editStepLabel', { index: index + 1 })"
                @click.stop="startStepEdit(step)">{{ step.content }}</Button>
              <IconButton size="icon-sm" class="step-delete-btn" :label="t('tasks.deleteStep')"
                @click="requestRemoveStep(index, $event)">
                <X class="h-icon-sm w-icon-sm" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          <p v-if="stepError" class="task-field-error" role="alert">{{ stepError }}</p>
          <div class="step-add">
            <IconButton size="icon-sm" class="step-add-btn" :label="t('tasks.addStep')" @click="addStep">
              <Plus class="h-icon-sm w-icon-sm step-add-icon" aria-hidden="true" />
            </IconButton>
            <input ref="newStepInput" v-model="newStepContent" type="text" :aria-label="t('today.newStepLabel')"
              :placeholder="t('tasks.addStep')" class="step-add-input"
              @keydown.enter="handleStepAddKeydown" />
          </div>
        </div>

        <!-- 任务选项区域 -->
        <div v-if="isAddingTask" class="task-options">
          <!-- 列表选择 -->
          <div class="task-option-section-list">
            <div class="task-option-item">
              <Button variant="ghost" class="task-option-btn" @click="toggleListPicker">
                <div class="task-option-icon">
                  <Tag class="h-icon-sm w-icon-sm" aria-hidden="true" />
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ getSelectedListName() }}</div>
                </div>
              </Button>
            </div>

            <!-- 列表选择器下拉 -->
            <div v-if="showListPicker" class="task-option-dropdown">
              <div class="list-options">
                <!-- 编辑模式 -->
                <template v-if="props.isEditing">
                  <!-- 当前任务所属列表 -->
                  <div v-if="editingTask && editingTask.listId" class="current-list">
                    <div class="current-list-label">当前列表</div>
                    <Button variant="ghost" class="list-option current-list-option"
                      :class="{ 'active': selectedListId === editingTask.listId }"
                      @click="selectList(getCurrentTaskList())">
                      <div class="list-icon" :style="{ color: getCurrentTaskList()?.color }">
                        <ListIcon :name="getCurrentTaskList()?.icon" class="h-icon-sm w-icon-sm" />
                      </div>
                      <span class="list-name">{{ getCurrentTaskList()?.name }}</span>
                    </Button>
                  </div>

                  <!-- 分隔线 -->
                  <div v-if="editingTask && editingTask.listId && getOtherLists().length > 0" class="list-separator">
                  </div>

                  <!-- 其他可选列表 -->
                  <div v-if="editingTask && editingTask.listId && getOtherLists().length > 0" class="other-lists-label">
                    移动到其他列表</div>
                  <Button variant="ghost" v-for="list in getOtherLists()" :key="list.id" class="list-option"
                    :class="{ 'active': selectedListId === list.id }" @click="selectList(list)">
                    <div class="list-icon" :style="{ color: list.color }">
                      <ListIcon :name="list.icon" class="h-icon-sm w-icon-sm" />
                    </div>
                    <span class="list-name">{{ list.name }}</span>
                  </Button>
                </template>

                <!-- 添加模式：显示所有列表 -->
                <template v-else>
                  <Button variant="ghost" v-for="list in availableLists" :key="list.id" class="list-option"
                    :class="{ 'active': selectedListId === list.id }" @click="selectList(list)">
                    <div class="list-icon" :style="{ color: list.color }">
                      <ListIcon :name="list.icon" class="h-icon-sm w-icon-sm" />
                    </div>
                    <span class="list-name">{{ list.name }}</span>
                  </Button>
                </template>
              </div>
            </div>
          </div>
          <!-- 提醒设置（附属：策略化提醒） -->
          <div class="task-option-section">
            <div class="task-option-item" :class="{ 'active': selectedReminder }">
              <Button variant="ghost" class="task-option-btn" @click="toggleReminderPicker">
                <div class="task-option-icon">
                  <Bell class="h-icon-sm w-icon-sm" aria-hidden="true" />
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ selectedReminder ? getReminderDisplayText() : '提醒我' }}</div>
                </div>
              </Button>
              <Button variant="ghost" v-if="selectedReminder" class="task-option-delete" :aria-label="t('tasks.clearReminder')"
                @click="clearReminder">
                <X class="h-icon-sm w-icon-sm" aria-hidden="true" />
              </Button>
            </div>

            <!-- 提醒选择器下拉：相对开始 / 自定义绝对时间 -->
            <div v-if="showReminderPicker" class="task-option-dropdown">
              <div class="reminder-options">
                <Button variant="ghost" v-if="selectedReminder || reminderPolicy?.mode === 'disabled'" class="reminder-option"
                  @click="disableReminder">
                  <Ban class="h-icon-sm w-icon-sm reminder-option-icon" aria-hidden="true" />
                  <span>不提醒</span>
                </Button>
                <Button variant="ghost" v-for="option in reminderOptions" :key="option.id" class="reminder-option"
                  :class="{ 'reminder-option-active': isReminderOptionActive(option) }"
                  @click="selectReminderOption(option)">
                  <Clock class="h-icon-sm w-icon-sm reminder-option-icon" aria-hidden="true" />
                  <span>{{ option.label }}</span>
                </Button>
              </div>
            </div>
          </div>

          <!-- 安排时间（一级入口：计划开始 / 结束） -->
          <div class="task-option-section">
            <div class="task-option-item" :class="{ 'active': scheduleStart }">
              <Button variant="ghost" class="task-option-btn" ref="scheduleStartBtn"
                @click="openPickerFor('scheduleStart', scheduleStartBtn)">
                <div class="task-option-icon">
                  <CalendarDays class="h-icon-sm w-icon-sm" aria-hidden="true" />
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ scheduleStart ? formatScheduleText() : t('tasks.addSchedule') }}</div>
                </div>
              </Button>
              <Button variant="ghost" v-if="scheduleStart" class="task-option-delete" :aria-label="t('tasks.clearSchedule')"
                @click="clearSchedule">
                <X class="h-icon-sm w-icon-sm" aria-hidden="true" />
              </Button>
            </div>

            <!-- 结束时间：只在设置开始后出现 -->
            <div v-if="scheduleStart" class="task-option-item task-option-subitem" :class="{ 'active': scheduleEnd }">
              <Button variant="ghost" class="task-option-btn" ref="scheduleEndBtn"
                @click="openPickerFor('scheduleEnd', scheduleEndBtn)">
                <div class="task-option-icon">
                  <Hourglass class="h-icon-sm w-icon-sm" aria-hidden="true" />
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ scheduleEnd ? formatScheduleEndText() : t('tasks.addScheduleEnd') }}</div>
                </div>
              </Button>
              <Button variant="ghost" v-if="scheduleEnd" class="task-option-delete" :aria-label="t('tasks.clearScheduleEnd')"
                @click="clearScheduleEnd">
                <X class="h-icon-sm w-icon-sm" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <!-- 截止日期（一级入口） -->
          <div class="task-option-section" ref="datePickerSection">
            <div class="task-option-item" :class="{ 'active': selectedDate }">
              <Button variant="ghost" class="task-option-btn" ref="datePickerBtn" @click="openPickerFor('deadline', datePickerBtn)">
                <div class="task-option-icon">
                  <CalendarClock class="h-icon-sm w-icon-sm" aria-hidden="true" />
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ selectedDate ? formatSelectedDate(selectedDate) : t('tasks.addDeadline') }}
                  </div>
                </div>
              </Button>
              <!-- 日期型截止与日期+时间截止的切换 -->
              <Button variant="ghost" v-if="selectedDate && selectedTime" class="task-option-mini" @click="makeDeadlineDateOnly"
                :title="t('tasks.clearDeadlineTime')">
                仅日期
              </Button>
              <Button variant="ghost" v-if="selectedDate && !selectedTime" class="task-option-mini" @click="openPickerFor('deadline', datePickerBtn)"
                :title="t('tasks.addDeadlineTime')">
                加时间
              </Button>
              <Button variant="ghost" v-if="selectedDate" class="task-option-delete" :aria-label="t('tasks.clearDeadline')"
                @click="clearDateTime">
                <X class="h-icon-sm w-icon-sm" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <!-- 时间模型提示（计划晚于截止 / 错过的相对提醒 / 无效旧截止） -->
          <div v-if="timeHintText" class="task-option-warning">
            <TriangleAlert class="h-icon-sm w-icon-sm" aria-hidden="true" />
            <span>{{ timeHintText }}</span>
          </div>
          <p v-if="timeSaveError" class="task-field-error" role="alert">{{ timeSaveError }}</p>
          
          <!-- 日期选择器 Portal - 固定定位在最上层 -->
          <Teleport to="body">
            <div v-if="showDatePicker" class="date-picker-overlay">
              <div class="date-picker-backdrop" @click="showDatePicker = false"></div>
              <div
                class="date-picker-popup-fixed"
                :style="datePickerStyle"
                @click.stop
              >
                <div class="date-picker-title">{{ datePickerTitle }}</div>
                <v-date-picker
                  v-model="dateTimeValue"
                  mode="dateTime"
                  is24hr
                  :minute-increment="5"
                  :is-dark="isDark"
                  :min-date="pickerMinDate"
                  @update:modelValue="handleDateTimeChange"
                  class="v-calendar"
                ></v-date-picker>
              </div>
            </div>
          </Teleport>

          <!-- 重复设置 -->
          <div class="task-option-section">
            <div class="task-option-item" :class="{ 'active': !!selectedRecurrence }">
              <Button variant="ghost" class="task-option-btn" @click="toggleRepeatPicker">
                <div class="task-option-icon">
                  <Repeat2 class="h-icon-sm w-icon-sm" aria-hidden="true" />
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ t('today.recurrenceLabel') }}</div>
                </div>
              </Button>
              <Switch class="task-option-switch" :model-value="!!selectedRecurrence"
                :label="t('today.recurrenceLabel')" @update:model-value="toggleRepeatEnabled" />
            </div>

            <!-- 重复配置面板 -->
            <div v-if="showRepeatPicker && selectedRecurrence" class="task-option-dropdown">
              <RepeatSelector v-model="selectedRecurrence" :base-date="getBaseDate()"
                @update:modelValue="handleRecurrenceChange" />
            </div>
          </div>

        </div>

        <!-- 备注区域 -->
        <div v-if="isAddingTask" class="task-note">
          <div class="task-note-editor">
            <div class="task-note-input-wrapper">
              <textarea ref="noteInput" v-model="taskNote" :aria-label="t('today.taskNoteLabel')"
                :aria-invalid="!!noteError" :aria-describedby="noteError ? 'today-task-note-error' : undefined"
                :placeholder="t('today.addNote')" class="task-note-textarea" maxlength="1000" :rows="inline ? 2 : 5"
                :style="{ minHeight: '3rem', maxHeight: '15rem' }" @input="autoResizeNote"
                @blur="handleNoteBlur" @keydown="handleNoteKeydown"></textarea>
              <p v-if="noteError" id="today-task-note-error" class="task-field-error" role="alert">{{ noteError }}</p>
              <div class="task-note-counter">{{ taskNote.length }}/1000</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div v-if="isAddingTask" class="task-actions">
        <div class="task-actions-left">
          <IconButton size="icon-sm" class="task-action-close" :label="t('common.close')" @click="handleCancelAdding">
            <X class="h-icon-md w-icon-md" aria-hidden="true" />
          </IconButton>
        </div>

        <div class="task-actions-center">
          <span v-if="props.isEditing" class="task-created-date">创建于 {{ formatCreatedDate() }}</span>
        </div>

        <div class="task-actions-right">
          <IconButton v-if="props.isEditing" size="icon-sm" class="task-action-delete" :label="t('tasks.deleteTask')"
            @click="handleDeleteTask">
            <Trash2 class="h-icon-md w-icon-md" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </div>

    <!-- 步骤删除确认 -->
    <AlertDialog :open="stepDeleteOpen" :title="t('tasks.deleteStep')"
      :description="t('tasks.confirmDeleteStep')" :cancel-label="t('common.cancel')"
      :confirm-label="t('common.delete')" confirm-variant="destructive" :loading="stepDeleteLoading"
      :error="stepDeleteError"
      @update:open="(value) => { if (!value) stepDeleteOpen = false }" @confirm="confirmRemoveStep"
      @cancel="cancelRemoveStep" />
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted, onUnmounted, defineExpose, computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { localeCode } from '../utils/locale-format.js'
import { localDateKey } from '../utils/task-time-rules.js'
import { storeToRefs } from 'pinia'
import {
  Ban,
  Bell,
  CalendarClock,
  CalendarDays,
  Clock,
  Hourglass,
  Plus,
  Repeat2,
  Tag,
  Trash2,
  TriangleAlert,
  X
} from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import { useTheme } from '@/composables/useTheme'
import RepeatSelector from './RepeatSelector.vue'
import ListIcon from './ui/ListIcon.vue'
import AlertDialog from './ui/alert-dialog/AlertDialog.vue'
import Button from './ui/button/Button.vue'
import IconButton from './ui/button/IconButton.vue'
import Checkbox from './ui/checkbox/Checkbox.vue'
import Switch from './ui/switch/Switch.vue'
import { isVirtualInstance } from '../utils/today-agenda.js'

// 导入 V-Calendar 样式文件
import 'v-calendar/style.css'

// 定义 props
const props = defineProps({
  task: {
    type: Object,
    default: null
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  inline: {
    type: Boolean,
    default: false
  }
})

// 定义事件
const emit = defineEmits(['add-task', 'update-task', 'cancel-edit', 'delete-task'])
const editorCoordinator = props.inline ? inject('todayTaskEditorCoordinator', null) : null

// 使用 taskStore
const taskStore = useTaskStore()
const { t, locale } = useI18n()
const { customReminderOptions: storeCustomReminderOptions, lists } = storeToRefs(taskStore)

const materializedTask = ref(null)
const timeSaveError = ref('')
const pendingTaskWrites = new Set()
let materializationPromise = null
const editingTask = computed(() => {
  const task = materializedTask.value || props.task
  if (!task) return null
  return taskStore.tasks.find((item) => item.id === task.id) || task
})

function taskIdentity(task) {
  const occurrenceDate = localDateKey(task?.occurrenceDate)
  if (task?.seriesId && occurrenceDate) {
    return `occurrence:${task.seriesId}:${occurrenceDate}`
  }
  return task ? `task:${task.id}` : ''
}

async function ensureEditableTask() {
  const task = editingTask.value
  if (!task) return null
  if (!isVirtualInstance(task)) return task
  if (materializationPromise) return materializationPromise

  materializationPromise = (async () => {
    const result = await taskStore.updateRecurringInstance(task.seriesId, task.occurrenceDate, {})
    if (!result?.success || !result.task) return null

    materializedTask.value = result.task
    return result.task
  })()
  try {
    return await materializationPromise
  } finally {
    materializationPromise = null
  }
}

async function saveTaskUpdates(task, updates) {
  const serializableUpdates = JSON.parse(JSON.stringify(updates))
  if (task?.seriesId && task?.occurrenceDate) {
    const result = await taskStore.updateRecurringInstance(task.seriesId, task.occurrenceDate, serializableUpdates)
    if (result?.success && result.task) materializedTask.value = result.task
    return result
  }
  return taskStore.updateTask(task.id, serializableUpdates)
}

function trackTaskWrite(promise) {
  const tracked = Promise.resolve(promise)
  pendingTaskWrites.add(tracked)
  tracked.then(
    () => pendingTaskWrites.delete(tracked),
    () => pendingTaskWrites.delete(tracked)
  )
  return tracked
}

async function updateCurrentTask(updates) {
  return trackTaskWrite((async () => {
    const task = editingTask.value
    if (!task) throw new Error(t('today.saveFailed', { error: '' }))
    const result = await saveTaskUpdates(task, updates)
    if (!result?.success) {
      timeSaveError.value = t('today.saveFailed', { error: result?.error || '' })
      throw new Error(result?.error || t('today.saveFailed', { error: '' }))
    }
    timeSaveError.value = ''
    return result
  })())
}

let metadataWriteQueue = Promise.resolve()

async function updateCurrentMetadata(mutateMetadata) {
  return trackTaskWrite((async () => {
    const task = editingTask.value
    if (!task) return { success: false, error: t('today.saveFailed', { error: '' }) }

    const write = metadataWriteQueue.then(async () => {
      const currentTask = editingTask.value || task
      const latestTask = taskStore.tasks.find((item) => item.id === currentTask.id) || currentTask
      const metadata = await mutateMetadata(latestTask.metadata || {})
      return saveTaskUpdates(currentTask, { metadata })
    })
    metadataWriteQueue = write.then(() => undefined, () => undefined)
    return write
  })())
}

// 使用主题
const { isDark } = useTheme()

// 组件根元素引用
const taskEditContainer = ref(null)
const addTaskInput = ref(null)
const noteInput = ref(null)
const fileInput = ref(null)
const datePickerBtn = ref(null)
const datePickerSection = ref(null)

// 任务相关状态
const newTaskContent = ref('')
const lastSavedTitle = ref('')
const isAddingTask = ref(false)
const isImportant = ref(false)
const taskNote = ref('')
const lastSavedNote = ref('')
const titleError = ref('')
const noteError = ref('')
const stepError = ref('')

// 防抖定时器
let noteDebounceTimer = null

// 步骤相关状态
const steps = ref([])
const newStepContent = ref('')
const newStepInput = ref(null)
const stepAddInProgress = ref(false)
const editingStepId = ref(null)
const editingStepContent = ref('')
const stepSaveInProgress = ref(false)

// 日期时间相关状态
const selectedDate = ref('')
const selectedTime = ref('')
const dateTimeValue = ref(null)
const showDatePicker = ref(false)
// 日期选择器用途：截止 / 安排开始 / 安排结束 / 自定义绝对提醒
const datePickerMode = ref('deadline')

// 安排相关状态
const scheduleStart = ref(null)
const scheduleEnd = ref(null)
const scheduleStartBtn = ref(null)
const scheduleEndBtn = ref(null)

// 时间模型提示（计划晚于截止 / 错过的相对提醒）
const timeWarning = ref('')

// 提醒相关状态
const selectedReminder = ref(null)
const showReminderPicker = ref(false)
const reminderPolicy = ref(null)

// 列表选择相关状态
const selectedListId = ref(null)
const showListPicker = ref(false)
const availableLists = lists

// 重复任务相关状态
const selectedRecurrence = ref(null)
const showRepeatPicker = ref(false)

// 使用 storeToRefs 确保响应式
const customReminderOptions = storeCustomReminderOptions

// 日期选择器位置状态
const datePickerPosition = ref({ top: 0, left: 0, showAbove: false })

// 日期选择器样式（动态计算位置）
const datePickerStyle = computed(() => {
  const pos = datePickerPosition.value
  return {
    position: 'fixed',
    left: `${pos.left}px`,
    top: pos.showAbove ? 'auto' : `${pos.top}px`,
    bottom: pos.showAbove ? `${window.innerHeight - pos.top + 8}px` : 'auto',
    zIndex: 9999
  }
})

// 切换日期选择器并计算位置（按用途初始化选择器当前值）
const openPickerFor = (mode, btnEl) => {
  if (showDatePicker.value && datePickerMode.value === mode) {
    showDatePicker.value = false
    return
  }

  datePickerMode.value = mode
  if (mode === 'deadline') {
    dateTimeValue.value = selectedDate.value && selectedTime.value
      ? new Date(`${selectedDate.value}T${selectedTime.value}:00`)
      : null
  } else if (mode === 'scheduleStart') {
    dateTimeValue.value = scheduleStart.value ? new Date(scheduleStart.value) : null
  } else if (mode === 'scheduleEnd') {
    dateTimeValue.value = scheduleEnd.value ? new Date(scheduleEnd.value) : null
  } else if (mode === 'reminderAbsolute') {
    dateTimeValue.value = null
    showReminderPicker.value = false
  }

  // 计算按钮位置（模板传入的是 ref 对象）
  const anchor = (btnEl && (btnEl.value || btnEl)) || datePickerBtn.value
  const anchorBtn = anchor?.el?.value || anchor?.$el || anchor
  if (anchorBtn) {
    const rect = anchorBtn.getBoundingClientRect()
    const pickerHeight = 380 // 预估的选择器高度
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    // 优先在下方显示，空间不足时在上方
    const showAbove = spaceBelow < pickerHeight && spaceAbove > spaceBelow

    datePickerPosition.value = {
      top: showAbove ? rect.top : rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)), // 确保不超出屏幕
      showAbove
    }
  }

  showDatePicker.value = true
}

// 选择器标题与最小日期：仅“新绝对提醒”限制不能选过去
const datePickerTitle = computed(() => {
  switch (datePickerMode.value) {
    case 'scheduleStart': return t('tasks.scheduleStartLabel')
    case 'scheduleEnd': return '计划结束时间'
    case 'reminderAbsolute': return t('tasks.customReminder')
    default: return t('tasks.deadlineLabel')
  }
})

const pickerMinDate = computed(() => (datePickerMode.value === 'reminderAbsolute' ? new Date() : null))

// 获取本地日期字符串（避免时区问题）
const getLocalDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 开始添加任务
const handleStartAdding = () => {
  isAddingTask.value = true
  nextTick(() => {
    if (addTaskInput.value) {
      addTaskInput.value.focus()
    }
  })
}

// 取消添加任务
const handleCancelAdding = async (options = {}) => {
  if (props.isEditing) {
    if (props.inline && !await flushPendingChanges()) return
    if (props.inline) {
      editorCoordinator?.close(taskIdentity(props.task), { restoreFocus: options?.restoreFocus !== false })
    }
    emit('cancel-edit', { restoreFocus: options?.restoreFocus !== false })
  } else {
    resetAllStates()
  }
}

const handleSaveAndClose = async () => {
  if (!props.inline) {
    await handleSaveTaskContent()
    return
  }
  await handleCancelAdding()
}

const handleTitleKeydown = (event) => {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    handleSaveAndClose()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    handleTitleEscape()
  }
}

const handleTitleEscape = async () => {
  if (contentDebounceTimer.value) clearTimeout(contentDebounceTimer.value)
  const committedTitle = lastSavedTitle.value
  const hasUncommittedTitle = titleError.value || newTaskContent.value !== committedTitle
  await titleSaveQueue
  if ((editingTask.value?.content || '') !== committedTitle) {
    try {
      await updateCurrentTask({ content: committedTitle })
    } catch (error) {
      titleError.value = t('today.saveFailed', { error: error?.message || '' })
      return
    }
  }
  lastSavedTitle.value = committedTitle
  if (hasUncommittedTitle) {
    newTaskContent.value = committedTitle
    titleError.value = ''
    nextTick(() => addTaskInput.value?.focus())
    return
  }

  titleError.value = ''
  handleCancelAdding()
}

const flushPendingChanges = async () => {
  if (contentDebounceTimer.value) {
    clearTimeout(contentDebounceTimer.value)
    contentDebounceTimer.value = null
  }
  if (noteDebounceTimer) {
    clearTimeout(noteDebounceTimer)
    noteDebounceTimer = null
  }
  showDatePicker.value = false
  showReminderPicker.value = false
  showListPicker.value = false
  showRepeatPicker.value = false

  const titleSaved = await handleSaveTaskContent()
  const noteSaved = await saveTaskNote()
  try {
    await Promise.all([...pendingTaskWrites])
  } catch {
    // Individual fields keep their own visible errors and drafts.
  }
  await metadataWriteQueue
  const canClose = titleSaved && noteSaved && !titleError.value && !noteError.value && !stepError.value && !timeSaveError.value
  return canClose
}

// 重置所有状态
const resetAllStates = () => {
  isAddingTask.value = false
  newTaskContent.value = ''
  isImportant.value = false
  taskNote.value = ''
  steps.value = []
  newStepContent.value = ''
  selectedDate.value = ''
  selectedTime.value = ''
  dateTimeValue.value = null
  showDatePicker.value = false
  selectedReminder.value = null
  reminderPolicy.value = null
  scheduleStart.value = null
  scheduleEnd.value = null
  timeWarning.value = ''
  selectedRecurrence.value = null
  showReminderPicker.value = false
  showListPicker.value = false
  showRepeatPicker.value = false

  // 重新设置默认列表
  if (taskStore.currentListId) {
    selectedListId.value = taskStore.currentListId
  } else if (availableLists.value.length > 0) {
    selectedListId.value = availableLists.value[0].id
  }
}

// 处理输入框失焦
const handleInputBlur = async (event) => {
  // 如果是编辑模式，先保存内容
  if (props.isEditing && props.task && newTaskContent.value.trim()) {
    if (contentDebounceTimer.value) clearTimeout(contentDebounceTimer.value)
    await handleSaveTaskContent()
  }

  // 延迟处理，避免与按钮点击冲突
  setTimeout(() => {
    if (!taskEditContainer.value?.contains(document.activeElement)) {
      if (!newTaskContent.value.trim() && !props.isEditing) {
        resetAllStates()
      }
    }
  }, 150)
}

// 处理点击外部区域
const handleClickOutside = (event) => {
  if (taskEditContainer.value && !taskEditContainer.value.contains(event.target)) {
    const target = event.target instanceof Element ? event.target : null
    const targetRow = target?.closest('.today-task-row')
    const isEditorOverlay = target?.closest('.date-picker-overlay, [role="dialog"], [role="alertdialog"]')
    if (isEditorOverlay) return

    if (!newTaskContent.value.trim() && !props.isEditing) {
      resetAllStates()
    }
    // 点击外部关闭所有选择器
    showDatePicker.value = false
    showReminderPicker.value = false
    showListPicker.value = false
    showRepeatPicker.value = false

    if (props.inline && !targetRow && !isEditorOverlay) {
      handleCancelAdding({ restoreFocus: false })
    }
  }
}

// 添加步骤
const addStep = async () => {
  if (stepAddInProgress.value) return
  const stepContent = newStepContent.value.trim()
  if (!stepContent) return

  if (props.isEditing && props.task) {
    const target = await ensureEditableTask()
    if (!target) {
      stepError.value = t('today.saveFailed', { error: '' })
      return
    }
    const newStep = { id: Date.now().toString(), content: stepContent, status: 'todo' }
    stepAddInProgress.value = true
    try {
      const result = await updateCurrentMetadata((metadata) => ({
        ...metadata,
        steps: [...(metadata.steps || []), newStep]
      }))
      if (!result?.success) {
        stepError.value = t('today.saveFailed', { error: result?.error || '' })
        return
      }
      steps.value.push(newStep)
      newStepContent.value = ''
      stepError.value = ''
      await nextTick()
      newStepInput.value?.focus()
    } catch (error) {
      stepError.value = t('today.saveFailed', { error: error?.message || '' })
    } finally {
      stepAddInProgress.value = false
    }
    return
  }

  steps.value.push({ id: Date.now(), content: stepContent, status: 'todo' })
  newStepContent.value = ''
  stepError.value = ''
}

const handleStepAddKeydown = (event) => {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key !== 'Enter') return
  event.preventDefault()
  addStep()
}

// 删除步骤：统一走 AlertDialog 确认，失败保留上下文可重试
const stepDeleteOpen = ref(false)
const stepDeleteIndex = ref(-1)
const stepDeleteLoading = ref(false)
const stepDeleteError = ref('')
let stepDeleteTrigger = null

const requestRemoveStep = (index, event) => {
  stepDeleteIndex.value = index
  stepDeleteTrigger = event?.currentTarget || null
  stepDeleteError.value = ''
  stepDeleteLoading.value = false
  stepDeleteOpen.value = true
}

const confirmRemoveStep = async () => {
  if (stepDeleteLoading.value) return
  const index = stepDeleteIndex.value
  const step = steps.value[index]
  if (!step) {
    stepDeleteOpen.value = false
    return
  }

  stepDeleteLoading.value = true
  stepDeleteError.value = ''
  try {
    if (props.isEditing && props.task) {
      const result = await updateCurrentMetadata((metadata) => ({
        ...metadata,
        steps: (metadata.steps || []).filter((item) => item.id !== step.id)
      }))
      if (!result || result.success === false) {
        stepDeleteError.value = t('tasks.deleteFailed', { error: result?.error || '' })
        return
      }
    }
    steps.value.splice(index, 1)
    stepDeleteOpen.value = false
    stepDeleteIndex.value = -1
    stepError.value = ''
    nextTick(() => {
      if (stepDeleteTrigger && document.contains(stepDeleteTrigger)) stepDeleteTrigger.focus()
    })
  } catch (error) {
    console.error('删除步骤失败:', error)
    stepDeleteError.value = t('tasks.deleteFailed', { error: error?.message || '' })
  } finally {
    stepDeleteLoading.value = false
  }
}

const cancelRemoveStep = () => {
  stepDeleteOpen.value = false
  stepDeleteIndex.value = -1
  stepDeleteError.value = ''
  nextTick(() => {
    if (stepDeleteTrigger && document.contains(stepDeleteTrigger)) stepDeleteTrigger.focus()
  })
}

// 切换步骤状态
const toggleStepStatus = async (step) => {
  // 立即更新本地状态以提供即时反馈
  const previousStatus = step.status
  const newStatus = step.status === 'done' ? 'todo' : 'done'
  step.status = newStatus

  // 如果是编辑模式且有任务，同时更新服务器状态
  if (props.isEditing && props.task) {
    try {
      const result = await updateCurrentMetadata((metadata) => ({
        ...metadata,
        steps: (metadata.steps || []).map((item) => item.id === step.id ? { ...item, status: newStatus } : item)
      }))
      if (!result || result.success === false) throw new Error(result?.error || '保存失败')
      stepError.value = ''
      if (newStatus === 'done' && editingTask.value?.status === 'todo') {
        const task = await ensureEditableTask()
        if (task) {
          const statusResult = await trackTaskWrite(taskStore.startTask(task.id))
          if (!statusResult?.success) {
            timeSaveError.value = t('today.saveFailed', { error: statusResult?.error || '' })
          }
        }
      }
    } catch (error) {
      console.error('更新步骤状态失败:', error)
      step.status = previousStatus
      stepError.value = t('today.saveFailed', { error: error?.message || '' })
    }
  }
}

// 开始编辑步骤
const startStepEdit = (step) => {
  editingStepId.value = step.id
  editingStepContent.value = step.content

  // 下一帧聚焦到输入框
  nextTick(() => {
    const input = document.querySelector('.step-content-input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// 保存步骤编辑
const saveStepEdit = async (step) => {
  if (stepSaveInProgress.value) return
  if (!editingStepContent.value.trim()) {
    cancelStepEdit()
    return
  }

  const newContent = editingStepContent.value.trim()
  if (newContent === step.content) {
    cancelStepEdit()
    return
  }

  if (props.isEditing && props.task) {
    stepSaveInProgress.value = true
    try {
      const result = await updateCurrentMetadata((metadata) => ({
        ...metadata,
        steps: (metadata.steps || []).map((item) => item.id === step.id ? { ...item, content: newContent } : item)
      }))
      if (!result || result.success === false) {
        stepError.value = t('today.saveFailed', { error: result?.error || '' })
        return
      }
      step.content = newContent
      stepError.value = ''
      cancelStepEdit()
    } catch (error) {
      console.error('更新步骤失败:', error)
      stepError.value = t('today.saveFailed', { error: error?.message || '' })
    } finally {
      stepSaveInProgress.value = false
    }
  } else {
    // 新建模式：本地更新步骤
    step.content = newContent
    cancelStepEdit()
  }
}

// 取消步骤编辑
const cancelStepEdit = () => {
  editingStepId.value = null
  editingStepContent.value = ''
}

const handleStepEditKeydown = (event, step) => {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Enter') {
    event.preventDefault()
    saveStepEdit(step)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    cancelStepEdit()
  }
}

// 切换提醒选择器
const toggleReminderPicker = async () => {
  showReminderPicker.value = !showReminderPicker.value
  showListPicker.value = false

  // 每次打开提醒选择器时重新加载提醒选项，确保数据最新
  if (showReminderPicker.value) {
    await taskStore.refreshCustomReminderOptions()
  }
}



// 切换重复功能开关
const toggleRepeatEnabled = async (enabled) => {
  if (enabled) {
    // 开启重复时，设置默认的重复配置
    selectedRecurrence.value = {
      type: 'daily',
      interval: 1
    }
    // 开启时自动展开面板
    showRepeatPicker.value = true
  } else {
    // 关闭重复时，清除重复配置
    selectedRecurrence.value = null
    // 关闭时收起面板
    showRepeatPicker.value = false
  }
  // 关闭其他选择器
  showReminderPicker.value = false
  showListPicker.value = false

  // 如果是编辑模式，自动保存重复配置
  if (props.isEditing && props.task) {
    await handleSaveRecurrence()
  }
}

// 切换重复面板展开状态
const toggleRepeatPicker = () => {
  // 只有在已启用重复功能时才能切换面板
  if (selectedRecurrence.value) {
    showRepeatPicker.value = !showRepeatPicker.value
    // 关闭其他选择器
    showReminderPicker.value = false
    showListPicker.value = false
  }
}

// 处理重复规则变化
const handleRecurrenceChange = async (recurrence) => {
  selectedRecurrence.value = recurrence

  // 如果是编辑模式，自动保存重复配置
  if (props.isEditing && props.task) {
    await handleSaveRecurrence()
  }
}

// 保存重复配置
const handleSaveRecurrence = async () => {
  if (!props.task || !props.isEditing) return

  try {
    const task = await ensureEditableTask()
    if (!task) throw new Error(t('today.saveFailed', { error: '' }))
    // 清理重复规则对象，确保可序列化
    const cleanRecurrence = selectedRecurrence.value ? {
      type: selectedRecurrence.value.type,
      interval: selectedRecurrence.value.interval,
      daysOfWeek: selectedRecurrence.value.daysOfWeek || [],
      byMonthDay: selectedRecurrence.value.byMonthDay || null,
      byWeekDay: selectedRecurrence.value.byWeekDay || null,
      byMonth: selectedRecurrence.value.byMonth || null,
      endCondition: selectedRecurrence.value.endCondition || null,
      reminderTime: selectedRecurrence.value.reminderTime || null
    } : null

    const updates = {
      recurrence: cleanRecurrence
    }

    if (task.seriesId && selectedRecurrence.value) {
      // 更新重复任务系列
      const result = await trackTaskWrite(taskStore.updateRecurringTask(task.id, updates, cleanRecurrence))
      if (!result?.success) throw new Error(result?.error || '')
    } else if (selectedRecurrence.value && !task.seriesId) {
      // 将普通任务转换为重复任务
      const result = await trackTaskWrite(taskStore.updateRecurringTask(task.id, updates, cleanRecurrence))
      if (!result?.success) throw new Error(result?.error || '')
    } else if (!selectedRecurrence.value && task.seriesId) {
      // 将重复任务转换为普通任务
      await updateCurrentTask( {
        seriesId: null,
        recurrence: null
      })
    } else {
      // 更新普通任务的重复配置
      await updateCurrentTask( updates)
    }

    console.log('重复配置已自动保存:', cleanRecurrence)
  } catch (error) {
    console.error('自动保存重复配置失败:', error)
    timeSaveError.value = t('today.saveFailed', { error: error?.message || '' })
  }
}

// 切换列表选择器
const toggleListPicker = () => {
  showListPicker.value = !showListPicker.value
  showReminderPicker.value = false
}


// 清除日期时间
const clearDateTime = () => {
  selectedDate.value = ''
  selectedTime.value = ''
  dateTimeValue.value = null
  showDatePicker.value = false
}

// 清除提醒（显式关闭，改期不会自动恢复通知）
const clearReminder = async () => {
  selectedReminder.value = null
  reminderPolicy.value = { mode: 'disabled', minutesBefore: null }

  // 如果是编辑模式，自动保存提醒时间清除
  if (props.isEditing && props.task) {
    try {
      await updateCurrentTask( {
        reminderPolicy: { mode: 'disabled', minutesBefore: null }
      })
      console.log('提醒已清除并自动保存')
    } catch (error) {
      console.error('自动保存提醒清除失败:', error)
    }
  }
}



// 安排时间显示：今天 / 明天 / 本地日期 + 开始时刻（结束单独展示）
const formatScheduleText = () => {
  if (!scheduleStart.value) return ''
  const start = new Date(scheduleStart.value)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const todayStr = getLocalDateString(today)
  const tomorrowStr = getLocalDateString(tomorrow)
  const startStr = getLocalDateString(start)
  const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`

  if (startStr === todayStr) return t('tasks.startsToday', { time: timeStr })
  if (startStr === tomorrowStr) return t('tasks.startsTomorrow', { time: timeStr })
  const dateText = start.toLocaleDateString(localeCode(locale.value), { month: 'short', day: 'numeric' })
  return `${dateText} ${timeStr}`
}

// 结束时间显示：同日只显示时刻，跨日显示完整日期
const formatScheduleEndText = () => {
  if (!scheduleEnd.value) return ''
  const end = new Date(scheduleEnd.value)
  const start = scheduleStart.value ? new Date(scheduleStart.value) : null
  const timeStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`

  if (start && getLocalDateString(start) === getLocalDateString(end)) {
    return t('tasks.endsAt', { time: timeStr })
  }
  const dateText = end.toLocaleDateString(localeCode(locale.value), { month: 'short', day: 'numeric' })
  return t('tasks.endsAt', { time: `${dateText} ${timeStr}` })
}

// 选择列表
const selectList = (list) => {
  selectedListId.value = list.id
  showListPicker.value = false

  // 如果是编辑模式且列表发生变化，立即更新任务列表
  if (props.isEditing && editingTask.value && editingTask.value.listId !== list.id) {
    handleUpdateTaskList(list.id)
  }
}

// 更新任务列表（轻量级方法，只更新列表）
const handleUpdateTaskList = async (newListId) => {
  if (!props.task || !props.isEditing) return

  try {
    const task = await ensureEditableTask()
    if (!task) throw new Error(t('today.saveFailed', { error: '' }))
    const result = await trackTaskWrite(taskStore.moveTaskToList(task.id, newListId))
    if (result.success) {
      selectedListId.value = newListId
      timeSaveError.value = ''
      console.log('任务列表更新成功')
    } else {
      console.error('更新任务列表失败:', result.error)
      // 恢复原来的选择
      selectedListId.value = editingTask.value?.listId
      timeSaveError.value = t('today.saveFailed', { error: result?.error || '' })
      return
    }
  } catch (error) {
    console.error('更新任务列表失败:', error)
    selectedListId.value = editingTask.value?.listId
    timeSaveError.value = t('today.saveFailed', { error: error?.message || '' })
  }
}

// 获取选中的列表名称
const getSelectedListName = () => {
  const selectedList = availableLists.value.find(list => list.id === selectedListId.value)
  return selectedList ? selectedList.name : '选择列表'
}

// 获取当前任务列表
const getCurrentTaskList = () => {
  if (editingTask.value && editingTask.value.listId) {
    return availableLists.value.find(list => list.id === editingTask.value.listId)
  }
  return null
}

// 获取其他列表
const getOtherLists = () => {
  if (editingTask.value && editingTask.value.listId) {
    return availableLists.value.filter(list => list.id !== editingTask.value.listId)
  }
  return availableLists.value
}

// 获取提醒显示文本
const getReminderDisplayText = () => {
  return selectedReminder.value ? selectedReminder.value.label : '提醒我'
}



// 获取最小日期
const getMinDate = () => {
  const today = new Date()
  return getLocalDateString(today)
}



// 获取 VueDatePicker 的最小时间
const getMinTimeForDatePicker = () => {
  const now = new Date()
  if (dateTimeValue.value) {
    const selectedDateObj = new Date(dateTimeValue.value)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDateObj.setHours(0, 0, 0, 0)

    if (selectedDateObj.getTime() === today.getTime()) {
      return { hours: now.getHours(), minutes: now.getMinutes() }
    }
  }
  return { hours: 0, minutes: 0 }
}

// 处理日期时间变化：按选择器用途分流（截止 / 安排开始 / 安排结束 / 绝对提醒）
const handleDateTimeChange = async (newValue) => {
  if (datePickerMode.value === 'scheduleStart') {
    if (!newValue) return
    const start = newValue instanceof Date ? newValue : new Date(newValue)
    const currentStart = scheduleStart.value ? new Date(scheduleStart.value) : null
    const currentEnd = scheduleEnd.value ? new Date(scheduleEnd.value) : null
    const duration = currentStart && currentEnd
      ? currentEnd.getTime() - currentStart.getTime()
      : null
    scheduleStart.value = start
    if (duration !== null && duration >= 0) {
      scheduleEnd.value = new Date(start.getTime() + duration)
    }
    await saveSchedule()
    return
  }

  if (datePickerMode.value === 'scheduleEnd') {
    if (!newValue) return
    const end = newValue instanceof Date ? newValue : new Date(newValue)
    if (scheduleStart.value && end.getTime() < new Date(scheduleStart.value).getTime()) {
      alert(t('tasks.scheduleEndBeforeStart'))
      return
    }
    scheduleEnd.value = end
    await saveSchedule()
    return
  }

  if (datePickerMode.value === 'reminderAbsolute') {
    if (!newValue) return
    const reminderTime = newValue instanceof Date ? newValue : new Date(newValue)
    if (reminderTime.getTime() <= Date.now()) {
      alert(t('tasks.reminderInPast'))
      return
    }
    await saveAbsoluteReminder(reminderTime)
    showDatePicker.value = false
    return
  }

  // 截止时间
  if (newValue) {
    const date = newValue instanceof Date ? newValue : new Date(newValue)
    selectedDate.value = getLocalDateString(date)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    selectedTime.value = `${hours}:${minutes}`

    // 选择后不自动关闭日期选择器，方便用户调整时间
    // showDatePicker.value = false

    // 如果是编辑模式，自动保存截止时间
    if (props.isEditing && props.task) {
      try {
        const result = await updateCurrentTask( {
          dueDate: selectedDate.value,
          dueTime: selectedTime.value
        })
        applyTimeWarning(result)
        console.log('截止时间已自动保存:', selectedDate.value, selectedTime.value)
      } catch (error) {
        console.error('自动保存截止时间失败:', error)
      }
    }
  } else {
    selectedDate.value = ''
    selectedTime.value = ''

    // 如果是编辑模式且清除了时间，也要自动保存
    if (props.isEditing && props.task) {
      try {
        await updateCurrentTask( { dueDate: null })
        console.log('截止时间已清除并自动保存')
      } catch (error) {
        console.error('自动保存截止时间清除失败:', error)
      }
    }
  }
}

// 截止改为日期型（清除时刻，保留日期）
const makeDeadlineDateOnly = async () => {
  if (!selectedDate.value) return
  selectedTime.value = ''
  if (props.isEditing && props.task) {
    try {
      await updateCurrentTask( {
        dueDate: selectedDate.value,
        dueTime: null
      })
      console.log('截止已改为仅日期:', selectedDate.value)
    } catch (error) {
      console.error('截止改为日期型失败:', error)
    }
  }
}

// 保存计划安排（开始 / 结束一起提交，服务端原子校验）
const saveSchedule = async () => {
  if (!(props.isEditing && props.task)) return
  try {
    const result = await updateCurrentTask( {
      scheduledStartAt: scheduleStart.value ? new Date(scheduleStart.value).toISOString() : null,
      scheduledEndAt: scheduleEnd.value ? new Date(scheduleEnd.value).toISOString() : null
    })
    applyTimeWarning(result)
    // 相对提醒跟随开始时间变化，禁用时同步本地显示
    syncReminderFromResult(result)
    console.log('计划安排已自动保存')
  } catch (error) {
    console.error('自动保存计划安排失败:', error)
    alert(error?.message || '计划安排保存失败')
  }
}

// 清除安排（同步清除结束；相对提醒转关闭）
const clearSchedule = async () => {
  scheduleStart.value = null
  scheduleEnd.value = null
  showDatePicker.value = false
  await saveSchedule()
}

// 只清除结束时间
const clearScheduleEnd = async () => {
  scheduleEnd.value = null
  showDatePicker.value = false
  await saveSchedule()
}

// 保存绝对提醒
const saveAbsoluteReminder = async (reminderTime) => {
  if (!(props.isEditing && props.task)) return
  try {
    const result = await updateCurrentTask( {
      reminderPolicy: { mode: 'absolute', minutesBefore: null },
      reminderTime: reminderTime.toISOString()
    })
    applyTimeWarning(result)
    syncReminderFromResult(result)
  } catch (error) {
    console.error('保存自定义提醒失败:', error)
    alert(error?.message || '提醒设置失败')
  }
}

// 提醒选项：开始时 / 提前 N 分钟（需要先有安排）；自定义绝对时间始终可用
const reminderOptions = computed(() => {
  const options = []
  if (scheduleStart.value) {
    options.push({ id: 'relative-0', kind: 'relative', minutesBefore: 0, label: t('tasks.reminderAtStart') })
    for (const minutes of [5, 10, 30, 60]) {
      options.push({ id: `relative-${minutes}`, kind: 'relative', minutesBefore: minutes, label: t('tasks.reminderBeforeMinutes', { minutes }) })
    }
  }
  options.push({ id: 'absolute-custom', kind: 'absolute', label: '自定义时间…' })
  return options
})

const isReminderOptionActive = (option) => {
  const policy = reminderPolicy.value
  if (!policy) return false
  if (option.kind === 'relative') {
    return policy.mode === 'relative' && (policy.minutesBefore || 0) === option.minutesBefore
  }
  return policy.mode === 'absolute' || (!policy && selectedReminder.value)
}

// 选择提醒选项
const selectReminderOption = async (option) => {
  if (option.kind === 'absolute') {
    openPickerFor('reminderAbsolute', null)
    return
  }
  if (!(props.isEditing && props.task)) return
  try {
    const result = await updateCurrentTask( {
      reminderPolicy: { mode: 'relative', minutesBefore: option.minutesBefore }
    })
    applyTimeWarning(result)
    syncReminderFromResult(result)
    showReminderPicker.value = false
  } catch (error) {
    console.error('保存相对提醒失败:', error)
    alert(error?.message || '提醒设置失败')
  }
}

// 关闭提醒（显式 disabled 策略）
const disableReminder = async () => {
  showReminderPicker.value = false
  selectedReminder.value = null
  reminderPolicy.value = { mode: 'disabled', minutesBefore: null }
  if (props.isEditing && props.task) {
    try {
      await updateCurrentTask( {
        reminderPolicy: { mode: 'disabled', minutesBefore: null }
      })
      console.log('提醒已关闭')
    } catch (error) {
      console.error('关闭提醒失败:', error)
    }
  }
}

// 从保存结果同步提醒显示（相对提醒的触发时间由服务端推导）
const syncReminderFromResult = (result) => {
  const task = result?.task
  if (!task) return
  reminderPolicy.value = task.reminderPolicy || null
  if (task.reminderPolicy?.mode === 'relative') {
    selectedReminder.value = {
      value: 'relative',
      label: relativePolicyLabel(task.reminderPolicy),
      config: task.reminderPolicy
    }
  } else if (task.reminderPolicy?.mode === 'disabled') {
    selectedReminder.value = null
  } else if (task.reminderTime) {
    const reminderDate = new Date(task.reminderTime)
    selectedReminder.value = {
      value: 'custom',
      label: `${getLocalDateString(reminderDate)} ${reminderDate.toTimeString().slice(0, 5)}`,
      reminderTime: task.reminderTime
    }
  } else {
    selectedReminder.value = null
  }
  // 清除安排可能把相对提醒转为关闭
  if (!task.scheduledStartAt) {
    scheduleStart.value = null
    scheduleEnd.value = null
  } else {
    scheduleStart.value = new Date(task.scheduledStartAt)
    scheduleEnd.value = task.scheduledEndAt ? new Date(task.scheduledEndAt) : null
  }
}

const relativePolicyLabel = (policy) => {
  const minutes = policy.minutesBefore || 0
  return minutes > 0 ? t('tasks.reminderBeforeMinutes', { minutes }) : t('tasks.reminderAtStart')
}

// 时间提示：无效旧截止 > 服务端警告（计划晚于截止 / 错过的相对提醒）
const timeHintText = computed(() => {
  if (editingTask.value?.deadlineInvalid) {
    return '截止数据无效，请重新设置截止时间'
  }
  return timeWarning.value || ''
})

const applyTimeWarning = (result) => {
  timeWarning.value = result?.task?.timeWarning || ''
}

// 格式化选中的日期
const formatSelectedDate = (date) => {
  if (!date) return ''
  const dateObj = new Date(date)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const todayStr = getLocalDateString(today)
  const tomorrowStr = getLocalDateString(tomorrow)

  if (date === todayStr) {
    return `今天 ${selectedTime.value || ''}`
  } else if (date === tomorrowStr) {
    return `明天 ${selectedTime.value || ''}`
  } else {
    return `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${selectedTime.value || ''}`
  }
}

// 格式化创建日期
const formatCreatedDate = () => {
  if (editingTask.value && editingTask.value.createdAt) {
    const date = new Date(editingTask.value.createdAt)
    const today = new Date()
    const todayStr = getLocalDateString(today)
    const taskDateStr = getLocalDateString(date)

    if (taskDateStr === todayStr) {
      return '今天'
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`
    }
  }
  return '今天'
}

// 获取基础日期
const getBaseDate = () => {
  if (selectedDate.value) {
    return new Date(selectedDate.value)
  }
  return new Date()
}



// 删除任务
const handleDeleteTask = () => {
  if (editingTask.value) {
    emit('delete-task', editingTask.value)
  }
}

// 切换任务完成状态
const handleToggleComplete = async (task) => {
  if (!task) return

  try {
    const editableTask = await ensureEditableTask()
    if (!editableTask) throw new Error(t('today.saveFailed', { error: '' }))
    if (editableTask.status === 'done') {
      // 如果已完成，重新开始任务
      await updateCurrentTask({ status: 'todo', completedAt: null })
    } else {
      // 如果未完成，标记为完成
      const result = await trackTaskWrite(taskStore.completeTask(editableTask.id))
      if (!result?.success) throw new Error(result?.error || '')
    }
  } catch (error) {
    console.error('切换任务完成状态失败:', error)
    timeSaveError.value = t('today.saveFailed', { error: error?.message || '' })
  }
}

// 任务内容防抖定时器
const contentDebounceTimer = ref(null)

// 自动调整textarea高度
const autoResize = () => {
  const textarea = addTaskInput.value
  if (!textarea) return

  // 重置高度以获取正确的scrollHeight
  textarea.style.height = 'auto'

  // 计算新高度，限制在最小和最大值之间
  const minHeight = 24 // 1.5rem = 24px
  const maxHeight = 240 // 15rem = 240px
  const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)

  textarea.style.height = newHeight + 'px'

  // 如果是编辑模式，启动防抖自动保存
  if (props.isEditing && props.task) {
    debounceSaveTaskContent()
  }
}

// 防抖保存任务内容
const debounceSaveTaskContent = () => {
  if (contentDebounceTimer.value) {
    clearTimeout(contentDebounceTimer.value)
  }

  contentDebounceTimer.value = setTimeout(async () => {
    if (newTaskContent.value.trim()) {
      await handleSaveTaskContent()
    }
  }, 1000) // 1秒后保存
}

let titleSaveQueue = Promise.resolve(true)

// 保存任务内容
const handleSaveTaskContent = () => {
  if (!props.task || !props.isEditing) return Promise.resolve(false)
  const newContent = newTaskContent.value.trim()
  if (!newContent) {
    titleError.value = t('today.titleRequired')
    return Promise.resolve(false)
  }

  const save = titleSaveQueue.then(async () => {
  if (newContent === (editingTask.value?.content || '')) {
      lastSavedTitle.value = newContent
      titleError.value = ''
      return true
    }
    try {
      await updateCurrentTask({ content: newContent })
      lastSavedTitle.value = newContent
      titleError.value = ''
      return true
    } catch (error) {
      console.error('自动保存任务内容失败:', error)
      titleError.value = t('today.saveFailed', { error: error?.message || '' })
      return false
    }
  })
  titleSaveQueue = save.then(() => true, () => false)
  return save
}

// 自动调整备注区域textarea高度
const autoResizeNote = (event) => {
  const textarea = event.target
  if (!textarea) return

  // 重置高度以获取正确的scrollHeight
  textarea.style.height = 'auto'

  // 计算新高度，限制在最小和最大值之间
  const minHeight = 48 // 3rem = 48px (2行最小高度)
  const maxHeight = 240 // 15rem = 240px
  const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)

  textarea.style.height = newHeight + 'px'

  // 如果是编辑模式，启动防抖自动保存
  if (props.isEditing && props.task) {
    debounceSaveNote()
  }
}

const saveTaskNote = async () => {
  if (!props.isEditing || !editingTask.value) return true
  const note = taskNote.value?.trim() || ''
  if (note === (editingTask.value.metadata?.note || '')) {
    lastSavedNote.value = note
    noteError.value = ''
    return true
  }

  try {
    const result = await updateCurrentMetadata((metadata) => ({ ...metadata, note }))
    if (!result?.success) throw new Error(result?.error || '')
    lastSavedNote.value = note
    noteError.value = ''
    return true
  } catch (error) {
    console.error('自动保存备注失败:', error)
    noteError.value = t('today.saveFailed', { error: error?.message || '' })
    return false
  }
}

// 防抖保存备注；metadata 写入队列会与步骤变更顺序执行，避免覆盖对方的字段。
const debounceSaveNote = () => {
  if (noteDebounceTimer) clearTimeout(noteDebounceTimer)
  noteDebounceTimer = setTimeout(() => {
    noteDebounceTimer = null
    saveTaskNote()
  }, 1000)
}

const handleNoteBlur = async () => {
  if (noteDebounceTimer) {
    clearTimeout(noteDebounceTimer)
    noteDebounceTimer = null
  }
  await saveTaskNote()
}

const handleNoteKeydown = async (event) => {
  if (event.isComposing || event.keyCode === 229 || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  if (noteDebounceTimer) {
    clearTimeout(noteDebounceTimer)
    noteDebounceTimer = null
  }

  const committedNote = lastSavedNote.value
  const hasUncommittedNote = noteError.value || (taskNote.value?.trim() || '') !== committedNote
  await metadataWriteQueue
  try {
    await Promise.all([...pendingTaskWrites])
  } catch {
    // Restore the last value that the task store confirms as saved.
  }
  const persistedNote = editingTask.value?.metadata?.note || ''
  if (persistedNote !== committedNote) {
    const result = await updateCurrentMetadata((metadata) => ({ ...metadata, note: committedNote }))
    if (!result?.success) {
      noteError.value = t('today.saveFailed', { error: result?.error || '' })
      return
    }
  }
  lastSavedNote.value = committedNote
  if (hasUncommittedNote) {
    taskNote.value = committedNote
    noteError.value = ''
    nextTick(() => noteInput.value?.focus())
    return
  }

  noteError.value = ''
  handleCancelAdding()
}

// 组件挂载时初始化
onMounted(async () => {
  if (props.inline) {
    editorCoordinator?.register(taskIdentity(props.task), flushPendingChanges)
  }

  if (!availableLists.value || availableLists.value.length === 0) {
    await taskStore.getAllLists()
  }

  if (!customReminderOptions.value || customReminderOptions.value.length === 0) {
    await taskStore.loadCustomReminderOptions()
  }

  if (props.isEditing && editingTask.value?.listId) {
    selectedListId.value = editingTask.value.listId
  } else if (taskStore.currentListId) {
    selectedListId.value = taskStore.currentListId
  } else if (availableLists.value.length > 0) {
    selectedListId.value = availableLists.value[0].id
  }

  document.addEventListener('click', handleClickOutside)
})

// 组件卸载时移除监听器
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (props.inline) editorCoordinator?.unregister(taskIdentity(props.task))

  if (props.inline) {
    if (newTaskContent.value.trim() && newTaskContent.value !== (editingTask.value?.content || '')) {
      void handleSaveTaskContent()
    }
    if (taskNote.value !== (editingTask.value?.metadata?.note || '')) {
      void saveTaskNote()
    }
  }

  // 清理防抖定时器
  if (noteDebounceTimer) {
    clearTimeout(noteDebounceTimer)
    noteDebounceTimer = null
  }
  if (contentDebounceTimer.value) {
    clearTimeout(contentDebounceTimer.value)
  }
})

// 加载任务数据的通用函数
const loadTaskData = () => {
  const task = editingTask.value
  if (!task) return

  isAddingTask.value = true
  newTaskContent.value = task.content || ''
  lastSavedTitle.value = task.content || ''
  titleError.value = ''
  noteError.value = ''
  stepError.value = ''
  timeSaveError.value = ''
  isImportant.value = task.isImportant || false
  taskNote.value = task.metadata?.note || ''
  lastSavedNote.value = task.metadata?.note || ''
  steps.value = (task.metadata?.steps || []).map((step) => ({ ...step }))

  // 截止与提醒分别展示，不再用一个入口填充另一个
  selectedDate.value = task.dueDate || ''
  selectedTime.value = task.dueTime || ''
  if (task.dueDate && task.dueTime) {
    dateTimeValue.value = new Date(`${task.dueDate}T${task.dueTime}:00`)
  } else {
    dateTimeValue.value = null
  }

  // 计划安排（开始 / 结束）
  scheduleStart.value = task.scheduledStartAt ? new Date(task.scheduledStartAt) : null
  scheduleEnd.value = task.scheduledEndAt ? new Date(task.scheduledEndAt) : null
  timeWarning.value = task.timeWarning || ''

  // 提醒策略：相对 / 绝对 / 关闭 / 旧绝对（无策略）
  const policy = task.reminderPolicy || null
  reminderPolicy.value = policy
  if (policy && policy.mode === 'relative') {
    selectedReminder.value = {
      value: 'relative',
      label: relativePolicyLabel(policy),
      config: policy
    }
  } else if (policy && policy.mode === 'disabled') {
    selectedReminder.value = null
  } else if (task.reminderTime) {
    const reminderDate = new Date(task.reminderTime)
    if (task.reminderConfig) {
      selectedReminder.value = {
        value: 'custom',
        label: task.reminderConfig.label,
        config: task.reminderConfig,
        reminderTime: task.reminderTime
      }
    } else {
      selectedReminder.value = {
        value: 'custom',
        label: `${getLocalDateString(reminderDate)} ${reminderDate.toTimeString().slice(0, 5)}`,
        reminderTime: task.reminderTime
      }
    }
  } else {
    selectedReminder.value = null
  }

  if (task.recurrence) {
    selectedRecurrence.value = task.recurrence
    // 编辑现有重复任务时，默认不展开面板
    showRepeatPicker.value = false
  } else {
    selectedRecurrence.value = null
    showRepeatPicker.value = false
  }

  if (task.listId) {
    selectedListId.value = task.listId
  }

  nextTick(() => {
    if (addTaskInput.value) {
      addTaskInput.value.focus()
      // 将光标移动到文本末尾
      const length = addTaskInput.value.value.length
      addTaskInput.value.setSelectionRange(length, length)
      autoResize()
    }
  })
}

// 只在真正切换编辑目标时加载；store 刷新同一任务时保留正在编辑的草稿。
watch(() => [props.isEditing, taskIdentity(props.task)], ([isEditing, identity], previous = []) => {
  const [wasEditing, previousIdentity] = previous
  if (isEditing && props.task && (!wasEditing || identity !== previousIdentity)) {
    materializedTask.value = null
    loadTaskData()
  } else if (!isEditing && wasEditing) {
    handleCancelAdding()
  }
}, { immediate: true })



// 聚焦到输入框（供父组件调用）
const focusInput = () => {
  if (addTaskInput.value) {
    addTaskInput.value.focus()
  }
}

// 暴露方法给父组件
defineExpose({
  focusInput
})
</script>

<style>
@import '@/assets/styles/components/task-edit-vertical.css';
@import '@/assets/styles/components/VCalendar.css';
</style>
