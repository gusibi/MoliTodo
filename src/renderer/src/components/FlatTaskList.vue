<template>
  <div class="flat-task-list-container" @click="handleContainerClick">
    <!-- 添加任务区域 -->
    <!-- <TaskEdit ref="taskEditRef" :task="null" :is-editing="false" @add-task="handleAddTask" /> -->

    <!-- 时间筛选器 - 在计划中、全部任务和清单视图中显示 -->
    <div v-if="shouldShowTimeFilter" class="flat-task-list-time-filter-container">
      <TimeFilter 
        v-model="currentTimeFilter" 
        :tasks="filteredTasksByTime"
        @filter-change="handleTimeFilterChange"
        @generate-report="handleGenerateReport"
        ref="timeFilterRef"
      />
    </div>

    <!-- 任务列表内容区域 -->
    <div class="flat-task-list-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="flat-task-list-loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!tasks || tasks.length === 0" class="flat-task-list-empty-state">
        <div class="flat-task-list-empty-icon">📝</div>
        <div class="flat-task-list-empty-text">暂无任务</div>
        <div class="flat-task-list-empty-suggestion">
          <p>开始创建您的第一个任务吧！</p>
          <ul>
            <li>• 点击上方输入框添加任务</li>
            <li>• 使用 <kbd>Ctrl + Enter</kbd> 创建任务</li>
            <li>• 设置截止日期和提醒</li>
            <li>• 开始高效管理您的时间</li>
          </ul>
        </div>
        <div class="flat-task-list-empty-hint">
          💡 提示：您可以使用快捷键 {{ getShortcutText('add') }} 快速添加任务
        </div>
      </div>

      <!-- 扁平化任务列表 -->
      <div v-else class="flat-task-list-items">
        <!-- 多选操作栏 - 仅在已完成分类且有选中任务时显示 -->
        <div v-if="isMultiSelectMode && selectedTaskIds.size > 0" class="flat-task-multiselect-bar">
          <div class="flat-task-multiselect-info">
            <span class="flat-task-multiselect-count">已选中 {{ selectedTaskIds.size }} 项</span>
            <button class="flat-task-multiselect-clear" @click="clearSelection">
              取消选择
            </button>
          </div>
          <div class="flat-task-multiselect-actions">
            <button class="flat-task-multiselect-delete" @click="deleteSelectedTasks">
              <i class="fas fa-trash"></i>
              <span>删除选中</span>
            </button>
          </div>
        </div>

        <!-- 按清单分组展示 -->
        <div v-for="group in groupedTasks" :key="group.id" class="flat-task-group">
          <!-- 清单标题 - 只在非清单视图中显示 -->
          <div v-if="!isInListView" class="flat-task-group-header" @click.stop="toggleGroupCollapse(group.id)">
            <div class="flat-task-group-title">
              <!-- 多选模式下显示全选复选框 -->
              <div v-if="isMultiSelectMode" class="flat-task-group-select" @click.stop>
                <input 
                  type="checkbox" 
                  :id="`group-select-${group.id}`"
                  :checked="isGroupAllSelected(group)"
                  :indeterminate="getGroupSelectedCount(group) > 0 && !isGroupAllSelected(group)"
                  @change="toggleSelectAll(group)"
                  class="flat-task-group-checkbox"
                />
                <label :for="`group-select-${group.id}`" class="flat-task-group-checkbox-label">全选</label>
              </div>
              <div class="flat-task-group-info">
                <i :class="getListIconClass(group.icon)" :style="{ color: group.color }"></i>
                <span :style="{ color: group.color }">{{ group.name }}</span>
                <span class="flat-task-group-count">({{ group.tasks.length }})</span>
                <span v-if="isMultiSelectMode && getGroupSelectedCount(group) > 0" class="flat-task-group-selected-count">
                  - 已选 {{ getGroupSelectedCount(group) }}
                </span>
              </div>
              <i class="flat-task-group-collapse-icon"
                :class="collapsedGroups.has(group.id) ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"
                :title="collapsedGroups.has(group.id) ? '展开' : '折叠'"></i>
            </div>
          </div>

          <!-- 清单标题 - 在清单视图中显示（不可折叠），只在有多个分组时显示 -->
          <div v-else-if="isInListView && groupedTasks.length > 1" class="flat-task-group-header-static">
            <div class="flat-task-group-title">
              <!-- 多选模式下显示全选复选框 -->
              <div v-if="isMultiSelectMode" class="flat-task-group-select" @click.stop>
                <input 
                  type="checkbox" 
                  :id="`group-select-list-${group.id}`"
                  :checked="isGroupAllSelected(group)"
                  :indeterminate="getGroupSelectedCount(group) > 0 && !isGroupAllSelected(group)"
                  @change="toggleSelectAll(group)"
                  class="flat-task-group-checkbox"
                />
                <label :for="`group-select-list-${group.id}`" class="flat-task-group-checkbox-label">全选</label>
              </div>
              <div class="flat-task-group-info">
                <i :class="getListIconClass(group.icon)" :style="{ color: group.color }"></i>
                <span>{{ group.name }}</span>
                <span class="flat-task-group-count">({{ group.tasks.length }})</span>
                <span v-if="isMultiSelectMode && getGroupSelectedCount(group) > 0" class="flat-task-group-selected-count">
                  - 已选 {{ getGroupSelectedCount(group) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 该清单下的任务 - 扁平化列表 -->
          <ul class="flat-task-group-items"
            :class="{ 'flat-task-group-collapsed': !isInListView && collapsedGroups.has(group.id) }">
            <div v-for="task in group.tasks" :key="task.id" class="flat-task-item-wrapper">
              <FlatTaskItem
                :task="task"
                :search-query="searchQuery"
                :time-update-trigger="timeUpdateTrigger"
                :is-editing="editingTaskId === task.id"
                :is-hovered="hoveredTaskId === task.id"
                :is-multi-select-mode="isMultiSelectMode"
                :is-selected="selectedTaskIds.has(task.id)"
                @task-click="handleTaskClick"
                @select-change="toggleTaskSelection(task.id)"
                @mouseenter="hoveredTaskId = task.id"
                @mouseleave="hoveredTaskId = null"
              />
            </div>
          </ul>
        </div>
      </div>

      <!-- 快速添加框 -->
      <div class="flat-task-list-quick-add">
        <!-- 主输入区域 -->
        <div class="flat-task-list-main-input">
          <div class="flat-task-list-input-wrapper">
            <textarea 
              v-model="newTaskContent" 
              class="flat-task-list-textarea" 
              placeholder="添加新任务..." 
              rows="1"
              maxlength="200"
              @keypress.enter.prevent="addTask"
              ref="quickAddInput"
            ></textarea>
            
            <!-- 输入框内部控制区域 -->
            <div class="flat-task-list-inline-controls">
              <!-- 左侧选项 -->
              <div class="flat-task-list-inline-options">
                <!-- AI模型选择 -->
                 <div class="flat-task-list-ai-container" v-if="taskStore.availableAIModels.length > 0">
                   <button 
                     class="flat-task-list-ai-toggle"
                     :class="{ 'active': taskStore.isAIEnabled }"
                     @click="toggleAI"
                     ref="aiButton"
                   >
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" 
                             :fill="taskStore.isAIEnabled ? 'currentColor' : 'none'" 
                             :stroke="taskStore.isAIEnabled ? 'none' : 'currentColor'" 
                             stroke-width="2"/>
                     </svg>
                     <span class="flat-task-list-ai-label">
                       {{ taskStore.selectedAIModel ? taskStore.selectedAIModel.name : 'AI' }}
                     </span>
                   </button>
                   
                   <!-- AI 模型下拉列表 -->
                   <div v-if="showAIDropdown" class="flat-task-list-ai-dropdown" ref="aiDropdown">
                     <div class="flat-task-list-ai-dropdown-list">
                       <!-- 不使用 AI 选项 -->
                       <div class="flat-task-list-ai-dropdown-item no-ai"
                            :class="{ 'selected': !taskStore.selectedAIModel }"
                            @click="selectAIModel(null)">
                         <div class="flat-task-list-ai-model-info">
                           <div class="flat-task-list-ai-model-name">不使用 AI</div>
                           <div class="flat-task-list-ai-model-provider">禁用 AI 功能</div>
                         </div>
                         <div class="flat-task-list-ai-model-check">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                           </svg>
                         </div>
                       </div>
                       
                       <!-- AI 模型选项 -->
                       <div v-for="model in taskStore.availableAIModels" 
                            :key="model.id"
                            class="flat-task-list-ai-dropdown-item"
                            :class="{ 'selected': taskStore.selectedAIModel?.id === model.id }"
                            @click="selectAIModel(model)">
                         <div class="flat-task-list-ai-model-info">
                           <div class="flat-task-list-ai-model-name">{{ model.name }}</div>
                           <div class="flat-task-list-ai-model-provider">{{ model.provider }}</div>
                         </div>
                         <div v-if="taskStore.selectedAIModel?.id === model.id" class="flat-task-list-ai-model-check">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                           </svg>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>

                   <!-- 任务拆分选项 -->
                <button 
                  @click="shouldSplitTask = !shouldSplitTask"
                  :class="['flat-task-list-split-btn', { 'active': shouldSplitTask }]"
                  :title="shouldSplitTask ? '关闭拆分任务：AI 生成的详细步骤会放在步骤中' : '打开拆分任务：AI 会将任务拆分生成多个任务'"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="flat-task-list-split-text">拆分</span>
                </button>
              </div>
              
              <!-- 右侧发送按钮 -->
              <div class="flat-task-list-input-actions">
                <button 
                  class="flat-task-list-send-btn"
                  :disabled="!newTaskContent.trim()"
                  @click="addTask"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- AI 任务预览弹窗 -->
    <TaskPreviewModal 
      :visible="showTaskPreview"
      :tasks="previewTasks"
      :original-input="originalTaskInput"
      :stream-content="streamContent"
      @close="closeTaskPreview"
      @created="handleTasksCreated"
    />

    <!-- 任务选择模态框 -->
    <TaskSelectionModal
      :visible="showTaskSelectionModal"
      :tasks="pendingReportData?.tasks || []"
      :filter-type="pendingReportData?.filterType || 'all'"
      @close="closeTaskSelectionModal"
      @confirm="handleTaskSelectionConfirm"
    />

    <!-- 报告模态框 -->
    <ReportModal
      :visible="showReportModal"
      :report-content="reportContent"
      :report-type="reportType"
      :report-period="reportPeriod"
      :task-count="reportTaskCount"
      :is-generating="isGeneratingReport"
      :is-streaming="isStreamingReport"
      :stream-content="reportStreamContent"
      :error="reportError"
      @close="closeReportModal"
      @retry="retryReportGeneration"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import FlatTaskItem from './FlatTaskItem.vue'
import TaskPreviewModal from './TaskPreviewModal.vue'
import TimeFilter from './TimeFilter.vue'
import TaskSelectionModal from './TaskSelectionModal.vue'
import ReportModal from './ReportModal.vue'
// ReportService 现在通过 taskStore 调用
import { getListIconClass } from '@/utils/icon-utils'

// 定义 props
const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  },
  editingTaskId: {
    type: [Number, String],
    default: null
  }
})

