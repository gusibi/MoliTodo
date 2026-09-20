<template>
  <!-- 竖向任务编辑区域 -->
  <div class="task-edit-vertical-container" ref="taskEditContainer">
    <div class="task-edit-vertical" :class="{ 'active': isAddingTask }">
      <!-- 可滚动内容区域 -->
      <div class="task-content-scrollable">
        <!-- 任务标题区域 -->
        <div class="task-header">
          <div class="task-header-title-wrapper">
            <!-- 复选框 -->
            <div class="flat-task-checkbox">
              <input type="checkbox" :id="`task-edit-${task?.id || 'new'}`" :checked="task?.status === 'done'"
                @change="handleToggleComplete(task)" @click.stop />
              <label :for="`task-edit-${task?.id || 'new'}`" class="flat-checkbox-label"></label>
            </div>

            <!-- 任务标题输入 -->
            <div class="task-title-input-wrapper">
              <textarea ref="addTaskInput" v-model="newTaskContent"
                :placeholder="props.isEditing ? '编辑任务...' : '添加新任务...'" class="task-title-input" maxlength="1000"
                rows="1" :style="{ minHeight: '1.5rem', maxHeight: '15rem' }" @focus="handleStartAdding"
                @blur="handleInputBlur" @keyup.ctrl.enter="handleSaveTaskContent" @keyup.escape="handleCancelAdding"
                @input="autoResize"></textarea>
              <div class="task-input-counter" v-if="isAddingTask">
                {{ newTaskContent.length }}/1000
              </div>
            </div>

            <!-- 重要性标记 -->
            <!-- <div class="task-importance-wrapper">
            <button class="task-importance-btn" :class="{ 'active': isImportant }" @click="toggleImportance">
              <i class="fas fa-star importance-icon"></i>
            </button>
          </div> -->
          </div>
        </div>

        <!-- 步骤区域 -->
        <div v-if="isAddingTask" class="task-steps">
          <div v-if="steps.length > 0" class="steps-list">
            <div v-for="(step, index) in steps" :key="step.id" class="step-item">
              <div class="flat-task-checkbox">
                <input type="checkbox" :id="`step-${step.id}`" :checked="step.status === 'done'"
                  @change="toggleStepStatus(step)" @click.stop />
                <label :for="`step-${step.id}`" class="flat-checkbox-label"></label>
              </div>
              <input v-if="editingStepId === step.id" v-model="editingStepContent" type="text"
                class="step-content-input" @blur="saveStepEdit(step)" @keyup.enter="saveStepEdit(step)"
                @keyup.escape="cancelStepEdit" ref="stepEditInput" />
              <span v-else class="step-content" :class="{ 'completed': step.status === 'done' }"
                @dblclick="startStepEdit(step)">{{ step.content }}</span>
              <button class="step-delete-btn" @click="removeStep(index)">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          <div class="step-add">
            <button class="step-add-btn" @click="addStep">
              <i class="fas fa-plus step-add-icon"></i>
            </button>
            <input v-model="newStepContent" type="text" placeholder="添加步骤" class="step-add-input"
              @keyup.enter="addStep" />
          </div>
        </div>

        <!-- 任务选项区域 -->
        <div v-if="isAddingTask" class="task-options">
          <!-- 列表选择 -->
          <div class="task-option-section-list">
            <div class="task-option-item">
              <button class="task-option-btn" @click="toggleListPicker">
                <div class="task-option-icon">
                  <i class="fas fa-tag"></i>
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ getSelectedListName() }}</div>
                </div>
              </button>
            </div>

            <!-- 列表选择器下拉 -->
            <div v-if="showListPicker" class="task-option-dropdown">
              <div class="list-options">
                <!-- 编辑模式 -->
                <template v-if="props.isEditing">
                  <!-- 当前任务所属列表 -->
                  <div v-if="props.task && props.task.listId" class="current-list">
                    <div class="current-list-label">当前列表</div>
                    <button class="list-option current-list-option"
                      :class="{ 'active': selectedListId === props.task.listId }"
                      @click="selectList(getCurrentTaskList())">
                      <div class="list-icon" :style="{ color: getCurrentTaskList()?.color }">
                        <i :class="`fas fa-${getCurrentTaskList()?.icon}`"></i>
                      </div>
                      <span class="list-name">{{ getCurrentTaskList()?.name }}</span>
                    </button>
                  </div>

                  <!-- 分隔线 -->
                  <div v-if="props.task && props.task.listId && getOtherLists().length > 0" class="list-separator">
                  </div>

                  <!-- 其他可选列表 -->
                  <div v-if="props.task && props.task.listId && getOtherLists().length > 0" class="other-lists-label">
                    移动到其他列表</div>
                  <button v-for="list in getOtherLists()" :key="list.id" class="list-option"
                    :class="{ 'active': selectedListId === list.id }" @click="selectList(list)">
                    <div class="list-icon" :style="{ color: list.color }">
                      <i :class="`fas fa-${list.icon}`"></i>
                    </div>
                    <span class="list-name">{{ list.name }}</span>
                  </button>
                </template>

                <!-- 添加模式：显示所有列表 -->
                <template v-else>
                  <button v-for="list in availableLists" :key="list.id" class="list-option"
                    :class="{ 'active': selectedListId === list.id }" @click="selectList(list)">
                    <div class="list-icon" :style="{ color: list.color }">
                      <i :class="`fas fa-${list.icon}`"></i>
                    </div>
                    <span class="list-name">{{ list.name }}</span>
                  </button>
                </template>
              </div>
            </div>
          </div>
          <!-- 提醒设置（附属：策略化提醒） -->
          <div class="task-option-section">
            <div class="task-option-item" :class="{ 'active': selectedReminder }">
              <button class="task-option-btn" @click="toggleReminderPicker">
                <div class="task-option-icon">
                  <i class="fas fa-bell"></i>
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ selectedReminder ? getReminderDisplayText() : '提醒我' }}</div>
                </div>
              </button>
              <button v-if="selectedReminder" class="task-option-delete" @click="clearReminder">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- 提醒选择器下拉：相对开始 / 自定义绝对时间 -->
            <div v-if="showReminderPicker" class="task-option-dropdown">
              <div class="reminder-options">
                <button v-if="selectedReminder || reminderPolicy?.mode === 'disabled'" class="reminder-option"
                  @click="disableReminder">
                  <i class="fas fa-ban reminder-option-icon"></i>
                  <span>不提醒</span>
                </button>
                <button v-for="option in reminderOptions" :key="option.id" class="reminder-option"
                  :class="{ 'reminder-option-active': isReminderOptionActive(option) }"
                  @click="selectReminderOption(option)">
                  <i class="fas fa-clock reminder-option-icon"></i>
                  <span>{{ option.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 安排时间（一级入口：计划开始 / 结束） -->
          <div class="task-option-section">
            <div class="task-option-item" :class="{ 'active': scheduleStart }">
              <button class="task-option-btn" ref="scheduleStartBtn"
                @click="openPickerFor('scheduleStart', scheduleStartBtn)">
                <div class="task-option-icon">
                  <i class="fas fa-calendar-day"></i>
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ scheduleStart ? formatScheduleText() : '添加安排时间' }}</div>
                </div>
              </button>
              <button v-if="scheduleStart" class="task-option-delete" @click="clearSchedule">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- 结束时间：只在设置开始后出现 -->
            <div v-if="scheduleStart" class="task-option-item task-option-subitem" :class="{ 'active': scheduleEnd }">
              <button class="task-option-btn" ref="scheduleEndBtn"
                @click="openPickerFor('scheduleEnd', scheduleEndBtn)">
                <div class="task-option-icon">
                  <i class="fas fa-hourglass-half"></i>
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ scheduleEnd ? formatScheduleEndText() : '添加结束时间（可选）' }}</div>
                </div>
              </button>
              <button v-if="scheduleEnd" class="task-option-delete" @click="clearScheduleEnd">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <!-- 截止日期（一级入口） -->
          <div class="task-option-section" ref="datePickerSection">
            <div class="task-option-item" :class="{ 'active': selectedDate }">
              <button class="task-option-btn" ref="datePickerBtn" @click="openPickerFor('deadline', datePickerBtn)">
                <div class="task-option-icon">
                  <i class="fas fa-calendar-alt"></i>
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">{{ selectedDate ? formatSelectedDate(selectedDate) : '添加截止时间' }}
                  </div>
                </div>
              </button>
              <!-- 日期型截止与日期+时间截止的切换 -->
              <button v-if="selectedDate && selectedTime" class="task-option-mini" @click="makeDeadlineDateOnly"
                title="清除截止时刻，仅保留日期">
                仅日期
              </button>
              <button v-if="selectedDate && !selectedTime" class="task-option-mini" @click="openPickerFor('deadline', datePickerBtn)"
                title="为截止日期添加具体时刻">
                加时间
              </button>
              <button v-if="selectedDate" class="task-option-delete" @click="clearDateTime">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <!-- 时间模型提示（计划晚于截止 / 错过的相对提醒 / 无效旧截止） -->
          <div v-if="timeHintText" class="task-option-warning">
            <i class="fas fa-triangle-exclamation"></i>
            <span>{{ timeHintText }}</span>
          </div>
          
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
              <div class="task-option-btn" @click="toggleRepeatPicker">
                <div class="task-option-icon">
                  <i class="fas fa-redo"></i>
                </div>
                <div class="task-option-content">
                  <div class="task-option-title">重复</div>
                </div>
                <!-- iOS风格开关 -->
                <div class="task-option-switch" @click.stop>
                  <label class="switch">
                    <input type="checkbox" :checked="!!selectedRecurrence" @change="toggleRepeatEnabled">
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
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
              <textarea v-model="taskNote" placeholder="添加备注" class="task-note-textarea" maxlength="1000" rows="5"
                :style="{ minHeight: '3rem', maxHeight: '15rem' }" @input="autoResizeNote"
                @blur="handleNoteBlur"></textarea>
              <div class="task-note-counter">{{ taskNote.length }}/1000</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div v-if="isAddingTask" class="task-actions">
        <div class="task-actions-left">
          <button class="task-action-close" @click="handleCancelAdding">
            <i class="fas fa-right-to-bracket"></i>
          </button>
        </div>

        <div class="task-actions-center">
          <span v-if="props.isEditing" class="task-created-date">创建于 {{ formatCreatedDate() }}</span>
        </div>

        <div class="task-actions-right">
          <button v-if="props.isEditing" class="task-action-delete" @click="handleDeleteTask">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted, onUnmounted, defineExpose, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/store/taskStore'
