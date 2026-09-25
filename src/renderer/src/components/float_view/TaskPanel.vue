<template>
  <div class="task-panel-container" @mouseenter="handlePanelMouseEnter" @mouseleave="handlePanelMouseLeave">
    <!-- 面板头部 - 固定时可拖动 -->
    <div class="task-panel-header" :class="{ 'draggable': isPinned }" @mousedown="handleHeaderMouseDown">
      <!-- 分类下拉 -->
      <Popover v-model:open="showDropdown" align="start" content-class="p-1 w-44">
        <template #trigger>
          <div class="task-panel-dropdown-trigger" role="button" tabindex="0"
            :aria-label="$t('floatView.selectCategory')">
            <component :is="getCategoryIcon(selectedCategory)" class="category-icon" />
            <span class="category-label">{{ getCategoryLabel(selectedCategory) }}</span>
            <span class="task-panel-count">{{ taskCount }}</span>
            <svg class="dropdown-arrow" :class="{ 'open': showDropdown }" width="12" height="12" viewBox="0 0 24 24"
              fill="none">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </div>
        </template>
        <div class="task-panel-dropdown-menu">
          <div v-for="category in categoryOptions" :key="category.value" class="dropdown-item" role="option"
            :class="{ 'active': selectedCategory === category.value }"
            @click.stop="selectCategory(category.value)">
            <component :is="category.icon" class="dropdown-item-icon" />
            <span>{{ category.label }}</span>
            <span class="dropdown-item-count">{{ getCategoryCount(category.value) }}</span>
          </div>
        </div>
      </Popover>

      <!-- 清单过滤下拉 -->
      <Popover v-model:open="showListDropdown" align="end" content-class="p-1 w-40">
        <template #trigger>
          <div class="task-panel-list-trigger" role="button" tabindex="0"
            :aria-label="$t('floatView.allLists')">
            <ListIcon v-if="selectedListId !== null" :name="selectedListIconName" class="h-icon-sm w-icon-sm"
              :style="getListColorStyle(selectedListColor)" />
            <Layers v-else class="h-icon-sm w-icon-sm" :style="getListColorStyle(selectedListColor)"
              aria-hidden="true" />
            <svg class="dropdown-arrow" :class="{ 'open': showListDropdown }" width="12" height="12" viewBox="0 0 24 24"
              fill="none">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </div>
        </template>
        <div class="task-panel-dropdown-menu list-dropdown-menu">
          <div class="dropdown-item" :class="{ 'active': selectedListId === null }" @click.stop="selectList(null)">
            <Layers class="h-icon-sm w-icon-sm dropdown-item-icon dropdown-item-icon-muted" aria-hidden="true" />
            <span>{{ $t('floatView.allLists') }}</span>
            <span class="dropdown-item-count">{{ getAllListsTaskCount() }}</span>
          </div>
          <div v-for="list in sortedLists" :key="list.id" class="dropdown-item"
            :class="{ 'active': selectedListId === list.id }" @click.stop="selectList(list.id)">
            <ListIcon :name="list.icon" class="h-icon-sm w-icon-sm dropdown-item-icon"
              :style="getListColorStyle(list.color)" />
            <span>{{ list.name }}</span>
            <span class="dropdown-item-count">{{ getListTaskCount(list.id) }}</span>
          </div>
        </div>
      </Popover>

      <!-- 固定按钮 -->
      <button :class="['task-panel-pin-btn', { 'pinned': isPinned }]" @click.stop="togglePin"
        :title="isPinned ? $t('floatView.unpinPanel') : $t('floatView.pinPanel')">
        <svg v-if="isPinned" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" fill="currentColor" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" stroke="currentColor" stroke-width="1.5"
            fill="none" />
        </svg>
      </button>
    </div>

    <!-- 快速添加（Things Quick Entry 式：支持「明天下午3点」自然语言解析，chip 预览） -->
    <div class="task-panel-quick-add">
      <div class="task-panel-input-wrapper">
        <input v-model="newTaskContent" type="text" class="task-panel-input" :placeholder="$t('floatView.addNewTask')"
          maxlength="200" @keypress.enter="addTask" ref="quickAddInput"
          @focus="handleInputFocus" @blur="handleInputBlur"
          @compositionstart="handleCompositionStart" @compositionend="handleCompositionEnd">
        <button class="task-panel-add-btn" :class="{ 'active': newTaskContent.trim() }" @click="addTask"
          :title="$t('floatView.addTask')">
          <Plus class="h-icon-sm w-icon-sm" aria-hidden="true" />
        </button>
      </div>
      <div class="quick-entry-chip-row">
        <button v-if="parsedDateChip" type="button" class="quick-entry-chip" @click="suppressParsedDate"
          :title="$t('floatView.removeDateChip')">
          <CalendarDays class="h-3 w-3" aria-hidden="true" />
          <span>{{ parsedDateChip }}</span>
          <X class="h-2.5 w-2.5 quick-entry-chip-remove" aria-hidden="true" />
        </button>
        <!-- 清单筛选 chip（与头部筛选同一状态）：筛选当前视图，同时决定新任务归属 -->
        <Popover v-model:open="showAddListDropdown" align="start" content-class="p-1 w-44">
          <template #trigger>
            <button type="button" class="quick-entry-chip quick-entry-chip-muted"
              :title="$t('floatView.listFilterTitle')">
              <Layers v-if="selectedListId === null" class="h-3 w-3" aria-hidden="true" />
              <ListIcon v-else :name="quickAddTargetList?.icon || ''" class="h-3 w-3"
                :style="getListColorStyle(quickAddTargetList?.color)" />
              <span>{{ quickAddListName }}</span>
              <svg class="dropdown-arrow" :class="{ 'open': showAddListDropdown }" width="10" height="10"
                viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
          </template>
          <div class="task-panel-dropdown-menu">
            <div class="dropdown-item" :class="{ 'active': selectedListId === null }"
              @click.stop="selectList(null)">
              <Layers class="h-3.5 w-3.5 dropdown-item-icon dropdown-item-icon-muted" aria-hidden="true" />
              <span>{{ $t('floatView.allLists') }}</span>
              <span class="dropdown-item-count">{{ getAllListsTaskCount() }}</span>
            </div>
            <div v-for="list in sortedLists" :key="list.id" class="dropdown-item"
              :class="{ 'active': selectedListId === list.id }" @click.stop="selectList(list.id)">
              <ListIcon :name="list.icon" class="h-icon-sm w-icon-sm dropdown-item-icon"
                :style="getListColorStyle(list.color)" />
              <span>{{ list.name }}</span>
              <span class="dropdown-item-count">{{ getListTaskCount(list.id) }}</span>
            </div>
          </div>
        </Popover>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="task-panel-list-container">
      <template v-if="tasks.length > 0">
        <section v-for="section in taskSections" :key="section.key" class="task-panel-section">
          <div v-if="section.label" class="task-panel-section-header">
            <span>{{ section.label }}</span>
            <span class="section-count">{{ section.tasks.length }}</span>
          </div>
          <div class="task-panel-list">
            <div v-for="task in section.tasks" :key="task.id" :class="[
              'task-panel-card',
              `status-${task.status || (task.completed ? 'done' : 'todo')}`,
              {
                'overtime': (task.status || (task.completed ? 'done' : 'todo')) === 'doing' && task.reminderTime && isReminderOverdue(task.reminderTime)
              }
            ]" :data-task-id="task.id" :data-status="task.status || (task.completed ? 'done' : 'todo')"
              @contextmenu="showTaskContextMenu($event, task)">

              <!-- 主行：状态指示 + 内容 + 悬浮动作 -->
              <div class="task-card-main">
                <!-- 状态指示（纯展示，不可点击；动作在右侧 hover 按钮） -->
                <span v-if="!isTrashView" class="task-status-indicator">
                  <TaskStatusCircle :status="statusOf(task)" />
                </span>

                <!-- 任务内容文本（单击原位编辑，Things 式） -->
                <div class="task-card-text-wrapper">
                  <div v-if="!isEditing(task.id)" class="task-card-text"
                    :class="{ 'completed': statusOf(task) === 'done' }"
                    @click="startEditTask(task.id)" :title="$t('floatView.clickToEdit')">
                    {{ task.content }}
                  </div>
                  <input v-else v-model="editingContent" class="task-card-edit-input"
                    @keydown.enter="saveTaskEdit(task.id)" @keydown.esc="cancelTaskEdit" @blur="saveTaskEdit(task.id)"
                    ref="editInput" />
                </div>

                <!-- 悬浮动作按钮：图标即点击后的动作（开始/暂停/继续/完成/重做） -->
                <div v-if="!isTrashView" class="task-card-actions">
                  <button v-if="statusOf(task) === 'todo'" class="task-action-btn" @click="startTaskAction(task.id)"
                    :title="$t('floatView.startTask')">
                    <Play class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button v-else-if="statusOf(task) === 'doing'" class="task-action-btn"
                    @click="pauseTask(task.id)" :title="$t('floatView.pauseTask')">
                    <Pause class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button v-else-if="statusOf(task) === 'paused'" class="task-action-btn"
                    @click="startTaskAction(task.id)" :title="$t('floatView.resumeTask')">
                    <Play class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button v-if="statusOf(task) !== 'done'" class="task-action-btn"
                    @click="completeTaskAction(task.id)" :title="$t('floatView.completeTask')">
                    <CircleCheck class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button v-if="statusOf(task) === 'done'" class="task-action-btn"
                    @click="redoTaskAction(task.id)" :title="$t('floatView.redoTask')">
                    <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <!-- 垃圾桶视图：恢复 / 彻底删除 -->
                <div v-else class="task-card-actions">
                  <button class="task-action-btn restore" @click="restoreTaskFromTrash(task.id)"
                    :title="$t('floatView.restore')">
                    <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button class="task-action-btn delete" @click="requestPurge(task)" :title="$t('floatView.purge')">
                    <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <!-- 元信息行（占满宽度） -->
              <div class="task-card-meta">
                <!-- 安排/截止 chip（点击弹 When 气泡，Things 式就地改期） -->
                <TaskWhenBubble v-if="statusOf(task) !== 'done' && !isTrashView" :task="task" align="start"
                  @open-change="(value) => trackWhenOpen(task.id, value)" @updated="loadTasks" />

                <!-- 提醒：小闹钟图标 + 悬浮说明；点击弹 When 式气泡（预设/自定义/清除） -->
                <TaskReminderBubble v-if="statusOf(task) !== 'done' && !isTrashView" :task="task" align="start"
                  @open-change="(value) => trackReminderOpen(task.id, value)" @updated="loadTasks" />

                <!-- 进行中状态标签 -->
                <div v-if="statusOf(task) === 'doing'" class="task-meta-tag doing">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                      fill="currentColor" />
                  </svg>
                  <span>{{ formatDurationCompact(getTaskTotalDuration(task)) }}</span>
                </div>

                <!-- 子任务指示器 -->
                <div v-if="task.metadata?.steps?.length > 0" class="task-meta-tag subtasks">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"
                      fill="currentColor" />
                  </svg>
                  <span>{{task.metadata.steps.filter(s => s.status === 'done').length}}/{{ task.metadata.steps.length
                  }}</span>
                </div>
              </div>

              <!-- 子任务列表 -->
              <div v-if="getIncompleteSteps(task).length > 0" class="task-card-subtasks">
                <div v-for="step in getIncompleteSteps(task)" :key="step.id" class="subtask-item">
                  <div class="subtask-checkbox" @click.stop="toggleStepStatus(task.id, step)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                    </svg>
                  </div>
                  <span class="subtask-text">{{ step.content }}</span>
                </div>
              </div>

              <!-- 面板内添加步骤（hover / focus 时显现） -->
              <div v-if="statusOf(task) !== 'done' && !isTrashView" class="task-add-step">
                <Plus class="h-3 w-3" aria-hidden="true" />
                <input v-model="stepDrafts[task.id]" class="task-add-step-input" :placeholder="$t('tasks.addStep')"
                  maxlength="200" @keypress.enter="addStep(task)" @click.stop>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- 空状态 -->
      <div v-else class="task-panel-empty">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              fill="currentColor" />
          </svg>
        </div>
        <template v-if="isTrashView">
          <h3 class="empty-title">{{ $t('floatView.trash') }}</h3>
          <p class="empty-text">{{ $t('floatView.trashEmpty') }}</p>
        </template>
        <template v-else>
          <h3 class="empty-title">{{ $t('floatView.excellent') }}</h3>
          <p class="empty-text">{{ $t('floatView.allTasksCompleted') }}</p>
        </template>
      </div>
    </div>

    <!-- 垃圾桶：彻底删除确认（不可恢复，统一 AlertDialog） -->
    <AlertDialog :open="purgeConfirm.open" :title="$t('floatView.purgeTitle')"
      :description="$t('floatView.purgeConfirm', { content: purgeConfirm.target ? purgeConfirm.target.content : '' })"
      :confirm-label="$t('floatView.purge')" :cancel-label="$t('floatView.cancel')" confirm-variant="destructive"
      :loading="purgeConfirm.loading" @update:open="(value) => { if (!value) closePurgeConfirm() }"
      @confirm="confirmPurge" />

    <!-- 面板底部 -->
    <div class="task-panel-footer">
      <span class="footer-stats" @click="openTaskManager">{{ footerStats }}</span>
      <span class="footer-link" @click="openTaskManager">→</span>
    </div>

    <!-- 右键菜单 -->
    <div v-if="showContextMenu" class="task-context-menu" :style="contextMenuStyle" @click.stop>
      <div class="context-menu-item" @click="createFloatingTask">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="currentColor" />
        </svg>
        {{ $t('floatView.createFloatingTask') }}
      </div>
      <div class="context-menu-item context-menu-item-delete" @click="deleteTaskFromMenu">
        <Trash2 class="h-3 w-3" aria-hidden="true" />
        {{ $t('floatView.deleteTask') }}
      </div>
    </div>

    <!-- 遮罩层 -->
    <div v-if="showContextMenu" class="context-menu-overlay" @click="hideContextMenu"></div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, h, watch } from 'vue'
