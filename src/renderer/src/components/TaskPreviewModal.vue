<template>
  <div v-if="visible" class="task-preview-modal-overlay" @click="handleOverlayClick">
    <div class="task-preview-dialog" @click.stop>
      <!-- 原始输入内容展示 -->
      <div v-if="originalInput" class="task-preview-original-input">
        <div class="task-preview-original-label">原始输入：</div>
        <div class="task-preview-original-content">{{ originalInput }}</div>
        <button 
          class="task-preview-copy-btn" 
          :class="{
            'copy-success': copyStatus === 'success',
            'copy-error': copyStatus === 'error',
            'copy-copying': copyStatus === 'copying'
          }"
          @click="copyOriginalInput"
          :title="copyStatus === 'success' ? '复制成功!' : copyStatus === 'error' ? '复制失败' : '复制原始输入'"
          :disabled="copyStatus === 'copying'"
        >
          <div v-if="copyStatus === 'success'" class="copy-icon-success"></div>
          <div v-else-if="copyStatus === 'error'" class="copy-icon-error"></div>
          <div v-else-if="copyStatus === 'copying'" class="copy-icon-loading"></div>
          <div v-else class="copy-icon"></div>
        </button>
      </div>
      
      <div class="task-preview-dialog-header">
        <button class="task-preview-header-btn task-preview-btn-cancel" @click="close">
          <i class="icon-close"></i>
        </button>
        <h3>AI 生成的任务列表</h3>
        <button 
          class="task-preview-header-btn task-preview-btn-confirm" 
          @click="createAllTasks"
          :disabled="!canCreate || isCreating"
        >
          <i v-if="isCreating" class="icon-loading"></i>
          <i v-else class="icon-check"></i>
        </button>
      </div>
      
      <div class="task-preview-dialog-body">
        <!-- AI生成内容显示区域 - 支持折叠 -->
        <div v-if="isLoading || streamContent" class="task-preview-stream-content">
          <div class="task-preview-stream-header" @click="isStreamCollapsed = !isStreamCollapsed">
            <i class="fas fa-robot"></i>
            <span class="flex items-center gap-2">
              <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
              {{ isLoading ? 'AI正在生成任务列表...' : 'AI生成详情' }}
            </span>
            <i :class="['fas', 'fa-chevron-down', 'task-preview-stream-toggle', { 'collapsed': isStreamCollapsed }]"></i>
          </div>
          <div v-show="!isStreamCollapsed" class="task-preview-stream-text">
            <div v-if="isLoading && !streamContent" class="task-preview-waiting-text">
              等待AI响应中...
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
                  placeholder="输入任务内容"
                  maxlength="200"
                />
              </div>
              <div class="task-preview-actions-wrapper">
                <button 
                  class="task-preview-delete-btn"
                  @click="removeTask(index)"
                  title="删除任务"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            
            <!-- 第二行：提醒时间 + 所属清单 -->
            <div class="task-preview-row task-preview-row-meta">
              <div class="task-preview-meta-item">
                <label class="task-preview-meta-label">提醒时间</label>
                <input 
                  v-model="task.reminderTime"
                  type="datetime-local"
                  class="task-preview-input-meta"
                />
              </div>
              <div class="task-preview-meta-item">
                <label class="task-preview-meta-label">所属清单</label>
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
              <label class="task-preview-note-label">备注</label>
              <input 
                v-model="task.metadata.note"
                type="text"
                class="task-preview-input-note"
                placeholder="添加备注"
                maxlength="100"
              />
            </div>
          </div>
        </div>
        
        <div class="task-preview-footer">
          <div class="task-preview-stats">
            <span class="task-preview-count">共 {{ taskList.length }} 个任务</span>
          </div>
          <div class="task-preview-actions">
            <button 
              class="task-preview-btn task-preview-btn-secondary"
              @click="close"
            >
              取消
            </button>
            <button 
              class="task-preview-btn task-preview-btn-primary"
              @click="createAllTasks"
              :disabled="!canCreate || isCreating"
            >
              <i v-if="isCreating" class="icon-loading"></i>
              <span v-if="isCreating">创建中...</span>
              <span v-else>创建所有任务</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { useTaskStore } from '@/store/taskStore'

export default {
  name: 'TaskPreviewModal',
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
    const taskStore = useTaskStore()
    const isCreating = ref(false)
    const copyStatus = ref('idle') // 'idle', 'copying', 'success', 'error'
    
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
        metadata: {
          note: task.metadata?.note || '',
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
            reminderTime: formatDateTimeForSave(task.reminderTime),
            metadata: {
              note: task.metadata?.note || ''
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
    
    // 处理遮罩层点击
    const handleOverlayClick = () => {
      close()
    }
    
    // 删除任务
    const removeTask = (index) => {
      taskList.value.splice(index, 1)
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
    
    return {
      taskList,
      availableLists,
      isLoading,
      canCreate,
      isCreating,
      createAllTasks,
      close,
      handleOverlayClick,
      removeTask,
      copyOriginalInput,
      copyStatus,
      isStreamGenerating,
      isStreamCollapsed
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/components/task-preview-modal.css';
</style>