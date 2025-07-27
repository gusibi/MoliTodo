<template>
  <!-- 添加任务区域 -->
  <div class="task-edit-container">
    <div 
      :class="['task-add-item-row', { 'task-add-item-active': isAddingTask }]"
      @click="handleStartAdding"
    >
      <!-- 展开占位符 -->
      <div class="task-edit-expand-placeholder"></div>
      
      <!-- 复选框（不可点击） -->
      <div class="task-item-checkbox">
        <input 
          type="checkbox" 
          disabled
          class="task-add-checkbox-disabled"
        />
        <label></label>
      </div>
      
      <!-- 输入区域 -->
      <div class="task-item-info">
        <div class="task-add-input-wrapper">
          <input
            ref="addTaskInput"
            v-model="newTaskContent"
            type="text"
            placeholder="添加新任务..."
            class="task-add-input"
            :class="{ 'task-add-input-active': isAddingTask }"
            @focus="handleStartAdding"
            @blur="handleInputBlur"
            @keyup.enter="handleAddTask"
            @keyup.escape="handleCancelAdding"
          />
        </div>
        
        <!-- 扩展选项 -->
        <div v-if="isAddingTask" class="task-add-options">
          <div class="task-add-options-row">
            <!-- 日期时间选择器 -->
            <button 
              class="task-add-option-btn"
              @click="toggleDatePicker"
              :class="{ 'active': showDatePicker }"
            >
              <i class="fas fa-calendar"></i>
              <span>{{ selectedDate ? formatSelectedDate(selectedDate) : '选择日期' }}</span>
            </button>
            
            <!-- 提醒选择器 -->
            <div class="task-add-option-group">
              <button 
                class="task-add-option-btn"
                @click="toggleReminderPicker"
                :class="{ 'active': showReminderPicker }"
              >
                <i class="fas fa-bell"></i>
                <span>{{ getReminderDisplayText() }}</span>
              </button>
              
              <!-- 清除提醒按钮 -->
              <button 
                v-if="selectedReminder"
                class="task-add-clear-btn"
                @click="clearReminder"
                title="清除提醒"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <!-- 添加/保存按钮 -->
            <button 
              v-if="newTaskContent.trim()"
              class="task-add-submit-btn"
              @click="handleAddTask"
            >
              <i class="fas fa-plus" v-if="!props.isEditing"></i>
              <i class="fas fa-save" v-if="props.isEditing"></i>
              {{ props.isEditing ? '保存' : '添加' }}
            </button>
            
            <!-- 取消按钮（仅编辑模式显示） -->
            <button 
              v-if="props.isEditing"
              class="task-add-cancel-btn"
              @click="handleCancelAdding"
            >
              <i class="fas fa-times"></i>
              取消
            </button>
          </div>
          
          <!-- 日期选择器下拉 -->
          <div v-if="showDatePicker" class="task-add-dropdown">
            <div class="task-add-date-picker">
              <input 
                type="date" 
                v-model="selectedDate"
                class="task-add-date-input"
              />
              <input 
                type="time" 
                v-model="selectedTime"
                class="task-add-time-input"
              />
            </div>
          </div>
          
          <!-- 提醒选择器下拉 -->
          <div v-if="showReminderPicker" class="task-add-dropdown">
            <div class="task-add-reminder-options">
              <button 
                v-for="reminder in reminderOptions"
                :key="reminder.value"
                class="task-add-reminder-option"
                @click="selectReminder(reminder)"
              >
                <i :class="reminder.icon"></i>
                <span>{{ reminder.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'

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
const emit = defineEmits(['add-task', 'update-task', 'cancel-edit'])

// 添加任务相关状态
const newTaskContent = ref('')
const addTaskInput = ref(null)
const isAddingTask = ref(false)

// 日期时间相关状态
const selectedDate = ref('')
const selectedTime = ref('09:00')
const showDatePicker = ref(false)

// 提醒相关状态
const selectedReminder = ref(null)
const showReminderPicker = ref(false)

// 提醒选项
const reminderOptions = ref([
  { value: 30, label: '30分钟后', icon: 'fas fa-clock' },
  { value: 60, label: '1小时后', icon: 'fas fa-clock' },
  { value: 'tomorrow', label: '明天9点', icon: 'fas fa-sun' },
  { value: 'next_week', label: '下周9点', icon: 'fas fa-calendar-week' },
  { value: 'custom', label: '自定义', icon: 'fas fa-cog' }
])

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
    // 编辑模式下，发送取消编辑事件
    emit('cancel-edit')
  } else {
    // 添加模式下，重置状态
    isAddingTask.value = false
    newTaskContent.value = ''
    selectedDate.value = ''
    selectedTime.value = '09:00'
    selectedReminder.value = null
    showDatePicker.value = false
    showReminderPicker.value = false
  }
}