import { CalendarDays, CircleCheck, Layers, Pause, Play, Plus, RotateCcw, Trash2, X } from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { parseQuickEntry } from '@/utils/quick-entry-parse'
import { isTaskInbox } from '@/utils/task-time-rules'
import { isReminderOverdue } from '@/utils/task-utils'
import { dayLabel, formatTimeHM } from '@/utils/when-labels'
import ListIcon from '../ui/ListIcon.vue'
import AlertDialog from '../ui/alert-dialog/AlertDialog.vue'
import Popover from '../ui/popover/Popover.vue'
import TaskStatusCircle from '../task/TaskStatusCircle.vue'
import TaskWhenBubble from '../task/TaskWhenBubble.vue'
import TaskReminderBubble from '../task/TaskReminderBubble.vue'

const taskStore = useTaskStore()
const { customReminderOptions } = storeToRefs(taskStore)
const { t: $t, locale } = useI18n()

// 响应式数据
const tasks = ref([])
const newTaskContent = ref('')
const currentEditingTask = ref(null)
const editingContent = ref('')
const completedTasksCount = ref(0)
const isPinned = ref(false)
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// 输入状态：用于抑制打字过程中的自动隐藏（issue #10）
const isInputFocused = ref(false)
const isComposing = ref(false)
const isMouseOverPanel = ref(false)

