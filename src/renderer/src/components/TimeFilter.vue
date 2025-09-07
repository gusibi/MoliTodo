<template>
  <div class="time-filter">
    <div class="filter-buttons">
      <button v-for="filter in timeFilters" :key="filter.key"
        :class="['filter-btn', { active: currentFilter === filter.key }]" @click="handleFilterChange(filter.key)">
        <i :class="filter.icon"></i>
        <span>{{ filter.label }}</span>
        <span v-if="filter.count > 0" class="filter-count">{{ filter.count }}</span>
      </button>

      <!-- AI 报告按钮 -->
      <button class="filter-btn ai-report-btn" :class="{ 'generating': isGeneratingReport }"
        :disabled="isGeneratingReport || !hasValidTasks" @click="generateReport" title="生成AI报告">
        <i class="fas fa-robot"></i>
        <span>AI报告</span>
        <div v-if="isGeneratingReport" class="loading-spinner"></div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const taskStore = useTaskStore()

// 接收 props
const props = defineProps({
  modelValue: {
    type: String,
    default: 'all'
  },
  tasks: {
    type: Array,
    default: () => []
  }
})

// 当前选中的筛选器
const currentFilter = ref(props.modelValue)

// 监听 props 变化
watch(() => props.modelValue, (newValue) => {
  currentFilter.value = newValue
})

// 计算各筛选器的任务数量
const getFilterCount = (filterKey) => {
  if (!props.tasks) return 0
  if (filterKey === 'all') {
    return props.tasks.length
  }
  return taskStore.filterTasksByCategory(props.tasks, filterKey).length
}

// 定义时间筛选选项
const timeFilters = computed(() => [
  {
    key: 'all',
    label: '全部',
    icon: 'fas fa-calendar',
    count: getFilterCount('all')
  },
  {
    key: 'overdue',
    label: '过期',
    icon: 'fas fa-exclamation-triangle',
    count: getFilterCount('overdue')
  },
  {
    key: 'onlyToday',
    label: '今天',
    icon: 'fas fa-calendar-day',
    count: getFilterCount('onlyToday')
  },

  {
    key: 'tomorrow',
    label: '明天',
    icon: 'fas fa-calendar-plus',
    count: getFilterCount('tomorrow')
  },
  {
    key: 'thisWeek',
    label: '本周',
    icon: 'fas fa-calendar-alt',
    count: getFilterCount('thisWeek')
  }
])

// AI 报告相关状态
const isGeneratingReport = ref(false)

// 计算属性：是否有有效任务
const hasValidTasks = computed(() => {
  return props.tasks && props.tasks.length > 0
})

// 定义事件
const emit = defineEmits(['filter-change', 'generate-report'])

// 处理筛选器变化
const handleFilterChange = (filterKey) => {
  currentFilter.value = filterKey
  emit('filter-change', filterKey)
}

// 生成 AI 报告
const generateReport = () => {
  console.log('[TimeFilter] 开始生成AI报告流程')
  console.log('[TimeFilter] 检查条件 - hasValidTasks:', hasValidTasks.value, 'isGeneratingReport:', isGeneratingReport.value)

  if (!hasValidTasks.value || isGeneratingReport.value) {
    console.log('[TimeFilter] 条件不满足，退出生成流程')
    return
  }

  console.log('[TimeFilter] 触发AI报告生成')
  console.log('[TimeFilter] 当前任务数量:', props.tasks.length)
  console.log('[TimeFilter] 当前筛选器:', currentFilter.value)
  console.log('[TimeFilter] 任务列表:', props.tasks.map(t => ({ id: t.id, content: t.content, status: t.status })))

  // 发送事件给父组件，传递当前筛选的任务和筛选器类型
  emit('generate-report', {
    tasks: props.tasks,
    filterType: currentFilter.value,
    taskCount: props.tasks.length
  })

  console.log('[TimeFilter] generate-report 事件已发送')
}

// 暴露方法给父组件
const setGeneratingState = (generating) => {
  isGeneratingReport.value = generating
}

// 暴露当前筛选器和方法给父组件
defineExpose({
  currentFilter,
  setGeneratingState
})
</script>

<style scoped>
.time-filter {
  @apply mb-0;
}

.filter-buttons {
  @apply flex flex-wrap gap-2;
}

.filter-btn {
  @apply flex items-center justify-start px-3 py-2 text-sm font-medium rounded-lg cursor-pointer;
  @apply bg-background border border-border text-foreground;
  @apply hover:bg-accent hover:text-accent-foreground;
  @apply transition-colors duration-150;
}

.filter-btn.active {
  @apply bg-primary text-primary-foreground;
}

.filter-btn i {
  @apply w-3 h-3 flex-shrink-0;
  @apply flex items-center justify-center;
}

.filter-btn span:not(.filter-count) {
  @apply flex-shrink-0;
  @apply flex items-center;
}

.filter-count {
  @apply px-2 py-0.5 text-xs rounded-full min-w-[20px] text-center;
  @apply bg-muted text-muted-foreground;
  @apply flex items-center justify-center;
  @apply flex-shrink-0;
}

.filter-btn.active .filter-count {
  @apply bg-primary-foreground/20 text-primary-foreground;
}

/* 过期任务的特殊样式 */
.filter-btn:has(i.fa-exclamation-triangle) {
  @apply text-red-600 border-red-200;
}

.dark .filter-btn:has(i.fa-exclamation-triangle) {
  @apply text-red-400 border-red-800;
}

.filter-btn.active:has(i.fa-exclamation-triangle) {
  @apply bg-red-600 text-white;
}

.dark .filter-btn.active:has(i.fa-exclamation-triangle) {
  @apply bg-red-500 text-white;
}

/* AI 报告按钮样式 */
.ai-report-btn {
  @apply bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0;
  @apply hover:from-blue-600 hover:to-purple-700;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
  @apply relative overflow-hidden;
}

.ai-report-btn.generating {
  @apply from-blue-400 to-purple-500;
}

.ai-report-btn i.fa-robot {
  @apply text-white;
}

.loading-spinner {
  @apply absolute right-2 top-1/2 transform -translate-y-1/2;
  @apply w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin;
}

.ai-report-btn:disabled {
  @apply from-gray-400 to-gray-500 hover:from-gray-400 hover:to-gray-500;
}

/* 深色模式下的 AI 按钮 */
.dark .ai-report-btn {
  @apply from-blue-600 to-purple-700;
  @apply hover:from-blue-700 hover:to-purple-800;
}

.dark .ai-report-btn:disabled {
  @apply from-gray-600 to-gray-700 hover:from-gray-600 hover:to-gray-700;
}
</style>