<template>
  <!-- 添加任务区域 -->
  <div class="task-edit-container" ref="taskEditContainer">
    <div :class="['task-add-item-row', { 'task-add-item-active': isAddingTask }]" @click="handleStartAdding">
      <!-- 展开占位符 -->
      <div class="task-edit-expand-placeholder"></div>

      <!-- 复选框（不可点击） -->
      <div class="task-item-checkbox">
        <input type="checkbox" disabled class="task-add-checkbox-disabled" />
        <label></label>
      </div>

      <!-- 输入区域 -->
      <div class="task-item-info">
        <div class="task-add-input-wrapper">
          <input ref="addTaskInput" v-model="newTaskContent" type="text" placeholder="添加新任务..." class="task-add-input"
            :class="{ 'task-add-input-active': isAddingTask }" @focus="handleStartAdding" @blur="handleInputBlur"
            @keyup.ctrl.enter="handleAddTask" @keyup.escape="handleCancelAdding" />
        </div>

        <!-- 扩展选项 -->
        <div v-if="isAddingTask" class="task-add-options">
          <div class="task-add-options-row">
            <!-- 列表选择器 -->
            <div class="task-add-option-group">
              <button class="task-add-option-btn" @click.stop="toggleListPicker" :class="{ 'active': showListPicker }">
                <i class="fas fa-list"></i>
                <span>{{ getSelectedListName() }}</span>
              </button>
            </div>

            <!-- 日期时间选择器 -->
            <button class="task-add-option-btn" @click.stop="toggleDatePicker" :class="{ 'active': showDatePicker }">
              <i class="fas fa-calendar"></i>
              <span>{{ selectedDate ? formatSelectedDate(selectedDate) : '设置时间' }}</span>
            </button>

            <!-- 提醒选择器 -->
            <div class="task-add-option-group">
              <button class="task-add-option-btn" @click.stop="toggleReminderPicker"
                :class="{ 'active': showReminderPicker }">
                <i class="fas fa-bell"></i>
                <span>{{ getReminderDisplayText() }}</span>
              </button>

              <!-- 清除提醒按钮 -->
              <button v-if="selectedReminder" class="task-add-clear-btn" @click.stop="clearReminder" title="清除提醒">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- 重复设置选择器 -->
            <div class="task-add-option-group">
              <button class="task-add-option-btn" @click.stop="toggleRepeatPicker"
                :class="{ 'active': showRepeatPicker }">
                <i class="fas fa-redo"></i>
                <span>{{ getRepeatDisplayText() }}</span>
              </button>

              <!-- 清除重复按钮 -->
              <button v-if="selectedRecurrence" class="task-add-clear-btn" @click.stop="clearRecurrence" title="清除重复">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- 添加/保存按钮 -->
            <button v-if="newTaskContent.trim()" class="task-add-submit-btn" @click="handleAddTask">
              <i class="fas fa-plus" v-if="!props.isEditing"></i>
              <i class="fas fa-save" v-if="props.isEditing"></i>
              {{ props.isEditing ? '保存' : '添加' }}
            </button>

            <!-- 取消按钮（仅编辑模式显示） -->
            <button v-if="props.isEditing" class="task-add-cancel-btn" @click="handleCancelAdding">
              <i class="fas fa-times"></i>
              取消
            </button>
          </div>

          <!-- 列表选择器下拉 -->
          <div v-if="showListPicker" class="task-add-dropdown">
            <div class="task-add-list-options">
              <!-- 编辑模式 -->
              <template v-if="props.isEditing">
                <!-- 当前任务所属列表 -->
                <div v-if="props.task && props.task.listId" class="task-add-current-list">
                  <div class="task-add-current-list-label">当前列表</div>
                  <button class="task-add-list-option task-add-current-list-option"
                    :class="{ 'active': selectedListId === props.task.listId }"
                    @click.stop="selectList(getCurrentTaskList())">
                    <div class="task-add-list-icon" :style="{ color: getCurrentTaskList()?.color }">
                      <i :class="`fas fa-${getCurrentTaskList()?.icon}`"></i>
                    </div>
                    <span class="task-add-list-option-name">{{ getCurrentTaskList()?.name }}</span>
                  </button>
                </div>

                <!-- 分隔线 -->
                <div v-if="props.task && props.task.listId && getOtherLists().length > 0"
                  class="task-add-list-separator"></div>

                <!-- 其他可选列表 -->
                <div v-if="props.task && props.task.listId && getOtherLists().length > 0"
                  class="task-add-other-lists-label">移动到其他列表</div>
                <button v-for="list in getOtherLists()" :key="list.id" class="task-add-list-option"
                  :class="{ 'active': selectedListId === list.id }" @click.stop="selectList(list)">
                  <div class="task-add-list-icon" :style="{ color: list.color }">
                    <i :class="`fas fa-${list.icon}`"></i>
                  </div>
                  <span class="task-add-list-option-name">{{ list.name }}</span>
                </button>
              </template>

              <!-- 添加模式：显示所有列表 -->
              <template v-else>
                <button v-for="list in availableLists" :key="list.id" class="task-add-list-option"
                  :class="{ 'active': selectedListId === list.id }" @click.stop="selectList(list)">
                  <div class="task-add-list-icon" :style="{ color: list.color }">
                    <i :class="`fas fa-${list.icon}`"></i>
                  </div>
                  <span class="task-add-list-option-name">{{ list.name }}</span>
                </button>
              </template>
            </div>
          </div>

          <!-- 日期选择器下拉 -->
          <div v-if="showDatePicker" class="task-add-dropdown">
            <div class="task-add-date-picker">
              <input type="date" v-model="selectedDate" :min="getMinDate()" class="task-add-date-input" @click.stop />
              <input type="time" v-model="selectedTime" :min="getMinTime()" class="task-add-time-input" @click.stop />
              <button v-if="selectedDate || selectedTime" class="task-add-clear-btn" @click.stop="clearDateTime"
                title="清除日期时间">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <!-- 提醒选择器下拉 -->
          <div v-if="showReminderPicker" class="task-add-dropdown">
            <div class="task-add-reminder-options">
              <button v-for="reminder in customReminderOptions" :key="reminder.id" class="task-add-reminder-option"
                @click.stop="selectCustomReminder(reminder)">
                <i class="fas fa-clock"></i>
                <span>{{ reminder.label }}</span>
              </button>
            </div>
          </div>

          <!-- 重复设置下拉 -->
          <div v-if="showRepeatPicker" class="task-add-dropdown task-add-repeat-dropdown">
            <RepeatSelector 
              v-model="selectedRecurrence" 
              :base-date="getBaseDate()"
              @update:modelValue="handleRecurrenceChange"
            />
            
            <!-- 重复实例预览 -->
            <div v-if="selectedRecurrence" class="task-add-repeat-preview">
              <NextOccurrencesPreview 
                :recurrence="selectedRecurrence"
                :base-date="getBaseDate()"
                :existing-instances="[]"
                @complete-occurrence="handleCompleteOccurrence"
                @edit-occurrence="handleEditOccurrence"
                @delete-occurrence="handleDeleteOccurrence"
              />
            </div>
          </div>
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
import NextOccurrencesPreview from './NextOccurrencesPreview.vue'


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

