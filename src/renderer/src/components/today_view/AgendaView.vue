<template>
  <div class="agenda-view">
    <div class="agenda-scroll" ref="scrollContainer" @scroll.passive="handleAgendaScroll"
      @wheel.passive="handleUserIntent" @touchstart.passive="handleUserIntent" @keydown="handleUserIntent">
      <!-- 初始加载 -->
      <div v-if="initialLoading" class="agenda-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>{{ $t('common.loading') }}</p>
      </div>

      <template v-else>
        <!-- 搜索无匹配：区别于"空日期"与"无未计划"的独立状态 -->
        <div v-if="searchNoMatch" class="agenda-state agenda-no-match" role="status">
          <i class="fas fa-magnifying-glass"></i>
          <p>{{ $t('today.noSearchMatch') }}</p>
        </div>

        <template v-else>
        <!-- 未计划汇总（默认折叠） -->
        <section class="agenda-section agenda-section-unplanned" data-agenda-section="unplanned">
          <button type="button" class="agenda-section-header is-button"
            :aria-expanded="unplannedExpanded" @click="toggleUnplanned">
            <i class="fas" :class="unplannedExpanded ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
            <span class="agenda-section-title">{{ $t('today.unplanned') }}</span>
            <span class="agenda-section-count">{{ model.unplanned.length }}</span>
          </button>
          <div v-if="unplannedExpanded" class="agenda-section-body">
            <div v-if="!model.unplanned.length" class="agenda-empty-inline">{{ $t('today.unplannedEmpty') }}</div>
            <div v-for="task in model.unplanned" :key="taskKey(task)" class="agenda-card-wrapper"
              :data-task-key="taskKey(task)">
              <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                :badges="cardBadges(task, 'unplanned')" :show-schedule="true"
                @task-click="(t) => $emit('task-click', t)" @schedule="handleScheduleClick(task)" />
            </div>
          </div>
        </section>

        <!-- 已逾期（空则隐藏，克制标记） -->
        <section v-if="model.overdue.length" class="agenda-section agenda-section-overdue"
          data-agenda-section="overdue">
          <div class="agenda-section-header">
            <i class="fas fa-exclamation-circle agenda-section-icon-overdue"></i>
            <span class="agenda-section-title">{{ $t('today.overdue') }}</span>
            <span class="agenda-section-count agenda-count-overdue">{{ model.overdue.length }}</span>
          </div>
          <div class="agenda-section-body">
            <div v-for="task in model.overdue" :key="taskKey(task)" class="agenda-card-wrapper"
              :data-task-key="taskKey(task)">
              <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                :badges="cardBadges(task, 'overdue')" @task-click="(t) => $emit('task-click', t)" />
            </div>
          </div>
        </section>

        <!-- 待重新安排 -->
        <section v-if="model.reschedule.length" class="agenda-section agenda-section-reschedule"
          data-agenda-section="reschedule">
          <div class="agenda-section-header">
            <i class="fas fa-history"></i>
            <span class="agenda-section-title">{{ $t('today.reschedule') }}</span>
            <span class="agenda-section-count">{{ model.reschedule.length }}</span>
          </div>
          <div class="agenda-section-body">
            <div v-for="task in model.reschedule" :key="taskKey(task)" class="agenda-card-wrapper"
              :data-task-key="taskKey(task)">
              <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                :badges="cardBadges(task, 'reschedule')" @task-click="(t) => $emit('task-click', t)" />
            </div>
          </div>
        </section>

        <!-- 已过期提醒：无安排/截止，提醒已过；点击可补排期 -->
        <section v-if="model.reminderExpired.length" class="agenda-section agenda-section-reminder"
          data-agenda-section="reminderExpired">
          <div class="agenda-section-header">
            <i class="fas fa-bell-slash"></i>
            <span class="agenda-section-title">{{ $t('today.reminderExpired') }}</span>
            <span class="agenda-section-count">{{ model.reminderExpired.length }}</span>
          </div>
          <div class="agenda-section-body">
            <div v-for="task in model.reminderExpired" :key="taskKey(task)" class="agenda-card-wrapper"
              :data-task-key="taskKey(task)">
              <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                :badges="cardBadges(task, 'reminderExpired')" :show-schedule="true"
                @task-click="(t) => $emit('task-click', t)" @schedule="handleScheduleClick(task)" />
            </div>
          </div>
        </section>

        <!-- 今天（始终保留可定位 section） -->
        <section class="agenda-section agenda-section-today" :data-date-section="todayKey">
          <div class="agenda-section-header">
            <i class="fas fa-calendar-day agenda-section-icon-today"></i>
            <span class="agenda-section-title">{{ $t('today.todaySection') }}</span>
            <span class="agenda-section-count">{{ model.today.length }}</span>
          </div>
          <div class="agenda-section-body">
            <div v-if="!model.today.length" class="agenda-empty-inline">{{ $t('today.todayEmpty') }}</div>
            <div v-for="task in model.today" :key="taskKey(task)" class="agenda-card-wrapper"
              :data-task-key="taskKey(task)">
              <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                :badges="cardBadges(task, 'today')" @task-click="(t) => $emit('task-click', t)" />
            </div>
            <template v-if="showCompleted && (model.todayCompleted.length || todayCompletedOnDate.length)">
              <div class="agenda-completed-label">
                {{ $t('today.completedToday', { count: model.todayCompleted.length + todayCompletedOnDate.length }) }}
              </div>
              <div v-for="task in todayCompletedOnDate" :key="taskKey(task)" class="agenda-card-wrapper"
                :data-task-key="taskKey(task)">
                <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                  @task-click="(t) => $emit('task-click', t)" />
              </div>
              <div v-for="task in model.todayCompleted" :key="taskKey(task)" class="agenda-card-wrapper"
                :data-task-key="taskKey(task)">
                <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                  @task-click="(t) => $emit('task-click', t)" />
              </div>
            </template>
          </div>
        </section>

        <!-- 未来 / 过去日期 section -->
        <section v-for="section in dateSectionsExceptToday" :key="section.dateKey" class="agenda-section agenda-section-date"
          :data-date-section="section.dateKey">
          <div class="agenda-section-header">
            <span class="agenda-section-title">
              {{ formatDateTitle(section.dateKey) }}
              <span v-if="friendlyDateLabel(section.dateKey)" class="agenda-section-friendly">{{ friendlyDateLabel(section.dateKey) }}</span>
            </span>
            <span class="agenda-section-count">{{ section.tasks.length }}</span>
          </div>
          <div class="agenda-section-body">
            <div v-if="!section.tasks.length && !section.completedTasks.length && !section.relocated.length"
              class="agenda-empty-inline">{{ $t('today.emptyDate') }}</div>

            <div v-for="task in section.tasks" :key="taskKey(task)" class="agenda-card-wrapper"
              :data-task-key="taskKey(task)">
              <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                :badges="cardBadges(task, 'date')" @task-click="(t) => $emit('task-click', t)" />
            </div>

            <!-- 已完成区域（开关打开时） -->
            <template v-if="showCompleted && section.completedTasks.length">
              <div class="agenda-completed-label">{{ $t('today.completedOnDate', { count: section.completedTasks.length }) }}</div>
              <div v-for="task in section.completedTasks" :key="taskKey(task)" class="agenda-card-wrapper"
                :data-task-key="taskKey(task)">
                <AgendaTaskCard :task="task" :search-query="searchQuery" :time-update-trigger="timeUpdateTrigger"
                  @task-click="(t) => $emit('task-click', t)" />
              </div>
            </template>

            <!-- 被执行分组收纳的定位链接：多个目标时列出任务标题供选择 -->
            <div v-if="section.relocated.length" class="agenda-relocated">
              <button type="button" class="agenda-relocated-link" :aria-expanded="relocatedMenuKey === section.dateKey"
                @click="handleRelocatedClick(section)">
                <i class="fas fa-crosshairs"></i>
                {{ $t('today.relocatedHint', { count: section.relocated.length }) }}
              </button>
              <div v-if="relocatedMenuKey === section.dateKey" class="agenda-relocated-menu" role="menu">
                <button v-for="task in section.relocated" :key="taskKey(task)" type="button" role="menuitem"
                  class="agenda-relocated-menu-item" @click="locateTask(task)">
                  {{ task.content }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 加载更多未来日期 -->
        <div class="agenda-load-more">
          <button type="button" class="agenda-load-more-btn" :disabled="loadingMore" @click="handleLoadMore">
            <i v-if="loadingMore" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-plus"></i>
            <span>{{ $t('today.loadMore') }}</span>
          </button>
        </div>
        </template>

        <!-- 范围加载失败：保留已加载内容并提供重试 -->
        <div v-if="hasError" class="agenda-error" role="alert">
          <span>{{ $t('today.loadError') }}</span>
          <button type="button" class="agenda-retry-btn" @click="$emit('retry')">
            <i class="fas fa-rotate-right"></i> {{ $t('calendar.retry') }}
          </button>
        </div>
      </template>
    </div>

    <!-- 快速添加（固定在 Agenda 底部，不跨日历） -->
    <div class="agenda-quick-add">
      <div class="agenda-quick-add-row">
        <input v-model="newTaskContent" type="text" class="agenda-quick-add-input"
          :placeholder="$t('today.quickAddPlaceholder')" maxlength="200" ref="quickAddInput"
          @keydown.enter.prevent="addTask" />
        <div class="agenda-quick-add-controls">
          <button v-if="taskStore.availableAIModels.length > 0" type="button"
            class="agenda-ai-toggle" :class="{ active: taskStore.isAIEnabled && aiEnabled }"
            :title="$t('today.aiToggle')" @click="toggleAI">
            <i class="fas fa-wand-magic-sparkles"></i>
            <span v-if="aiEnabled">{{ aiModelShortName }}</span>
          </button>
          <button type="button" class="agenda-ai-split" :class="{ active: shouldSplitTask }"
            :title="$t('today.splitToggle')" @click="shouldSplitTask = !shouldSplitTask">
            <i class="fas fa-list-ul"></i>
          </button>
          <button type="button" class="agenda-quick-add-btn" :disabled="!newTaskContent.trim()" @click="addTask">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
      <!-- 新任务进入未计划的反馈 -->
      <Transition name="agenda-flash">
        <div v-if="unplannedFeedback" class="agenda-quick-add-feedback" role="status">
          <span>{{ $t('today.addedToUnplanned') }}</span>
          <button type="button" class="agenda-feedback-link" @click="viewUnplanned">{{ $t('today.viewUnplanned') }}</button>
          <button type="button" class="agenda-feedback-close" :aria-label="$t('common.close')" @click="unplannedFeedback = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </Transition>
    </div>

    <!-- AI 任务预览弹窗（复用现有链路） -->
    <TaskPreviewModal :visible="showTaskPreview" :tasks="previewTasks" :original-input="originalTaskInput"
      :stream-content="streamContent" @close="closeTaskPreview" @created="handleTasksCreated" />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'
import AgendaTaskCard from './AgendaTaskCard.vue'
import TaskPreviewModal from '../TaskPreviewModal.vue'
import { isLegacyRecurringDateInstance } from '../../utils/task-time-rules.js'
import { addDaysToKey } from '../../utils/today-agenda.js'
import { localeCode } from '../../utils/locale-format.js'

const props = defineProps({
  model: { type: Object, required: true },
  todayKey: { type: String, required: true },
  searchQuery: { type: String, default: '' },
  showCompleted: { type: Boolean, default: false },
  initialLoading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasError: { type: Boolean, default: false }
})

const emit = defineEmits([
  'task-click',
  'load-more',
  'retry',
  'active-date-change'
])

const { t, locale } = useI18n()
const taskStore = useTaskStore()

const scrollContainer = ref(null)
const quickAddInput = ref(null)
const unplannedExpanded = ref(false)
const unplannedFeedback = ref(false)
const newTaskContent = ref('')

// AI 快速创建（沿用现有流式生成与预览链路）
const aiEnabled = ref(false)
const shouldSplitTask = ref(false)
const showTaskPreview = ref(false)
const previewTasks = ref([])
const originalTaskInput = ref('')
const streamContent = ref('')

// 进行中任务计时刷新
let timeUpdateTimer = null
const timeUpdateTrigger = ref(0)

// 滚动观察：Agenda 顶部进入有效阅读区的日期 section 为当前日期
let programmaticScrollUntil = 0
const activeDate = ref('')

function taskKey(task) {
  return task.seriesId ? `${task.seriesId}|${task.occurrenceDate || ''}|${task.id}` : String(task.id)
}

const dateSectionsExceptToday = computed(() => {
  return props.model.dateSections.filter((section) => section.dateKey !== props.todayKey)
})

// 主日期为今天的已完成任务（开关打开时并入今天已完成区域展示）
const todayCompletedOnDate = computed(() => {
  const section = props.model.dateSections.find((item) => item.dateKey === props.todayKey)
  return section ? section.completedTasks : []
})

// 搜索生效但页面范围内没有任何匹配结果
const searchNoMatch = computed(() => {
  if (!props.searchQuery.trim()) return false
  const model = props.model
  return (
    model.unplanned.length === 0 &&
    model.overdue.length === 0 &&
    model.reschedule.length === 0 &&
    model.reminderExpired.length === 0 &&
    model.today.length === 0 &&
    model.todayCompleted.length === 0 &&
    model.dateSections.every(
      (section) => section.tasks.length === 0 && section.completedTasks.length === 0
    )
  )
})

function formatDateTitle(key) {
  const date = new Date(`${key}T00:00:00`)
  return date.toLocaleDateString(localeCode(locale.value), {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

function friendlyDateLabel(key) {
  if (key === props.todayKey) return t('common.time.today')
  if (key === addDaysToKey(props.todayKey, 1)) return t('common.time.tomorrow')
  return ''
}

function cardBadges(task, group) {
  const badges = []
  if (isLegacyRecurringDateInstance(task)) {
    badges.push({ text: t('today.badge.recurring'), tone: 'muted' })
  }
  // 日期型 Deadline 在日期 section 中显示"当天截止"，不伪造具体时刻
  if (group === 'date' && task.dueDate && !task.dueTime) {
    badges.push({ text: t('today.badge.dueDateOnly'), tone: 'warning' })
  }
  if (group === 'reminderExpired') {
    badges.push({ text: t('today.badge.reminderExpired'), tone: 'warning' })
  }
  if (group === 'today' && task.dueDate && !task.scheduledStartAt) {
    const dueKey = task.dueDate.slice(0, 10)
    if (dueKey === props.todayKey) badges.push({ text: t('today.badge.dueToday'), tone: 'warning' })
  }
  if (group === 'today' && task.scheduledStartAt) {
    const startKey = String(task.scheduledStartAt).slice(0, 10)
    if (startKey !== props.todayKey) badges.push({ text: t('today.badge.scheduledElsewhere'), tone: 'muted' })
  }
  const list = taskStore.getListById(task.listId)
  if (list) badges.push({ text: list.name, tone: 'list', color: list.color })
  return badges
}

function toggleUnplanned() {
  unplannedExpanded.value = !unplannedExpanded.value
}

function viewUnplanned() {
  unplannedExpanded.value = true
  unplannedFeedback.value = false
  nextTick(() => {
    const section = scrollContainer.value?.querySelector('[data-agenda-section="unplanned"]')
    section?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
  })
}

function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

// ---------- 快速添加 ----------

async function addTask() {
  const content = newTaskContent.value.trim()
  if (!content) return

  if (aiEnabled.value && taskStore.selectedAIModel && taskStore.isAIEnabled) {
    originalTaskInput.value = content
    previewTasks.value = []
    streamContent.value = ''
    showTaskPreview.value = true
    newTaskContent.value = ''
    try {
      await taskStore.streamGenerateTaskList(
        content,
        (chunk) => { streamContent.value = chunk },
        (finalResult) => {
          if (finalResult.success && finalResult.tasks) {
            previewTasks.value = finalResult.tasks.map((task) => ({
              ...task,
              listId: task.listId || taskStore.currentListId,
              dueDate: task.dueDate || null,
              dueTime: task.dueTime || null,
              reminderTime: task.reminderTime || null,
              metadata: task.metadata || { note: '' }
            }))
          } else {
            showTaskPreview.value = false
            newTaskContent.value = content
            createNormalTask(content)
          }
        },
        (error) => {
          console.error('[AgendaView] AI 生成任务失败:', error.error || error)
          showTaskPreview.value = false
          newTaskContent.value = content
          createNormalTask(content)
        },
        shouldSplitTask.value
      )
    } catch (error) {
      console.error('[AgendaView] AI 生成任务异常:', error)
      showTaskPreview.value = false
      newTaskContent.value = content
      createNormalTask(content)
    }
    return
  }

  await createNormalTask(content)
}

// 新任务默认不带时间：选中日历日期不自动填入 Schedule
async function createNormalTask(content) {
  const taskData = { content }
  if (taskStore.currentListId !== null) taskData.listId = taskStore.currentListId
  const result = await taskStore.createTask(taskData)
  if (result && result.success) {
    newTaskContent.value = ''
    unplannedFeedback.value = true
    quickAddInput.value?.focus()
  }
}

function toggleAI() {
  if (!taskStore.isAIEnabled) {
    taskStore.toggleAI()
    aiEnabled.value = true
    return
  }
  aiEnabled.value = !aiEnabled.value
}

const aiModelShortName = computed(() => {
  return taskStore.selectedAIModel ? taskStore.selectedAIModel.name : 'AI'
})

function closeTaskPreview() {
  showTaskPreview.value = false
  previewTasks.value = []
  originalTaskInput.value = ''
  streamContent.value = ''
}

function handleTasksCreated(result) {
  if (result.success) {
    taskStore.getAllTasks()
  } else {
    console.error('[AgendaView] AI 任务创建失败:', result.message)
  }
}

// ---------- 定位与滚动 ----------

function isProgrammaticScrolling() {
  return Date.now() < programmaticScrollUntil
}

// 用户主动滚动立即中断程序动画并暂停观察，避免循环跳动。
// 监听 wheel / touch / key 等真实输入事件，而非 scroll：
// scrollIntoView 的平滑动画自身也会派发 scroll，不能用 scroll 判定用户意图。
function handleUserIntent() {
  if (!isProgrammaticScrolling()) return
  programmaticScrollUntil = 0
  disconnectObserverTemporarily()
}

let observerPaused = false
let observerResumeTimer = null

function disconnectObserverTemporarily() {
  observerPaused = true
  if (observerResumeTimer) clearTimeout(observerResumeTimer)
  observerResumeTimer = setTimeout(() => { observerPaused = false }, 400)
}

const PROGRAMMATIC_SCROLL_MS = 900

function beginProgrammaticScroll() {
  programmaticScrollUntil = Date.now() + PROGRAMMATIC_SCROLL_MS
  observerPaused = true
  if (observerResumeTimer) clearTimeout(observerResumeTimer)
  observerResumeTimer = setTimeout(() => { observerPaused = false }, PROGRAMMATIC_SCROLL_MS)
}

function scrollToSection(dateKey) {
  const container = scrollContainer.value
  if (!container) return
  const target = container.querySelector(`[data-date-section="${dateKey}"]`)
  if (!target) return
  beginProgrammaticScroll()
  target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
}

function highlightTasks(taskKeys) {
  nextTick(() => {
    const container = scrollContainer.value
    if (!container) return
    for (const key of taskKeys) {
      const el = container.querySelector(`[data-task-key="${cssEscape(key)}"]`)
      if (!el) continue
      el.classList.add('agenda-card-highlight')
      setTimeout(() => el.classList.remove('agenda-card-highlight'), 1600)
    }
  })
}

function cssEscape(value) {
  if (window.CSS && window.CSS.escape) return window.CSS.escape(value)
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

function scrollToGroup(group) {
  const container = scrollContainer.value
  if (!container) return
  const target = container.querySelector(`[data-agenda-section="${group}"]`)
  if (!target) return
  beginProgrammaticScroll()
  target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
}

// 定位链接：指向执行分组中已有的任务卡片。
// 单个目标直接定位；多个目标列出任务标题供选择，不复制卡片。
const relocatedMenuKey = ref('')

function handleRelocatedClick(section) {
  if (section.relocated.length === 1) {
    locateTask(section.relocated[0])
    return
  }
  relocatedMenuKey.value = relocatedMenuKey.value === section.dateKey ? '' : section.dateKey
}

function locateTask(task) {
  relocatedMenuKey.value = ''
  const key = taskKey(task)
  if (props.model.overdue.some((t) => taskKey(t) === key)) {
    scrollToGroup('overdue')
  } else if (props.model.reschedule.some((t) => taskKey(t) === key)) {
    scrollToGroup('reschedule')
  } else {
    scrollToGroup('today')
  }
  highlightTasks([key])
}

function handleScheduleClick(task) {
  emit('task-click', task)
}

function handleLoadMore() {
  emit('load-more')
}

// ---------- 滚动观察 ----------

// 以 Agenda 顶部进入有效阅读区域的日期 section 作为 active 日期。
// 停留在未计划 / 已逾期 / 待重新安排等非日期分组时保留上一次有效日期。
function computeActiveDate() {
  const container = scrollContainer.value
  if (!container) return
  const containerTop = container.getBoundingClientRect().top
  // 容器顶部内边距会让 scrollIntoView 后 section 顶部略低于容器顶部，
  // 阈值需覆盖该偏移，使刚定位的 section 立即成为 active 日期。
  const threshold = 48
  let candidate = null
  for (const el of container.querySelectorAll('[data-date-section]')) {
    const top = el.getBoundingClientRect().top - containerTop
    if (top <= threshold) candidate = el.getAttribute('data-date-section')
    else break
  }
  if (candidate && candidate !== activeDate.value) {
    activeDate.value = candidate
    emit('active-date-change', candidate)
  }
}

function handleAgendaScroll() {
  if (observerPaused || isProgrammaticScrolling()) return
  computeActiveDate()
}

// section 集合变化后重新计算一次 active 日期
const sectionSignature = computed(() => props.model.dateSections.map((s) => s.dateKey).join(','))

watch(sectionSignature, () => nextTick(computeActiveDate), { immediate: true })

function refreshObserverNow() {
  nextTick(computeActiveDate)
}

defineExpose({
  scrollToSection,
  scrollToGroup,
  highlightTasks,
  viewUnplanned,
  refreshObserverNow,
  focusQuickAdd: () => quickAddInput.value?.focus()
})

onMounted(async () => {
  await taskStore.loadAIModels()
  nextTick(computeActiveDate)
  timeUpdateTimer = setInterval(() => {
    const hasDoing = props.model.today.some((task) => task.status === 'doing')
    if (hasDoing) timeUpdateTrigger.value += 1
  }, 1000)
})

onUnmounted(() => {
  if (timeUpdateTimer) clearInterval(timeUpdateTimer)
  if (observerResumeTimer) clearTimeout(observerResumeTimer)
})
</script>
