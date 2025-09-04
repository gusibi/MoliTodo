<template>
  <div class="kanban-add-task">
    <!-- 添加按钮 -->
    <div
      v-if="!showForm"
      class="kanban-add-task-button"
      @click="showAddForm"
      tabindex="0"
      @keydown.enter="showAddForm"
      @keydown.space.prevent="showAddForm"
    >
      <i class="fas fa-plus"></i>
      <span>添加任务</span>
    </div>

    <!-- 添加表单 -->
    <div v-else class="kanban-add-task-form">
      <input
        ref="taskInput"
        v-model="taskContent"
        type="text"
        placeholder="输入任务内容..."
        class="kanban-add-task-input"
        @keydown.enter="handleSubmit"
        @keydown.escape="handleCancel"
        @blur="handleBlur"
      />
      <div class="kanban-add-task-actions">
        <button
          class="kanban-add-task-submit"
          @click="handleSubmit"
          :disabled="!taskContent.trim()"
        >
          添加
        </button>
        <button
          class="kanban-add-task-cancel"
          @click="handleCancel"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  status: {
    type: String,
    required: true,
    validator: (value) => ['todo', 'doing', 'paused', 'done'].includes(value)
  },
  listId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['add-task'])

const showForm = ref(false)
const taskContent = ref('')
const taskInput = ref(null)

const showAddForm = async () => {
  showForm.value = true
  await nextTick()
  if (taskInput.value) {
    taskInput.value.focus()
  }
}

const handleSubmit = () => {
  const content = taskContent.value.trim()
  if (!content) return

  const taskData = {
    content,
    status: props.status,
    listId: props.listId
  }

  emit('add-task', taskData)
  
  // 重置表单
  taskContent.value = ''
  showForm.value = false
}

const handleCancel = () => {
  taskContent.value = ''
  showForm.value = false
}

const handleBlur = () => {
  // 延迟隐藏表单，避免点击按钮时立即隐藏
  setTimeout(() => {
    if (!taskContent.value.trim()) {
      showForm.value = false
    }
  }, 150)
}
</script>

<style>
@import '@/assets/styles/components/kanban-board.css';
</style>