const emit = defineEmits([
  'add-task',
  'update-task',
  'edit-task',
  'show-tooltip',
  'hide-tooltip',
  'show-edit-panel',
  'hide-edit-panel'
])

// 编辑状态管理

const hoveredTaskId = ref(null)

// 多选状态管理
const selectedTaskIds = ref(new Set())

// 快速添加相关
const newTaskContent = ref('')
const shouldSplitTask = ref(false)
const quickAddInput = ref(null)

// AI 相关响应式数据
const showAIDropdown = ref(false)
const aiButton = ref(null)
const aiDropdown = ref(null)

// TaskPreviewModal 相关状态
const showTaskPreview = ref(false)
const previewTasks = ref([])
const originalTaskInput = ref('')
const streamContent = ref('')

// AI 报告相关状态
const timeFilterRef = ref(null)
const showTaskSelectionModal = ref(false)
const showReportModal = ref(false)
const pendingReportData = ref(null)
const reportContent = ref('')
const reportType = ref('')
const reportPeriod = ref('')
const reportTaskCount = ref(0)
const isGeneratingReport = ref(false)
const isStreamingReport = ref(false)
const reportStreamContent = ref('')
const reportError = ref('')

// 折叠状态管理
const collapsedGroups = ref(new Set())

// 从本地存储加载折叠状态
const loadCollapsedState = () => {
  try {
    const saved = localStorage.getItem('flatTaskList-collapsedGroups')
    if (saved) {
      const collapsedArray = JSON.parse(saved)
      collapsedGroups.value = new Set(collapsedArray)
    }
  } catch (error) {
    console.warn('加载折叠状态失败:', error)
  }
}