// 下拉选择器相关（开合由 ui Popover 管理）
const showDropdown = ref(false)
const selectedCategory = ref('today')

// 清单下拉选择器相关
const showListDropdown = ref(false)
const selectedListId = ref(null)

// 快速录入日期 chip：手动移除后，再次输入前不再应用解析结果
const parsedDateSuppressed = ref(false)

// 清单筛选 chip（与头部清单下拉共用 selectedListId）
const showAddListDropdown = ref(false)

// When 气泡（行上就地改期）：开合状态由共享组件自管，面板只跟踪用于抑制自动隐藏
const whenMenuTaskId = ref(null)

// 提醒气泡（与 When 气泡同一交互模式）
const reminderMenuTaskId = ref(null)

const trackWhenOpen = (taskId, open) => {
  if (open) {
    whenMenuTaskId.value = taskId
  } else if (whenMenuTaskId.value === taskId) {
    whenMenuTaskId.value = null
  }
}

const trackReminderOpen = (taskId, open) => {
  if (open) {
    reminderMenuTaskId.value = taskId
  } else if (reminderMenuTaskId.value === taskId) {
    reminderMenuTaskId.value = null
  }
}

// 垃圾桶视图 + 彻底删除确认
const isTrashView = computed(() => selectedCategory.value === 'trash')
const purgeConfirm = reactive({ open: false, target: null, loading: false })

