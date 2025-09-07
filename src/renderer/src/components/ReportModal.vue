<template>
  <div v-if="visible" class="report-modal-overlay" @click="handleOverlayClick">
    <div class="report-modal" @click.stop>
      <!-- 模态框头部 -->
      <div class="report-modal-header">
        <div class="report-modal-title">
          <i class="fas fa-robot"></i>
          <h3>AI生成报告</h3>
          <span v-if="reportType" class="report-type-badge">{{ reportType === 'daily' ? '日报' : '周报' }}</span>
        </div>
        <button @click="closeModal" class="close-btn" title="关闭">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <!-- 警告信息 -->
      <div class="report-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <span>报告内容不会自动保存，请复制后再关闭</span>
      </div>
      
      <!-- 报告内容区域 -->
      <div class="report-modal-content">
        <!-- AI生成过程展示区域 - 支持折叠 -->
        <div v-if="isGenerating || streamContent" class="report-stream-content">
          <div class="report-stream-header" @click="isStreamCollapsed = !isStreamCollapsed">
            <i class="fas fa-robot"></i>
            <span class="flex items-center gap-2">
              <i v-if="isGenerating" class="fas fa-spinner fa-spin"></i>
              {{ isGenerating ? 'AI正在生成报告...' : 'AI生成过程' }}
            </span>
            <i :class="['fas', 'fa-chevron-down', 'report-stream-toggle', { 'collapsed': isStreamCollapsed }]"></i>
          </div>
          <div v-show="!isStreamCollapsed" class="report-stream-text">
            <div v-if="isGenerating && !streamContent" class="report-waiting-text">
              等待AI响应中...
            </div>
            <div v-else class="report-stream-display" v-html="formattedStreamContent"></div>
          </div>
        </div>
        
        <!-- 错误状态 -->
        <div v-else-if="error" class="report-error">
          <i class="fas fa-exclamation-circle"></i>
          <div class="error-content">
            <h4>生成失败</h4>
            <p>{{ error }}</p>
            <button @click="retryGeneration" class="retry-btn">
              <i class="fas fa-redo"></i>
              重试
            </button>
          </div>
        </div>
        
        <!-- 报告内容 -->
        <div v-if="reportContent" class="report-content">
          <!-- 最终报告内容 -->
          <div class="report-text" v-html="formattedReportContent"></div>
        </div>
        
        <!-- 空状态 -->
        <div v-else-if="!isGenerating && !streamContent && !reportContent" class="report-empty">
          <i class="fas fa-file-alt"></i>
          <p>暂无报告内容</p>
        </div>
      </div>
      
      <!-- 模态框底部操作 -->
      <div class="report-modal-actions">
        <div class="report-info">
          <span v-if="taskCount !== null" class="task-count">
            <i class="fas fa-tasks"></i>
            {{ taskCount }} 个任务
          </span>
          <span v-if="reportPeriod" class="report-period">
            <i class="fas fa-calendar"></i>
            {{ reportPeriod }}
          </span>
        </div>
        
        <div class="action-buttons">
          <button 
            @click="copyToClipboard" 
            class="copy-btn"
            :disabled="!reportContent || isGenerating"
            title="复制到剪贴板"
          >
            <i class="fas fa-copy"></i>
            {{ copySuccess ? '已复制' : '复制内容' }}
          </button>
          <button @click="closeModal" class="close-action-btn">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { marked } from 'marked'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  reportContent: {
    type: String,
    default: ''
  },
  reportType: {
    type: String,
    default: ''
  },
  reportPeriod: {
    type: String,
    default: ''
  },
  taskCount: {
    type: Number,
    default: null
  },
  isGenerating: {
    type: Boolean,
    default: false
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  streamContent: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  }
})

// Emits
const emit = defineEmits(['close', 'retry'])

// 响应式数据
const copySuccess = ref(false)
const loadingMessage = ref('正在准备数据...')
const isStreamCollapsed = ref(false)

// 计算属性
const formattedReportContent = computed(() => {
  if (!props.reportContent) return ''
  try {
    return marked(props.reportContent)
  } catch (error) {
    console.error('Markdown解析失败:', error)
    return `<pre>${props.reportContent}</pre>`
  }
})

const formattedStreamContent = computed(() => {
  if (!props.streamContent) return ''
  try {
    return marked(props.streamContent)
  } catch (error) {
    console.error('Markdown解析失败:', error)
    return `<pre>${props.streamContent}</pre>`
  }
})

