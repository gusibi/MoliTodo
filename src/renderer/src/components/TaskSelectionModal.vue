<template>
  <div v-if="visible" class="task-selection-modal-overlay" @click="handleOverlayClick">
    <div class="task-selection-modal" @click.stop>
      <!-- 模态框头部 -->
      <div class="task-selection-modal-header">
        <div class="modal-title">
          <i class="fas fa-tasks"></i>
          <h3>选择要生成报告的任务</h3>
        </div>
        <button @click="closeModal" class="close-btn" title="关闭">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <!-- 筛选信息 -->
      <div class="filter-info">
        <div class="filter-badge">
          <i :class="getFilterIcon(filterType)"></i>
          <span>{{ getFilterLabel(filterType) }}</span>
        </div>
        <div class="task-count">共 {{ tasks.length }} 个任务</div>
      </div>
      
      <!-- 任务列表 -->
      <div class="task-selection-content">
        <div class="selection-header">
          <label class="select-all-checkbox">
            <input 
              type="checkbox" 
              :checked="isAllSelected"
              :indeterminate="isPartiallySelected"
              @change="toggleSelectAll"
            />
            <span class="checkmark"></span>
            <span class="label-text">
              {{ isAllSelected ? '取消全选' : '全选' }}
              ({{ selectedTasks.length }}/{{ tasks.length }})
            </span>
          </label>
        </div>
        
        <div class="task-list">
          <div 
            v-for="task in tasks" 
            :key="task.id" 
            class="task-item"
            :class="{ 'selected': selectedTaskIds.has(task.id) }"
          >
            <label class="task-checkbox">
              <input 
                type="checkbox" 
                :checked="selectedTaskIds.has(task.id)"
                @change="toggleTask(task.id)"
              />
              <span class="checkmark"></span>
            </label>
            
            <div class="task-info">
              <div class="task-content">{{ task.content }}</div>
              <div class="task-meta">
                <span class="task-status" :class="`status-${task.status}`">
                  {{ getTaskStatusText(task.status) }}
                </span>
                <span v-if="task.reminderTime" class="task-time">
                  {{ formatTaskTime(task.reminderTime) }}
                </span>
                <span v-if="task.metadata?.steps?.length" class="task-steps">
                  {{ task.metadata.steps.length }} 个步骤
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="tasks.length === 0" class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>当前筛选条件下没有任务</p>
        </div>
      </div>
      
      <!-- 模态框底部操作 -->
      <div class="task-selection-modal-actions">
        <div class="selection-options">
          <div class="left-controls">
            <div class="ai-model-selector">
              <div class="ai-model-dropdown" :class="{ 'open': showAIModelDropdown }">
                <button 
                  class="ai-model-button"
                  @click="toggleAIModelDropdown"
                  :disabled="!hasAvailableModels"
                >
                  <div v-if="selectedAIModel" class="selected-model">
                    <span class="model-name">{{ selectedAIModel.name }}</span>
                    <span class="model-provider">{{ selectedAIModel.provider }}</span>
                  </div>
                  <div v-else class="no-model">
                    {{ hasAvailableModels ? '选择 AI 模型' : '未配置 AI 模型' }}
                  </div>
                  <i class="fas fa-chevron-down dropdown-icon"></i>
                </button>
                
                <div v-if="showAIModelDropdown" class="ai-model-list">
                  <div 
                    v-for="model in availableAIModels" 
                    :key="model.id"
                    class="ai-model-item"
                    :class="{ 'selected': selectedAIModel?.id === model.id }"
                    @click="selectAIModel(model)"
                  >
                    <div class="ai-model-info">
                      <div class="ai-model-name">{{ model.name }}</div>
                      <div class="ai-model-provider">{{ model.provider }}</div>
                    </div>
                    <div v-if="selectedAIModel?.id === model.id" class="ai-model-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  
                  <div v-if="!hasAvailableModels" class="no-models-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>请先在设置中配置 AI 模型</span>
                  </div>
                </div>
              </div>
            </div>
             <div class="report-type-selector">
              <select v-model="selectedReportType" class="report-type-select">
                <option value="daily">日报</option>
                <option value="weekly">周报</option>
              </select>
            </div>
          </div>
          
          <div class="right-controls">
            <button 
              @click="confirmGeneration" 
              class="confirm-btn"
              :disabled="selectedTasks.length === 0 || !selectedAIModel"
            >
              <i class="fas fa-robot"></i>
              生成报告
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTaskStore } from '@/store/taskStore'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  tasks: {
    type: Array,
    default: () => []
  },
  filterType: {
    type: String,
    default: 'all'
  }
})