// 使用 taskStore
const taskStore = useTaskStore()
const { customReminderOptions: storeCustomReminderOptions, lists } = storeToRefs(taskStore)

// 组件根元素引用
const taskEditContainer = ref(null)

// 添加任务相关状态
const newTaskContent = ref('')
const addTaskInput = ref(null)
const isAddingTask = ref(false)

// 日期时间相关状态
const selectedDate = ref('')
const selectedTime = ref('')
const showDatePicker = ref(false)

// 提醒相关状态
const selectedReminder = ref(null)
const showReminderPicker = ref(false)

// 列表选择相关状态
const selectedListId = ref(null)
const showListPicker = ref(false)
// 使用 taskStore 中的 lists 作为 availableLists
const availableLists = lists

// 重复任务相关状态
const selectedRecurrence = ref(null)
const showRepeatPicker = ref(false)

// 使用 storeToRefs 确保响应式
const customReminderOptions = storeCustomReminderOptions

// 调试：监听 customReminderOptions 的变化
watch(customReminderOptions, (newOptions) => {
}, { immediate: true })

// 调试：监听 availableLists 的变化
watch(availableLists, (newLists) => {
}, { immediate: true })

// 获取本地日期字符串（避免时区问题）
const getLocalDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 初始化默认日期和时间（仅在打开日期选择器时调用）
const initializeDefaultDateTime = () => {
  // 只有在没有设置日期时才设置默认值
  if (!selectedDate.value) {
    const now = new Date()
    selectedDate.value = getLocalDateString(now)
  }

  // 只有在没有设置时间时才设置默认值
  if (!selectedTime.value) {
    // 设置默认时间为当前时间的下一个整点
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
    const hours = String(nextHour.getHours()).padStart(2, '0')
    selectedTime.value = `${hours}:00`
  }
}



