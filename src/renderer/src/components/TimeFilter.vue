<template>
  <div class="time-filter">
    <div class="filter-buttons">
      <Button v-for="filter in timeFilters" :key="filter.key" size="sm"
        :variant="currentFilter === filter.key ? (filter.key === 'overdue' ? 'destructive' : 'secondary') : 'outline'"
        :aria-pressed="currentFilter === filter.key" @click="handleFilterChange(filter.key)">
        <component :is="filter.icon" class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <span>{{ filter.label }}</span><span v-if="filter.count > 0" class="filter-count">{{ filter.count }}</span>
      </Button>
      <Button size="sm" variant="outline" :loading="isGeneratingReport" :disabled="!hasValidTasks" @click="generateReport">
        <Bot class="h-icon-sm w-icon-sm" aria-hidden="true" /><span>{{ $t('reports.aiReport') }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Bot, Calendar, CalendarDays, CalendarPlus, CalendarRange, TriangleAlert } from '@lucide/vue'
import Button from './ui/button/Button.vue'
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
    icon: Calendar,
    count: getFilterCount('all')
  },
  {
    key: 'overdue',
    label: '过期',
    icon: TriangleAlert,
    count: getFilterCount('overdue')
  },
  {
    key: 'onlyToday',
    label: '今天',
    icon: CalendarDays,
    count: getFilterCount('onlyToday')
  },

  {
    key: 'tomorrow',
    label: '明天',
    icon: CalendarPlus,
    count: getFilterCount('tomorrow')
  },
  {
    key: 'thisWeek',
    label: '本周',
    icon: CalendarRange,
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
.filter-buttons {
  @apply flex flex-wrap gap-2;
}
.filter-count {
  @apply text-xs tabular-nums opacity-80;
}
</style>