// 面板内添加步骤的草稿（按任务 id 存放）
const stepDrafts = reactive({})

// 右键菜单相关
const showContextMenu = ref(false)
const contextMenuStyle = ref({})
const selectedTask = ref(null)

// 分类选项配置
const categoryOptions = computed(() => [
  { value: 'today', label: $t('categories.today'), icon: CalendarDayIcon },
  { value: 'planned', label: $t('categories.planned'), icon: CalendarWeekIcon },
  { value: 'doing', label: $t('categories.doing'), icon: PlayCircleIcon },
  { value: 'paused', label: $t('categories.paused'), icon: PauseCircleIcon },
  { value: 'all', label: $t('categories.all'), icon: AllTasksIcon },
  { value: 'inbox', label: $t('categories.inbox'), icon: InboxIcon },
  { value: 'completed', label: $t('categories.completed'), icon: CheckCircleIcon },
  { value: 'trash', label: $t('floatView.trash'), icon: TrashIcon }
])

// 图标组件
const CalendarDayIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z', fill: 'currentColor' })
])

const CalendarWeekIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7v-5z', fill: 'currentColor' })
])

const PlayCircleIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z', fill: 'currentColor' })
])

const PauseCircleIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z', fill: 'currentColor' })
])

const AllTasksIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z', fill: 'currentColor' })
])

const InboxIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2H19v3zm0-5h-4.99c0 1.1-.9 2-2 2s-2-.9-2-2H5V5h14v9z', fill: 'currentColor' })
])

const CheckCircleIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z', fill: 'currentColor' })
])

const TrashIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
  h('path', { d: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
])

// 引用
const quickAddInput = ref(null)
const editInput = ref(null)

// 计算属性
const taskCount = computed(() => tasks.value.length)

// 快速录入解析：日期 chip 预览
const parsedEntry = computed(() => parseQuickEntry(newTaskContent.value))

const parsedDateChip = computed(() => {
  if (!parsedEntry.value.date || parsedDateSuppressed.value) return ''
  return formatParsedDate(parsedEntry.value.date, parsedEntry.value.hasTime)
})

watch(newTaskContent, () => {
  parsedDateSuppressed.value = false
})

const suppressParsedDate = () => {
  parsedDateSuppressed.value = true
}

// 行状态简写
const statusOf = (task) => task.status || (task.completed ? 'done' : 'todo')

// chip 上的日期文案：日期词 + 非零点时刻（dayLabel/formatTimeHM 来自共享工具 when-labels）
const formatParsedDate = (date, hasTime) => {
  let label = dayLabel(date, $t, locale.value)
  if (hasTime) label += formatTimeHM(date)
  return label
}

