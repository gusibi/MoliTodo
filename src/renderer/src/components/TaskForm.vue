<template>
  <div 
    v-if="show" 
    class="task-form-overlay"
    @click="handleOverlayClick"
  >
    <div 
      class="task-form-content"
      @click.stop
    >
      <h3 class="task-form-title">
        {{ isEdit ? '编辑任务' : '添加新任务' }}
      </h3>
      
      <form @submit.prevent="handleSubmit" class="task-form-form">
        <div class="task-form-field">
          <label for="task-content" class="task-form-label">
            任务内容
          </label>
          <input 
            id="task-content"
            v-model="formData.content" 
            type="text" 
            placeholder="输入任务内容..." 
            ref="contentInput"
            required
            class="task-form-input"
          />
        </div>
        
        <div class="task-form-field">
          <label for="task-description" class="task-form-label">
            任务描述（可选）
          </label>
          <textarea 
            id="task-description"
            v-model="formData.description" 
            placeholder="输入任务描述..."
            rows="3"
            class="task-form-textarea"
          ></textarea>
        </div>
        
        <div class="task-form-field">
          <label for="task-reminder" class="task-form-label">
            提醒时间（可选）
          </label>
          <input 
            id="task-reminder"
            v-model="formData.reminderTime" 
            type="datetime-local"
            class="task-form-input"
          />
        </div>
        
        <div class="task-form-actions">
          <button 
            type="submit" 
            :disabled="!formData.content.trim()"
            class="task-form-btn-primary"
          >
            {{ isEdit ? '保存' : '添加' }}
          </button>
          <button 
            type="button" 
            @click="handleCancel"
            class="task-form-btn-secondary"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  task: {
    type: Object,
    default: null
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel', 'close'])

const contentInput = ref(null)
const formData = ref({
  content: '',
  description: '',
  reminderTime: ''
})

// 监听显示状态，重置表单和聚焦
watch(() => props.show, async (newShow) => {
  if (newShow) {
    if (props.isEdit && props.task) {
      // 编辑模式，填充现有数据
      formData.value = {
        content: props.task.content || '',
        description: props.task.description || '',
        reminderTime: props.task.reminderTime ? formatDateTimeLocal(props.task.reminderTime) : ''
      }
    } else {
      // 添加模式，重置表单
      formData.value = {
        content: '',
        description: '',
        reminderTime: ''
      }
    }
    
    // 聚焦到输入框
    await nextTick()
    if (contentInput.value) {
      contentInput.value.focus()
      contentInput.value.select()
    }
  }
})

// 格式化日期时间为本地格式
const formatDateTimeLocal = (timestamp) => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// 处理表单提交
const handleSubmit = () => {
  if (!formData.value.content.trim()) return
  
  let reminderTimeValue = null
  
  // 处理提醒时间
  if (formData.value.reminderTime && formData.value.reminderTime.trim()) {
    try {
      const date = new Date(formData.value.reminderTime)
      // 检查日期是否有效
      if (!isNaN(date.getTime())) {
        reminderTimeValue = date.getTime()
      }
    } catch (error) {
      console.error('日期转换失败:', error)
      // 如果日期转换失败，设置为 null
      reminderTimeValue = null
    }
  }
  
  const taskData = {
    content: formData.value.content.trim(),
    description: formData.value.description.trim(),
    reminderTime: reminderTimeValue
  }
  
  if (props.isEdit && props.task) {
    taskData.id = props.task.id
  }
  
  emit('submit', taskData)
}

// 处理取消
const handleCancel = () => {
  emit('cancel')
}

// 处理遮罩层点击
const handleOverlayClick = () => {
  emit('close')
}
</script>

<style scoped>
@import '../assets/styles/components/task-form.css';
</style>