// 保存折叠状态到本地存储
const saveCollapsedState = () => {
  try {
    const collapsedArray = Array.from(collapsedGroups.value)
    localStorage.setItem('flatTaskList-collapsedGroups', JSON.stringify(collapsedArray))
  } catch (error) {
    console.warn('保存折叠状态失败:', error)
  }
}

// 时间更新定时器和响应式更新触发器
let timeUpdateTimer = null
const timeUpdateTrigger = ref(0)

// 使用任务存储
const taskStore = useTaskStore()

// 获取当前分类
const currentCategory = computed(() => taskStore.currentCategory)

// 计算属性：是否处于多选模式（仅在已完成分类中启用）
const isMultiSelectMode = computed(() => currentCategory.value === 'completed')

// 计算属性：是否应该显示时间过滤器
const shouldShowTimeFilter = computed(() => {
  const category = currentCategory.value
  const isInList = taskStore.currentListId !== null
  
  // 在以下情况显示时间过滤器：
  // 1. 计划中分类
  // 2. 全部任务分类
  // 3. 在任何清单中
  return category === 'planned' || category === 'all' || isInList
})

// 时间筛选相关
const currentTimeFilter = ref('all')

// 处理时间筛选变化
const handleTimeFilterChange = (filterKey) => {
  currentTimeFilter.value = filterKey
  // 不修改 currentCategory，只更新本地筛选状态
}

