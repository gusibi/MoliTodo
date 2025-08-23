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
              @keyup.ctrl.enter="handleAddTask" 
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
      <!-- <div v-if="isAddingTask" class="task-steps">
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
        
        <div v-if="steps.length > 0" class="steps-list">
          <div v-for="(step, index) in steps" :key="index" class="step-item">
            <input type="checkbox" v-model="step.completed" class="step-checkbox" />
            <span class="step-content" :class="{ 'completed': step.completed }">{{ step.content }}</span>
            <button class="step-delete-btn" @click="removeStep(index)">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div> -->

      <!-- 任务选项区域 -->
      <div v-if="isAddingTask" class="task-options">
      
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
          <div class="task-option-item" :class="{ 'active': selectedRecurrence }">
            <button class="task-option-btn" @click="toggleRepeatPicker">
              <div class="task-option-icon">
                <i class="fas fa-redo"></i>
              </div>
              <div class="task-option-content">
                <div class="task-option-title">{{ selectedRecurrence ? getRepeatDisplayText() : '重复' }}</div>
              </div>
            </button>
            <button v-if="selectedRecurrence" class="task-option-delete" @click="clearRecurrence">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- 重复设置下拉 -->
          <div v-if="showRepeatPicker" class="task-option-dropdown">
            <RepeatSelector 
              v-model="selectedRecurrence" 
              :base-date="getBaseDate()"
              @update:modelValue="handleRecurrenceChange"
            />
          </div>
        </div>

        <!-- 列表选择 -->
        <div class="task-option-section">
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
              rows="2"
              :style="{ minHeight: '3rem', maxHeight: '15rem' }"
              @input="autoResizeNote"
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
          <!-- 添加/保存按钮 -->
          <button 
            v-if="newTaskContent.trim()" 
            class="task-action-save" 
            @click="handleAddTask"
          >
            {{ props.isEditing ? '保存' : '添加' }}
          </button>
          
          <!-- 删除按钮（仅编辑模式显示） -->
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
import { useTaskStore } from '../store/taskStore'
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