// Emits
const emit = defineEmits(['close', 'confirm'])

// 使用 taskStore
const taskStore = useTaskStore()

// 响应式数据
const selectedTaskIds = ref(new Set())
const selectedReportType = ref('weekly')
const showAIModelDropdown = ref(false)
const selectedAIModel = ref(null)
const availableAIModels = ref([])

// 计算属性
const selectedTasks = computed(() => {
  return props.tasks.filter(task => selectedTaskIds.value.has(task.id))
})

const isAllSelected = computed(() => {
  return props.tasks.length > 0 && selectedTaskIds.value.size === props.tasks.length
})

const isPartiallySelected = computed(() => {
  return selectedTaskIds.value.size > 0 && selectedTaskIds.value.size < props.tasks.length
})

const hasAvailableModels = computed(() => {
  return availableAIModels.value.length > 0
})

// 监听 props 变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 默认全选
    selectedTaskIds.value = new Set(props.tasks.map(task => task.id))
    
    // 根据筛选器类型自动选择报告类型
    if (props.filterType === 'onlyToday' || props.filterType === 'overdue') {
      selectedReportType.value = 'daily'
    } else {
      selectedReportType.value = 'weekly'
    }
    
    // 重新加载 AI 模型
    loadAIModels()
    
    console.log('[TaskSelectionModal] 模态框打开，默认选择任务:', selectedTaskIds.value.size)
  } else {
    // 关闭下拉菜单
    showAIModelDropdown.value = false
  }
})

// 方法
const closeModal = () => {
  console.log('[TaskSelectionModal] 关闭模态框')
  emit('close')
}

const handleOverlayClick = () => {
  // 如果下拉菜单打开，先关闭下拉菜单
  if (showAIModelDropdown.value) {
    showAIModelDropdown.value = false
  } else {
    closeModal()
  }
}

const toggleSelectAll = () => {
  console.log('[TaskSelectionModal] 切换全选状态')
  if (isAllSelected.value) {
    selectedTaskIds.value.clear()
  } else {
    selectedTaskIds.value = new Set(props.tasks.map(task => task.id))
  }
  console.log('[TaskSelectionModal] 当前选中任务数:', selectedTaskIds.value.size)
}

const toggleTask = (taskId) => {
  console.log('[TaskSelectionModal] 切换任务选择状态:', taskId)
  if (selectedTaskIds.value.has(taskId)) {
    selectedTaskIds.value.delete(taskId)
  } else {
    selectedTaskIds.value.add(taskId)
  }
  console.log('[TaskSelectionModal] 当前选中任务数:', selectedTaskIds.value.size)
}

const confirmGeneration = () => {
  console.log('[TaskSelectionModal] 确认生成报告')
  console.log('[TaskSelectionModal] 选中的任务数量:', selectedTasks.value.length)
  console.log('[TaskSelectionModal] 报告类型:', selectedReportType.value)
  console.log('[TaskSelectionModal] 选中的 AI 模型:', selectedAIModel.value)
  
  if (selectedTasks.value.length === 0) {
    console.log('[TaskSelectionModal] 没有选中任务，不能生成报告')
    return
  }
  
  if (!selectedAIModel.value) {
    console.log('[TaskSelectionModal] 没有选中 AI 模型，不能生成报告')
    return
  }
  
  // 先选择 AI 模型
  taskStore.selectAIModel(selectedAIModel.value)
  
  emit('confirm', {
    tasks: selectedTasks.value,
    filterType: props.filterType,
    reportType: selectedReportType.value,
    taskCount: selectedTasks.value.length,
    aiModel: selectedAIModel.value
  })
  
  console.log('[TaskSelectionModal] confirm 事件已发送')
}

const toggleAIModelDropdown = () => {
  if (!hasAvailableModels.value) return
  showAIModelDropdown.value = !showAIModelDropdown.value
}

const selectAIModel = (model) => {
  console.log('[TaskSelectionModal] 选择 AI 模型:', model)
  selectedAIModel.value = model
  showAIModelDropdown.value = false
}