// AI 报告生成处理方法
const handleGenerateReport = (data) => {
  // console.log('🚀 [FlatTaskList] 收到生成报告请求:', data)
  // console.log('[FlatTaskList] 任务数量:', data.tasks.length)
  // console.log('[FlatTaskList] 筛选类型:', data.filterType)
  
  // 保存待处理的报告数据
  pendingReportData.value = data
  
  // 显示任务选择模态框
  showTaskSelectionModal.value = true
  
  console.log('[FlatTaskList] 任务选择模态框已显示')
}

const closeTaskSelectionModal = () => {
  console.log('[FlatTaskList] 关闭任务选择模态框')
  showTaskSelectionModal.value = false
  pendingReportData.value = null
}

const handleTaskSelectionConfirm = async (selectionData) => {
  // console.log('[FlatTaskList] 用户确认任务选择:', selectionData)
  // console.log('[FlatTaskList] 选中任务数量:', selectionData.tasks.length)
  // console.log('[FlatTaskList] 报告类型:', selectionData.reportType)
  
  // 关闭任务选择模态框
  showTaskSelectionModal.value = false
  
  try {
    // 设置加载状态
    isGeneratingReport.value = true
    isStreamingReport.value = true
    reportError.value = ''
    reportStreamContent.value = ''
    reportContent.value = ''
    showReportModal.value = true
    
    console.log('[FlatTaskList] 开始生成报告流程...')
    
    // 通知 TimeFilter 组件进入生成状态
    if (timeFilterRef.value) {
      timeFilterRef.value.setGeneratingState(true)
    }

    // 获取 AI 配置
    console.log('[FlatTaskList] 开始获取 AI 配置...')
    const aiConfig = await window.electronAPI.ai.getConfig()
    console.log('[FlatTaskList] AI 配置获取成功:', aiConfig)

    // 使用报告服务生成提示
    console.log('[FlatTaskList] 开始生成报告数据...')
    const reportData = await taskStore.generateReport(
      selectionData.tasks,
      selectionData.filterType,
      aiConfig.reportTemplates || {}
    )
    
    // 如果用户手动选择了报告类型，覆盖自动判断的类型
    if (selectionData.reportType) {
      reportData.reportType = selectionData.reportType
    }
    
    // 添加AI模型信息
    if (selectionData.aiModel) {
      reportData.aiModel = selectionData.aiModel
    }
    
    console.log('[FlatTaskList] 报告数据生成完成:', {
      reportType: reportData.reportType,
      taskCount: reportData.taskCount,
      promptLength: reportData.prompt.length
    })
    
    // 设置报告信息
    reportType.value = reportData.reportType
    reportPeriod.value = reportData.reportPeriod
    reportTaskCount.value = selectionData.tasks.length

    // 使用 taskStore 的流式生成方法
    console.log('[FlatTaskList] 开始调用 taskStore 流式生成报告...')
    
    const result = await taskStore.streamGenerateReport(
      reportData,
      // onChunk 回调
      (chunk) => {
        console.log('[FlatTaskList] 接收到流式数据块，长度:', chunk.length)
        reportStreamContent.value = chunk
      },
      // onComplete 回调
      (result) => {
        console.log('[FlatTaskList] 报告生成完成:', result.success)
        if (result.success) {
          reportContent.value = result.report
          isStreamingReport.value = false
          console.log('[FlatTaskList] 最终报告长度:', result.report.length)
        } else {
          reportError.value = result.error || '生成报告失败'
          isStreamingReport.value = false
          console.error('[FlatTaskList] 报告生成失败:', result.error)
        }
      },
      // onError 回调
      (error) => {
        console.error('[FlatTaskList] 报告生成错误:', error)
        reportError.value = error.error || '生成报告时发生未知错误'
        isStreamingReport.value = false
      }
    )
    
    console.log('[FlatTaskList] taskStore 调用完成，结果:', result.success)
    
  } catch (error) {
    console.error('[FlatTaskList] 生成报告异常:', error)
    reportError.value = error.message || '生成报告时发生未知错误'
    isStreamingReport.value = false
  } finally {
    isGeneratingReport.value = false
    
    // 通知 TimeFilter 组件退出生成状态
    if (timeFilterRef.value) {
      timeFilterRef.value.setGeneratingState(false)
    }
    
    console.log('[FlatTaskList] 报告生成流程结束')
  }
}

