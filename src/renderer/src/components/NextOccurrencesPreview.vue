<template>
  <div class="next-occurrences-preview">
    <div class="preview-header">
      <h4 class="preview-title">接下来的实例</h4>
      <div class="preview-controls">
        <button 
          class="control-btn"
          @click="refreshPreview"
          :disabled="loading"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <select 
          v-model="previewCount" 
          class="count-select"
          @change="updatePreview"
        >
          <option value="5">5个</option>
          <option value="10">10个</option>
          <option value="20">20个</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="preview-loading">
      <div class="loading-spinner"></div>
      <span>计算中...</span>
    </div>

    <div v-else-if="error" class="preview-error">
      <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="!occurrences || occurrences.length === 0" class="preview-empty">
      <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10m6-10v10m-6-4h6" />
      </svg>
      <span>无重复实例</span>
    </div>

    <div v-else class="preview-list">
      <div 
        v-for="(occurrence, index) in occurrences" 
        :key="index"
        class="occurrence-item"
        :class="{ 
          'is-today': isToday(occurrence.date),
          'is-past': isPast(occurrence.date),
          'is-weekend': isWeekend(occurrence.date)
        }"
      >
        <div class="occurrence-date">
          <div class="date-main">
            {{ formatDate(occurrence.date) }}
          </div>
          <div class="date-relative">
            {{ getRelativeDate(occurrence.date) }}
          </div>
        </div>
        
        <div class="occurrence-info">
          <div class="occurrence-weekday">
            {{ getWeekdayName(occurrence.date) }}
          </div>
          <div v-if="occurrence.isOverride" class="occurrence-badge override">
            已修改
          </div>
          <div v-if="occurrence.isCompleted" class="occurrence-badge completed">
            已完成
          </div>
        </div>
        
        <div class="occurrence-actions">
          <button 
            v-if="!occurrence.isCompleted && !isPast(occurrence.date)"
            class="action-btn complete"
            @click="completeOccurrence(occurrence)"
            title="标记完成"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          
          <button 
            class="action-btn edit"
            @click="editOccurrence(occurrence)"
            title="编辑此实例"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          
          <button 
            class="action-btn delete"
            @click="deleteOccurrence(occurrence)"
            title="删除此实例"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="hasMore" class="preview-footer">
      <button 
        class="load-more-btn"
        @click="loadMore"
        :disabled="loading"
      >
        加载更多
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RecurrenceRule } from '@/utils/recurrence-rule.js'

const props = defineProps({
  recurrence: {
    type: Object,
    required: true
  },
  baseDate: {
    type: Date,
    default: () => new Date()
  },
  taskId: {
    type: String,
    default: null
  },
  existingInstances: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'complete-occurrence',
  'edit-occurrence', 
  'delete-occurrence'
])

// 响应式数据
const occurrences = ref([])
const loading = ref(false)
const error = ref('')
const previewCount = ref(10)
const hasMore = ref(false)

// 计算属性
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

// 方法
const updatePreview = async () => {
  if (!props.recurrence) {
    occurrences.value = []
    return
  }

  loading.value = true
  error.value = ''

  try {
    const rule = new RecurrenceRule(props.recurrence)
    
    // 计算预览范围（从今天开始，向后计算足够的时间）
    const startDate = new Date()
    const endDate = new Date()
    endDate.setFullYear(endDate.getFullYear() + 2) // 向后2年
    
    // 获取重复实例
    const instances = rule.calculateOccurrences(startDate, endDate, parseInt(previewCount.value))
    
    // 合并已存在的实例信息
    const enrichedInstances = instances.map(date => {
      const dateStr = date.toISOString().split('T')[0]
      const existingInstance = props.existingInstances.find(inst => 
        inst.occurrence_date === dateStr
      )
      
      return {
        date,
        dateStr,
        isOverride: !!existingInstance,
        isCompleted: existingInstance?.completed_at != null,
        instanceId: existingInstance?.id
      }
    })
    
    occurrences.value = enrichedInstances
    hasMore.value = instances.length >= parseInt(previewCount.value)
    
  } catch (err) {
    console.error('计算重复实例失败:', err)
    error.value = '计算重复实例失败: ' + err.message
    occurrences.value = []
  } finally {
    loading.value = false
  }
}