const loadAIModels = async () => {
  console.log('[TaskSelectionModal] 加载 AI 模型列表')
  try {
    await taskStore.loadAIModels()
    availableAIModels.value = taskStore.availableAIModels
    
    // 如果有当前选中的模型，使用它
    if (taskStore.selectedAIModel) {
      selectedAIModel.value = taskStore.selectedAIModel
    } else if (availableAIModels.value.length > 0) {
      // 否则选择第一个可用模型
      selectedAIModel.value = availableAIModels.value[0]
    }
    
    console.log('[TaskSelectionModal] AI 模型加载完成，数量:', availableAIModels.value.length)
    console.log('[TaskSelectionModal] 当前选中模型:', selectedAIModel.value)
  } catch (error) {
    console.error('[TaskSelectionModal] 加载 AI 模型失败:', error)
  }
}

const getFilterIcon = (filterType) => {
  const iconMap = {
    'all': 'fas fa-calendar',
    'onlyToday': 'fas fa-calendar-day',
    'tomorrow': 'fas fa-calendar-plus',
    'thisWeek': 'fas fa-calendar-alt',
    'overdue': 'fas fa-exclamation-triangle'
  }
  return iconMap[filterType] || 'fas fa-calendar'
}

const getFilterLabel = (filterType) => {
  const labelMap = {
    'all': '全部任务',
    'onlyToday': '今天的任务',
    'tomorrow': '明天的任务',
    'thisWeek': '本周的任务',
    'overdue': '过期的任务'
  }
  return labelMap[filterType] || '筛选的任务'
}

const getTaskStatusText = (status) => {
  const statusMap = {
    'done': '已完成',
    'doing': '进行中',
    'todo': '待办',
    'overdue': '已过期',
    'blocked': '已阻塞'
  }
  return statusMap[status] || '未知'
}