import { useTheme } from '@/composables/useTheme'
import RepeatSelector from './RepeatSelector.vue'

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
  }
})

// 定义事件
const emit = defineEmits(['add-task', 'update-task', 'cancel-edit', 'delete-task'])

// 使用 taskStore
const taskStore = useTaskStore()
const { customReminderOptions: storeCustomReminderOptions, lists } = storeToRefs(taskStore)

// 使用主题
const { isDark } = useTheme()

// 组件根元素引用
const taskEditContainer = ref(null)
const addTaskInput = ref(null)
const fileInput = ref(null)
const datePickerBtn = ref(null)
const datePickerSection = ref(null)

// 任务相关状态
const newTaskContent = ref('')
const isAddingTask = ref(false)
const isImportant = ref(false)
const taskNote = ref('')

// 防抖定时器
let noteDebounceTimer = null

// 步骤相关状态
const steps = ref([])
const newStepContent = ref('')
const editingStepId = ref(null)
const editingStepContent = ref('')

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
  const anchorBtn = (btnEl && (btnEl.value || btnEl)) || datePickerBtn.value
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
    case 'scheduleStart': return '计划开始时间'
    case 'scheduleEnd': return '计划结束时间'
    case 'reminderAbsolute': return '自定义提醒时间'
    default: return '截止时间'
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
const handleCancelAdding = () => {
  if (props.isEditing) {
    emit('cancel-edit')
  } else {
    resetAllStates()
  }
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
    if (!newTaskContent.value.trim() && !props.isEditing) {
      resetAllStates()
    }
    // 点击外部关闭所有选择器
    showDatePicker.value = false
    showReminderPicker.value = false
    showListPicker.value = false
    showRepeatPicker.value = false
  }
}