const refreshPreview = () => {
  updatePreview()
}

const loadMore = () => {
  previewCount.value += 10
  updatePreview()
}

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getRelativeDate = (date) => {
  const today = new Date()
  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return '今天'
  } else if (diffDays === 1) {
    return '明天'
  } else if (diffDays === -1) {
    return '昨天'
  } else if (diffDays > 0 && diffDays <= 7) {
    return `${diffDays}天后`
  } else if (diffDays < 0 && diffDays >= -7) {
    return `${Math.abs(diffDays)}天前`
  } else if (diffDays > 7) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}周后`
  } else {
    const weeks = Math.floor(Math.abs(diffDays) / 7)
    return `${weeks}周前`
  }
}

const getWeekdayName = (date) => {
  return weekdays[date.getDay()]
}

const isToday = (date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

const isPast = (date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

const isWeekend = (date) => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const completeOccurrence = (occurrence) => {
  emit('complete-occurrence', {
    date: occurrence.date,
    dateStr: occurrence.dateStr,
    instanceId: occurrence.instanceId
  })
}

const editOccurrence = (occurrence) => {
  emit('edit-occurrence', {
    date: occurrence.date,
    dateStr: occurrence.dateStr,
    instanceId: occurrence.instanceId
  })
}

const deleteOccurrence = (occurrence) => {
  emit('delete-occurrence', {
    date: occurrence.date,
    dateStr: occurrence.dateStr,
    instanceId: occurrence.instanceId
  })
}

// 监听器
watch(() => props.recurrence, () => {
  updatePreview()
}, { deep: true })

watch(() => props.existingInstances, () => {
  updatePreview()
}, { deep: true })

// 初始化
onMounted(() => {
  updatePreview()
})
</script>

<style scoped>
.next-occurrences-preview {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e1e5e9;
  background: #f9fafb;
}

.preview-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  padding: 4px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #374151;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.count-select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  color: #374151;
}

.preview-loading,
.preview-error,
.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: #6b7280;
  font-size: 13px;
}

.preview-error {
  color: #dc2626;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.preview-list {
  max-height: 400px;
  overflow-y: auto;
}

.occurrence-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
}

.occurrence-item:hover {
  background: #f9fafb;
}

.occurrence-item:last-child {
  border-bottom: none;
}

.occurrence-item.is-today {
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.occurrence-item.is-past {
  opacity: 0.6;
}

.occurrence-item.is-weekend {
  background: #fefce8;
}

.occurrence-date {
  flex: 1;
  min-width: 0;
}

.date-main {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
}

.date-relative {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.occurrence-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px;
}

.occurrence-weekday {
  font-size: 12px;
  color: #6b7280;
  min-width: 20px;
}

.occurrence-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.occurrence-badge.override {
  background: #fef3c7;
  color: #92400e;
}

.occurrence-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.occurrence-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.occurrence-item:hover .occurrence-actions {
  opacity: 1;
}

.action-btn {
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #f3f4f6;
}

.action-btn.complete:hover {
  background: #d1fae5;
  color: #059669;
}

.action-btn.edit:hover {
  background: #dbeafe;
  color: #2563eb;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.preview-footer {
  padding: 12px 16px;
  border-top: 1px solid #e1e5e9;
  background: #f9fafb;
  text-align: center;
}

.load-more-btn {
  padding: 6px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .occurrence-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .occurrence-info {
    margin: 0;
    width: 100%;
    justify-content: space-between;
  }
  
  .occurrence-actions {
    opacity: 1;
    width: 100%;
    justify-content: flex-end;
  }
}
</style>