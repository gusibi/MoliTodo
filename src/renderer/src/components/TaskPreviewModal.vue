<template>
  <Dialog
    :open="visible"
    :title="$t('ai.generatedTaskList')"
    content-class="w-[min(94vw,48rem)]"
    body-class="pb-0"
    :close-on-overlay="false"
    @update:open="(value) => { if (!value) close() }"
  >
    <!-- 原始输入内容展示 -->
    <div v-if="originalInput" class="task-preview-original-input">
      <div class="task-preview-original-label">{{ $t('ai.originalInput') }}：</div>
      <div class="task-preview-original-content">{{ originalInput }}</div>
      <button 
        class="task-preview-copy-btn" 
        :class="{
          'copy-success': copyStatus === 'success',
          'copy-error': copyStatus === 'error',
          'copy-copying': copyStatus === 'copying'
        }"
        @click="copyOriginalInput"
        :title="copyStatus === 'success' ? $t('ai.copySuccess') : copyStatus === 'error' ? $t('ai.copyFailed') : $t('ai.copyOriginalInput')"
        :disabled="copyStatus === 'copying'"
      >
        <div v-if="copyStatus === 'success'" class="copy-icon-success"></div>
        <div v-else-if="copyStatus === 'error'" class="copy-icon-error"></div>
        <div v-else-if="copyStatus === 'copying'" class="copy-icon-loading"></div>
        <div v-else class="copy-icon"></div>
      </button>
    </div>
    
    <div class="task-preview-dialog-body">
      <!-- AI生成内容显示区域 - 支持折叠 -->
      <div v-if="isLoading || streamContent" class="task-preview-stream-content">
        <div class="task-preview-stream-header" @click="isStreamCollapsed = !isStreamCollapsed">
          <Bot class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span class="flex items-center gap-2">
            <LoaderCircle v-if="isLoading" class="h-icon-sm w-icon-sm animate-spin" aria-hidden="true" />
            {{ isLoading ? $t('ai.generatingTasks') : $t('ai.generationDetails') }}
          </span>
          <ChevronDown class="task-preview-stream-toggle h-icon-sm w-icon-sm"
            :class="{ 'collapsed': isStreamCollapsed }" aria-hidden="true" />
        </div>
        <div v-show="!isStreamCollapsed" class="task-preview-stream-text">
          <div v-if="isLoading && !streamContent" class="task-preview-waiting-text">
            {{ $t('ai.waitingForResponse') }}
          </div>
          <div v-else>{{ streamContent }}</div>
        </div>
      </div>
      
      <!-- 任务列表 -->
      <div v-if="taskList.length > 0" class="task-preview-list">
        <!-- 任务项 -->
        <div 
          v-for="(task, index) in taskList" 
          :key="index"
          class="task-preview-item"
        >
          <!-- 第一行：任务内容 + 操作按钮 -->
          <div class="task-preview-row task-preview-row-main">
            <div class="task-preview-content-wrapper">
              <input 
                v-model="task.content"
                type="text"
                class="task-preview-input-main"
                :placeholder="$t('tasks.taskName')"
                maxlength="200"
              />
            </div>
            <div class="task-preview-actions-wrapper">
              <IconButton 
                size="icon-sm"
                variant="ghost"
                class="task-preview-delete-btn"
                :label="$t('tasks.deleteTask')"
                @click="removeTask(index)"
              >
                <Trash2 class="h-icon-sm w-icon-sm" />
              </IconButton>
            </div>
          </div>
          
          <!-- 第二行：安排 / 提醒 / 所属清单 -->
          <div class="task-preview-row task-preview-row-meta">
            <div class="task-preview-meta-item" v-if="task.scheduledStartAt || task.dueDate">
              <label class="task-preview-meta-label">{{ $t('tasks.scheduleDeadline') }}</label>
              <div class="task-preview-input-meta task-preview-time-text">{{ formatPreviewSchedule(task) }}</div>
            </div>
            <div class="task-preview-meta-item" v-if="task.reminderPolicy?.mode === 'relative'">
              <label class="task-preview-meta-label">{{ $t('tasks.reminderTime') }}</label>
              <div class="task-preview-input-meta task-preview-time-text">
                {{ task.reminderPolicy.minutesBefore > 0 ? $t('tasks.reminderBeforeMinutes', { minutes: task.reminderPolicy.minutesBefore }) : $t('tasks.reminderAtStart') }}
              </div>
            </div>
            <div class="task-preview-meta-item" v-else>
              <label class="task-preview-meta-label">{{ $t('tasks.reminderTime') }}</label>
              <input
                v-model="task.reminderTime"
                type="datetime-local"
                class="task-preview-input-meta"
              />
            </div>
            <div class="task-preview-meta-item">
              <label class="task-preview-meta-label">{{ $t('tasks.belongToList') }}</label>
              <select
                v-model="task.listId"
                class="task-preview-select-meta"
              >
                <option
                  v-for="list in availableLists"
                  :key="list.id"
                  :value="list.id"
                >
                  {{ list.name }}
                </option>
              </select>
            </div>
          </div>
          
          <!-- 第三行：备注 -->
          <div class="task-preview-row task-preview-row-note">
            <label class="task-preview-note-label">{{ $t('tasks.note') }}</label>
            <textarea 
              v-model="task.metadata.note"
              class="task-preview-input-note task-preview-textarea-note"
              :placeholder="$t('tasks.addNote')"
              maxlength="1000"
              rows="3"
              @input="autoResizeTextarea"
              ref="noteTextarea"
            ></textarea>
          </div>
          
          <!-- 第四行：步骤标题 -->
          <div v-if="task.metadata.steps && task.metadata.steps.length > 0" class="task-preview-steps-header" @click="toggleSteps(index)">
            <label class="task-preview-steps-label">
              <ListOrdered class="h-icon-sm w-icon-sm" aria-hidden="true" />
              {{ $t('tasks.executionSteps') }} ({{ task.metadata.steps.length }})
            </label>
            <ChevronDown class="task-preview-steps-toggle h-icon-sm w-icon-sm"
              :class="{ 'collapsed': task.stepsCollapsed }" aria-hidden="true" />
          </div>
          
          <!-- 第五行：步骤列表 -->
          <div v-if="task.metadata.steps && task.metadata.steps.length > 0" v-show="!task.stepsCollapsed" class="task-preview-steps-list">
              <div 
                v-for="(step, stepIndex) in task.metadata.steps" 
                :key="step.id"
                class="task-preview-step-item"
              >
                <div class="task-preview-step-number">{{ stepIndex + 1 }}.</div>
                <div class="task-preview-step-content-wrapper">
                  <input 
                    v-model="step.content"
                    type="text"
                    class="task-preview-step-input"
                    :placeholder="$t('tasks.stepContent')"
                    maxlength="200"
                  />
                </div>
                <div class="task-preview-step-status-wrapper">
                  <select 
                    v-model="step.status"
                    class="task-preview-step-status"
                  >
                    <option value="todo">{{ $t('tasks.pending') }}</option>
                    <option value="doing">{{ $t('tasks.inProgress') }}</option>
                    <option value="done">{{ $t('tasks.completed') }}</option>
                  </select>
                </div>
                <div class="task-preview-step-actions-wrapper">
                  <IconButton 
                    size="icon-sm"
                    variant="ghost"
                    class="task-preview-step-delete-btn"
                    :label="$t('tasks.deleteStep')"
                    @click="removeStep(index, stepIndex)"
                  >
                    <X class="h-icon-sm w-icon-sm" />
                  </IconButton>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="task-preview-footer">
        <div class="task-preview-stats">
          <span class="task-preview-count">{{ $t('tasks.totalTasks', { count: taskList.length }) }}</span>
        </div>
        <div class="task-preview-actions">
          <Button variant="secondary" @click="close">{{ $t('common.cancel') }}</Button>
          <Button variant="default" :loading="isCreating" :disabled="!canCreate || isCreating" @click="createAllTasks">
            {{ isCreating ? $t('tasks.creating') : $t('tasks.createAllTasks') }}
          </Button>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bot, ChevronDown, ListOrdered, LoaderCircle, Trash2, X } from '@lucide/vue'