// 任务行 When chip 内容由共享组件 TaskWhenBubble 计算（安排优先，其次截止（逾期红），否则未安排占位）

// 面板内添加步骤
const addStep = async (task) => {
  const content = (stepDrafts[task.id] || '').trim()
  if (!content) return
  try {
    await taskStore.addTaskStep(task.id, content)
    stepDrafts[task.id] = ''
    await loadTasks()
  } catch (error) {
    console.error('添加步骤失败:', error)
  }
}

// 悬浮窗「今天」= 已安排今天的任务 + 未安排的收件箱任务。
// 快速添加默认不设置日期，若只按主窗口的 isTaskToday 规则过滤，
// 新建任务会落进收件箱而在当前视图里不可见（创建即找不到）。
// 这里只放宽悬浮窗的展示：未安排任务以独立分组跟在「今天」之后。
const taskSections = computed(() => {
  if (selectedCategory.value !== 'today') {
    return [{ key: 'list', label: '', tasks: tasks.value }]
  }
  const todays = tasks.value.filter(task => !isTaskInbox(task))
  const unscheduled = tasks.value.filter(task => isTaskInbox(task))
  const sections = []
  if (todays.length > 0) sections.push({ key: 'today', label: $t('categories.today'), tasks: todays })
  if (unscheduled.length > 0) sections.push({ key: 'unscheduled', label: $t('floatView.unscheduledSection'), tasks: unscheduled })
  return sections
})

const footerStats = computed(() => {
  if (isTrashView.value) {
    return $t('floatView.trashStats', { count: taskCount.value })
  }
  const totalCount = taskCount.value + completedTasksCount.value
  if (totalCount === 0) {
    return $t('floatView.noTasks')
  }
  return $t('floatView.taskStats', { total: totalCount, completed: completedTasksCount.value })
})

// 方法
const loadTasks = async () => {
  try {
    // 确保任务数据和清单数据已加载
    await taskStore.getAllTasks()
    await taskStore.getAllLists()
    // 垃圾桶计数与视图需要已删除任务列表
    await taskStore.loadDeletedTasks()

    // 使用选中的清单过滤任务
    const listId = selectedListId.value

    if (selectedCategory.value === 'trash') {
      // 垃圾桶视图：仅展示软删除任务（IPC 已按删除时间倒序）
      tasks.value = [...taskStore.deletedTasks]
      completedTasksCount.value = 0
      return
    }

    // 对于 completed 分类，显示已完成任务；其他分类不显示已完成任务
    const includeCompleted = selectedCategory.value === 'completed'

    if (selectedCategory.value === 'today') {
      // 悬浮窗今天视图：合并未安排任务（见 taskSections 说明）
      const todays = taskStore.getSortedTasks('today', listId, includeCompleted)
      const unscheduled = taskStore.getSortedTasks('inbox', listId, null)
      tasks.value = [...todays, ...unscheduled]
    } else {
      tasks.value = taskStore.getSortedTasks(selectedCategory.value, listId, includeCompleted)
    }

    // 获取已完成任务的计数
    const stats = taskStore.getCategoryStats(selectedCategory.value, listId)
    completedTasksCount.value = stats.completed
  } catch (error) {
    console.error('加载任务失败:', error)
  }
}

const addTask = async () => {
  const parsed = parsedEntry.value
  const applyParsed = Boolean(parsed.date) && !parsedDateSuppressed.value
  const content = applyParsed ? parsed.content : newTaskContent.value.trim()
  if (!content) return

  try {
    // 构建任务数据：解析出日期时写入安排时间；选中清单时新任务归入该清单
    const taskData = { content }
    if (applyParsed) {
      taskData.scheduledStartAt = parsed.date.toISOString()
    }
    if (selectedListId.value !== null) {
      taskData.listId = selectedListId.value
    }

    await taskStore.createTask(taskData)
    newTaskContent.value = ''
    parsedDateSuppressed.value = false

    // 重新加载任务列表以显示新添加的任务
    await loadTasks()

    if (quickAddInput.value) {
      quickAddInput.value.focus()
    }
  } catch (error) {
    console.error('添加任务失败:', error)
  }
}

// 状态动作：图标即动作（开始/暂停/继续/完成/重做），状态圆圈只做展示
const startTaskAction = async (taskId) => {
  try {
    await taskStore.startTask(taskId)
    await loadTasks()
    startUpdateTimer()
  } catch (error) {
    console.error('开始任务失败:', error)
  }
}

const completeTaskAction = async (taskId) => {
  try {
    await taskStore.completeTask(taskId)
    await loadTasks()
    startUpdateTimer()
  } catch (error) {
    console.error('完成任务失败:', error)
  }
}

const redoTaskAction = async (taskId) => {
  try {
    await taskStore.updateTask(taskId, { status: 'todo' })
    await loadTasks()
    startUpdateTimer()
  } catch (error) {
    console.error('重做任务失败:', error)
  }
}