// 添加步骤
const addStep = async () => {
  if (newStepContent.value.trim()) {
    const stepContent = newStepContent.value.trim()

    if (props.isEditing && props.task) {
      // 编辑模式：使用API添加步骤
      try {
        const newStep = await taskStore.addTaskStep(props.task.id, stepContent)
        steps.value.push(newStep.step)
        newStepContent.value = ''
      } catch (error) {
        console.error('添加步骤失败:', error)
      }
    } else {
      // 新建模式：本地添加步骤
      const newStep = {
        id: Date.now(), // 临时ID，保存时会由后端生成正式ID
        content: stepContent,
        status: 'todo'
      }
      steps.value.push(newStep)
      newStepContent.value = ''
    }
  }
}

// 删除步骤
const removeStep = async (index) => {
  const step = steps.value[index]

  // 弹窗确认删除
  if (!confirm('确定要删除这个步骤吗？')) {
    return
  }

  if (props.isEditing && props.task) {
    // 编辑模式：使用API删除步骤
    try {
      await taskStore.deleteTaskStep(props.task.id, step.id)
      steps.value.splice(index, 1)
    } catch (error) {
      console.error('删除步骤失败:', error)
    }
  } else {
    // 新建模式：本地删除步骤
    steps.value.splice(index, 1)
  }
}