import { localeCode } from '../utils/locale-format.js'
import { useTaskStore } from '@/store/taskStore'
import Dialog from './ui/dialog/Dialog.vue'
import Button from './ui/button/Button.vue'
import IconButton from './ui/button/IconButton.vue'

export default {
  name: 'TaskPreviewModal',
  components: {
    Bot,
    Button,
    ChevronDown,
    Dialog,
    IconButton,
    ListOrdered,
    LoaderCircle,
    Trash2,
    X
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    tasks: {
      type: Array,
      default: () => []
    },
    originalInput: {
      type: String,
      default: ''
    },
    streamContent: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'created'],
  setup(props, { emit }) {
    const { t, locale } = useI18n()
    const taskStore = useTaskStore()
    const isCreating = ref(false)
    const copyStatus = ref('idle') // 'idle', 'copying', 'success', 'error'
    const noteTextarea = ref(null)
    
    // 本地任务列表副本，用于编辑
    const taskList = ref([])
    
    // 流式生成状态
    const isStreamGenerating = ref(false)
    
    // 流式内容折叠状态
    const isStreamCollapsed = ref(false)
    
    // 可用的清单列表
    const availableLists = computed(() => {
      return taskStore.sortedLists
    })
    
    // 是否处于加载状态
    const isLoading = computed(() => {
      return props.visible && taskList.value.length === 0 && props.tasks.length === 0
    })
    
    // 是否可以创建任务
    const canCreate = computed(() => {
      return taskList.value.length > 0 && 
             taskList.value.every(task => task.content && task.content.trim().length > 0)
    })
    
    // 将ISO时间格式转换为datetime-local格式
    const formatDateTimeForInput = (isoString) => {
      if (!isoString) return ''
      try {
        const date = new Date(isoString)
        // 转换为本地时间并格式化为 YYYY-MM-DDTHH:mm
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
      } catch (error) {
        console.error('时间格式转换失败:', error)
        return ''
      }
    }

    // 初始化任务列表
    const initializeTaskList = () => {
      taskList.value = props.tasks.map(task => ({
        ...task,
        dueDate: task.dueDate || '',
        dueTime: task.dueTime || '',
        reminderTime: formatDateTimeForInput(task.reminderTime),
        stepsCollapsed: false, // 步骤展开/折叠状态
        metadata: {
          note: task.metadata?.note || '',
          steps: task.metadata?.steps || [],
          ...task.metadata
        }
      }))
    }
    

    
    // 创建所有任务
    const createAllTasks = async () => {
      if (!canCreate.value || isCreating.value) return
      
      try {
        isCreating.value = true
        const results = []
        
        // 将datetime-local格式转换为ISO格式
        const formatDateTimeForSave = (localDateTime) => {
          if (!localDateTime) return null
          try {
            const date = new Date(localDateTime)
            return date.toISOString()
          } catch (error) {
            console.error('时间格式转换失败:', error)
            return null
          }
        }

        // 依次创建每个任务
        for (const task of taskList.value) {
          const taskData = {
            content: task.content.trim(),
            listId: task.listId,
            dueDate: task.dueDate || null,
            dueTime: task.dueTime || null,
            scheduledStartAt: task.scheduledStartAt || null,
            scheduledEndAt: task.scheduledEndAt || null,
            reminderPolicy: task.reminderPolicy || null,
            // 相对策略不携带绝对提醒时间，避免歧义输入
            reminderTime: task.reminderPolicy?.mode === 'relative'
              ? null
              : formatDateTimeForSave(task.reminderTime),
            metadata: {
              note: task.metadata?.note || '',
              steps: task.metadata?.steps || []
            }
          }
          
          console.log("task:-----", taskData)
          const result = await taskStore.createTask(taskData)
          results.push(result)
        }
        
        // 检查是否所有任务都创建成功
        const successCount = results.filter(r => r.success).length
        const failCount = results.length - successCount
        
        if (failCount === 0) {
          emit('created', {
            success: true,
            message: `成功创建 ${successCount} 个任务`,
            count: successCount
          })
        } else {
          emit('created', {
            success: false,
            message: `创建了 ${successCount} 个任务，${failCount} 个失败`,
            count: successCount
          })
        }
        
        close()
      } catch (error) {
        console.error('批量创建任务失败:', error)
        emit('created', {
          success: false,
          message: '创建任务失败: ' + error.message,
          count: 0
        })
      } finally {
        isCreating.value = false
      }
    }
    
    // 关闭弹窗
    const close = () => {
      emit('close')
    }
    

    
    // 删除任务
    const removeTask = (index) => {
      taskList.value.splice(index, 1)
    }
    
    // 切换步骤展开/折叠状态
    const toggleSteps = (taskIndex) => {
      taskList.value[taskIndex].stepsCollapsed = !taskList.value[taskIndex].stepsCollapsed
    }
    
    // 删除步骤
    const removeStep = (taskIndex, stepIndex) => {
      taskList.value[taskIndex].metadata.steps.splice(stepIndex, 1)
    }
    
    // 复制原始输入
    const copyOriginalInput = async () => {
      copyStatus.value = 'copying'
      try {
        await navigator.clipboard.writeText(props.originalInput)
        copyStatus.value = 'success'
      } catch (err) {
        console.error('复制失败:', err)
        try {
          // 降级方案：使用传统方法
          const textArea = document.createElement('textarea')
          textArea.value = props.originalInput
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
          copyStatus.value = 'success'
        } catch (fallbackErr) {
          copyStatus.value = 'error'
        }
      }
      
      // 2秒后重置状态
      setTimeout(() => {
        copyStatus.value = 'idle'
      }, 2000)
    }
    
    // 监听 visible 变化，初始化数据
    watch(() => props.visible, (visible) => {
      if (visible) {
        nextTick(() => {
          initializeTaskList()
        })
      }
    }, { immediate: true })
    
    // 监听 tasks 变化
    watch(() => props.tasks, () => {
      if (props.visible) {
        initializeTaskList()
      }
    }, { deep: true })
    
    // 自动调整textarea高度的方法
    const autoResizeTextarea = (event) => {
      const textarea = event.target
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const minHeight = 3 * 24 // 3行的最小高度 (假设行高24px)
      const maxHeight = 10 * 24 // 10行的最大高度
      const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight))
      textarea.style.height = newHeight + 'px'
    }
    
    // 展示 AI 生成的安排 / 截止信息
    const formatPreviewSchedule = (task) => {
      const code = localeCode(locale.value)
      const parts = []
      if (task.scheduledStartAt) {
        const start = new Date(task.scheduledStartAt)
        let text = t('tasks.scheduleStartPrefix', {
          time: start.toLocaleString(code, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        })
        if (task.scheduledEndAt) {
          const end = new Date(task.scheduledEndAt)
          text += ` – ${end.toLocaleString(code, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        }
        parts.push(text)
      }
      if (task.dueDate) {
        parts.push(t('tasks.deadlinePrefix', { time: `${task.dueDate}${task.dueTime ? ' ' + task.dueTime : ''}` }))
      }
      return parts.join('　')
    }

    return {
      taskList,
      availableLists,
      isLoading,
      canCreate,
      isCreating,
      createAllTasks,
      close,
      removeTask,
      toggleSteps,
      removeStep,
      copyOriginalInput,
      copyStatus,
      isStreamGenerating,
      isStreamCollapsed,
      formatPreviewSchedule,
      noteTextarea,
      autoResizeTextarea
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/components/task-preview-modal.css';
</style>