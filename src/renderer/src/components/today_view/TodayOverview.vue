<template>
  <div class="today-overview" ref="rootEl" :class="{ 'is-narrow': isNarrow }">
    <!-- 左侧 Agenda -->
    <div class="today-overview-agenda">
      <AgendaView ref="agendaRef" :model="agendaModel" :today-key="todayKey" :selected-key="selectedDateKey"
        :search-query="searchQuery"
        :show-completed="showCompleted"
        :initial-loading="(!initialLoaded && loadingCount > 0) || (taskStore.loading && taskStore.tasks.length === 0)"
        :loading-more="loadingCount > 0" :has-error="hasLoadError" :expanded-task-key="expandedTaskKey"
        @task-click="handleEditTask" @task-collapse="handleTaskCollapse" @load-more="loadMoreFuture"
        @retry="retryFailed" @active-date-change="handleActiveDateChange"
        @delete-request="requestTaskDelete" />
    </div>

    <!-- 右侧 Future Calendar（宽屏常驻） -->
    <aside v-if="!isNarrow" class="today-overview-calendar">
      <FutureCalendar :month-window="monthWindow" :dots="calendarDots" :today-key="todayKey"
        :selected-key="selectedDateKey" @select-date="handleSelectDate" @expand-months="expandMonths"
        @back-today="handleBackToday" />
    </aside>

    <!-- 窄屏：日历开关 -->
    <IconButton
      v-if="isNarrow"
      class="today-calendar-toggle"
      :label="$t('today.calendar.toggle')"
      :aria-expanded="drawerOpen"
      ref="calendarToggleBtn"
      @click="openDrawer"
    >
      <CalendarRange class="h-icon-md w-icon-md" />
    </IconButton>

    <!-- 窄屏日历抽屉 -->
    <Teleport to="body">
      <Transition name="today-drawer">
        <div v-if="drawerOpen" class="today-calendar-drawer-backdrop" @click.self="closeDrawer">
          <div class="today-calendar-drawer" role="dialog" aria-modal="true" :aria-label="$t('today.calendar.title')"
            ref="drawerEl" @keydown.escape.stop.prevent="closeDrawer" @keydown.tab="handleDrawerTab">
            <div class="today-calendar-drawer-header">
              <span class="today-calendar-drawer-title">{{ $t('today.calendar.title') }}</span>
              <IconButton class="today-calendar-drawer-close" :label="$t('common.close')" @click="closeDrawer">
                <X class="h-icon-md w-icon-md" />
              </IconButton>
            </div>
            <FutureCalendar :month-window="monthWindow" :dots="calendarDots" :today-key="todayKey"
              :selected-key="selectedDateKey" @select-date="(key) => { handleSelectDate(key); closeDrawer() }"
              @expand-months="expandMonths" @back-today="handleBackToday" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 统一危险确认：任务行与展开态删除共用同一流程（软删除语义：可从悬浮窗垃圾桶恢复） -->
    <AlertDialog
      :open="deleteDialogOpen"
      :title="$t('tasks.deleteTask')"
      :description="$t('tasks.confirmSoftDelete')"
      :cancel-label="$t('common.cancel')"
      :confirm-label="$t('common.delete')"
      confirm-variant="destructive"
      :loading="deleteLoading"
      :error="deleteError"
      @update:open="(value) => { if (!value) deleteDialogOpen = false }"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarRange, X } from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import { useTodayOverview } from '@/composables/useTodayOverview'
import AgendaView from './AgendaView.vue'
import FutureCalendar from './FutureCalendar.vue'
import AlertDialog from '../ui/alert-dialog/AlertDialog.vue'
import IconButton from '../ui/button/IconButton.vue'
import { isVirtualInstance } from '../../utils/today-agenda.js'
import { localDateKey } from '../../utils/task-time-rules.js'

/**
 * Today 综合视图：左侧 Agenda + 右侧 Future Calendar。
 * 只组合布局与交互状态；查询、合并与分组语义来自页面协调层（useTodayOverview）。
 */
