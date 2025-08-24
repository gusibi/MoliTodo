<template>
  <div v-if="visible" class="task-preview-modal-overlay" @click="handleOverlayClick">
    <div class="task-preview-dialog" @click.stop>
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
        <div class="task-preview-stats">
          <span class="task-preview-count">共 {{ taskList.length }} 个任务</span>
        </div>
        
        <!-- 加载状态 -->
        <div v-if="isLoading" class="task-preview-loading">
          <div class="task-preview-loading-spinner">
            <i class="icon-loading"></i>
          </div>
          <p class="task-preview-loading-text">AI 正在生成任务列表...</p>
        </div>
        
        <!-- 任务列表 -->
        <div v-else class="task-preview-list">
          <div 
            v-for="(task, index) in taskList" 
            :key="index"
            class="task-preview-item"
          >
            <!-- 任务内容 -->
            <div class="task-preview-field">
              <label class="task-preview-label">任务内容</label>
              <input 
                v-model="task.content"
                type="text"
                class="task-preview-input"
                placeholder="输入任务内容"
                maxlength="200"
              />
            </div>
            
            <!-- 截止日期和时间 -->
            <div class="task-preview-field-row">
              <div class="task-preview-field">
                <label class="task-preview-label">截止日期</label>
                <input 
                  v-model="task.dueDate"
                  type="date"
                  class="task-preview-input"
                />
              </div>
              
              <div class="task-preview-field">
                <label class="task-preview-label">截止时间</label>
                <input 
                  v-model="task.dueTime"
                  type="time"
                  class="task-preview-input"
                />
              </div>
            </div>
            
            <!-- 清单选择和提醒时间 -->
            <div class="task-preview-field-row">
              <div class="task-preview-field">
                <label class="task-preview-label">所属清单</label>
                <select 
                  v-model="task.listId"
                  class="task-preview-select"
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
              
              <div class="task-preview-field">
                <label class="task-preview-label">提醒时间</label>
                <input 
                  v-model="task.reminderTime"
                  type="datetime-local"
                  class="task-preview-input"
                />
              </div>
            </div>
            
            <!-- 备注 -->
            <div class="task-preview-field">
              <label class="task-preview-label">备注</label>
              <textarea 
                v-model="task.metadata.note"
                class="task-preview-textarea"
                placeholder="添加备注"
                rows="2"
                maxlength="500"
              ></textarea>
            </div>
            
            <!-- 分隔线 -->
            <div v-if="index < taskList.length - 1" class="task-preview-divider"></div>
          </div>
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
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { useTaskStore } from '../store/taskStore'

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
    }
  },
  emits: ['close', 'created'],
  setup(props, { emit }) {
    const taskStore = useTaskStore()
    const isCreating = ref(false)
    
    // 本地任务列表副本，用于编辑
    const taskList = ref([])
    
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
      handleOverlayClick
    }
  }
}
</script>

<style scoped>
@import '../assets/styles/components/task-preview-modal.css';
</style>