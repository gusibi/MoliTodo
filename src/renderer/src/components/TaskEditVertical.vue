<template>
  <!-- 竖向任务编辑区域 -->
  <div class="task-edit-vertical-container" ref="taskEditContainer">
    <div class="task-edit-vertical" :class="{ 'active': isAddingTask }">
      <!-- 任务标题区域 -->
      <div class="task-header">
        <div class="task-header-title-wrapper">
          <!-- 复选框 -->
          <div class="task-checkbox-wrapper">
            <input 
              type="checkbox" 
              :disabled="!props.isEditing" 
              class="task-checkbox"
              :class="{ 'disabled': !props.isEditing }"
            />
          </div>
          
          <!-- 任务标题输入 -->
          <div class="task-title-input-wrapper">
            <input 
              ref="addTaskInput" 
              v-model="newTaskContent" 
              type="text" 
              :placeholder="props.isEditing ? '编辑任务...' : '添加新任务...'"
              class="task-title-input"
              @focus="handleStartAdding" 
              @blur="handleInputBlur"
              @keyup.ctrl.enter="handleAddTask" 
              @keyup.escape="handleCancelAdding"
            />
          </div>
          
          <!-- 重要性标记 -->
          <div class="task-importance-wrapper">
            <button class="task-importance-btn" :class="{ 'active': isImportant }" @click="toggleImportance">
              <svg class="importance-icon" width="20" height="20" viewBox="0 0 20 20">
                <path d="M10.79 3.1c.5-1 1.92-1 2.42 0l2.36 4.78 5.27.77c1.1.16 1.55 1.52.75 2.3l-3.82 3.72.9 5.25a1.35 1.35 0 01-1.96 1.42L12 18.86l-4.72 2.48a1.35 1.35 0 01-1.96-1.42l.9-5.25-3.81-3.72c-.8-.78-.36-2.14.75-2.3l5.27-.77 2.36-4.78zm1.2.94L9.75 8.6c-.2.4-.58.68-1.02.74l-5.05.74 3.66 3.56c.32.3.46.76.39 1.2l-.87 5.02 4.52-2.37c.4-.2.86-.2 1.26 0l4.51 2.37-.86-5.03c-.07-.43.07-.88.39-1.2l3.65-3.55-5.05-.74a1.35 1.35 0 01-1.01-.74L12 4.04z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 步骤区域 -->
      <div v-if="isAddingTask" class="task-steps">
        <div class="step-add">
          <button class="step-add-btn" @click="addStep">
            <svg class="step-add-icon" width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 2a.5.5 0 01.5.5V7H13a.5.5 0 010 1H8.5v4.5a.5.5 0 01-1 0V8H3a.5.5 0 010-1h4.5V2.5A.5.5 0 018 2z" fill="currentColor"/>
            </svg>
          </button>
          <input 
            v-model="newStepContent" 
            type="text" 
            placeholder="添加步骤" 
            class="step-add-input"
            @keyup.enter="addStep"
          />
        </div>
        
        <!-- 步骤列表 -->
        <div v-if="steps.length > 0" class="steps-list">
          <div v-for="(step, index) in steps" :key="index" class="step-item">
            <input type="checkbox" v-model="step.completed" class="step-checkbox" />
            <span class="step-content" :class="{ 'completed': step.completed }">{{ step.content }}</span>
            <button class="step-delete-btn" @click="removeStep(index)">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 任务选项区域 -->
      <div v-if="isAddingTask" class="task-options">
        <!-- 我的一天 -->
        <div class="task-option-section">
          <div class="task-option-item" :class="{ 'active': isMyDay }">
            <button class="task-option-btn" @click="toggleMyDay">
              <div class="task-option-icon">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M8 1.5c.28 0 .5.22.5.5v1a.5.5 0 01-1 0V2c0-.28.22-.5.5-.5zm0 9a3 3 0 100-6 3 3 0 000 6zm0-1a2 2 0 110-4 2 2 0 010 4zm6-2.5a.5.5 0 000-1h-1a.5.5 0 000 1h1zM8 12.5c.28 0 .5.22.5.5v1a.5.5 0 01-1 0v-1c0-.28.22-.5.5-.5zm-5.5-5.5a.5.5 0 000-1H1.5a.5.5 0 000 1H2.5zm.65-4.65c.2-.2.5-.2.7 0l.71.71a.5.5 0 11-.71.7l-.7-.7a.5.5 0 010-.71zm.7 8.3a.5.5 0 01-.7-.71l.7-.7a.5.5 0 01.71.7l-.71.71zm8.3-.7a.5.5 0 00.7-.71l-.7-.7a.5.5 0 00-.71.7l.71.71zm-.7-8.3a.5.5 0 00-.7 0l-.71.71a.5.5 0 00.7.7l.71-.7a.5.5 0 000-.71z" fill="currentColor"/>
                </svg>
              </div>
              <div class="task-option-content">
                <div class="task-option-title">{{ isMyDay ? '已添加到"我的一天"' : '添加到"我的一天"' }}</div>
              </div>
            </button>
            <button v-if="isMyDay" class="task-option-delete" @click="toggleMyDay">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 提醒设置 -->
        <div class="task-option-section">
          <div class="task-option-item" :class="{ 'active': selectedReminder }">
            <button class="task-option-btn" @click="toggleReminderPicker">
              <div class="task-option-icon">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M8 1.5a4.73 4.73 0 014.78 4.29l.02.17V8.9l.74 1.78a.8.8 0 01.05.13l.01.07.01.1a.8.8 0 01-.6.78l-.09.01L12.8 12h-2.8v.13a2 2 0 01-4 0V12H3.2a.8.8 0 01-.21-.02l-.1-.03a.8.8 0 01-.48-.84l.02-.1.04-.11L3.2 8.9V5.96A4.72 4.72 0 018 1.5zm1.2 10.5h-2.4v.12a1.2 1.2 0 001.09 1.07l.11.01c.62 0 1.14-.48 1.2-1.09V12zM8 2.5a3.92 3.92 0 00-3.98 3.5L4 6.1V9l-.03.16L3.2 11h9.6l-.77-1.84L12 9V6.1A3.92 3.92 0 008 2.5z" fill="currentColor"/>
                </svg>
              </div>
              <div class="task-option-content">
                <div class="task-option-title">{{ selectedReminder ? getReminderDisplayText() : '提醒我' }}</div>
              </div>
            </button>
            <button v-if="selectedReminder" class="task-option-delete" @click="clearReminder">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" fill="currentColor"/>
              </svg>
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
                <svg class="reminder-option-icon" width="16" height="16" viewBox="0 0 16 16">
                  <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1a6 6 0 100 12A6 6 0 008 2zm0 2a.5.5 0 01.5.5v3h2a.5.5 0 010 1h-2.5a.5.5 0 01-.5-.5v-3.5A.5.5 0 018 4z" fill="currentColor"/>
                </svg>
                <span>{{ reminder.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 截止日期 -->
        <div class="task-option-section">
          <div class="task-option-item" :class="{ 'active': selectedDate }">
            <button class="task-option-btn" @click="toggleDatePicker">
              <div class="task-option-icon">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M5.5 8.5a.5.5 0 100-1 .5.5 0 000 1zm1 1.5a.5.5 0 11-1 0 .5.5 0 011 0zm1-1.5a.5.5 0 100-1 .5.5 0 000 1zm1 1.5a.5.5 0 11-1 0 .5.5 0 011 0zm1-1.5a.5.5 0 100-1 .5.5 0 000 1zm3-4A2 2 0 0114 2H2a2 2 0 00-2 2v8c0 1.1.9 2 2 2h12a2 2 0 002-2V4zM1 5.5h14V12a1 1 0 01-1 1H2a1 1 0 01-1-1V5.5zM2 2h12a1 1 0 011 1v1.5H1V3a1 1 0 011-1z" fill="currentColor"/>
                </svg>
              </div>
              <div class="task-option-content">
                <div class="task-option-title">{{ selectedDate ? formatSelectedDate(selectedDate) : '添加截止日期' }}</div>
              </div>
            </button>
            <button v-if="selectedDate" class="task-option-delete" @click="clearDateTime">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          
          <!-- 日期选择器下拉 -->
          <div v-if="showDatePicker" class="task-option-dropdown">
            <div class="date-picker">
              <input 
                type="date" 
                v-model="selectedDate" 
                :min="getMinDate()" 
                class="date-input" 
              />
              <input 
                type="time" 
                v-model="selectedTime" 
                :min="getMinTime()" 
                class="time-input" 
              />
            </div>
          </div>
        </div>

        <!-- 重复设置 -->
        <div class="task-option-section">
          <div class="task-option-item" :class="{ 'active': selectedRecurrence }">
            <button class="task-option-btn" @click="toggleRepeatPicker">
              <div class="task-option-icon">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M13.2 5.34a.4.4 0 01.24.08l.06.05.01.02A4 4 0 0110.58 12L10.4 12H5.36l1.32 1.32c.14.14.16.35.05.5l-.05.06a.4.4 0 01-.5.05l-.06-.05-2-2a.4.4 0 01-.05-.5l.05-.06 2-2a.4.4 0 01.61.5l-.05.06L5.78 11.2h.11l.14-.01H10.4a3.2 3.2 0 002.49-5.22.4.4 0 01.31-.65zm-3.88-3.22a.4.4 0 01.5-.05l.06.05 2 2 .05.06a.4.4 0 010 .44l-.05.06-2 2-.06.05a.4.4 0 01-.44 0l-.06-.05-.05-.06a.4.4 0 010-.44l.05-.06L10.22 4.8h-.11L10 4.8H5.6a3.2 3.2 0 00-2.48 5.22c.05.07.08.16.08.25a.4.4 0 01-.72.24A3.99 3.99 0 015.52 4h5.22L9.42 2.68l-.05-.06a.4.4 0 01.05-.5z" fill="currentColor"/>
                </svg>
              </div>
              <div class="task-option-content">
                <div class="task-option-title">{{ selectedRecurrence ? getRepeatDisplayText() : '重复' }}</div>
              </div>
            </button>
            <button v-if="selectedRecurrence" class="task-option-delete" @click="clearRecurrence">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" fill="currentColor"/>
              </svg>
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
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M11.2 5.6a.8.8 0 100-1.6.8.8 0 000 1.6zm-2.3-4a1.6 1.6 0 00-1.14.46L2.42 7.4a1.6 1.6 0 000 2.27l3.96 3.96a1.6 1.6 0 002.27 0l5.3-5.3A1.6 1.6 0 0014.4 7.18V3.22a1.6 1.6 0 00-1.59-1.6L8.9 1.6zm-.58 1.04a.8.8 0 01.57-.24l3.92.02a.8.8 0 01.79.8v3.96a.8.8 0 01-.23.56l-5.3 5.31a.8.8 0 01-1.13 0L3.56 9.09a.8.8 0 010-1.13l5.35-5.34z" fill="currentColor"/>
                </svg>
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

        <!-- 文件附件 -->
        <div class="task-option-section">
          <div class="task-option-item">
            <button class="task-option-btn" @click="handleFileAttach">
              <div class="task-option-icon">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M3.86 8.38l4.52-4.52a2.4 2.4 0 013.4 3.39L6.4 12.64a1.2 1.2 0 01-1.7-1.7l4.8-4.8a.4.4 0 10-.56-.57l-4.8 4.8a2 2 0 002.83 2.83l5.37-5.38a3.2 3.2 0 10-4.52-4.52L3.3 7.82a.4.4 0 00.56.56z" fill="currentColor"/>
                </svg>
              </div>
              <div class="task-option-content">
                <div class="task-option-title">添加文件</div>
              </div>
            </button>
            <input ref="fileInput" type="file" class="file-input" @change="handleFileChange" />
          </div>
        </div>
      </div>

      <!-- 备注区域 -->
      <div v-if="isAddingTask" class="task-note">
        <div class="task-note-editor">
          <textarea 
            v-model="taskNote" 
            placeholder="添加备注" 
            class="task-note-textarea"
            rows="3"
          ></textarea>
          <div v-if="taskNote" class="task-note-footer">
            <span class="task-note-updated">更新于 刚刚</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div v-if="isAddingTask" class="task-actions">
        <div class="task-actions-left">
          <button class="task-action-close" @click="handleCancelAdding">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M7.34 8.4l-.8.7a.4.4 0 10.53.61l1.6-1.4a.4.4 0 000-.61l-1.6-1.4a.4.4 0 10-.53.61l.8.7H4.4a.4.4 0 000 .8h2.94zM12.8 12.8a1.6 1.6 0 001.6-1.6V4.8a1.6 1.6 0 00-1.6-1.6H3.2a1.6 1.6 0 00-1.6 1.6v6.4c0 .88.72 1.6 1.6 1.6h9.6zm.8-1.6a.8.8 0 01-.8.8h-2.4V4h2.4a.8.8 0 01.8.8v6.4zm-4-7.2v8H3.2a.8.8 0 01-.8-.8V4.8a.8.8 0 01.8-.8h6.4z" fill="currentColor"/>
            </svg>
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
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M6.8 3.2h2.4a1.2 1.2 0 00-2.4 0zm-.8 0a2 2 0 014 0h4a.4.4 0 010 .8h-.84l-.96 8.27A2.4 2.4 0 019.82 14.4H6.18a2.4 2.4 0 01-2.38-2.13L2.84 4H2a.4.4 0 010-.8h4zm-.41 9.38A1.6 1.6 0 006.18 13.6h3.64a1.6 1.6 0 001.59-1.42L12.36 4H3.64l.95 8.18zM6.8 6a.4.4 0 01.4.4v4.8a.4.4 0 01-.8 0V6.4c0-.22.18-.4.4-.4zM9.6 6.4a.4.4 0 00-.8 0v4.8a.4.4 0 00.8 0V6.4z" fill="currentColor"/>
            </svg>
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
const isMyDay = ref(false)
const taskNote = ref('')

// 步骤相关状态
const steps = ref([])
const newStepContent = ref('')

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
  isMyDay.value = false
  taskNote.value = ''
  steps.value = []
  newStepContent.value = ''
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

// 切换我的一天
const toggleMyDay = () => {
  isMyDay.value = !isMyDay.value
}

// 切换提醒选择器
const toggleReminderPicker = () => {
  showReminderPicker.value = !showReminderPicker.value
  showDatePicker.value = false
  showRepeatPicker.value = false
  showListPicker.value = false
}

// 切换日期选择器
const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value
  showReminderPicker.value = false
  showRepeatPicker.value = false
  showListPicker.value = false
  
  if (showDatePicker.value) {
    initializeDefaultDateTime()
  }
}

// 切换重复选择器
const toggleRepeatPicker = () => {
  showRepeatPicker.value = !showRepeatPicker.value
  showReminderPicker.value = false
  showDatePicker.value = false
  showListPicker.value = false
}

// 切换列表选择器
const toggleListPicker = () => {
  showListPicker.value = !showListPicker.value
  showReminderPicker.value = false
  showDatePicker.value = false
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
}

// 清除日期时间
const clearDateTime = () => {
  selectedDate.value = ''
  selectedTime.value = ''
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

// 处理文件附件
const handleFileAttach = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

// 处理文件变化
const handleFileChange = (event) => {
  const files = event.target.files
  if (files && files.length > 0) {
    // 处理文件上传逻辑
    console.log('选择的文件:', files[0])
  }
}

// 添加任务
const handleAddTask = () => {
  if (!newTaskContent.value.trim()) return

  const taskData = {
    content: newTaskContent.value.trim(),
    listId: selectedListId.value,
    isImportant: isImportant.value,
    isMyDay: isMyDay.value,
    note: taskNote.value,
    steps: steps.value,
    dueDate: selectedDate.value,
    dueTime: selectedTime.value,
    reminderTime: selectedReminder.value?.reminderTime,
    reminderConfig: selectedReminder.value?.config,
    recurrence: selectedRecurrence.value
  }

  if (props.isEditing) {
    emit('update-task', { ...props.task, ...taskData })
  } else {
    emit('add-task', taskData)
    resetAllStates()
  }
}

// 删除任务
const handleDeleteTask = () => {
  if (props.task) {
    emit('delete-task', props.task)
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
})

// 监听编辑状态变化
watch(() => props.isEditing, (newIsEditing) => {
  if (newIsEditing && props.task) {
    isAddingTask.value = true
    newTaskContent.value = props.task.content || ''
    isImportant.value = props.task.isImportant || false
    isMyDay.value = props.task.isMyDay || false
    taskNote.value = props.task.note || ''
    steps.value = props.task.steps || []
    
    selectedDate.value = props.task.dueDate || ''
    selectedTime.value = props.task.dueTime || ''
    
    if (props.task.reminderTime) {
      const reminderDate = new Date(props.task.reminderTime)
      if (props.task.reminderConfig) {
        selectedReminder.value = {
          value: 'custom',
          label: props.task.reminderConfig.label,
          config: props.task.reminderConfig,
          reminderTime: props.task.reminderTime
        }
      }
    }
    
    if (props.task.recurrence) {
      selectedRecurrence.value = props.task.recurrence
    }
    
    if (props.task.listId) {
      selectedListId.value = props.task.listId
    }

    nextTick(() => {
      if (addTaskInput.value) {
        addTaskInput.value.focus()
        addTaskInput.value.select()
      }
    })
  } else if (!newIsEditing) {
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
@import '../assets/styles/components/task-edit-vertical.css';
</style>