// 步骤相关状态
const steps = ref([])
const newStepContent = ref('')

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
const handleInputBlur = (event) => {
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
const addStep = () => {
  if (newStepContent.value.trim()) {
    steps.value.push({
      content: newStepContent.value.trim(),
      completed: false
    })
    newStepContent.value = ''
  }
}

// 删除步骤
const removeStep = (index) => {
  steps.value.splice(index, 1)
}

// 切换重要性
const toggleImportance = () => {
  isImportant.value = !isImportant.value
}


// 切换提醒选择器
const toggleReminderPicker = () => {
  showReminderPicker.value = !showReminderPicker.value
  showRepeatPicker.value = false
  showListPicker.value = false
}



// 切换重复选择器
const toggleRepeatPicker = () => {
  showRepeatPicker.value = !showRepeatPicker.value
  showReminderPicker.value = false
  showListPicker.value = false
}

// 切换列表选择器
const toggleListPicker = () => {
  showListPicker.value = !showListPicker.value
  showReminderPicker.value = false
  showRepeatPicker.value = false
}

// 初始化默认日期和时间
const initializeDefaultDateTime = () => {
  if (!selectedDate.value) {
    const now = new Date()
    selectedDate.value = getLocalDateString(now)
  }

  if (!selectedTime.value) {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
    const hours = String(nextHour.getHours()).padStart(2, '0')
    selectedTime.value = `${hours}:00`
  }

  // 同步设置 dateTimeValue
  if (selectedDate.value && selectedTime.value) {
    const dateTimeStr = `${selectedDate.value}T${selectedTime.value}:00`
    dateTimeValue.value = new Date(dateTimeStr)
  }
}

// 清除日期时间
const clearDateTime = () => {
  selectedDate.value = ''
  selectedTime.value = ''
  dateTimeValue.value = null
}

// 清除提醒
const clearReminder = () => {
  selectedReminder.value = null
}

// 清除重复设置
const clearRecurrence = () => {
  selectedRecurrence.value = null
}

// 选择自定义提醒
const selectCustomReminder = (reminderOption) => {
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
}

// 选择列表
const selectList = (list) => {
  selectedListId.value = list.id
  showListPicker.value = false
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

// 获取重复显示文本
const getRepeatDisplayText = () => {
  if (!selectedRecurrence.value) return '重复'
  
  const { type, interval } = selectedRecurrence.value
  switch (type) {
    case 'daily':
      return interval === 1 ? '每天' : `每${interval}天`
    case 'weekly':
      return interval === 1 ? '每周' : `每${interval}周`
    case 'monthly':
      return interval === 1 ? '每月' : `每${interval}月`
    case 'yearly':
      return interval === 1 ? '每年' : `每${interval}年`
    default:
      return '重复'
  }
}

// 获取最小日期
const getMinDate = () => {
  const today = new Date()
  return getLocalDateString(today)
}

// 获取最小时间
const getMinTime = () => {
  const now = new Date()
  const today = getLocalDateString(now)

  if (selectedDate.value === today) {
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  return '00:00'
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
const handleDateTimeChange = (newValue) => {
  if (newValue) {
    const date = new Date(newValue)
    selectedDate.value = getLocalDateString(date)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    selectedTime.value = `${hours}:${minutes}`
  } else {
    selectedDate.value = ''
    selectedTime.value = ''
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

// 处理重复设置变化
const handleRecurrenceChange = (newRecurrence) => {
  selectedRecurrence.value = newRecurrence
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
    isValid = reminderDateTime > now
    console.log('提醒时间验证结果:', isValid, '当前时间:', now.toLocaleString(), '提醒时间:', reminderDateTime.toLocaleString())
  } else if (!selectedReminder.value && !selectedDate.value) {
    console.log('没有提醒设置，验证通过')
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

// 添加/更新任务
const handleAddTask = async () => {
  if (!newTaskContent.value.trim()) return

  // 计算并验证提醒时间, 如果是循环任务，这里不校验,且提醒时间需要置空,在存储时动态生成
  const { reminderTime, cleanReminderConfig, isValid } = calculateAndValidateReminderTime()
  if (!isValid && !selectedRecurrence.value) {
    alert('提醒时间不能设置为过去的时间，请重新选择')
    return
  }
  console.log("reminderTime: ", reminderTime)
  console.log("cleanReminderConfig: ", cleanReminderConfig)

  const taskData = {
    content: newTaskContent.value.trim(),
    dueDate: selectedDate.value,
    dueTime: selectedTime.value,
    reminderTime: reminderTime,
    reminderConfig: cleanReminderConfig,
    listId: selectedListId.value,
    recurrence: selectedRecurrence.value || null
  }

  console.log('准备发送的 taskData 序列化测试:', JSON.stringify(taskData))

  if (props.isEditing && props.task) {
    // 编辑模式，处理重复任务的更新逻辑
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
        content: newTaskContent.value.trim(),
        dueDate: selectedDate.value || null,
        dueTime: selectedTime.value || null,
        reminderTime: reminderTime,
        reminderConfig: cleanReminderConfig,
        listId: selectedListId.value,
        recurrence: cleanRecurrence
      }

      console.log("updates: ----", updates)
      
      if (props.task.seriesId && selectedRecurrence.value) {
        // 更新重复任务系列
        console.log("更新重复任务系列, 当前是子任务: ", props.task.seriesId)
        await taskStore.updateRecurringTask(props.task.id, updates)
        handleCancelAdding()
      } else if (selectedRecurrence.value && !props.task.seriesId) {
        // 将普通任务转换为重复任务
        console.log("将普通任务转换为重复任务: ", props.task.id)
        await taskStore.updateRecurringTask(props.task.id, updates, cleanRecurrence)
        handleCancelAdding()
      } else if (!selectedRecurrence.value && props.task.seriesId) {
        console.log("将重复任务转换为普通任务, : ", props.task.seriesId)
        // 将重复任务转换为普通任务
        await taskStore.updateTask(props.task.id, {
          ...updates,
          seriesId: null,
          recurrence: null
        })
        handleCancelAdding()
      } else {
        // 更新普通任务
        taskData.id = props.task.id
        emit('update-task', taskData)
        handleCancelAdding()
      }
    } catch (error) {
      console.error('更新任务失败:', error)
    }
  } else {
    // 添加模式，发送添加事件
    console.log("add task: taskData: ", taskData)
    emit('add-task', taskData)
    handleCancelAdding()
  }
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
})

// 加载任务数据的通用函数
const loadTaskData = () => {
  if (!props.task) return
  
  isAddingTask.value = true
  newTaskContent.value = props.task.content || ''
  isImportant.value = props.task.isImportant || false
  taskNote.value = props.task.note || ''
  steps.value = props.task.steps || []
  
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
  } else {
    selectedRecurrence.value = null
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
@import '../assets/styles/components/task-edit-vertical.css';
@import '../assets/styles/components/VueDatePicker.css';
</style>