// 监听编辑状态变化，填充数据
watch(() => props.isEditing, (newIsEditing) => {
  if (newIsEditing && props.task) {
    // 编辑模式，填充现有数据
    isAddingTask.value = true
    newTaskContent.value = props.task.content || ''
    
    // 处理日期时间
    if (props.task.dueDate) {
      selectedDate.value = props.task.dueDate
    }
    if (props.task.dueTime) {
      selectedTime.value = props.task.dueTime
    }
    
    // 处理提醒时间
    if (props.task.reminderTime) {
      // 根据提醒时间推断提醒类型
      const reminderDate = new Date(props.task.reminderTime)
      const now = new Date()
      const diffMinutes = Math.round((reminderDate.getTime() - now.getTime()) / (1000 * 60))
      
      if (diffMinutes === 30) {
        selectedReminder.value = reminderOptions.value.find(r => r.value === 30)
      } else if (diffMinutes === 60) {
        selectedReminder.value = reminderOptions.value.find(r => r.value === 60)
      } else {
        // 自定义提醒
        selectedReminder.value = reminderOptions.value.find(r => r.value === 'custom')
        selectedDate.value = reminderDate.toISOString().split('T')[0]
        selectedTime.value = reminderDate.toTimeString().slice(0, 5)
      }
    }
    
    // 聚焦到输入框
    nextTick(() => {
      if (addTaskInput.value) {
        addTaskInput.value.focus()
        addTaskInput.value.select()
      }
    })
  } else if (!newIsEditing) {
    // 退出编辑模式，重置状态
    handleCancelAdding()
  }
}, { immediate: true })

// 输入框失去焦点
const handleInputBlur = () => {
  // 延迟执行，避免点击按钮时立即收起
  setTimeout(() => {
    // 检查是否有任何内容：文本内容、选择的日期、选择的提醒
    const hasTextContent = newTaskContent.value.trim()
    const hasDateSelected = selectedDate.value
    const hasReminderSelected = selectedReminder.value
    const hasDropdownOpen = showDatePicker.value || showReminderPicker.value
    
    // 只有在没有任何内容且没有下拉框打开时才收起
    if (!hasTextContent && !hasDateSelected && !hasReminderSelected && !hasDropdownOpen) {
      handleCancelAdding()
    }
  }, 200)
}

// 添加/更新任务
const handleAddTask = () => {
  if (!newTaskContent.value.trim()) return
  
  // 验证提醒时间
  if (!isReminderTimeValid()) {
    alert('提醒时间不能设置为过去的时间，请重新选择')
    return
  }
  
  // 计算提醒时间
  let reminderTime = null
  if (selectedReminder.value) {
    const now = new Date()
    
    if (selectedReminder.value.value === 'tomorrow') {
      // 明天9点提醒
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      reminderTime = tomorrow.toISOString()
    } else if (selectedReminder.value.value === 'next_week') {
      // 下周同一天9点提醒
      const nextWeek = new Date(now)
      nextWeek.setDate(now.getDate() + 7)
      nextWeek.setHours(9, 0, 0, 0)
      reminderTime = nextWeek.toISOString()
    } else if (typeof selectedReminder.value.value === 'number') {
      // 从当前时间开始计算提醒时间（30分钟后、1小时后）
      reminderTime = new Date(now.getTime() + selectedReminder.value.value * 60 * 1000).toISOString()
    } else if (selectedReminder.value.value === 'custom') {
      // 自定义提醒，直接使用用户在日期选择器中设置的日期和时间
      if (selectedDate.value && selectedTime.value) {
        const customReminderStr = `${selectedDate.value}T${selectedTime.value}:00`
        reminderTime = new Date(customReminderStr).toISOString()
      } else {
        // 如果没有设置日期时间，默认使用1小时后
        reminderTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
      }
    }
  }
  
  const taskData = {
    content: newTaskContent.value.trim(),
    dueDate: selectedDate.value,
    dueTime: selectedTime.value,
    reminderTime: reminderTime
  }
  
  if (props.isEditing && props.task) {
    // 编辑模式，发送更新事件
    taskData.id = props.task.id
    emit('update-task', taskData)
  } else {
    // 添加模式，发送添加事件
    emit('add-task', taskData)
    handleCancelAdding()
  }
}

// 切换日期选择器
const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value
  showReminderPicker.value = false
}

// 切换提醒选择器
const toggleReminderPicker = () => {
  showReminderPicker.value = !showReminderPicker.value
  showDatePicker.value = false
}

// 清除提醒
const clearReminder = () => {
  selectedReminder.value = null
  // 如果是自定义提醒，也清除日期时间选择
  if (showDatePicker.value) {
    selectedDate.value = ''
    selectedTime.value = '09:00'
    showDatePicker.value = false
  }
}

// 验证提醒时间是否有效
const isReminderTimeValid = () => {
  if (!selectedReminder.value) return true
  
  if (selectedReminder.value.value === 'custom') {
    if (selectedDate.value && selectedTime.value) {
      const customReminderStr = `${selectedDate.value}T${selectedTime.value}:00`
      const customReminderTime = new Date(customReminderStr)
      const now = new Date()
      return customReminderTime > now
    }
  }
  
  return true
}

// 获取提醒显示文本
const getReminderDisplayText = () => {
  if (!selectedReminder.value) {
    return '设置提醒'
  }
  
  if (selectedReminder.value.value === 'custom' && selectedDate.value && selectedTime.value) {
    // 自定义提醒且已设置日期时间，显示具体时间
    return formatSelectedDate(selectedDate.value)
  }
  
  return selectedReminder.value.label
}

// 选择提醒
const selectReminder = (reminder) => {
  selectedReminder.value = reminder
  showReminderPicker.value = false
  
  // 如果选择自定义提醒，自动打开日期选择器
  if (reminder.value === 'custom') {
    showDatePicker.value = true
  }
}

// 格式化选中的日期
const formatSelectedDate = (date) => {
  if (!date) return ''
  const dateObj = new Date(date)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  
  if (date === today.toISOString().split('T')[0]) {
    return `今天 ${selectedTime.value}`
  } else if (date === tomorrow.toISOString().split('T')[0]) {
    return `明天 ${selectedTime.value}`
  } else {
    return `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${selectedTime.value}`
  }
}
</script>

<style>
@import '../assets/styles/components/task-list.css';
</style>