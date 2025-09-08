<template>
  <div class="task-details-modal-overlay">
    <div class="task-details-modal-container">
      <!-- 模态框头部 -->
      <div class="task-details-modal-header">
        <h2 class="task-details-modal-title">任务详情数据库视图</h2>
        <button @click="$emit('close')" class="task-details-modal-close-btn">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- 表格容器 -->
      <div class="task-details-table-container">
        <table class="task-details-table">
          <thead class="task-details-table-header">
            <tr>
              <th v-for="column in tableColumns" :key="column.key" class="task-details-table-th">
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody class="task-details-table-body">
            <tr v-for="task in paginatedTasks" :key="task.id" class="task-details-table-row">
              <td v-for="column in tableColumns" :key="column.key" class="task-details-table-td">
                <div class="task-details-cell-content">
                  <span 
                    v-if="!isComplexField(task[column.key])" 
                    class="task-details-simple-value"
                  >
                    {{ formatSimpleValue(task[column.key]) }}
                  </span>
                  <button 
                    v-else 
                    @click="showFieldDetail(column.label, task[column.key])" 
                    class="task-details-complex-btn"
                  >
                    <i class="fas fa-eye"></i>
                    查看详情
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页控件 -->
      <div class="task-details-pagination">
        <button 
          @click="currentPage--" 
          :disabled="currentPage <= 1" 
          class="task-details-pagination-btn"
        >
          <i class="fas fa-chevron-left"></i>
          上一页
        </button>
        <span class="task-details-pagination-info">
          第 {{ currentPage }} 页，共 {{ totalPages }} 页 ({{ tasks.length }} 条记录)
        </span>
        <button 
          @click="currentPage++" 
          :disabled="currentPage >= totalPages" 
          class="task-details-pagination-btn"
        >
          下一页
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- 字段详情模态框 -->
    <div v-if="showFieldModal" class="task-details-field-modal-overlay">
      <div class="task-details-field-modal-container">
        <div class="task-details-field-modal-header">
          <h3 class="task-details-field-modal-title">{{ fieldModalTitle }}</h3>
          <button @click="closeFieldModal" class="task-details-modal-close-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="task-details-field-modal-content">
          <pre class="task-details-field-value">{{ fieldModalContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  tasks: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close'])

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)

// 字段详情模态框
const showFieldModal = ref(false)
const fieldModalTitle = ref('')
const fieldModalContent = ref('')

// 表格列定义
const tableColumns = [
  { key: 'id', label: 'id (ID)' },
  { key: 'content', label: 'content (内容)' },
  { key: 'status', label: 'status (状态)' },
  { key: 'completed', label: 'completed (已完成)' },
  { key: 'createdAt', label: 'createdAt (创建时间)' },
  { key: 'updatedAt', label: 'updatedAt (更新时间)' },
  { key: 'reminderTime', label: 'reminderTime (提醒时间)' },
  { key: 'startedAt', label: 'startedAt (开始时间)' },
  { key: 'completedAt', label: 'completedAt (完成时间)' },
  { key: 'totalDuration', label: 'totalDuration (总耗时)' },
  { key: 'listId', label: 'listId (清单ID)' },
  { key: 'metadata', label: 'metadata (元数据)' },
  { key: 'dueDate', label: 'dueDate (到期日期)' },
  { key: 'dueTime', label: 'dueTime (到期时间)' },
  { key: 'recurrence', label: 'recurrence (重复规则)' },
  { key: 'seriesId', label: 'seriesId (系列ID)' },
  { key: 'occurrenceDate', label: 'occurrenceDate (发生日期)' }
]

// 计算属性
const totalPages = computed(() => {
  return Math.ceil(props.tasks.length / pageSize.value)
})

const paginatedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return props.tasks.slice(start, end)
})

// 方法
const isComplexField = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'object') return true
  if (typeof value === 'string' && value.length > 50) return true
  return false
}

const formatSimpleValue = (value) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') {
    // 如果是时间戳或持续时间，进行格式化
    if (value > 1000000000000) { // 可能是时间戳
      return new Date(value).toLocaleString()
    }
    return value.toString()
  }
  if (value instanceof Date) return value.toLocaleString()
  return value.toString()
}

const showFieldDetail = (fieldName, value) => {
  fieldModalTitle.value = fieldName
  if (typeof value === 'object') {
    fieldModalContent.value = JSON.stringify(value, null, 2)
  } else {
    fieldModalContent.value = value.toString()
  }
  showFieldModal.value = true
}

const closeFieldModal = () => {
  showFieldModal.value = false
  fieldModalTitle.value = ''
  fieldModalContent.value = ''
}
</script>

<style scoped>
/* 主模态框样式 */
.task-details-modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
}

.task-details-modal-container {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] flex flex-col;
}

.task-details-modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700;
}

.task-details-modal-title {
  @apply text-xl font-semibold text-gray-900 dark:text-white;
}

.task-details-modal-close-btn {
  @apply p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors;
}

/* 表格容器样式 */
.task-details-table-container {
  @apply flex-1 overflow-auto p-6;
}

.task-details-table {
  @apply w-full border-collapse;
}

.task-details-table-header {
  @apply bg-gray-50 dark:bg-gray-700 sticky top-0;
}

.task-details-table-th {
  @apply px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600;
}

.task-details-table-body {
  @apply bg-white dark:bg-gray-800;
}

.task-details-table-row {
  @apply hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors;
}

.task-details-table-td {
  @apply px-4 py-3 border-b border-gray-200 dark:border-gray-600;
}

.task-details-cell-content {
  @apply max-w-xs;
}

.task-details-simple-value {
  @apply text-sm text-gray-900 dark:text-gray-100 truncate block;
}

.task-details-complex-btn {
  @apply inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors;
}

/* 分页样式 */
.task-details-pagination {
  @apply flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700;
}

.task-details-pagination-btn {
  @apply inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors;
}

.task-details-pagination-info {
  @apply text-sm text-gray-700 dark:text-gray-300;
}

/* 字段详情模态框样式 */
.task-details-field-modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center;
  z-index: 60;
}

.task-details-field-modal-container {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col;
}

.task-details-field-modal-header {
  @apply flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700;
}

.task-details-field-modal-title {
  @apply text-lg font-medium text-gray-900 dark:text-white;
}

.task-details-field-modal-content {
  @apply flex-1 overflow-auto p-4;
}

.task-details-field-value {
  @apply text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded border;
}

/* 滚动条样式适配主题 */
.task-details-table-container::-webkit-scrollbar,
.task-details-field-modal-content::-webkit-scrollbar {
  @apply w-2 h-2;
}

.task-details-table-container::-webkit-scrollbar-track,
.task-details-field-modal-content::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-700 rounded;
}

.task-details-table-container::-webkit-scrollbar-thumb,
.task-details-field-modal-content::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-500 rounded hover:bg-gray-400 dark:hover:bg-gray-400;
}

/* Firefox 滚动条样式 */
.task-details-table-container,
.task-details-field-modal-content {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f3f4f6;
}

@media (prefers-color-scheme: dark) {
  .task-details-table-container,
  .task-details-field-modal-content {
    scrollbar-color: #6b7280 #374151;
  }
}
</style>