<template>
  <div class="time-filter">
    <div class="filter-buttons">
      <button 
        v-for="filter in timeFilters" 
        :key="filter.key"
        :class="['filter-btn', { active: currentFilter === filter.key }]"
        @click="handleFilterChange(filter.key)"
      >
        <i :class="filter.icon"></i>
        <span>{{ filter.label }}</span>
        <span v-if="filter.count > 0" class="filter-count">{{ filter.count }}</span>
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

// 定义事件
const emit = defineEmits(['filter-change'])

// 处理筛选器变化
const handleFilterChange = (filterKey) => {
  currentFilter.value = filterKey
  emit('filter-change', filterKey)
}

// 暴露当前筛选器给父组件
defineExpose({
  currentFilter
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
</style>