// 组件挂载时初始化
onMounted(async () => {
  // console.log('TaskEdit 组件已挂载，开始初始化...')
  // console.log('当前 customReminderOptions:', customReminderOptions.value)
  // console.log('当前 availableLists:', availableLists.value)

  // 如果列表为空，则加载它们
  if (!availableLists.value || availableLists.value.length === 0) {
    // console.log('availableLists 为空，正在加载...')
    await taskStore.getAllLists()
  }

  // 如果自定义提醒选项为空，则加载它们
  if (!customReminderOptions.value || customReminderOptions.value.length === 0) {
    // console.log('customReminderOptions 为空，正在加载...')
    await taskStore.loadCustomReminderOptions()
  }



  // 设置默认选中的列表
  if (props.isEditing && props.task && props.task.listId) {
    // 编辑模式：使用任务当前所属的列表
    selectedListId.value = props.task.listId
  } else if (taskStore.currentListId) {
    // 添加模式：使用当前选中的列表
    selectedListId.value = taskStore.currentListId
  } else if (availableLists.value.length > 0) {
    // 如果没有当前列表，选择第一个列表
    selectedListId.value = availableLists.value[0].id
  }

  // 添加点击外部区域的监听器
  document.addEventListener('click', handleClickOutside)
})

// 组件卸载时移除监听器
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 重置所有状态的函数
const resetAllStates = () => {
  isAddingTask.value = false
  newTaskContent.value = ''
  selectedDate.value = ''
  selectedTime.value = ''
  selectedReminder.value = null
  selectedRecurrence.value = null
  showDatePicker.value = false
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


// 查找匹配的提醒选项
const findMatchingReminderOption = (reminderDate) => {
  const now = new Date()
  const diffMs = reminderDate.getTime() - now.getTime()

  // 尝试匹配相对时间选项
  for (const option of customReminderOptions.value) {
    if (option.type === 'relative') {
      let expectedMs = 0
      switch (option.unit) {
        case 'minutes':
          expectedMs = option.value * 60 * 1000
          break
        case 'hours':
          expectedMs = option.value * 60 * 60 * 1000
          break
        case 'days':
          expectedMs = option.value * 24 * 60 * 60 * 1000
          break
      }

      // 允许5分钟的误差
      if (Math.abs(diffMs - expectedMs) < 5 * 60 * 1000) {
        return option
      }
    }
  }

  // 尝试匹配绝对时间选项
  const reminderTime = reminderDate.toTimeString().slice(0, 5)
  const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate())
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const actualDayOffset = Math.round((reminderDateOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24))

  for (const option of customReminderOptions.value) {
    if (option.type === 'absolute' && option.time === reminderTime && option.dayOffset === actualDayOffset) {
      return option
    }
  }

  return null
}

// 格式化日期和时间（用于编辑模式）
const formatDateWithTime = (date, time) => {
  if (!date || !time) return ''
  const dateObj = new Date(date)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const todayStr = getLocalDateString(today)
  const tomorrowStr = getLocalDateString(tomorrow)

  if (date === todayStr) {
    return `今天 ${time}`
  } else if (date === tomorrowStr) {
    return `明天 ${time}`
  } else {
    return `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${time}`
  }
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
    // 编辑模式下，发送取消编辑事件
    emit('cancel-edit')
  } else {
    // 添加模式下，重置状态
    resetAllStates()
  }
}

// 监听 props.task 变化，更新列表选择
watch(() => props.task, (newTask) => {
  if (newTask && newTask.listId) {
    selectedListId.value = newTask.listId
  }
  
  // 处理重复设置
  if (props.isEditing && newTask && newTask.recurrence) {
    selectedRecurrence.value = newTask.recurrence
    
    // 如果重复任务有提醒时间，需要确保RepeatSelector能正确显示
    if (newTask.recurrence.reminderTime) {
      console.log('编辑模式：发现重复任务的提醒时间', newTask.recurrence.reminderTime)
    }
  }
}, { immediate: true })

// 监听当前列表变化，重置状态
watch(() => taskStore.currentListId, () => {
  resetAllStates()
})

// 监听日期变化，调整时间限制
watch(() => selectedDate.value, (newDate) => {
  if (newDate) {
    const now = new Date()
    const today = getLocalDateString(now)

    // 如果选择的是今天，且当前时间小于现在时间，则调整为当前时间
    if (newDate === today && selectedTime.value) {
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (selectedTime.value < currentTime) {
        selectedTime.value = currentTime
      }
    }
  }
})

