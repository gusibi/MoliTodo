<template>
  <Dialog
    :open="visible"
    title="选择要生成报告的任务"
    content-class="w-[min(94vw,52rem)]"
    body-class="pb-5"
    @update:open="(value) => { if (!value) closeModal() }"
  >
    <!-- 筛选信息 -->
    <div class="filter-info">
      <div class="filter-badge">
        <component :is="getFilterIcon(filterType)" class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <span>{{ getFilterLabel(filterType) }}</span>
      </div>
      <div class="task-count">共 {{ tasks.length }} 个任务</div>
    </div>
    
    <!-- 任务列表 -->
    <div class="task-selection-content">
      <div class="selection-header">
        <div class="select-all-checkbox">
          <Checkbox id="report-select-all" :model-value="isAllSelected" :indeterminate="isPartiallySelected"
            :label="$t('reports.selectAll')" @update:model-value="toggleSelectAll" />
          <label for="report-select-all" class="label-text">{{ $t(isAllSelected ? 'reports.deselectAll' : 'reports.selectAll') }}
            ({{ selectedTasks.length }}/{{ tasks.length }})</label>
        </div>
      </div>
      
      <div class="task-list">
        <div 
          v-for="task in tasks" 
          :key="task.id" 
          class="task-item"
          :class="{ 'selected': selectedTaskIds.has(task.id) }"
        >
          <Checkbox :id="`report-task-${task.id}`" :model-value="selectedTaskIds.has(task.id)"
            :label="task.content" @update:model-value="toggleTask(task.id)" />
          
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
        <Inbox class="h-icon-lg w-icon-lg" aria-hidden="true" />
        <p>当前筛选条件下没有任务</p>
      </div>
    </div>
    
    <!-- 模态框底部操作 -->
    <div class="task-selection-modal-actions">
      <div class="selection-options">
        <div class="left-controls">
          <div class="ai-model-selector">
            <DropdownMenu v-model:open="showAIModelDropdown">
              <template #trigger>
                <Button variant="outline" :disabled="!hasAvailableModels" :aria-label="$t('reports.selectModel')">
                  <span class="selected-model" v-if="selectedAIModel">
                    <span class="model-name">{{ selectedAIModel.name }}</span>
                    <span class="model-provider">{{ selectedAIModel.provider }}</span>
                  </span>
                  <span v-else>{{ $t('reports.noModel') }}</span>
                  <ChevronDown class="h-icon-sm w-icon-sm" aria-hidden="true" />
                </Button>
              </template>
              <DropdownMenuItem v-for="model in availableAIModels" :key="model.id"
                role="menuitemradio" :aria-checked="selectedAIModel?.id === model.id"
                :selected="selectedAIModel?.id === model.id" @select="selectAIModel(model)">
                <span class="selected-model"><span>{{ model.name }}</span><span class="model-provider">{{ model.provider }}</span></span>
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
           <div class="report-type-selector">
            <select v-model="selectedReportType" class="report-type-select" :aria-label="$t('reports.reportType')">
              <option value="daily">日报</option>
              <option value="weekly">周报</option>
            </select>
          </div>
        </div>
        
        <div class="right-controls">
          <Button 
            variant="default"
            :disabled="selectedTasks.length === 0 || !selectedAIModel"
            @click="confirmGeneration"
          >
            <Bot class="h-icon-sm w-icon-sm" aria-hidden="true" />
            生成报告
          </Button>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Bot, Calendar, CalendarDays, CalendarPlus, ChevronDown, Inbox, ListChecks, TriangleAlert } from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import Dialog from './ui/dialog/Dialog.vue'
import Button from './ui/button/Button.vue'
import Checkbox from './ui/checkbox/Checkbox.vue'
import DropdownMenu from './ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuItem from './ui/dropdown-menu/DropdownMenuItem.vue'

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
    'all': Calendar,
    'onlyToday': CalendarDays,
    'tomorrow': CalendarPlus,
    'thisWeek': ListChecks,
    'overdue': TriangleAlert
  }
  return iconMap[filterType] || Calendar
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
  @apply text-status-done;
}

.status-doing {
  @apply text-status-doing;
}

.status-todo {
  @apply text-muted-foreground;
}

.status-overdue {
  @apply text-destructive;
}

.status-blocked {
  @apply text-muted-foreground;
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
  @apply flex flex-wrap items-center justify-between gap-3;
}

.left-controls {
  @apply flex flex-wrap items-center gap-3;
}

.right-controls {
  @apply flex items-center;
}

.report-type-selector {
  @apply flex items-center gap-2 text-sm;
}

.report-type-select {
  @apply px-3 py-2 border border-border rounded bg-background text-foreground;
  @apply h-control-md min-w-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring;
}

.ai-model-selector {
  @apply flex items-center gap-2 text-sm;
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

.label-text {
  @apply text-sm font-medium text-foreground;
}

/* 滚动条样式 */
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