const closeReportModal = () => {
  console.log('[FlatTaskList] 关闭报告模态框')
  showReportModal.value = false
  reportContent.value = ''
  reportError.value = ''
  reportStreamContent.value = ''
}

const retryReportGeneration = () => {
  console.log('[FlatTaskList] 重试报告生成')
  // 重新生成报告，使用上次的数据
  if (pendingReportData.value) {
    handleTaskSelectionConfirm({
      tasks: filteredTasksByTime.value,
      filterType: currentTimeFilter.value,
      reportType: reportType.value || 'weekly',
      taskCount: filteredTasksByTime.value.length
    })
  }
}

// 监听分类变化，当切换到不支持时间筛选的分类时，重置时间筛选器为'all'
watch(() => [currentCategory.value, taskStore.currentListId], ([newCategory, newListId]) => {
  // 如果切换到不支持时间筛选的分类，重置筛选器
  if (!shouldShowTimeFilter.value) {
    currentTimeFilter.value = 'all'
  }
})

// 计算属性：是否在清单视图中
const isInListView = computed(() => taskStore.currentListId !== null)

// 根据时间筛选器过滤任务
const filteredTasksByTime = computed(() => {
  const allTasks = props.tasks || []
  if (currentTimeFilter.value === 'all') {
    return allTasks
  }
  return taskStore.filterTasksByCategory(allTasks, currentTimeFilter.value)
})

// 按 list 分组任务
const groupedTasks = computed(() => {
  const allTasks = filteredTasksByTime.value
  // console.log("allTasks:", JSON.stringify(allTasks)) 
  if (!allTasks || allTasks.length === 0) {
    return []
  }

  // 创建分组对象
  const groups = {}

  allTasks.forEach(task => {
    const listId = task.listId || task.list_id || 0
    const list = taskStore.getListById(listId)
    const listName = list ? list.name : '未知清单'
    const listIcon = list ? list.icon : 'list'
    const listColor = list ? list.color : '#007AFF'

    if (!groups[listId]) {
      groups[listId] = {
        id: listId,
        name: listName,
        icon: listIcon,
        color: listColor,
        tasks: []
      }
    }

    groups[listId].tasks.push(task)
  })

  // 转换为数组并排序
  return Object.values(groups).sort((a, b) => {
    // 默认清单排在最前面
    if (a.id === 0) return -1
    if (b.id === 0) return 1
    return a.name.localeCompare(b.name)
  })
})

// 计算属性：是否有多个分组
const hasMultipleGroups = computed(() => groupedTasks.value.length > 1)




