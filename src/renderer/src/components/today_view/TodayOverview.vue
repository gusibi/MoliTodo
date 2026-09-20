<template>
  <div class="today-overview" ref="rootEl" :class="{ 'is-narrow': isNarrow }">
    <!-- 左侧 Agenda -->
    <div class="today-overview-agenda">
      <AgendaView ref="agendaRef" :model="agendaModel" :today-key="todayKey" :search-query="searchQuery"
        :show-completed="showCompleted"
        :initial-loading="(!initialLoaded && loadingCount > 0) || (taskStore.loading && taskStore.tasks.length === 0)"
        :loading-more="loadingCount > 0" :has-error="hasLoadError" @task-click="handleEditTask" @load-more="loadMoreFuture"
        @retry="retryFailed" @active-date-change="handleActiveDateChange" />
    </div>

    <!-- 右侧 Future Calendar（宽屏常驻） -->
    <aside v-if="!isNarrow && calendarVisible" class="today-overview-calendar" :aria-hidden="editorOpen">
      <FutureCalendar :month-window="monthWindow" :dots="calendarDots" :today-key="todayKey"
        :selected-key="selectedDateKey" @select-date="handleSelectDate" @expand-months="expandMonths"
        @back-today="handleBackToday" />
    </aside>

    <!-- 窄屏：日历开关 -->
    <button v-if="isNarrow" type="button" class="today-calendar-toggle" :title="$t('today.calendar.toggle')"
      :aria-expanded="drawerOpen" ref="calendarToggleBtn" @click="openDrawer">
      <i class="fas fa-calendar-week"></i>
    </button>

    <!-- 窄屏日历抽屉 -->
    <Teleport to="body">
      <Transition name="today-drawer">
        <div v-if="drawerOpen" class="today-calendar-drawer-backdrop" @click.self="closeDrawer">
          <div class="today-calendar-drawer" role="dialog" aria-modal="true" :aria-label="$t('today.calendar.title')"
            ref="drawerEl" @keydown.escape.stop.prevent="closeDrawer" @keydown.tab="handleDrawerTab">
            <div class="today-calendar-drawer-header">
              <span class="today-calendar-drawer-title">{{ $t('today.calendar.title') }}</span>
              <button type="button" class="today-calendar-drawer-close" :aria-label="$t('common.close')"
                @click="closeDrawer">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <FutureCalendar :month-window="monthWindow" :dots="calendarDots" :today-key="todayKey"
              :selected-key="selectedDateKey" @select-date="(key) => { handleSelectDate(key); closeDrawer() }"
              @expand-months="expandMonths" @back-today="handleBackToday" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 编辑器：打开时优先收起 Future Calendar，关闭后恢复 -->
    <Transition name="today-edit" appear>
      <div v-if="editorOpen" class="today-edit-panel">
        <TaskEditVertical :task="selectedTask" :is-editing="true" @update-task="handleUpdateTask"
          @cancel-edit="closeEditor" @delete-task="handleDeleteTask" />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'
import { useTodayOverview } from '@/composables/useTodayOverview'
import AgendaView from './AgendaView.vue'
import FutureCalendar from './FutureCalendar.vue'
import TaskEditVertical from '../TaskEditVertical.vue'
import { isVirtualInstance } from '../../utils/today-agenda.js'

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

const calendarVisible = ref(true)
const calendarVisibleBeforeEditor = ref(true)
const drawerOpen = ref(false)

const editorOpen = computed(() => selectedTask.value !== null)

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

// ---------- 任务编辑 ----------

const selectedTask = ref(null)

// 虚拟重复实例先物化为真实任务行再编辑：编辑器内所有保存链路（重复规则、提醒等）
// 都以真实任务 ID 工作，物化幂等且与 #13 实例规则一致
async function handleEditTask(task) {
  let editable = task
  if (isVirtualInstance(task)) {
    try {
      const result = await taskStore.updateRecurringInstance(task.seriesId, task.occurrenceDate, {})
      if (result && result.success && result.task) {
        editable = result.task
      }
    } catch (error) {
      console.error('[TodayOverview] 物化重复实例失败:', error)
    }
  }
  // 仅在首次打开编辑器时记录日历可见性，避免切换任务时丢失恢复状态
  if (!editorOpen.value) {
    calendarVisibleBeforeEditor.value = calendarVisible.value
  }
  selectedTask.value = editable
  // 编辑器打开时优先收起 Future Calendar，保证 Agenda 与编辑区域可用
  calendarVisible.value = false
}

function closeEditor() {
  selectedTask.value = null
  calendarVisible.value = calendarVisibleBeforeEditor.value
}

// 保存路由：真实任务走普通更新；虚拟实例兜底走重复实例更新
async function handleUpdateTask(taskData) {
  try {
    if (isVirtualInstance(taskData)) {
      const updates = { ...taskData }
      delete updates.id
      delete updates.seriesId
      delete updates.occurrenceDate
      delete updates.createdAt
      delete updates.updatedAt
      const result = await taskStore.updateRecurringInstance(
        taskData.seriesId,
        taskData.occurrenceDate,
        updates
      )
      if (!result.success) {
        alert(t('today.saveFailed', { error: result.error || '' }))
      }
      return
    }
    const result = await taskStore.updateTask(taskData.id, taskData)
    if (!result.success) {
      alert(t('today.saveFailed', { error: result.error || '' }))
    }
  } catch (error) {
    console.error('[TodayOverview] 更新任务失败:', error)
    alert(t('today.saveFailed', { error: error.message }))
  }
}

async function handleDeleteTask(task) {
  if (!confirm(t('tasks.confirmDelete'))) return
  try {
    if (isVirtualInstance(task)) {
      await taskStore.deleteRecurringInstance(task.seriesId, task.occurrenceDate)
    } else {
      await taskStore.deleteTask(task.id)
    }
    closeEditor()
  } catch (error) {
    console.error('[TodayOverview] 删除任务失败:', error)
    alert(t('today.saveFailed', { error: error.message }))
  }
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