// 切换步骤状态
const toggleStepStatus = async (step) => {
  // 立即更新本地状态以提供即时反馈
  const newStatus = step.status === 'done' ? 'todo' : 'done'
  step.status = newStatus

  // 如果是编辑模式且有任务，同时更新服务器状态
  if (props.isEditing && props.task) {
    try {
      // 使用taskStore的API更新步骤状态
      await taskStore.toggleTaskStepStatus(props.task.id, step.id)
    } catch (error) {
      console.error('更新步骤状态失败:', error)
      // 如果API调用失败，回滚本地状态
      step.status = step.status === 'done' ? 'todo' : 'done'
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
    // 编辑模式：使用API更新步骤
    try {
      await taskStore.updateTaskStep(props.task.id, step.id, { content: newContent })
      step.content = newContent
      cancelStepEdit()
    } catch (error) {
      console.error('更新步骤失败:', error)
      cancelStepEdit()
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

// 切换重要性
const toggleImportance = () => {
  isImportant.value = !isImportant.value
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
const toggleRepeatEnabled = async (event) => {
  if (event.target.checked) {
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

    if (props.task.seriesId && selectedRecurrence.value) {
      // 更新重复任务系列
      await taskStore.updateRecurringTask(props.task.id, updates, cleanRecurrence)
    } else if (selectedRecurrence.value && !props.task.seriesId) {
      // 将普通任务转换为重复任务
      await taskStore.updateRecurringTask(props.task.id, updates, cleanRecurrence)
    } else if (!selectedRecurrence.value && props.task.seriesId) {
      // 将重复任务转换为普通任务
      await taskStore.updateTask(props.task.id, {
        seriesId: null,
        recurrence: null
      })
    } else {
      // 更新普通任务的重复配置
      await taskStore.updateTask(props.task.id, updates)
    }

    console.log('重复配置已自动保存:', cleanRecurrence)
  } catch (error) {
    console.error('自动保存重复配置失败:', error)
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
      await taskStore.updateTask(props.task.id, {
        reminderPolicy: { mode: 'disabled', minutesBefore: null }
      })
      console.log('提醒已清除并自动保存')
    } catch (error) {
      console.error('自动保存提醒清除失败:', error)
    }
  }
}



// 安排时间显示：今天 / 明天 / N月N日 + 开始时刻（结束单独展示）
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

  if (startStr === todayStr) return `今天 ${timeStr}`
  if (startStr === tomorrowStr) return `明天 ${timeStr}`
  return `${start.getMonth() + 1}月${start.getDate()}日 ${timeStr}`
}

// 结束时间显示：同日只显示时刻，跨日显示完整日期
const formatScheduleEndText = () => {
  if (!scheduleEnd.value) return ''
  const end = new Date(scheduleEnd.value)
  const start = scheduleStart.value ? new Date(scheduleStart.value) : null
  const timeStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`

  if (start && getLocalDateString(start) === getLocalDateString(end)) {
    return `结束于 ${timeStr}`
  }
  return `结束于 ${end.getMonth() + 1}月${end.getDate()}日 ${timeStr}`
}

// 选择列表
const selectList = (list) => {
  selectedListId.value = list.id
  showListPicker.value = false

  // 如果是编辑模式且列表发生变化，立即更新任务列表
  if (props.isEditing && props.task && props.task.listId !== list.id) {
    handleUpdateTaskList(list.id)
  }
}

// 更新任务列表（轻量级方法，只更新列表）
const handleUpdateTaskList = async (newListId) => {
  if (!props.task || !props.isEditing) return

  try {
    const result = await taskStore.moveTaskToList(props.task.id, newListId)
    if (result.success) {
      // 更新本地任务数据的listId
      if (props.task) {
        props.task.listId = newListId
      }
      console.log('任务列表更新成功')
    } else {
      console.error('更新任务列表失败:', result.error)
      // 恢复原来的选择
      selectedListId.value = props.task.listId
    }
  } catch (error) {
    console.error('更新任务列表失败:', error)
    // 恢复原来的选择
    selectedListId.value = props.task.listId
  }
}

// 获取选中的列表名称
const getSelectedListName = () => {
  const selectedList = availableLists.value.find(list => list.id === selectedListId.value)
  return selectedList ? selectedList.name : '选择列表'
}

// 获取当前任务列表
const getCurrentTaskList = () => {
  if (props.task && props.task.listId) {
    return availableLists.value.find(list => list.id === props.task.listId)
  }
  return null
}

// 获取其他列表
const getOtherLists = () => {
  if (props.task && props.task.listId) {
    return availableLists.value.filter(list => list.id !== props.task.listId)
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
    if (scheduleEnd.value && start.getTime() > new Date(scheduleEnd.value).getTime()) {
      alert('计划结束时间早于新的开始时间，请先调整或清除结束时间')
      return
    }
    scheduleStart.value = start
    await saveSchedule()
    return
  }

  if (datePickerMode.value === 'scheduleEnd') {
    if (!newValue) return
    const end = newValue instanceof Date ? newValue : new Date(newValue)
    if (scheduleStart.value && end.getTime() < new Date(scheduleStart.value).getTime()) {
      alert('计划结束时间不能早于计划开始时间')
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
      alert('提醒时间不能设置为过去的时间，请重新选择')
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
        const result = await taskStore.updateTask(props.task.id, {
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
        await taskStore.updateTask(props.task.id, { dueDate: null })
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
      await taskStore.updateTask(props.task.id, {
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
    const result = await taskStore.updateTask(props.task.id, {
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
    const result = await taskStore.updateTask(props.task.id, {
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
    options.push({ id: 'relative-0', kind: 'relative', minutesBefore: 0, label: '开始时' })
    for (const minutes of [5, 10, 30, 60]) {
      options.push({ id: `relative-${minutes}`, kind: 'relative', minutesBefore: minutes, label: `提前 ${minutes} 分钟` })
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
    const result = await taskStore.updateTask(props.task.id, {
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
      await taskStore.updateTask(props.task.id, {
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
  return minutes > 0 ? `提前 ${minutes} 分钟` : '开始时'
}

// 时间提示：无效旧截止 > 服务端警告（计划晚于截止 / 错过的相对提醒）
const timeHintText = computed(() => {
  if (props.task?.deadlineInvalid) {
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
  if (props.task && props.task.createdAt) {
    const date = new Date(props.task.createdAt)
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
  if (props.task) {
    emit('delete-task', props.task)
  }
}

// 切换任务完成状态
const handleToggleComplete = async (task) => {
  if (!task) return

  try {
    if (task.status === 'done') {
      // 如果已完成，重新开始任务
      await taskStore.updateTask(task.id, { status: 'todo', completedAt: null })
      // 立即更新本地task状态
      task.status = 'todo'
      task.completedAt = null
    } else {
      // 如果未完成，标记为完成
      await taskStore.completeTask(task.id)
      // 立即更新本地task状态
      task.status = 'done'
      task.completedAt = new Date().toISOString()
    }
  } catch (error) {
    console.error('切换任务完成状态失败:', error)
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

// 保存任务内容
const handleSaveTaskContent = async () => {
  if (!props.task || !props.isEditing || !newTaskContent.value.trim()) return

  // 检查内容是否真的发生了变化
  const newContent = newTaskContent.value.trim()
  const originalContent = props.task.content || ''

  if (newContent === originalContent) {
    console.log('任务内容未发生变化，跳过保存')
    return
  }

  try {
    const updates = {
      content: newContent
    }

    await taskStore.updateTask(props.task.id, updates)
    console.log('任务内容已自动保存:', updates.content)
  } catch (error) {
    console.error('自动保存任务内容失败:', error)
  }
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

// 防抖保存备注
const debounceSaveNote = () => {
  // 清除之前的定时器
  if (noteDebounceTimer) {
    clearTimeout(noteDebounceTimer)
  }

  // 设置新的定时器，1秒后保存
  noteDebounceTimer = setTimeout(async () => {
    if (props.isEditing && props.task) {
      try {
        const currentMetadata = props.task.metadata || {}
        const updatedMetadata = {
          ...currentMetadata,
          note: taskNote.value?.trim() || ''
        }
        await taskStore.updateTaskMetadata(props.task.id, updatedMetadata)
        console.log('备注已自动保存:', taskNote.value)
      } catch (error) {
        console.error('自动保存备注失败:', error)
      }
    }
  }, 1000)
}

// 备注失焦时立即保存
const handleNoteBlur = async () => {
  if (props.isEditing && props.task) {
    // 清除防抖定时器
    if (noteDebounceTimer) {
      clearTimeout(noteDebounceTimer)
      noteDebounceTimer = null
    }

    // 立即保存
    try {
      const currentMetadata = props.task.metadata || {}
      const updatedMetadata = {
        ...currentMetadata,
        note: taskNote.value?.trim() || ''
      }
      await taskStore.updateTaskMetadata(props.task.id, updatedMetadata)
      console.log('备注失焦自动保存:', taskNote.value)
    } catch (error) {
      console.error('备注失焦自动保存失败:', error)
    }
  }
}

// 组件挂载时初始化
onMounted(async () => {
  if (!availableLists.value || availableLists.value.length === 0) {
    await taskStore.getAllLists()
  }

  if (!customReminderOptions.value || customReminderOptions.value.length === 0) {
    await taskStore.loadCustomReminderOptions()
  }

  if (props.isEditing && props.task && props.task.listId) {
    selectedListId.value = props.task.listId
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
  if (!props.task) return

  isAddingTask.value = true
  newTaskContent.value = props.task.content || ''
  isImportant.value = props.task.isImportant || false
  taskNote.value = props.task.metadata?.note || ''
  steps.value = props.task.metadata?.steps || []

  // 截止与提醒分别展示，不再用一个入口填充另一个
  selectedDate.value = props.task.dueDate || ''
  selectedTime.value = props.task.dueTime || ''
  if (props.task.dueDate && props.task.dueTime) {
    dateTimeValue.value = new Date(`${props.task.dueDate}T${props.task.dueTime}:00`)
  } else {
    dateTimeValue.value = null
  }

  // 计划安排（开始 / 结束）
  scheduleStart.value = props.task.scheduledStartAt ? new Date(props.task.scheduledStartAt) : null
  scheduleEnd.value = props.task.scheduledEndAt ? new Date(props.task.scheduledEndAt) : null
  timeWarning.value = props.task.timeWarning || ''

  // 提醒策略：相对 / 绝对 / 关闭 / 旧绝对（无策略）
  const policy = props.task.reminderPolicy || null
  reminderPolicy.value = policy
  if (policy && policy.mode === 'relative') {
    selectedReminder.value = {
      value: 'relative',
      label: relativePolicyLabel(policy),
      config: policy
    }
  } else if (policy && policy.mode === 'disabled') {
    selectedReminder.value = null
  } else if (props.task.reminderTime) {
    const reminderDate = new Date(props.task.reminderTime)
    if (props.task.reminderConfig) {
      selectedReminder.value = {
        value: 'custom',
        label: props.task.reminderConfig.label,
        config: props.task.reminderConfig,
        reminderTime: props.task.reminderTime
      }
    } else {
      selectedReminder.value = {
        value: 'custom',
        label: `${getLocalDateString(reminderDate)} ${reminderDate.toTimeString().slice(0, 5)}`,
        reminderTime: props.task.reminderTime
      }
    }
  } else {
    selectedReminder.value = null
  }

  if (props.task.recurrence) {
    selectedRecurrence.value = props.task.recurrence
    // 编辑现有重复任务时，默认不展开面板
    showRepeatPicker.value = false
  } else {
    selectedRecurrence.value = null
    showRepeatPicker.value = false
  }

  if (props.task.listId) {
    selectedListId.value = props.task.listId
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

// 监听编辑状态变化
watch(() => props.isEditing, (newIsEditing) => {
  if (newIsEditing && props.task) {
    loadTaskData()
  } else if (!newIsEditing) {
    handleCancelAdding()
  }
}, { immediate: true })

// 监听任务变化 - 当点击不同任务时更新编辑区域
watch(() => props.task, (newTask) => {
  if (newTask) {
    loadTaskData()
  }
}, { immediate: true })

// 监听编辑状态和任务的组合变化
watch(() => [props.isEditing, props.task], ([newIsEditing, newTask]) => {
  if (newIsEditing && newTask) {
    // 确保在编辑状态下有任务时立即加载数据
    nextTick(() => {
      loadTaskData()
    })
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