// 监听加载状态变化
watch(() => props.isGenerating, (newVal) => {
  if (newVal) {
    // 模拟加载消息变化
    const messages = [
      '正在准备数据...',
      '正在分析任务状态...',
      '正在生成报告摘要...',
      '正在格式化内容...'
    ]
    
    let index = 0
    const interval = setInterval(() => {
      if (!props.isGenerating) {
        clearInterval(interval)
        return
      }
      
      loadingMessage.value = messages[index % messages.length]
      index++
    }, 1500)
  }
})

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 重置状态
    copySuccess.value = false
    loadingMessage.value = '正在准备数据...'
    
    // 防止背景滚动
    document.body.style.overflow = 'hidden'
  } else {
    // 恢复背景滚动
    document.body.style.overflow = ''
  }
})

// 方法
const closeModal = () => {
  emit('close')
}

const handleOverlayClick = () => {
  // 点击遮罩层关闭模态框
  closeModal()
}

const retryGeneration = () => {
  emit('retry')
}

const copyToClipboard = async () => {
  if (!props.reportContent) return
  
  try {
    await navigator.clipboard.writeText(props.reportContent)
    copySuccess.value = true
    
    // 3秒后重置状态
    setTimeout(() => {
      copySuccess.value = false
    }, 3000)
  } catch (error) {
    console.error('复制失败:', error)
    
    // 降级方案：使用传统方法
    try {
      const textArea = document.createElement('textarea')
      textArea.value = props.reportContent
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      
      copySuccess.value = true
      setTimeout(() => {
        copySuccess.value = false
      }, 3000)
    } catch (fallbackError) {
      console.error('降级复制也失败:', fallbackError)
      alert('复制失败，请手动选择文本复制')
    }
  }
}

// 组件卸载时清理
import { onUnmounted } from 'vue'

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
.report-modal-overlay {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50;
  backdrop-filter: blur(4px);
}

.report-modal {
  @apply bg-background border border-border rounded-lg shadow-2xl;
  @apply w-full max-w-4xl max-h-[90vh] flex flex-col;
  @apply mx-4;
}

.report-modal-header {
  @apply flex items-center justify-between p-4 border-b border-border;
  @apply bg-muted/30;
}

.report-modal-title {
  @apply flex items-center gap-3;
}

.report-modal-title h3 {
  @apply text-lg font-semibold text-foreground;
}

.report-modal-title i {
  @apply text-primary text-xl;
}

.report-type-badge {
  @apply px-2 py-1 bg-primary/10 text-primary text-xs rounded-full;
}

.close-btn {
  @apply p-2 hover:bg-muted rounded-md transition-colors duration-200;
  @apply text-muted-foreground hover:text-foreground;
}

.report-warning {
  @apply flex items-center gap-2 p-3 bg-yellow-50 border-l-4 border-yellow-400;
  @apply text-yellow-800 text-sm;
}

[data-theme="dark"] .report-warning {
  @apply bg-yellow-900/20 text-yellow-400 border-yellow-600;
}

.report-warning i {
  @apply text-yellow-600;
}

[data-theme="dark"] .report-warning i {
  @apply text-yellow-400;
}

.report-modal-content {
  @apply flex-1 overflow-y-auto;
}

.report-loading {
  @apply flex flex-col items-center justify-center p-8 space-y-4;
}

.loading-spinner {
  @apply w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin;
}

.loading-text {
  @apply text-center space-y-2;
}

.loading-text p {
  @apply text-foreground;
}

.loading-detail {
  @apply text-sm text-muted-foreground;
}

.report-error {
  @apply flex flex-col items-center justify-center p-8 space-y-4;
}

.report-error i {
  @apply text-4xl text-red-500;
}

.error-content {
  @apply text-center space-y-3;
}

.error-content h4 {
  @apply text-lg font-semibold text-foreground;
}

.error-content p {
  @apply text-muted-foreground;
}

.retry-btn {
  @apply px-4 py-2 bg-primary text-primary-foreground rounded-md;
  @apply hover:bg-primary/90 transition-colors duration-200;
  @apply flex items-center gap-2;
}

.report-content {
  @apply h-full overflow-y-auto;
}

.streaming-content {
  @apply h-full flex flex-col;
}