// 快速添加任务
const addTask = async () => {
  const content = newTaskContent.value.trim()
  if (!content) return

  try {
    // 如果选中了AI模型且启用了AI，使用AI流式生成任务列表
    if (taskStore.selectedAIModel && taskStore.isAIEnabled) {
      console.log('[FlatTaskList] 开始AI流式生成任务，输入内容:', content)
      // 保存原始输入内容
      originalTaskInput.value = content
      // 立即显示加载状态的任务预览弹窗
      previewTasks.value = []
      streamContent.value = ''
      showTaskPreview.value = true
      newTaskContent.value = ''
      if (quickAddInput.value) {
        quickAddInput.value.focus()
      }
      
      try {
        console.log('[FlatTaskList] 调用流式生成方法')
        const result = await taskStore.streamGenerateTaskList(
          content,
          (chunk) => {
            console.log('[FlatTaskList] 接收到流式数据块:', chunk)
            // 实时更新流式内容显示
            streamContent.value = chunk
          },
          (finalResult) => {
            console.log('[FlatTaskList] 流式生成完成:', finalResult)
            if (finalResult.success && finalResult.tasks) {
              console.log(`[FlatTaskList] AI成功生成了 ${finalResult.tasks.length} 个任务`)
              // 更新任务预览弹窗内容
              previewTasks.value = finalResult.tasks.map(task => ({
                ...task,
                listId: task.listId || taskStore.currentListId,
                dueDate: task.dueDate || null,
                dueTime: task.dueTime || null,
                reminderTime: task.reminderTime || null,
                metadata: task.metadata || { note: '' }
              }))
            } else {
              console.error('[FlatTaskList] AI生成任务失败:', finalResult.error)
              // AI生成失败时，关闭弹窗并回退到普通任务创建
              showTaskPreview.value = false
              newTaskContent.value = content // 恢复输入内容
              createNormalTask(content)
            }
          },
          (error) => {
            console.error('[FlatTaskList] 流式生成错误:', error)
            // 发生错误时关闭弹窗并回退到普通任务创建
            showTaskPreview.value = false
            newTaskContent.value = content // 恢复输入内容
            createNormalTask(content)
          },
          shouldSplitTask.value
        )
      } catch (error) {
        console.error('[FlatTaskList] 流式生成异常:', error)
        showTaskPreview.value = false
        newTaskContent.value = content
        await createNormalTask(content)
      }
    } else {
      // 没有选择AI模型时，创建普通任务
      await createNormalTask(content)
    }
  } catch (error) {
    console.error('添加任务失败:', error)
    // 发生错误时关闭弹窗
    showTaskPreview.value = false
    newTaskContent.value = content // 恢复输入内容
  }
}

// 创建普通任务的辅助方法
const createNormalTask = async (content) => {
  const taskData = { content }
  
  // 如果当前在清单中，添加 listId
  if (taskStore.currentListId !== null) {
    taskData.listId = taskStore.currentListId
  }
  
  await taskStore.createTask(taskData)
  newTaskContent.value = ''

  if (quickAddInput.value) {
    quickAddInput.value.focus()
  }
}



// 任务点击处理 - 发射事件给父组件
const handleTaskClick = (task) => {
  if (task.status === 'done') {
    return
  }
  emit('show-edit-panel', task)
}

// 容器点击处理 - 隐藏右侧面板
const handleContainerClick = (event) => {
  // 如果点击的是任务项或其子元素，不隐藏面板
  if (event.target.closest('.flat-task-item')) {
    return
  }
  emit('hide-edit-panel')
}

// 快捷键处理
const handleKeydown = (event) => {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey

  if (isCtrlOrCmd && event.key === 'n') {
    event.preventDefault()
    focusAddTaskInput()
  }

  if (isCtrlOrCmd && event.key === 'e' && hasMultipleGroups.value && !isInListView.value) {
    event.preventDefault()
    expandAllGroups()
  }

  if (isCtrlOrCmd && event.shiftKey && event.key === 'E' && hasMultipleGroups.value && !isInListView.value) {
    event.preventDefault()
    collapseAllGroups()
  }
}

// 聚焦到添加任务输入框
const focusAddTaskInput = () => {
  if (quickAddInput.value) {
    quickAddInput.value.focus()
  }
}

// AI 相关方法
const toggleAI = () => {
  if (taskStore.isAIEnabled) {
    // 如果AI已启用，点击切换下拉列表显示状态
    showAIDropdown.value = !showAIDropdown.value
  } else {
    // 如果AI未启用，启用AI并显示下拉列表
    taskStore.toggleAI()
    showAIDropdown.value = true
  }
}

const selectAIModel = (model) => {
  taskStore.selectAIModel(model)
  showAIDropdown.value = false
}

const handleClickOutside = (event) => {
  if (aiButton.value && aiButton.value.contains(event.target)) {
    return
  }
  if (aiDropdown.value && !aiDropdown.value.contains(event.target)) {
    showAIDropdown.value = false
  }
}