// 监听编辑状态变化，填充数据
watch(() => props.isEditing, (newIsEditing) => {
  if (newIsEditing && props.task) {
    // 编辑模式，填充现有数据
    isAddingTask.value = true
    newTaskContent.value = props.task.content || ''

    // 重置其他状态
    selectedDate.value = ''
    selectedTime.value = ''
    selectedReminder.value = null

    // 处理日期时间
    if (props.task.dueDate) {
      selectedDate.value = props.task.dueDate
    }
    if (props.task.dueTime) {
      selectedTime.value = props.task.dueTime
    }

    // 处理提醒时间
    if (props.task.reminderTime) {
      const reminderDate = new Date(props.task.reminderTime)

      if (props.task.reminderConfig) {
        // 如果有提醒配置，使用配置信息，确保配置是可序列化的
        const cleanConfig = {
          id: props.task.reminderConfig.id,
          label: props.task.reminderConfig.label,
          type: props.task.reminderConfig.type,
          value: props.task.reminderConfig.value,
          unit: props.task.reminderConfig.unit,
          time: props.task.reminderConfig.time,
          dayOffset: props.task.reminderConfig.dayOffset
        }

        selectedReminder.value = {
          value: 'custom',
          label: formatReminderLabel(props.task.reminderConfig, reminderDate),
          config: cleanConfig,
          reminderTime: props.task.reminderTime
        }
      } else {
        // 兼容旧格式，尝试匹配现有的自定义提醒选项
        const matchedOption = findMatchingReminderOption(reminderDate)
        if (matchedOption) {
          // 确保匹配的选项是可序列化的
          const cleanMatchedOption = {
            id: matchedOption.id,
            label: matchedOption.label,
            type: matchedOption.type,
            value: matchedOption.value,
            unit: matchedOption.unit,
            time: matchedOption.time,
            dayOffset: matchedOption.dayOffset
          }

          selectedReminder.value = {
            value: 'custom',
            label: matchedOption.label,
            config: cleanMatchedOption,
            reminderTime: props.task.reminderTime
          }
        } else {
          // 创建简单的自定义提醒，计算正确的天数偏移
          const now = new Date()
          const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate())
          const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const dayOffset = Math.round((reminderDateOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24))

          const reminderTimeStr = reminderDate.toTimeString().slice(0, 5)
          selectedReminder.value = {
            value: 'custom',
            label: formatDateWithTime(getLocalDateString(reminderDate), reminderTimeStr),
            config: {
              type: 'absolute',
              time: reminderTimeStr,
              dayOffset: Math.max(0, dayOffset) // 确保不是负数
            },
            reminderTime: props.task.reminderTime
          }
        }
      }
      console.log("reminderDate: ", reminderDate)

      // 使用本地时间设置日期，避免时区问题
      selectedDate.value = getLocalDateString(reminderDate)
      selectedTime.value = reminderDate.toTimeString().slice(0, 5)
    }

    // 处理列表信息
    if (props.task.listId) {
      selectedListId.value = props.task.listId
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

// 监听 props.task 的变化，当任务内容变化时更新编辑区
watch(() => [props.task, props.isEditing], ([newTask, newIsEditing]) => {
  if (newIsEditing && newTask) {
    // 编辑模式下，当任务变化时重新填充数据
    isAddingTask.value = true
    newTaskContent.value = newTask.content || ''

    // 重置其他状态
    selectedDate.value = ''
    selectedTime.value = ''
    selectedReminder.value = null

    // 处理日期时间
    if (newTask.dueDate) {
      selectedDate.value = newTask.dueDate
    }
    if (newTask.dueTime) {
      selectedTime.value = newTask.dueTime
    }

    // 处理提醒时间
    if (newTask.reminderTime) {
      const reminderDate = new Date(newTask.reminderTime)
      const now = new Date()
      const diffMinutes = Math.round((reminderDate.getTime() - now.getTime()) / (1000 * 60))

      // 这段代码已经过时，因为我们现在使用自定义提醒配置
      // 直接使用新的逻辑处理提醒时间
      const matchedOption = findMatchingReminderOption(reminderDate)
      if (matchedOption) {
        const cleanMatchedOption = {
          id: matchedOption.id,
          label: matchedOption.label,
          type: matchedOption.type,
          value: matchedOption.value,
          unit: matchedOption.unit,
          time: matchedOption.time,
          dayOffset: matchedOption.dayOffset
        }

        selectedReminder.value = {
          value: 'custom',
          label: matchedOption.label,
          config: cleanMatchedOption,
          reminderTime: newTask.reminderTime
        }
      } else {
        // 创建简单的自定义提醒
        selectedReminder.value = {
          value: 'custom',
          label: formatDateWithTime(getLocalDateString(reminderDate), reminderDate.toTimeString().slice(0, 5)),
          config: {
            type: 'absolute',
            time: reminderDate.toTimeString().slice(0, 5),
            dayOffset: 0
          },
          reminderTime: newTask.reminderTime
        }
      }

      // 使用本地时间设置日期，避免时区问题
      selectedDate.value = getLocalDateString(reminderDate)
      selectedTime.value = reminderDate.toTimeString().slice(0, 5)
    }

    // 处理列表信息
    if (newTask.listId) {
      selectedListId.value = newTask.listId
    }

    // 聚焦到输入框
    nextTick(() => {
      if (addTaskInput.value) {
        addTaskInput.value.focus()
        addTaskInput.value.select()
      }
    })
  }
}, { immediate: true, deep: true })

// 输入框失去焦点
const handleInputBlur = () => {
  // 延迟执行，避免点击按钮时立即收起
  setTimeout(() => {
    // 检查是否有任何内容：文本内容、选择的日期、选择的提醒
    const hasTextContent = newTaskContent.value.trim()
    const hasDateSelected = selectedDate.value
    const hasReminderSelected = selectedReminder.value
    const hasDropdownOpen = showDatePicker.value || showReminderPicker.value || showListPicker.value

    // 只有在没有任何内容且没有下拉框打开时才收起
    if (!hasTextContent && !hasDateSelected && !hasReminderSelected && !hasDropdownOpen) {
      handleCancelAdding()
    }
  }, 200)
}

// 计算提醒时间的独立方法
const calculateReminderTime = () => {
  console.log('=== 计算提醒时间 ===')

  let reminderTime = null
  let reminderConfig = null

  // 处理重复任务的提醒时间
  if (selectedRecurrence.value && selectedRecurrence.value.reminderTime) {
    console.log('处理重复任务的提醒时间')
    try {
      // 使用当前任务实例的日期，而不是下一个重复周期的日期
      const currentDate = selectedDate.value ? new Date(selectedDate.value) : new Date()
      
      // 将重复任务的提醒时间（只有时间部分）与当前任务日期组合
      const [hours, minutes] = selectedRecurrence.value.reminderTime.split(':')
      currentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      reminderTime = currentDate.toISOString()
      console.log('重复任务计算的提醒时间:', reminderTime)
    } catch (error) {
      console.error('计算重复任务提醒时间失败:', error)
    }
  }
  
  // 处理普通任务的提醒时间（如果没有设置重复任务提醒时间）
  if (!reminderTime && selectedReminder.value) {
    if (selectedReminder.value.value === 'custom' && selectedReminder.value.reminderTime) {
      console.log('使用自定义提醒配置中的时间')
      // 使用自定义提醒配置中的时间
      reminderTime = selectedReminder.value.reminderTime
      reminderConfig = selectedReminder.value.config
    } else if (selectedDate.value && selectedTime.value) {
      // 使用日期时间选择器中的时间
      const customReminderStr = `${selectedDate.value}T${selectedTime.value}:00`
      reminderTime = new Date(customReminderStr).toISOString()
    }
  } else if (!reminderTime && selectedDate.value && selectedTime.value) {
    // 当没有选择提醒类型，但设置了日期和时间时，直接使用这个日期时间作为提醒时间
    const customReminderStr = `${selectedDate.value}T${selectedTime.value}:00`
    reminderTime = new Date(customReminderStr).toISOString()
  }

  console.log('最终的提醒时间:', reminderTime)
  console.log('最终的提醒配置:', reminderConfig)

  // 确保 reminderConfig 是可序列化的，移除任何不可序列化的属性
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

  return { reminderTime, cleanReminderConfig }
}

// 添加/更新任务
const handleAddTask = async () => {
  if (!newTaskContent.value.trim()) return

  // 验证提醒时间
  if (!isReminderTimeValid()) {
    alert('提醒时间不能设置为过去的时间，请重新选择 add')
    return
  }

  // 计算提醒时间
  const { reminderTime, cleanReminderConfig } = calculateReminderTime()
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
        console.log("updated task data: ", taskData)
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

// 切换列表选择器
const toggleListPicker = async () => {
  showListPicker.value = !showListPicker.value
  showDatePicker.value = false
  showReminderPicker.value = false

  // 当打开列表选择器时，重新加载最新的列表数据
  if (showListPicker.value) {
    console.log('重新加载列表数据...')
    await taskStore.getAllLists()
  }
}

// 切换日期选择器
const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value
  showReminderPicker.value = false
  showListPicker.value = false

  // 当打开日期选择器时，如果没有设置日期和时间，则设置默认值
  if (showDatePicker.value) {
    initializeDefaultDateTime()
  }
}

// 切换提醒选择器
const toggleReminderPicker = async () => {
  showReminderPicker.value = !showReminderPicker.value
  showDatePicker.value = false
  showListPicker.value = false

  // 当打开提醒选择器时，重新加载最新的自定义提醒选项
  if (showReminderPicker.value) {
    console.log('重新加载自定义提醒选项...')
    await taskStore.refreshCustomReminderOptions()
  }
}

// 清除提醒
const clearReminder = () => {
  selectedReminder.value = null
  selectedDate.value = ''
  selectedTime.value = ''
  showDatePicker.value = false
  showReminderPicker.value = false
}

// 清除日期时间
const clearDateTime = () => {
  selectedDate.value = ''
  selectedTime.value = ''
  selectedReminder.value = null
}

// 处理点击外部区域
const handleClickOutside = (event) => {
  if (taskEditContainer.value && !taskEditContainer.value.contains(event.target)) {
    // 点击了组件外部，关闭所有下拉框
    showDatePicker.value = false
    showReminderPicker.value = false
    showListPicker.value = false
  }
}

// 验证提醒时间是否有效
const isReminderTimeValid = () => {
  console.log('=== isReminderTimeValid 验证开始 ===')
  console.log('selectedReminder.value:', selectedReminder.value)
  console.log('selectedDate.value:', selectedDate.value)
  console.log('selectedTime.value:', selectedTime.value)

  if (!selectedReminder.value && !selectedDate.value) {
    console.log('没有提醒设置，返回 true')
    return true
  }

  const now = new Date()
  console.log('当前时间:', now.toLocaleString())

  if (selectedReminder.value && selectedReminder.value.value === 'custom') {

    // 优先使用 selectedReminder 中存储的 reminderTime
    if (selectedReminder.value.reminderTime) {
      const customReminderTime = new Date(selectedReminder.value.reminderTime)
      const isValid = customReminderTime > now
      return isValid
    } else if (selectedDate.value && selectedTime.value) {
      const customReminderStr = `${selectedDate.value}T${selectedTime.value}:00`

      const customReminderTime = new Date(customReminderStr)

      const isValid = customReminderTime > now
      return isValid
    }
  } else if (!selectedReminder.value && selectedDate.value && selectedTime.value) {
    // 当没有选择提醒类型，但设置了日期和时间时，也需要验证时间
    const customReminderStr = `${selectedDate.value}T${selectedTime.value}:00`

    const customReminderTime = new Date(customReminderStr)

    const isValid = customReminderTime > now
    return isValid
  }

  return true
}

// 获取提醒显示文本
const getReminderDisplayText = () => {
  if (!selectedReminder.value) {
    return '设置提醒'
  }

  return selectedReminder.value.label || '自定义提醒'
}

// 获取当前任务所属的列表
const getCurrentTaskList = () => {
  if (props.task && props.task.listId) {
    return availableLists.value.find(list => list.id === props.task.listId)
  }
  return null
}

// 获取除当前任务所属列表外的其他列表
const getOtherLists = () => {
  if (props.task && props.task.listId) {
    return availableLists.value.filter(list => list.id !== props.task.listId)
  }
  return availableLists.value
}

// 选择列表
const selectList = (list) => {
  selectedListId.value = list.id
  showListPicker.value = false
}

// 获取选中的列表名称
const getSelectedListName = () => {
  const list = availableLists.value.find(l => l.id === selectedListId.value)
  return list ? list.name : '选择列表'
}

// 获取重复设置显示文本
const getRepeatDisplayText = () => {
  if (!selectedRecurrence.value) {
    return '设置重复'
  }
  
  const rule = selectedRecurrence.value
  const freq = rule.type  // 修复：使用 type 而不是 frequency
  const interval = rule.interval || 1
  
  let desc = ''
  
  if (freq === 'daily') {
    desc = interval === 1 ? '每天' : `每${interval}天`
  } else if (freq === 'weekly') {
    desc = interval === 1 ? '每周' : `每${interval}周`
    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {  // 修复：使用 daysOfWeek 而不是 weekdays
      const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const selectedDays = rule.daysOfWeek.map(day => dayNames[day]).join('、')
      desc += ` (${selectedDays})`
    }
  } else if (freq === 'monthly') {
    desc = interval === 1 ? '每月' : `每${interval}月`
    if (rule.byMonthDay && rule.byMonthDay.length > 0) {  // 修复：使用 byMonthDay 数组
      const days = rule.byMonthDay.sort((a, b) => a - b).join('、')
      desc += ` ${days}日`
    } else if (rule.byWeekDay) {  // 修复：使用 byWeekDay 对象
      const weekNames = ['第一个', '第二个', '第三个', '第四个', '最后一个']
      const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const week = rule.byWeekDay.week === -1 ? '最后' : weekNames[rule.byWeekDay.week - 1]
      desc += ` ${week}个${dayNames[rule.byWeekDay.weekday]}`
    }
  } else if (freq === 'yearly') {
    desc = interval === 1 ? '每年' : `每${interval}年`
    if (rule.byMonth && rule.byMonth.length > 0) {  // 修复：添加月份显示
      const months = rule.byMonth.sort((a, b) => a - b).map(m => `${m}月`).join('、')
      desc += ` ${months}`
      if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        const days = rule.byMonthDay.sort((a, b) => a - b).join('、')
        desc += `${days}日`
      }
    }
  }
  
  // 结束条件
  if (rule.endCondition) {  // 修复：使用 endCondition 对象
    if (rule.endCondition.type === 'date' && rule.endCondition.value) {
      desc += ` (至${rule.endCondition.value})`
    } else if (rule.endCondition.type === 'count' && rule.endCondition.value > 0) {
      desc += ` (${rule.endCondition.value}次)`
    }
  }
  
  return desc
}

// 处理重复规则变化
const handleRecurrenceChange = (recurrence) => {
  selectedRecurrence.value = recurrence
}

// 监听 props.task 的重复设置变化
watch(() => props.task?.recurrence, (newRecurrence) => {
  if (props.isEditing && newRecurrence) {
    selectedRecurrence.value = newRecurrence
  }
}, { immediate: true, deep: true })

// 清除重复设置
const clearRecurrence = () => {
  selectedRecurrence.value = null
  showRepeatPicker.value = false
}

// 切换重复选择器显示
const toggleRepeatPicker = () => {
  showRepeatPicker.value = !showRepeatPicker.value
  showDatePicker.value = false
  showReminderPicker.value = false
  showListPicker.value = false
}

// 获取基准日期（用于重复任务计算）
const getBaseDate = () => {
  if (selectedDate.value) {
    return new Date(selectedDate.value)
  }
  // 如果没有选择日期，使用今天
  return new Date()
}

// 处理完成重复任务实例
const handleCompleteOccurrence = (occurrence) => {
  console.log('完成重复任务实例:', occurrence)
  // 这里可以添加完成重复任务实例的逻辑
}

// 处理编辑重复任务实例
const handleEditOccurrence = (occurrence) => {
  console.log('编辑重复任务实例:', occurrence)
  // 这里可以添加编辑重复任务实例的逻辑
}

// 处理删除重复任务实例
const handleDeleteOccurrence = (occurrence) => {
  console.log('删除重复任务实例:', occurrence)
  // 这里可以添加删除重复任务实例的逻辑
}



// 选择自定义提醒选项
const selectCustomReminder = (reminderOption) => {
  console.log('=== selectCustomReminder 开始 ===')
  console.log('选择的提醒选项:', reminderOption)

  const now = new Date()
  console.log('当前时间:', now.toLocaleString())

  let reminderTime = null
  let displayText = reminderOption.label

  if (reminderOption.type === 'relative') {
    console.log('处理相对时间提醒')
    // 相对时间
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

    console.log(`计算的毫秒数: ${milliseconds} (${reminderOption.value} ${reminderOption.unit})`)
    reminderTime = new Date(now.getTime() + milliseconds)
    console.log('计算的提醒时间:', reminderTime.toLocaleString())
  } else if (reminderOption.type === 'absolute') {
    console.log('处理绝对时间提醒')
    console.log('dayOffset:', reminderOption.dayOffset)
    console.log('time:', reminderOption.time)

    // 绝对时间
    const targetDate = new Date(now)
    console.log('初始目标日期:', targetDate.toLocaleString())

    targetDate.setDate(now.getDate() + reminderOption.dayOffset)
    console.log('设置天数偏移后:', targetDate.toLocaleString())

    const [hours, minutes] = reminderOption.time.split(':').map(Number)
    console.log('解析的时间:', { hours, minutes })

    targetDate.setHours(hours, minutes, 0, 0)
    console.log('设置时间后:', targetDate.toLocaleString())

    // 如果是今天且时间已过，则设置为明天
    if (reminderOption.dayOffset === 0 && targetDate <= now) {
      console.log('今天时间已过，调整为明天')
      targetDate.setDate(now.getDate() + 1)
      console.log('调整后的时间:', targetDate.toLocaleString())
    }

    reminderTime = targetDate
  }

  console.log('最终计算的提醒时间:', reminderTime ? reminderTime.toLocaleString() : 'null')
  console.log('当前时间 vs 提醒时间:', {
    now: now.getTime(),
    reminder: reminderTime ? reminderTime.getTime() : null,
    diff: reminderTime ? reminderTime.getTime() - now.getTime() : null,
    diffMinutes: reminderTime ? (reminderTime.getTime() - now.getTime()) / (1000 * 60) : null
  })

  // 验证时间是否有效
  if (reminderTime && reminderTime <= now) {
    console.log('❌ 提醒时间无效，小于等于当前时间')
    alert('提醒时间不能设置为过去的时间，请重新选择 111')
    return
  } else {
    console.log('✅ 提醒时间有效')
  }

  // 设置提醒信息，确保所有属性都是可序列化的
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

  console.log('设置的 selectedReminder.value:', selectedReminder.value)
  console.log('selectedReminder 序列化测试:', JSON.stringify(selectedReminder.value))

  // 同步到日期时间选择器
  if (reminderTime) {
    console.log('同步到日期时间选择器')
    // 使用本地时间而不是 UTC 时间，避免时区问题
    const year = reminderTime.getFullYear()
    const month = String(reminderTime.getMonth() + 1).padStart(2, '0')
    const day = String(reminderTime.getDate()).padStart(2, '0')
    const hours = String(reminderTime.getHours()).padStart(2, '0')
    const minutes = String(reminderTime.getMinutes()).padStart(2, '0')

    const dateStr = `${year}-${month}-${day}`
    const timeStr = `${hours}:${minutes}`

    console.log('设置的日期 (本地时间):', dateStr)
    console.log('设置的时间 (本地时间):', timeStr)
    console.log('原始时间对象:', reminderTime.toLocaleString())

    selectedDate.value = dateStr
    selectedTime.value = timeStr

    console.log('selectedDate.value 已设置为:', selectedDate.value)
    console.log('selectedTime.value 已设置为:', selectedTime.value)
  } else {
    console.log('reminderTime 为空，不同步到日期时间选择器')
  }

  console.log('=== selectCustomReminder 结束 ===')
  console.log('最终状态:', {
    selectedReminder: selectedReminder.value,
    selectedDate: selectedDate.value,
    selectedTime: selectedTime.value
  })

  showReminderPicker.value = false
}

// 获取最小日期（今天）
const getMinDate = () => {
  const today = new Date()
  return getLocalDateString(today)
}

// 获取最小时间（如果选择的是今天，则为当前时间；否则为 00:00）
const getMinTime = () => {
  const now = new Date()
  const today = getLocalDateString(now)

  // 如果选择的日期是今天，则最小时间为当前时间
  if (selectedDate.value === today) {
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // 如果选择的是未来日期，则没有时间限制
  return '00:00'
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
    return `今天 ${selectedTime.value}`
  } else if (date === tomorrowStr) {
    return `明天 ${selectedTime.value}`
  } else {
    return `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${selectedTime.value}`
  }
}

// 格式化提醒标签
const formatReminderLabel = (config, reminderDate) => {
  if (!config || !reminderDate) return '自定义提醒'

  if (config.type === 'relative') {
    const { value, unit } = config
    switch (unit) {
      case 'minutes':
        return `${value}分钟后`
      case 'hours':
        return `${value}小时后`
      case 'days':
        return `${value}天后`
      default:
        return '自定义提醒'
    }
  } else {
    // 绝对时间
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const reminderDateStr = getLocalDateString(reminderDate)
    const todayStr = getLocalDateString(today)
    const tomorrowStr = getLocalDateString(tomorrow)
    const timeStr = reminderDate.toTimeString().slice(0, 5)

    if (reminderDateStr === todayStr) {
      return `今天 ${timeStr}`
    } else if (reminderDateStr === tomorrowStr) {
      return `明天 ${timeStr}`
    } else {
      return `${reminderDate.getMonth() + 1}月${reminderDate.getDate()}日 ${timeStr}`
    }
  }
}



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
@import '../assets/styles/components/task-list.css';

.task-add-date-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}
</style>