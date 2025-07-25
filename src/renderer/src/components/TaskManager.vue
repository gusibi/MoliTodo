<template>
  <div class="task-manager">
    <div class="task-manager-header">
      <h1>任务管理</h1>
      <button class="btn btn-primary" @click="showAddModal = true">
        添加任务
      </button>
    </div>
    
    <div class="task-manager-content">
      <!-- 分类标签 -->
      <div class="task-categories">
        <button 
          v-for="category in categories" 
          :key="category.key"
          :class="['category-btn', { active: currentCategory === category.key }]"
          @click="switchCategory(category.key)"
        >
          {{ category.label }} ({{ getCategoryCount(category.key) }})
        </button>
      </div>

      <!-- 任务列表 -->
      <div class="task-list">
        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="filteredTasks.length === 0" class="empty-state">
          暂无任务
        </div>
        <div v-else class="task-items">
          <div 
            v-for="task in filteredTasks" 
            :key="task.id"
            class="task-item"
            :class="{ 
              completed: task.status === 'done', 
              'in-progress': task.status === 'doing' 
            }"
          >
            <div class="task-content">
              <input 
                type="checkbox" 
                :checked="task.status === 'done'"
                @change="toggleTaskComplete(task)"
              />
              <span class="task-text">{{ task.content }}</span>
              <span v-if="task.status === 'doing'" class="task-status doing">
                进行中
              </span>
              <span v-if="task.reminderTime" class="task-reminder">
                {{ formatReminderTime(task.reminderTime) }}
              </span>
            </div>
            
            <div class="task-actions">
              <button 
                v-if="task.status === 'todo'" 
                class="btn btn-sm btn-success"
                @click="startTask(task.id)"
              >
                开始
              </button>
              <button 
                v-if="task.status === 'doing'" 
                class="btn btn-sm btn-warning"
                @click="pauseTask(task.id)"
              >
                暂停
              </button>
              <button 
                class="btn btn-sm btn-danger"
                @click="deleteTask(task.id)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加任务模态框 -->
    <div v-if="showAddModal" class="modal-overlay" @click="showAddModal = false">
      <div class="modal" @click.stop>
        <h3>添加新任务</h3>
        <input 
          v-model="newTaskContent" 
          type="text" 
          placeholder="输入任务内容..."
          @keyup.enter="addTask"
          ref="taskInput"
        />
        <div class="modal-actions">
          <button class="btn btn-primary" @click="addTask">添加</button>
          <button class="btn btn-secondary" @click="showAddModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const taskStore = useTaskStore()
const currentCategory = ref('incomplete')
const showAddModal = ref(false)
const newTaskContent = ref('')
const taskInput = ref(null)
const allTasks = ref([])

const categories = [
  { key: 'incomplete', label: '未完成' },
  { key: 'completed', label: '已完成' },
  { key: 'all', label: '全部' }
]

const loading = computed(() => taskStore.loading)

const filteredTasks = computed(() => {
  switch (currentCategory.value) {
    case 'incomplete':
      return allTasks.value.filter(task => task.status !== 'done')
    case 'completed':
      return allTasks.value.filter(task => task.status === 'done')
    case 'all':
    default:
      return allTasks.value
  }
})

const getCategoryCount = (category) => {
  switch (category) {
    case 'incomplete':
      return allTasks.value.filter(task => task.status !== 'done').length
    case 'completed':
      return allTasks.value.filter(task => task.status === 'done').length
    case 'all':
      return allTasks.value.length
    default:
      return 0
  }
}

const switchCategory = (category) => {
  currentCategory.value = category
}

const loadTasks = async () => {
  try {
    allTasks.value = await taskStore.getAllTasks()
  } catch (error) {
    console.error('加载任务失败:', error)
  }
}

const addTask = async () => {
  if (!newTaskContent.value.trim()) {
    return
  }

  try {
    await taskStore.createTask({
      content: newTaskContent.value.trim()
    })
    newTaskContent.value = ''
    showAddModal.value = false
    await loadTasks()
  } catch (error) {
    console.error('添加任务失败:', error)
  }
}

const toggleTaskComplete = async (task) => {
  try {
    if (task.status === 'done') {
      // 重新激活任务
      await taskStore.updateTask(task.id, { status: 'todo' })
    } else {
      // 完成任务
      await taskStore.completeTask(task.id)
    }
    await loadTasks()
  } catch (error) {
    console.error('切换任务状态失败:', error)
  }
}

const startTask = async (taskId) => {
  try {
    await taskStore.startTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const pauseTask = async (taskId) => {
  try {
    await taskStore.pauseTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const deleteTask = async (taskId) => {
  if (!confirm('确定要删除这个任务吗？')) {
    return
  }

  try {
    await taskStore.deleteTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('删除任务失败:', error)
  }
}

const formatReminderTime = (reminderTime) => {
  if (!reminderTime) return ''
  
  const date = new Date(reminderTime)
  const now = new Date()
  
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }
  
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 监听模态框显示，自动聚焦输入框
watch(showAddModal, async (newVal) => {
  if (newVal) {
    await nextTick()
    if (taskInput.value) {
      taskInput.value.focus()
    }
  }
})

// 监听任务更新事件
const handleTasksUpdated = () => {
  loadTasks()
}

onMounted(async () => {
  await loadTasks()
  window.electronAPI.events.on('tasks-updated', handleTasksUpdated)
})

onUnmounted(() => {
  window.electronAPI.events.removeAllListeners('tasks-updated')
})
</script>

<style scoped>
.task-manager {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.task-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: white;
  border-bottom: 1px solid #e1e8ed;
}

.task-manager-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.task-manager-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.task-categories {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.category-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.category-btn:hover {
  background: #f8f9fa;
}

.category-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.task-list {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
}

.loading, .empty-state {
  text-align: center;
  color: #666;
  padding: 40px;
}

.task-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.task-item:last-child {
  border-bottom: none;
}

.task-item.completed .task-text {
  text-decoration: line-through;
  color: #999;
}

.task-item.in-progress {
  background: #fff3cd;
  margin: 0 -20px;
  padding: 12px 20px;
  border-radius: 4px;
}

.task-content {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 12px;
}

.task-text {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.task-status.doing {
  font-size: 12px;
  color: #856404;
  background: #fff3cd;
  padding: 2px 6px;
  border-radius: 3px;
}

.task-reminder {
  font-size: 12px;
  color: #666;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #1e7e34;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-warning:hover {
  background: #e0a800;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  min-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #333;
}

.modal input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 16px;
}

.modal input:focus {
  outline: none;
  border-color: #007bff;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>