// 获取快捷键文本
const getShortcutText = (type = 'add') => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'Cmd' : 'Ctrl'

  switch (type) {
    case 'add':
      return `${cmdKey}+N`
    case 'expand':
      return `${cmdKey}+E`
    case 'collapse':
      return `${cmdKey}+Shift+E`
    default:
      return `${cmdKey}+N`
  }
}

// 切换清单组折叠状态
const toggleGroupCollapse = (groupId) => {
  if (isInListView.value) {
    return
  }

  if (collapsedGroups.value.has(groupId)) {
    collapsedGroups.value.delete(groupId)
  } else {
    collapsedGroups.value.add(groupId)
  }

  collapsedGroups.value = new Set(collapsedGroups.value)
  saveCollapsedState()
}

// 全部展开
const expandAllGroups = () => {
  collapsedGroups.value.clear()
  saveCollapsedState()
}

// 全部折叠
const collapseAllGroups = () => {
  const allGroupIds = groupedTasks.value.map(group => group.id)
  collapsedGroups.value = new Set(allGroupIds)
  saveCollapsedState()
}

// ===== 多选操作方法 =====

// 切换单个任务的选中状态
const toggleTaskSelection = (taskId) => {
  const newSet = new Set(selectedTaskIds.value)
  if (newSet.has(taskId)) {
    newSet.delete(taskId)
  } else {
    newSet.add(taskId)
  }
  selectedTaskIds.value = newSet
}

// 检查某个分组是否全选
const isGroupAllSelected = (group) => {
  if (!group.tasks || group.tasks.length === 0) return false
  return group.tasks.every(task => selectedTaskIds.value.has(task.id))
}

// 获取分组中已选中的任务数量
const getGroupSelectedCount = (group) => {
  if (!group.tasks) return 0
  return group.tasks.filter(task => selectedTaskIds.value.has(task.id)).length
}

// 切换某个分组的全选状态
const toggleSelectAll = (group) => {
  const newSet = new Set(selectedTaskIds.value)
  const allSelected = isGroupAllSelected(group)
  
  group.tasks.forEach(task => {
    if (allSelected) {
      newSet.delete(task.id)
    } else {
      newSet.add(task.id)
    }
  })
  
  selectedTaskIds.value = newSet
}

// 批量删除选中的任务
const deleteSelectedTasks = async () => {
  const count = selectedTaskIds.value.size
  if (count === 0) return
  
  if (!confirm(`确定要删除选中的 ${count} 个任务吗？此操作不可撤销。`)) {
    return
  }
  
  try {
    const taskIdsToDelete = Array.from(selectedTaskIds.value)
    
    // 逐个删除任务
    for (const taskId of taskIdsToDelete) {
      await taskStore.deleteTask(taskId)
    }
    
    // 清空选中状态
    selectedTaskIds.value = new Set()
    
    console.log(`成功删除 ${count} 个任务`)
  } catch (error) {
    console.error('批量删除任务失败:', error)
  }
}

// 清除所有选中
const clearSelection = () => {
  selectedTaskIds.value = new Set()
}

// 监听分类变化，切换分类时清除选中状态
watch(() => currentCategory.value, () => {
  clearSelection()
})

// 启动时间更新定时器
const startTimeUpdateTimer = () => {
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
  }

  timeUpdateTimer = setInterval(() => {
    const hasDoingTasks = props.tasks.some(task => task.status === 'doing')
    if (hasDoingTasks) {
      timeUpdateTrigger.value++
    }
  }, 1000)
}

// 停止时间更新定时器
const stopTimeUpdateTimer = () => {
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
    timeUpdateTimer = null
  }
}

// TaskPreviewModal 相关方法
const closeTaskPreview = () => {
  showTaskPreview.value = false
  previewTasks.value = []
  originalTaskInput.value = ''
  streamContent.value = ''
}

const handleTasksCreated = (result) => {
  if (result.success) {
    console.log('任务创建成功:', result.message)
    // 刷新任务列表
    taskStore.getAllTasks()
  } else {
    console.error('任务创建失败:', result.message)
  }
}

// 组件挂载时启动定时器
onMounted(async () => {
  if (taskStore.lists.length === 0) {
    await taskStore.getAllLists()
  }

  loadCollapsedState()
  startTimeUpdateTimer()
  await taskStore.loadAIModels()
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('click', handleClickOutside)
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopTimeUpdateTimer()
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleClickOutside)
})


</script>

<style>
@import '@/assets/styles/components/flat-task-list.css';
</style>