const emit = defineEmits(['pending-count-change', 'scope-change'])

const { t } = useI18n()
const taskStore = useTaskStore()

const {
  todayKey,
  monthWindow,
  agendaModel,
  calendarDots,
  todayPendingCount,
  loadingCount,
  initialLoaded,
  hasLoadError,
  loadMoreFuture,
  ensureDateLoaded,
  ensureMonthVisible,
  expandMonths,
  resetToToday,
  retryFailed,
  searchScopeLabel
} = useTodayOverview()

const searchQuery = computed(() => taskStore.searchQuery)
const showCompleted = computed(() => taskStore.showCompletedInToday)

const agendaRef = ref(null)
const rootEl = ref(null)
const drawerEl = ref(null)
const calendarToggleBtn = ref(null)

// ---------- 响应式布局 ----------

// Agenda 360px + Calendar 280px + 间距无法满足时隐藏常驻日历
const AGENDA_MIN = 360
const CALENDAR_MIN = 280
const LAYOUT_GAP = 48
const contentWidth = ref(1200)
const isNarrow = computed(() => contentWidth.value < AGENDA_MIN + CALENDAR_MIN + LAYOUT_GAP)

let resizeObserver = null

onMounted(() => {
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        contentWidth.value = entry.contentRect.width
      }
    })
    resizeObserver.observe(rootEl.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

// ---------- 日历可见性与抽屉 ----------

const drawerOpen = ref(false)
const expandedTaskKey = ref('')
const activeTaskEditor = ref(null)
const expansionChangePending = ref(false)

provide('todayTaskEditorCoordinator', {
  register(identity, flush) {
    activeTaskEditor.value = { identity, flush }
  },
  unregister(identity) {
    if (activeTaskEditor.value?.identity === identity) activeTaskEditor.value = null
  },
  close(identity, options = {}) {
    if (expandedTaskKey.value !== identity) return false
    closeEditor()
    if (options.restoreFocus !== false) {
      nextTick(() => {
        const wrapper = [...document.querySelectorAll('.agenda-card-wrapper')]
          .find((element) => element.dataset.taskKey === identity)
        wrapper?.querySelector('.today-task-title')?.focus()
      })
    }
    return true
  }
})

function openDrawer() {
  drawerOpen.value = true
  nextTick(() => {
    const focusable = drawerEl.value?.querySelector('button')
    focusable?.focus()
  })
}

function closeDrawer() {
  drawerOpen.value = false
  calendarToggleBtn.value?.focus()
}

// 焦点约束：Tab / Shift+Tab 在抽屉内循环，关闭后焦点返回触发按钮
function handleDrawerTab(event) {
  const drawer = drawerEl.value
  if (!drawer) return
  const focusables = [...drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// ---------- 日期导航 ----------

// 新进入 Today 默认从今天执行上下文开始
const selectedDateKey = ref(todayKey.value)

async function handleSelectDate(key) {
  selectedDateKey.value = key
  await ensureDateLoaded(key)
  nextTick(() => {
    agendaRef.value?.scrollToSection(key)
  })
}

function handleActiveDateChange(key) {
  // 滚动 Agenda 同步当前日期；active 日期在窗口外时向对应方向扩展月份
  selectedDateKey.value = key
  ensureMonthVisible(key)
}

async function handleBackToday() {
  await resetToToday()
  selectedDateKey.value = todayKey.value
  nextTick(() => {
    agendaRef.value?.scrollToGroup('today')
  })
}

// ---------- 原位展开任务 ----------

const selectedTask = ref(null)

function taskIdentity(task) {
  const occurrenceDate = localDateKey(task?.occurrenceDate)
  if (task?.seriesId && occurrenceDate) {
    return `occurrence:${task.seriesId}:${occurrenceDate}`
  }
  return task ? `task:${task.id}` : ''
}

async function handleEditTask(task) {
  if (expansionChangePending.value) return
  expansionChangePending.value = true
  const identity = taskIdentity(task)
  try {
    const editor = activeTaskEditor.value
    if (expandedTaskKey.value && editor?.identity === expandedTaskKey.value) {
      const canChangeTask = await editor.flush()
      if (!canChangeTask) return
    }
    if (expandedTaskKey.value === identity) {
      closeEditor()
      return
    }
    selectedTask.value = task
    expandedTaskKey.value = identity
  } finally {
    expansionChangePending.value = false
  }
}

function closeEditor() {
  selectedTask.value = null
  expandedTaskKey.value = ''
}

function handleTaskCollapse({ task, restoreFocus }) {
  const identity = taskIdentity(task)
  if (identity !== expandedTaskKey.value) return
  closeEditor()
}

// ---------- 统一删除确认 ----------

const deleteDialogOpen = ref(false)
const deleteTarget = ref(null)
const deleteLoading = ref(false)
const deleteError = ref('')
let deleteTrigger = null
let deleteNextTaskKey = null

function cssEscape(value) {
  if (window.CSS && window.CSS.escape) return window.CSS.escape(value)
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

// 记录相邻任务，成功删除后据此恢复焦点（触发控件随任务移除）
function captureNextTaskKey(trigger) {
  const wrapper = trigger?.closest?.('.agenda-card-wrapper')
  if (!wrapper) return null
  const wrappers = [...document.querySelectorAll('.agenda-card-wrapper')]
  const index = wrappers.indexOf(wrapper)
  if (index === -1) return null
  const neighbor = wrappers[index + 1] || wrappers[index - 1]
  return neighbor?.getAttribute('data-task-key') || null
}

function openDeleteDialog(task, trigger) {
  deleteTarget.value = task
  deleteTrigger = trigger || null
  deleteNextTaskKey = captureNextTaskKey(trigger)
  deleteError.value = ''
  deleteLoading.value = false
  deleteDialogOpen.value = true
}

// 任务行删除入口
function requestTaskDelete({ task, trigger }) {
  openDeleteDialog(task, trigger)
}

async function confirmDelete() {
  if (!deleteTarget.value || deleteLoading.value) return
  const task = deleteTarget.value
  deleteLoading.value = true
  deleteError.value = ''
  try {
    // store 方法以 { success, error } 汇报结果，不抛错；失败时保留弹窗与上下文
    const result = isVirtualInstance(task)
      ? await taskStore.deleteRecurringInstance(task.seriesId, task.occurrenceDate)
      : await taskStore.deleteTask(task.id)

    if (!result || result.success === false) {
      deleteError.value = t('tasks.deleteFailed', { error: result?.error || '' })
      return
    }

    deleteDialogOpen.value = false
    deleteTarget.value = null
    if (selectedTask.value && taskIdentity(selectedTask.value) === taskIdentity(task)) closeEditor()
    restoreFocusAfterDelete()
  } catch (error) {
    console.error('[TodayOverview] 删除任务失败:', error)
    deleteError.value = t('tasks.deleteFailed', { error: error?.message || '' })
  } finally {
    deleteLoading.value = false
  }
}

function cancelDelete() {
  deleteTarget.value = null
  deleteError.value = ''
  nextTick(() => {
    if (deleteTrigger && document.contains(deleteTrigger)) deleteTrigger.focus()
  })
}

function restoreFocusAfterDelete() {
  nextTick(() => {
    const next = deleteNextTaskKey
      ? document.querySelector(`.agenda-card-wrapper[data-task-key="${cssEscape(deleteNextTaskKey)}"]`)
      : null
    const focusable = next?.querySelector('input[type="checkbox"], button')
    if (focusable) {
      focusable.focus()
      return
    }
    agendaRef.value?.focusAddButton?.()
  })
}

// ---------- 计数与搜索范围上报 ----------

watch(todayPendingCount, (count) => {
  emit('pending-count-change', count)
}, { immediate: true })

watch(searchScopeLabel, (scope) => {
  emit('scope-change', scope)
}, { immediate: true })
</script>

<style>
@import '@/assets/styles/components/today-overview.css';
</style>