const deleteTask = async (taskId) => {
  try {
    await taskStore.deleteTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('删除任务失败:', error)
  }
}

const pauseTask = async (taskId) => {
  try {
    await taskStore.pauseTask(taskId)
    await loadTasks()
    // 重新启动定时器以调整更新频率
    startUpdateTimer()
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const isEditing = (taskId) => {
  return currentEditingTask.value === taskId
}

const startEditTask = (taskId) => {
  if (isTrashView.value) return
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  currentEditingTask.value = taskId
  editingContent.value = task.content

  nextTick(() => {
    if (editInput.value && editInput.value[0]) {
      editInput.value[0].focus()
      editInput.value[0].select()
    }
  })
}

const saveTaskEdit = async (taskId) => {
  const newContent = editingContent.value.trim()
  if (!newContent) {
    cancelTaskEdit()
    return
  }

  try {
    await taskStore.updateTask(taskId, { content: newContent })
    currentEditingTask.value = null
    editingContent.value = ''
    await loadTasks()
  } catch (error) {
    console.error('更新任务失败:', error)
    cancelTaskEdit()
  }
}

const cancelTaskEdit = () => {
  currentEditingTask.value = null
  editingContent.value = ''
}

// 垃圾桶动作
const restoreTaskFromTrash = async (taskId) => {
  try {
    await taskStore.restoreTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('恢复任务失败:', error)
  }
}

const requestPurge = (task) => {
  purgeConfirm.target = task
  purgeConfirm.open = true
}

const closePurgeConfirm = () => {
  purgeConfirm.open = false
  purgeConfirm.target = null
  purgeConfirm.loading = false
}

const confirmPurge = async () => {
  if (!purgeConfirm.target || purgeConfirm.loading) return
  purgeConfirm.loading = true
  try {
    await taskStore.purgeTask(purgeConfirm.target.id)
    await loadTasks()
    closePurgeConfirm()
  } catch (error) {
    console.error('彻底删除失败:', error)
    purgeConfirm.loading = false
  }
}

// 右键菜单删除（软删除，无确认：可在垃圾桶恢复）
const deleteTaskFromMenu = async () => {
  if (!selectedTask.value) return
  try {
    await taskStore.deleteTask(selectedTask.value.id)
    hideContextMenu()
    await loadTasks()
  } catch (error) {
    console.error('删除任务失败:', error)
  }
}

const getTaskTotalDuration = (task) => {
  let totalDuration = task.totalDuration || 0

  // 如果任务正在进行中，加上当前进行时长
  if (task.status === 'doing' && task.startedAt) {
    const currentDuration = Date.now() - new Date(task.startedAt).getTime()
    totalDuration += currentDuration
  }

  return totalDuration
}

const formatDurationCompact = (milliseconds) => {
  if (!milliseconds || milliseconds < 1000) {
    return '0s'
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // 如果超过一小时，显示小时和分钟
  if (hours > 0) {
    return `${hours}h${minutes}m`
  }
  // 如果超过一分钟但不到一小时，显示分钟和秒
  else if (minutes > 0) {
    return `${minutes}m${seconds}s`
  }
  // 如果不到一分钟，只显示秒
  else {
    return `${seconds}s`
  }
}

// 获取任务的未完成步骤
const getIncompleteSteps = (task) => {
  const steps = task.metadata?.steps || []
  return steps.filter(step => step.status !== 'done')
}

// 切换步骤状态
const toggleStepStatus = async (taskId, step) => {
  try {
    await taskStore.toggleTaskStepStatus(taskId, step.id)
    await loadTasks()
  } catch (error) {
    console.error('切换步骤状态失败:', error)
  }
}

// 分类选择
const selectCategory = (category) => {
  selectedCategory.value = category
  showDropdown.value = false
  loadTasks()
}

const getCategoryLabel = (category) => {
  const option = categoryOptions.value.find(opt => opt.value === category)
  return option ? option.label : $t('categories.unknown')
}

const getCategoryIcon = (category) => {
  const option = categoryOptions.value.find(opt => opt.value === category)
  return option ? option.icon : CalendarDayIcon
}

// 悬浮窗分类计数：与 taskSections 的展示口径一致（今天含未安排分组）
const countForCategory = (category, listId) => {
  if (category === 'trash') {
    return taskStore.deletedTasks.length
  }
  const stats = taskStore.getCategoryStats(category, listId)
  if (category === 'completed') {
    return stats.completed
  }
  let count = stats.total - stats.completed
  if (category === 'today') {
    count += taskStore.getCategoryStats('inbox', listId).incomplete
  }
  return count
}

const getCategoryCount = (category) => {
  return countForCategory(category, selectedListId.value)
}

// 清单选择
const selectList = (listId) => {
  selectedListId.value = listId
  showListDropdown.value = false
  showAddListDropdown.value = false
  loadTasks()
}

// 获取排序后的清单列表
const sortedLists = computed(() => {
  return taskStore.sortedLists
})

// 清单 chip 文案：null = 全部清单（新建落默认清单 listId 0），否则为所选清单
const quickAddTargetList = computed(() => {
  if (selectedListId.value === null) return null
  return sortedLists.value.find(l => l.id === selectedListId.value) || null
})

const quickAddListName = computed(() => {
  if (selectedListId.value === null) return $t('floatView.allLists')
  return quickAddTargetList.value?.name || $t('floatView.defaultList')
})

// 获取选中清单的图标名称（未选择清单时由模板回退到 Layers）
const selectedListIconName = computed(() => {
  const list = sortedLists.value.find(l => l.id === selectedListId.value)
  return list?.icon || ''
})

// 获取选中清单的颜色
const selectedListColor = computed(() => {
  if (selectedListId.value === null) {
    return null // 使用 CSS 默认颜色
  }
  const list = sortedLists.value.find(l => l.id === selectedListId.value)
  return list?.color || null // 使用 CSS 默认颜色
})

// 获取清单颜色样式（处理暗色模式兼容）
const getListColorStyle = (color) => {
  if (!color) return {}
  return { color }
}

// 获取清单任务数量
const getListTaskCount = (listId) => {
  return countForCategory(selectedCategory.value, listId)
}

// 获取所有清单的任务数量
const getAllListsTaskCount = () => {
  return countForCategory(selectedCategory.value, null)
}

// 打开任务管理页面
const openTaskManager = async () => {
  try {
    await window.electronAPI.windows.showTaskManager()
  } catch (error) {
    console.error('打开任务管理窗口失败:', error)
  }
}

// 右键菜单相关方法
const showTaskContextMenu = (event, task) => {
  event.preventDefault()
  if (isTrashView.value) return
  selectedTask.value = task

  // 紧凑面板内按窗口可用尺寸夹取菜单位置，避免溢出被裁切
  const menuWidth = 180
  const menuHeight = 84
  let left = event.clientX
  let top = event.clientY
  if (left + menuWidth > window.innerWidth) {
    left = Math.max(4, window.innerWidth - menuWidth - 8)
  }
  if (top + menuHeight > window.innerHeight) {
    top = Math.max(4, window.innerHeight - menuHeight - 8)
  }

  contextMenuStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 1000
  }

  showContextMenu.value = true
}

const hideContextMenu = () => {
  showContextMenu.value = false
  selectedTask.value = null
}

const createFloatingTask = async () => {
  if (!selectedTask.value) return

  try {
    await window.electronAPI.windows.createFloatingTask(selectedTask.value.id)
    hideContextMenu()
  } catch (error) {
    console.error('创建悬浮任务失败:', error)
  }
}

// 面板鼠标事件处理
// 用户正在输入时不允许自动隐藏面板。
// 输入法候选框是一层原生窗口，盖住光标时 Chromium 会真的抛出 mouseleave，
// 导致面板在打字过程中被收起（issue #10）。
// 只看焦点/组词状态：内容非空不作为条件，否则输入框留了字就再也不会自动收起了。
// 输入内容本身由主进程 hide()（而非 close()）保住，不会丢。
const isInputActive = () => isInputFocused.value || isComposing.value

const handleInputFocus = () => {
  isInputFocused.value = true
}

const handleInputBlur = () => {
  isInputFocused.value = false
  // 失焦后如果鼠标其实已经不在面板上了，补发一次离开事件
  if (!isMouseOverPanel.value && !isInputActive()) {
    handlePanelMouseLeave()
  }
}

const handleCompositionStart = () => {
  isComposing.value = true
}

const handleCompositionEnd = () => {
  isComposing.value = false
}

const handlePanelMouseEnter = () => {
  isMouseOverPanel.value = true

  // 如果已固定，不需要发送鼠标事件
  if (isPinned.value) return

  try {
    window.electronAPI.windows.panelMouseEnter()
  } catch (error) {
    console.error('发送面板鼠标进入事件失败:', error)
  }
}

const handlePanelMouseLeave = () => {
  isMouseOverPanel.value = false

  // 如果已固定，不需要发送鼠标事件
  if (isPinned.value) return

  // 正在输入（含输入法组词）或交互浮层打开时不隐藏
  if (isInputActive() || showContextMenu.value || showDropdown.value || showListDropdown.value
    || showAddListDropdown.value || whenMenuTaskId.value !== null || reminderMenuTaskId.value !== null) {
    return
  }

  try {
    window.electronAPI.windows.panelMouseLeave()
  } catch (error) {
    console.error('发送面板鼠标离开事件失败:', error)
  }
}

// 固定/取消固定面板
const togglePin = async () => {
  try {
    const newPinned = !isPinned.value
    isPinned.value = newPinned
    await window.electronAPI.windows.setPanelPinned(newPinned)

    // 如果取消固定，直接隐藏面板
    if (!newPinned) {
      await window.electronAPI.windows.hideTaskPanel()
    }
  } catch (error) {
    console.error('切换固定状态失败:', error)
    // 回滚状态
    isPinned.value = !isPinned.value
  }
}

// 头部拖动处理
const handleHeaderMouseDown = (event) => {
  // 只有固定状态才能拖动
  if (!isPinned.value) return
  // 只处理左键
  if (event.button !== 0) return
  // 点击操作控件（含下拉触发器）时不进入拖动
  if (event.target.closest('button') || event.target.closest('.task-panel-dropdown-trigger, .task-panel-list-trigger')) return

  let hasMoved = false
  let initialWindowPos = null
  let lastIpcTime = 0
  let pendingUpdate = false
  const ipcThrottle = 40 // IPC调用节流

  isDragging.value = true
  dragStartPos.value = { x: event.screenX, y: event.screenY }

  // 获取当前窗口位置
  window.electronAPI.drag.getWindowPosition().then(pos => {
    initialWindowPos = pos
  }).catch(error => {
    console.error('获取窗口位置失败:', error)
  })

  const handleMouseMove = (moveEvent) => {
    if (!isDragging.value) return
    if (!initialWindowPos) return

    const deltaX = moveEvent.screenX - dragStartPos.value.x
    const deltaY = moveEvent.screenY - dragStartPos.value.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance > 5) {
      if (!hasMoved) {
        hasMoved = true
      }

      // 节流的IPC调用
      const now = Date.now()
      if (now - lastIpcTime >= ipcThrottle && !pendingUpdate) {
        lastIpcTime = now
        pendingUpdate = true

        const newPosition = {
          x: initialWindowPos.x + deltaX,
          y: initialWindowPos.y + deltaY
        }

        window.electronAPI.drag.dragWindow(newPosition)
          .then(() => {
            pendingUpdate = false
          })
          .catch((error) => {
            console.error('窗口位置更新失败:', error)
            pendingUpdate = false
          })
      }
    }
  }

  const handleMouseUp = async (upEvent) => {
    if (!isDragging.value) return

    isDragging.value = false

    if (hasMoved && initialWindowPos) {
      const finalDeltaX = upEvent.screenX - dragStartPos.value.x
      const finalDeltaY = upEvent.screenY - dragStartPos.value.y
      const finalPosition = {
        x: initialWindowPos.x + finalDeltaX,
        y: initialWindowPos.y + finalDeltaY
      }

      try {
        await window.electronAPI.drag.dragWindow(finalPosition)
        await window.electronAPI.drag.endDrag()
      } catch (error) {
        console.error('最终位置同步失败:', error)
      }
    }

    hasMoved = false
    initialWindowPos = null
    pendingUpdate = false

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)

  event.preventDefault()
}

// 监听任务更新事件
const handleTasksUpdated = () => {
  loadTasks()
}

// 检查是否有进行中的任务在一小时内
const hasRecentDoingTasks = () => {
  return tasks.value.some(task => {
    if (task.status !== 'doing' || !task.startedAt) return false
    const currentDuration = Date.now() - new Date(task.startedAt).getTime()
    return currentDuration < 60 * 60 * 1000 // 一小时内
  })
}

// 定时器引用
let updateTimer = null

// 启动定时器更新进行中任务的时长显示
const startUpdateTimer = () => {
  if (updateTimer) {
    clearInterval(updateTimer)
  }

  const updateDisplay = () => {
    // 强制更新进行中任务的时长显示
    tasks.value = [...tasks.value]

    // 重新设置定时器间隔
    const interval = hasRecentDoingTasks() ? 1000 : 30000 // 一小时内每秒更新，否则每30秒更新

    if (updateTimer) {
      clearInterval(updateTimer)
    }
    updateTimer = setInterval(updateDisplay, interval)
  }

  // 初始设置
  const initialInterval = hasRecentDoingTasks() ? 1000 : 30000
  updateTimer = setInterval(updateDisplay, initialInterval)
}

const stopUpdateTimer = () => {
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = null
  }
}

// 生命周期
onMounted(async () => {
  await loadTasks()

  // 加载自定义提醒选项
  if (!customReminderOptions.value || customReminderOptions.value.length === 0) {
    await taskStore.loadCustomReminderOptions()
  }

  if (quickAddInput.value) {
    quickAddInput.value.focus()
  }

  // 监听任务更新事件
  window.electronAPI.events.on('tasks-updated', handleTasksUpdated)

  // 启动定时器
  startUpdateTimer()

  onUnmounted(() => {
    stopUpdateTimer()
    window.electronAPI.events.removeAllListeners('tasks-updated')
  })
})

// 监听清单变化，重新加载任务
watch(() => taskStore.currentListId, () => {
  loadTasks()
}, { immediate: false })
</script>

<style scoped>
@import '@/assets/styles/components/task-panel.css';
</style>