.streaming-indicator {
  @apply flex items-center gap-2 p-3 bg-blue-50 border-b border-border;
  @apply text-blue-700 text-sm;
}

[data-theme="dark"] .streaming-indicator {
  @apply bg-blue-900/20 text-blue-400;
}

.streaming-dot {
  @apply w-2 h-2 bg-blue-500 rounded-full animate-pulse;
}

.report-text {
  @apply flex-1 overflow-y-auto p-6;
  @apply text-foreground;
  @apply select-text;
}

/* Prose 样式覆盖 */
.report-text :deep(h1) {
  @apply text-2xl font-bold text-foreground mb-4;
}

.report-text :deep(h2) {
  @apply text-xl font-semibold text-foreground mb-3 mt-6;
}

.report-text :deep(h3) {
  @apply text-lg font-semibold text-foreground mb-2 mt-4;
}

.report-text :deep(p) {
  @apply text-foreground mb-3 leading-relaxed;
}

.report-text :deep(ul) {
  @apply list-disc list-inside space-y-1 mb-4;
}

.report-text :deep(li) {
  @apply text-foreground;
}

.report-text :deep(strong) {
  @apply font-semibold text-foreground;
}

.report-text :deep(code) {
  @apply px-1.5 py-0.5 bg-muted rounded text-sm font-mono;
}

.report-text :deep(pre) {
  @apply bg-muted p-4 rounded-lg overflow-x-auto text-sm;
}

.report-empty {
  @apply flex flex-col items-center justify-center p-8 space-y-4;
  @apply text-muted-foreground;
}

.report-empty i {
  @apply text-4xl;
}

.report-modal-actions {
  @apply flex items-center justify-between p-4 border-t border-border;
  @apply bg-muted/30;
}

.report-info {
  @apply flex items-center gap-4 text-sm text-muted-foreground;
}

.task-count,
.report-period {
  @apply flex items-center gap-1;
}

.action-buttons {
  @apply flex items-center gap-3;
}

.copy-btn {
  @apply px-4 py-2 bg-primary text-primary-foreground rounded-md;
  @apply hover:bg-primary/90 transition-colors duration-200;
  @apply flex items-center gap-2 text-sm;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
}

.copy-btn.success {
  @apply bg-green-600 hover:bg-green-700;
}

.close-action-btn {
  @apply px-4 py-2 bg-muted text-foreground rounded-md;
  @apply hover:bg-muted/80 transition-colors duration-200;
  @apply text-sm;
}

/* 流式内容显示区域样式 */
.report-stream-content {
  @apply mb-3 px-3 py-3 bg-muted/30 rounded-lg border border-border;
}

.report-stream-header {
  @apply flex items-center justify-between gap-2 mb-2 font-medium text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer;
}

.report-stream-header i:first-child {
  @apply text-primary text-sm;
}

.report-stream-toggle {
  @apply text-muted-foreground transition-all duration-200 hover:text-foreground;
}

.report-stream-toggle.collapsed {
  @apply rotate-180;
}

.report-stream-text {
  @apply p-3 bg-background rounded-md border border-border text-sm text-foreground overflow-y-auto max-h-64;
}

.report-stream-display {
  @apply whitespace-pre-wrap;
}

.report-waiting-text {
  @apply text-center text-muted-foreground py-4 text-sm;
}




/* 滚动条样式 */
.report-modal-content::-webkit-scrollbar {
  @apply w-2;
}

.report-modal-content::-webkit-scrollbar-track {
  @apply bg-transparent;
}

.report-modal-content::-webkit-scrollbar-thumb {
  @apply bg-muted-foreground/20 rounded-full;
}

.report-modal-content::-webkit-scrollbar-thumb:hover {
  @apply bg-muted-foreground/30;
}

/* 滚动条样式 */
.report-text::-webkit-scrollbar,
.report-stream-text::-webkit-scrollbar {
  width: 8px;
}

.report-text::-webkit-scrollbar-track,
.report-stream-text::-webkit-scrollbar-track {
  background: transparent;
}

.report-text::-webkit-scrollbar-thumb,
.report-stream-text::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 9999px;
}

.report-text::-webkit-scrollbar-thumb:hover,
.report-stream-text::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}

.report-text::-webkit-scrollbar-corner,
.report-stream-text::-webkit-scrollbar-corner {
  background: transparent;
}
</style>