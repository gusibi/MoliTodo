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
            <textarea 
              ref="addTaskInput" 
              v-model="newTaskContent" 
              :placeholder="props.isEditing ? '编辑任务...' : '添加新任务...'"
              class="task-title-input"
              maxlength="1000"
              rows="1"
              :style="{ minHeight: '1.5rem', maxHeight: '15rem' }"
              @focus="handleStartAdding" 
              @blur="handleInputBlur"
              @keyup.ctrl.enter="handleSaveTaskContent" 
              @keyup.escape="handleCancelAdding"
              @input="autoResize"
            ></textarea>
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
            <input type="checkbox" :checked="step.status === 'done'" @change="toggleStepStatus(step)" class="step-checkbox" />
            <input 
              v-if="editingStepId === step.id"
              v-model="editingStepContent"
              type="text"
              class="step-content-input"
              @blur="saveStepEdit(step)"
              @keyup.enter="saveStepEdit(step)"
              @keyup.escape="cancelStepEdit"
              ref="stepEditInput"
            />
            <span 
              v-else
              class="step-content" 
              :class="{ 'completed': step.status === 'done' }"
              @dblclick="startStepEdit(step)"
            >{{ step.content }}</span>
            <button class="step-delete-btn" @click="removeStep(index)">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div class="step-add">
          <button class="step-add-btn" @click="addStep">
            <i class="fas fa-plus step-add-icon"></i>
          </button>
          <input 
            v-model="newStepContent" 
            type="text" 
            placeholder="添加步骤" 
            class="step-add-input"
            @keyup.enter="addStep"
          />
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
                  <button 
                    class="list-option current-list-option"
                    :class="{ 'active': selectedListId === props.task.listId }"
                    @click="selectList(getCurrentTaskList())"
                  >
                    <div class="list-icon" :style="{ color: getCurrentTaskList()?.color }">
                      <i :class="`fas fa-${getCurrentTaskList()?.icon}`"></i>
                    </div>
                    <span class="list-name">{{ getCurrentTaskList()?.name }}</span>
                  </button>
                </div>

                <!-- 分隔线 -->
                <div v-if="props.task && props.task.listId && getOtherLists().length > 0" class="list-separator"></div>

                <!-- 其他可选列表 -->
                <div v-if="props.task && props.task.listId && getOtherLists().length > 0" class="other-lists-label">移动到其他列表</div>
                <button 
                  v-for="list in getOtherLists()" 
                  :key="list.id" 
                  class="list-option"
                  :class="{ 'active': selectedListId === list.id }"
                  @click="selectList(list)"
                >
                  <div class="list-icon" :style="{ color: list.color }">
                    <i :class="`fas fa-${list.icon}`"></i>
                  </div>
                  <span class="list-name">{{ list.name }}</span>
                </button>
              </template>

              <!-- 添加模式：显示所有列表 -->
              <template v-else>
                <button 
                  v-for="list in availableLists" 
                  :key="list.id" 
                  class="list-option"
                  :class="{ 'active': selectedListId === list.id }"
                  @click="selectList(list)"
                >
                  <div class="list-icon" :style="{ color: list.color }">
                    <i :class="`fas fa-${list.icon}`"></i>
                  </div>
                  <span class="list-name">{{ list.name }}</span>
                </button>
              </template>
            </div>
          </div>
        </div>
        <!-- 提醒设置 -->
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
          
          <!-- 提醒选择器下拉 -->
          <div v-if="showReminderPicker" class="task-option-dropdown">
            <div class="reminder-options">
              <button 
                v-for="reminder in customReminderOptions" 
                :key="reminder.id" 
                class="reminder-option"
                @click="selectCustomReminder(reminder)"
              >
                <i class="fas fa-clock reminder-option-icon"></i>
                <span>{{ reminder.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 截止日期 -->
        <div class="task-option-section">
          <div class="task-option-item" :class="{ 'active': selectedDate }">
            <VueDatePicker 
              v-model="dateTimeValue"
              :enable-time-picker="true"
              :min-date="getMinDate()"
              :min-time="getMinTimeForDatePicker()"
              :format="'yyyy-MM-dd HH:mm'"
              :preview-format="'yyyy-MM-dd HH:mm'"
              :text-input="false"
              :auto-apply="true"
              :close-on-scroll="true"
              :close-on-click-outside="true"
              placeholder="选择日期和时间"
              class="vue-datepicker"
              @update:model-value="handleDateTimeChange"
            >
              <template #trigger>
                <button class="task-option-btn">
                  <div class="task-option-icon">
                    <i class="fas fa-calendar-alt"></i>
                  </div>
                  <div class="task-option-content">
                    <div class="task-option-title">{{ selectedDate ? formatSelectedDate(selectedDate) : '添加提醒时间' }}</div>
                  </div>
                </button>
              </template>
            </VueDatePicker>
            <button v-if="selectedDate" class="task-option-delete" @click="clearDateTime">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

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
                  <input 
                    type="checkbox" 
                    :checked="!!selectedRecurrence" 
                    @change="toggleRepeatEnabled"
                  >
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
          
          <!-- 重复配置面板 -->
          <div v-if="showRepeatPicker && selectedRecurrence" class="task-option-dropdown">
            <RepeatSelector 
              v-model="selectedRecurrence" 
              :base-date="getBaseDate()"
              @update:modelValue="handleRecurrenceChange"
            />
          </div>
        </div>

      </div>

      <!-- 备注区域 -->
      <div v-if="isAddingTask" class="task-note">
        <div class="task-note-editor">
          <div class="task-note-input-wrapper">
            <textarea 
              v-model="taskNote" 
              placeholder="添加备注" 
              class="task-note-textarea"
              maxlength="1000"
              rows="5"
              :style="{ minHeight: '3rem', maxHeight: '15rem' }"
              @input="autoResizeNote"
              @blur="handleNoteBlur"
            ></textarea>
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
import RepeatSelector from './RepeatSelector.vue'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

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

// 组件根元素引用
const taskEditContainer = ref(null)
const addTaskInput = ref(null)
const fileInput = ref(null)

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

// 提醒相关状态
const selectedReminder = ref(null)
const showReminderPicker = ref(false)

// 列表选择相关状态
const selectedListId = ref(null)
const showListPicker = ref(false)
const availableLists = lists

// 重复任务相关状态
const selectedRecurrence = ref(null)
const showRepeatPicker = ref(false)

// 使用 storeToRefs 确保响应式
const customReminderOptions = storeCustomReminderOptions

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
  selectedReminder.value = null
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
  // 如果是编辑模式且有任务，立即更新任务状态
  if (props.isEditing && props.task) {
    try {
      // 使用taskStore的API更新步骤状态
      await taskStore.toggleTaskStepStatus(props.task.id, step.id)
    } catch (error) {
      console.error('更新步骤状态失败:', error)
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
const toggleReminderPicker = () => {
  showReminderPicker.value = !showReminderPicker.value
  showListPicker.value = false
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
}

// 清除提醒
const clearReminder = async () => {
  selectedReminder.value = null
  
  // 如果是编辑模式，自动保存提醒时间清除
  if (props.isEditing && props.task) {
    try {
      await taskStore.updateTaskReminder(props.task.id, null)
      console.log('提醒已清除并自动保存')
    } catch (error) {
      console.error('自动保存提醒清除失败:', error)
    }
  }
}



// 选择自定义提醒
const selectCustomReminder = async (reminderOption) => {
  const now = new Date()
  let reminderTime = null
  let displayText = reminderOption.label

  if (reminderOption.type === 'relative') {
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
    const targetDate = new Date(now)
    targetDate.setDate(now.getDate() + reminderOption.dayOffset)
    const [hours, minutes] = reminderOption.time.split(':').map(Number)
    targetDate.setHours(hours, minutes, 0, 0)
    
    if (reminderOption.dayOffset === 0 && targetDate <= now) {
      targetDate.setDate(now.getDate() + 1)
    }
    reminderTime = targetDate
  }

  if (reminderTime && reminderTime <= now) {
    alert('提醒时间不能设置为过去的时间，请重新选择')
    return
  }

  const cleanReminderOption = {
    id: reminderOption.id,
    label: reminderOption.label,
    type: reminderOption.type,
    value: reminderOption.value,
    unit: reminderOption.unit,
    time: reminderOption.time,
    dayOffset: reminderOption.dayOffset
  }

  selectedReminder.value = {
    value: 'custom',
    label: displayText,
    config: cleanReminderOption,
    reminderTime: reminderTime ? reminderTime.toISOString() : null
  }

  if (reminderTime) {
    const year = reminderTime.getFullYear()
    const month = String(reminderTime.getMonth() + 1).padStart(2, '0')
    const day = String(reminderTime.getDate()).padStart(2, '0')
    const hours = String(reminderTime.getHours()).padStart(2, '0')
    const minutes = String(reminderTime.getMinutes()).padStart(2, '0')

    selectedDate.value = `${year}-${month}-${day}`
    selectedTime.value = `${hours}:${minutes}`
  }

  showReminderPicker.value = false
  
  // 如果是编辑模式，自动保存提醒时间
  if (props.isEditing && props.task) {
    try {
      const reminderTimeISO = reminderTime ? reminderTime.toISOString() : null
      await taskStore.updateTaskReminder(props.task.id, reminderTimeISO)
      console.log('自定义提醒时间已自动保存:', reminderTimeISO)
    } catch (error) {
      console.error('自动保存自定义提醒时间失败:', error)
    }
  }
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

// 处理日期时间变化
const handleDateTimeChange = async (newValue) => {
  if (newValue) {
    const date = new Date(newValue)
    selectedDate.value = getLocalDateString(date)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    selectedTime.value = `${hours}:${minutes}`
    
    // 如果是编辑模式，自动保存提醒时间
    if (props.isEditing && props.task) {
      try {
        const reminderTime = date.toISOString()
        await taskStore.updateTaskReminder(props.task.id, reminderTime)
        console.log('提醒时间已自动保存:', reminderTime)
      } catch (error) {
        console.error('自动保存提醒时间失败:', error)
      }
    }
  } else {
    selectedDate.value = ''
    selectedTime.value = ''
    
    // 如果是编辑模式且清除了时间，也要自动保存
    if (props.isEditing && props.task) {
      try {
        await taskStore.updateTaskReminder(props.task.id, null)
        console.log('提醒时间已清除并自动保存')
      } catch (error) {
        console.error('自动保存提醒时间清除失败:', error)
      }
    }
  }
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



// 计算并验证提醒时间的合并方法
const calculateAndValidateReminderTime = () => {
  console.log('=== 计算并验证提醒时间 ===')

  let reminderTime = null
  let reminderConfig = null
  let isValid = true

  // 处理普通任务的提醒时间
  if (selectedReminder.value) {
    if (selectedDate.value && selectedTime.value) {
      // 使用日期时间选择器中的时间
      const customReminderStr = `${selectedDate.value}T${selectedTime.value}:00`
      reminderTime = new Date(customReminderStr).toISOString()
    }else if (selectedReminder.value.value === 'custom' && selectedReminder.value.reminderTime) {
      reminderTime = selectedReminder.value.reminderTime
      reminderConfig = selectedReminder.value.config
    }
  } else if (selectedDate.value && selectedTime.value) {
    // 当没有选择提醒类型，但设置了日期和时间时，直接使用这个日期时间作为提醒时间
    const customReminderStr = `${selectedDate.value}T${selectedTime.value}:00`
    reminderTime = new Date(customReminderStr).toISOString()
  }

  console.log("reminderTime------: ", reminderTime)

  // 验证提醒时间是否有效
  if (reminderTime) {
    const now = new Date()
    const reminderDateTime = new Date(reminderTime)
    
    // 在编辑模式下，如果提醒时间没有变化，跳过过去时间的验证
    if (props.isEditing && props.task) {
      if (props.task.reminderTime) {
        const originalReminderTime = new Date(props.task.reminderTime)
        const newReminderTime = new Date(reminderTime)
        // 如果提醒时间没有变化（精确到分钟），跳过验证
        if (Math.abs(originalReminderTime.getTime() - newReminderTime.getTime()) < 60000) {
          isValid = true
        } else {
          isValid = reminderDateTime > now
        }
      } else {
        // 原任务没有提醒时间，现在新增提醒时间，需要验证
        isValid = reminderDateTime > now
      }
    } else {
      isValid = reminderDateTime > now
    }
  } else if (!selectedReminder.value && !selectedDate.value) {
    isValid = true
  }

  // 确保 reminderConfig 是可序列化的
  let cleanReminderConfig = null
  if (reminderConfig) {
    cleanReminderConfig = {
      type: reminderConfig.type,
      value: reminderConfig.value,
      unit: reminderConfig.unit,
      time: reminderConfig.time,
      dayOffset: reminderConfig.dayOffset,
      label: reminderConfig.label,
      id: reminderConfig.id
    }
    console.log('清理后的提醒配置:', cleanReminderConfig)
  }

  return { reminderTime, cleanReminderConfig, isValid }
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
  
  try {
    const updates = {
      content: newTaskContent.value.trim()
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
  
  // 优先使用reminderTime，如果没有则使用dueDate/dueTime
  if (props.task.reminderTime) {
    const reminderDate = new Date(props.task.reminderTime)
    selectedDate.value = getLocalDateString(reminderDate)
    selectedTime.value = reminderDate.toTimeString().slice(0, 5)
    dateTimeValue.value = reminderDate
    
    if (props.task.reminderConfig) {
      selectedReminder.value = {
        value: 'custom',
        label: props.task.reminderConfig.label,
        config: props.task.reminderConfig,
        reminderTime: props.task.reminderTime
      }
    }
  } else {
    selectedDate.value = props.task.dueDate || ''
    selectedTime.value = props.task.dueTime || ''
    selectedReminder.value = null
    
    // 设置 dateTimeValue
    if (props.task.dueDate && props.task.dueTime) {
      const dateTimeStr = `${props.task.dueDate}T${props.task.dueTime}:00`
      dateTimeValue.value = new Date(dateTimeStr)
    } else {
      dateTimeValue.value = null
    }
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
@import '@/assets/styles/components/VueDatePicker.css';
</style>