const formatTaskTime = (timeString) => {
  if (!timeString) return ''
  
  try {
    const date = new Date(timeString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    if (taskDate.getTime() === today.getTime()) {
      return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleString('zh-CN', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  } catch (error) {
    return timeString
  }
}

// 生命周期
onMounted(() => {
  loadAIModels()
})
</script>

<style scoped>
.task-selection-modal-overlay {
  @apply fixed inset-0 bg-black/50 flex items-start justify-center z-50;
  overflow-y: auto;
}

.task-selection-modal {
  @apply bg-background border border-border rounded-lg shadow-2xl;
  @apply w-full max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col;
  @apply mx-4 my-auto;
  position: sticky;
  top: 2rem;
}

.task-selection-modal-header {
  @apply flex items-center justify-between p-4 border-b border-border;
  @apply bg-muted/30;
}

.modal-title {
  @apply flex items-center gap-3;
}

.modal-title h3 {
  @apply text-lg font-semibold text-foreground;
}

.modal-title i {
  @apply text-primary text-xl;
}

.close-btn {
  @apply p-2 hover:bg-muted rounded-md transition-colors duration-200;
  @apply text-muted-foreground hover:text-foreground;
}

.filter-info {
  @apply flex items-center justify-between p-3 bg-muted/20 border-b border-border;
}

.filter-badge {
  @apply flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm;
}

.task-count {
  @apply text-sm text-muted-foreground;
}

.task-selection-content {
  @apply flex-1 overflow-hidden flex flex-col;
}

.selection-header {
  @apply p-3 border-b border-border bg-muted/10;
}

.select-all-checkbox {
  @apply flex items-center gap-3 cursor-pointer;
}

.task-list {
  @apply flex-1 overflow-y-auto p-2 space-y-1;
}

.task-item {
  @apply flex items-start gap-3 p-3 rounded-md hover:bg-muted/30 transition-colors duration-200;
  @apply border border-transparent;
}

.task-item.selected {
  @apply bg-primary/5 border-primary/20;
}

.task-checkbox {
  @apply flex-shrink-0 cursor-pointer;
}

.task-info {
  @apply flex-1 min-w-0;
}

.task-content {
  @apply text-foreground font-medium mb-1 break-words;
}

.task-meta {
  @apply flex items-center gap-2 text-xs text-muted-foreground flex-wrap;
}

.task-status {
  @apply px-2 py-0.5 rounded-full text-xs font-medium;
}

.status-done {
  @apply bg-green-100 text-green-700;
}

.status-doing {
  @apply bg-blue-100 text-blue-700;
}

.status-todo {
  @apply bg-gray-100 text-gray-700;
}

.status-overdue {
  @apply bg-red-100 text-red-700;
}

.status-blocked {
  @apply bg-yellow-100 text-yellow-700;
}

[data-theme="dark"] .status-done {
  @apply bg-green-900/30 text-green-400;
}

[data-theme="dark"] .status-doing {
  @apply bg-blue-900/30 text-blue-400;
}

[data-theme="dark"] .status-todo {
  @apply bg-gray-800/50 text-gray-300;
}

[data-theme="dark"] .status-overdue {
  @apply bg-red-900/30 text-red-400;
}

[data-theme="dark"] .status-blocked {
  @apply bg-yellow-900/30 text-yellow-400;
}

.task-time,
.task-steps {
  @apply text-muted-foreground;
}

.empty-state {
  @apply flex flex-col items-center justify-center p-8 text-muted-foreground;
}

.empty-state i {
  @apply text-4xl mb-2;
}

.task-selection-modal-actions {
  @apply flex flex-col gap-4 p-4 border-t border-border bg-muted/30;
}

.selection-options {
  @apply flex items-center justify-between;
}

.left-controls {
  @apply flex items-center gap-4;
}

.right-controls {
  @apply flex items-center;
}

.report-type-selector {
  @apply flex items-center gap-2 text-sm;
}

.report-type-select {
  @apply px-3 py-2 border border-border rounded bg-background text-foreground;
  @apply h-10 min-w-[120px];
}

.ai-model-selector {
  @apply flex items-center gap-2 text-sm;
}

.ai-model-dropdown {
  @apply relative;
}

.ai-model-button {
  @apply flex items-center justify-between gap-2 px-3 py-2 border border-border rounded bg-background text-foreground;
  @apply hover:bg-muted transition-colors duration-200 min-w-[200px];
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
  @apply h-10;
}

.selected-model {
  @apply flex flex-col items-start;
}

.model-name {
  @apply text-xs font-medium text-foreground;
}

.model-provider {
  @apply text-2xs text-muted-foreground;
}

.no-model {
  @apply text-muted-foreground;
}

.dropdown-icon {
  @apply text-muted-foreground transition-transform duration-200;
}

.ai-model-dropdown.open .dropdown-icon {
  @apply rotate-180;
}

.ai-model-list {
  @apply absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10;
  @apply max-h-48 overflow-y-auto;
}

.ai-model-item {
  @apply flex items-center justify-between p-3 hover:bg-muted cursor-pointer;
  @apply border-b border-border last:border-b-0;
}

.ai-model-item.selected {
  @apply bg-primary/5 text-primary;
}

.ai-model-info {
  @apply flex flex-col;
}

.ai-model-name {
  @apply font-medium text-sm;
}

.ai-model-provider {
  @apply text-xs text-muted-foreground;
}

.ai-model-check {
  @apply text-primary;
}

.no-models-message {
  @apply flex items-center gap-2 p-3 text-muted-foreground text-sm;
}

.no-models-message i {
  @apply text-yellow-500;
}

.cancel-btn {
  @apply px-4 py-2 bg-muted text-foreground rounded-md;
  @apply hover:bg-muted/80 transition-colors duration-200;
}

.confirm-btn {
  @apply px-4 py-2 bg-primary text-primary-foreground rounded-md;
  @apply hover:bg-primary/90 transition-colors duration-200;
  @apply flex items-center gap-2;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
  @apply h-10;
}

/* 自定义复选框样式 */
input[type="checkbox"] {
  @apply sr-only;
}

.checkmark {
  @apply w-4 h-4 border-2 border-border rounded flex-shrink-0;
  @apply flex items-center justify-center transition-all duration-200;
}

input[type="checkbox"]:checked + .checkmark {
  @apply bg-primary border-primary;
}

input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  @apply text-primary-foreground text-xs font-bold;
}

input[type="checkbox"]:indeterminate + .checkmark {
  @apply bg-primary/50 border-primary;
}

input[type="checkbox"]:indeterminate + .checkmark::after {
  content: '−';
  @apply text-primary-foreground text-xs font-bold;
}

.label-text {
  @apply text-sm font-medium text-foreground;
}

/* 滚动条样式 */
.task-selection-modal-overlay::-webkit-scrollbar {
  display: none;
}

.task-selection-modal-overlay {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.task-list::-webkit-scrollbar {
  @apply w-2;
}

.task-list::-webkit-scrollbar-track {
  @apply bg-transparent;
}

.task-list::-webkit-scrollbar-thumb {
  @apply bg-muted-foreground/20 rounded-full;
}

.task-list::-webkit-scrollbar-thumb:hover {
  @apply bg-muted-foreground/30;
}
</style>