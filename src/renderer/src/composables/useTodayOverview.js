import { ref, computed, shallowRef, onMounted, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/store/taskStore'
import {
  mergeTaskWorld,
  buildAgendaModel,
  buildCalendarDots,
  mergeDayRanges,
  missingDaySpans,
  enumerateDateKeys,
  addDaysToKey,
  dateToKey,
  instanceKey
} from '../utils/today-agenda.js'
import { getMainDateInfo } from '../utils/task-time-rules.js'

/**
 * Today 综合视图的页面级数据协调层（issue #14）。
 *
 * 职责：协调 Agenda 日期范围与 Future Calendar 月份范围的重复实例查询、
 * 按实例身份合并基础任务与虚拟实例、驱动分组/日期点模型与刷新。
 * 业务时间语义全部来自渲染层规则 today-agenda / task-time-rules（#13），
 * 本层只管理请求、状态与响应式。
 */
export function useTodayOverview() {
  const taskStore = useTaskStore()

  // ---------- 日期与范围状态 ----------
  const todayKey = ref(dateToKey(new Date()))
  const modelClock = ref(new Date()) // 分组评估时钟，跨午夜时刷新
  const futureDays = ref(7) // Agenda 初始加载今天起 7 天（含首尾）
  const extraSpans = ref([]) // 导航到初始范围之外的日期时按需加载的区间（过去 / 远期）
  const monthWindow = ref(defaultMonthWindow()) // { startKey, endKey } 月份窗口（含头尾月）

  const loadedRanges = ref([]) // 已完成查询的日期区间（合并后）
  const virtualByKey = shallowRef(new Map())
  const failedSpans = ref([]) // 查询失败的区间（span 对象），保留已加载内容并可重试
  const loadingCount = ref(0)
  const initialLoaded = ref(false)

  let requestEpoch = 0

  function defaultMonthWindow() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1)
    return { startKey: dateToKey(start), endKey: monthEndKey(dateToKey(endMonth).slice(0, 7)) }
  }

  // ---------- 范围协调 ----------

  // 页面当前需要的全部日期区间：Agenda（今天 + 未来 7 天 + 按需区间）与日历月份窗口
  const wantedRanges = computed(() => {
    const ranges = []
    for (const span of extraSpans.value) ranges.push({ ...span })
    ranges.push({ startKey: todayKey.value, endKey: addDaysToKey(todayKey.value, futureDays.value) })
    if (monthWindow.value.startKey <= monthWindow.value.endKey) {
      ranges.push({ startKey: monthWindow.value.startKey, endKey: monthWindow.value.endKey })
    }
    return mergeDayRanges(ranges)
  })

  // Agenda 展示的日期 section：今天至未来 7 天，加上按需加载的过去 / 远期日期
  const agendaBrowsingDates = computed(() => {
    const keys = new Set()
    for (const span of extraSpans.value) {
      for (const key of enumerateDateKeys(span.startKey, span.endKey)) keys.add(key)
    }
    for (const key of enumerateDateKeys(todayKey.value, addDaysToKey(todayKey.value, futureDays.value))) {
      keys.add(key)
    }
    return [...keys].sort()
  })

  function spanKey(span) {
    return `${span.startKey}:${span.endKey}`
  }

  async function fetchSpan(span, epoch) {
    const key = spanKey(span)
    loadingCount.value += 1
    try {
      const result = await window.electronAPI.tasks.expandRecurring({
        startDate: `${span.startKey}T00:00:00`,
        endDate: `${span.endKey}T23:59:59.999`,
        listId: null
      })
      if (epoch !== requestEpoch) return // 旧响应不得覆盖新状态
      if (!result || !result.success) {
        throw new Error(result && result.error ? result.error : '加载重复实例失败')
      }
      const next = new Map(virtualByKey.value)
      for (const instance of result.tasks || []) {
        const identity = instanceKey(instance)
        if (identity) next.set(identity, instance)
      }
      virtualByKey.value = next
      loadedRanges.value = mergeDayRanges([...loadedRanges.value, span])
      failedSpans.value = failedSpans.value.filter((failed) => spanKey(failed) !== key)
    } catch (error) {
      if (epoch !== requestEpoch) return
      console.error('[TodayOverview] 加载日期范围失败:', span, error)
      if (!failedSpans.value.some((failed) => spanKey(failed) === key)) {
        failedSpans.value = [...failedSpans.value, { ...span }]
      }
    } finally {
      loadingCount.value -= 1
    }
  }

  // 补齐当前需要的所有日期区间；复用已加载区间。
  // 只补齐每个 wanted 区间内部缺失的日期，不填充互不相交区间之间的空隙
  // （例如按需导航到远期日期时，不加载中间的无关日期）。
  async function ensureRanges() {
    const epoch = requestEpoch
    const spans = []
    for (const range of wantedRanges.value) {
      spans.push(...missingDaySpans(loadedRanges.value, range.startKey, range.endKey))
    }
    const deduped = mergeDayRanges(spans)
    if (!deduped.length) return
    await Promise.all(deduped.map((span) => fetchSpan(span, epoch)))
    initialLoaded.value = true
  }

  // 数据变化后的全量刷新：作废旧请求与旧虚拟实例快照，再按当前范围重取
  async function refreshAfterMutation() {
    requestEpoch += 1
    virtualByKey.value = new Map()
    loadedRanges.value = []
    failedSpans.value = []
    await ensureRanges()
  }

  // 加载失败重试：保留已加载内容，只重取失败的区间
  async function retryFailed() {
    const failed = failedSpans.value
    if (!failed.length) {
      await refreshAfterMutation()
      return
    }
    const epoch = requestEpoch
    await Promise.all(failed.map((span) => fetchSpan(span, epoch)))
  }

  function loadMoreFuture() {
    futureDays.value += 7
  }

  // 导航到任意日期（过去 / 远期）：把目标日期纳入 Agenda 展示范围，并按需加载数据。
  // 注意：月份窗口已加载的数据区间不代表 Agenda 已展示该日期 section，
  // 因此只要超出初始 Agenda 范围就必须加入 extraSpans，不能只判断 loadedRanges。
  function ensureDateLoaded(key) {
    const initialEnd = addDaysToKey(todayKey.value, futureDays.value)
    if (key < todayKey.value || key > initialEnd) {
      const alreadyBrowsing = agendaBrowsingDates.value.includes(key)
      if (!alreadyBrowsing) {
        extraSpans.value = mergeDayRanges([...extraSpans.value, { startKey: key, endKey: key }])
      }
    }
    // 日历月份窗口向目标方向扩展
    ensureMonthVisible(key)
    return ensureRanges()
  }

  function monthKeyOf(key) {
    return key.slice(0, 7)
  }

  function ensureMonthVisible(key) {
    const target = monthKeyOf(key)
    const start = monthKeyOf(monthWindow.value.startKey)
    const end = monthKeyOf(monthWindow.value.endKey)
    if (target >= start && target <= end) return
    if (target < start) {
      monthWindow.value = { startKey: `${target}-01`, endKey: monthWindow.value.endKey }
    } else {
      monthWindow.value = {
        startKey: monthWindow.value.startKey,
        endKey: monthEndKey(target)
      }
    }
  }

  function monthEndKey(month) {
    const [y, m] = month.split('-').map(Number)
    const end = new Date(y, m, 0)
    return dateToKey(end)
  }

  function expandMonths(direction) {
    if (direction < 0) {
      const [y, m] = monthKeyOf(monthWindow.value.startKey).split('-').map(Number)
      const prev = new Date(y, m - 2, 1)
      monthWindow.value = { startKey: dateToKey(prev), endKey: monthWindow.value.endKey }
    } else {
      const [y, m] = monthKeyOf(monthWindow.value.endKey).split('-').map(Number)
      const next = new Date(y, m, 1)
      monthWindow.value = { startKey: monthWindow.value.startKey, endKey: monthEndKey(dateToKey(next).slice(0, 7)) }
    }
  }

  function resetToToday() {
    todayKey.value = dateToKey(new Date())
    extraSpans.value = []
    futureDays.value = 7
    monthWindow.value = defaultMonthWindow()
    return ensureRanges()
  }

  // ---------- 世界与模型 ----------

  const baseTasksInScope = computed(() => {
    const listId = taskStore.currentListId
    if (listId === null) return taskStore.tasks
    return taskStore.tasks.filter((task) => task.listId === listId)
  })

  const world = computed(() => {
    return mergeTaskWorld({
      baseTasks: baseTasksInScope.value,
      virtualInstances: [...virtualByKey.value.values()]
    }).instances
  })

  const searchQuery = computed(() => taskStore.searchQuery.trim())

  // 搜索覆盖范围：今日执行集合、收件箱集合与当前已查询日期范围（含日历可见月份）的并集。
  // 无主日期的任务（收件箱 / doing）始终在范围内；有主日期的任务需落在已查询区间内。
  const searchableWorld = computed(() => {
    const ranges = loadedRanges.value
    return world.value.filter((task) => {
      const main = getMainDateInfo(task)
      if (!main || !main.date) return true
      return ranges.some((range) => main.date >= range.startKey && main.date <= range.endKey)
    })
  })

  const filteredWorld = computed(() => {
    const query = searchQuery.value
    if (!query) return world.value
    const lower = query.toLowerCase()
    return searchableWorld.value.filter((task) => {
      const content = task.content ? task.content.toLowerCase() : ''
      const note = task.metadata?.note ? String(task.metadata.note).toLowerCase() : ''
      return content.includes(lower) || note.includes(lower)
    })
  })

  const showCompleted = computed(() => taskStore.showCompletedInToday)

  // 今日待处理数量：来自未过滤的任务世界，不受搜索或已完成开关影响。
  // 与 Sidebar 的 Today 计数同源（#13 的今日执行集合、按实例身份去重）。
  const todayPendingCount = computed(() => {
    const model = buildAgendaModel({
      instances: world.value,
      todayKey: todayKey.value,
      browsingDates: [todayKey.value],
      showCompleted: false,
      now: modelClock.value
    })
    return model.todayPendingCount
  })

  const agendaModel = computed(() => {
    return buildAgendaModel({
      instances: filteredWorld.value,
      todayKey: todayKey.value,
      browsingDates: agendaBrowsingDates.value,
      showCompleted: showCompleted.value,
      now: modelClock.value
    })
  })

  const calendarDots = computed(() => {
    return buildCalendarDots({
      instances: filteredWorld.value,
      showCompleted: showCompleted.value
    })
  })

  // 搜索覆盖范围说明：今日执行 + 收件箱 + 已查询日期区间
  const searchScopeLabel = computed(() => {
    if (!loadedRanges.value.length) return ''
    const first = loadedRanges.value[0].startKey
    const last = loadedRanges.value[loadedRanges.value.length - 1].endKey
    return { from: first, to: last }
  })

  const hasLoadError = computed(() => failedSpans.value.length > 0)

  // ---------- 生命周期与刷新 ----------

  let midnightTimer = null

  function checkMidnight() {
    const key = dateToKey(new Date())
    modelClock.value = new Date()
    if (key !== todayKey.value) {
      todayKey.value = key
      ensureRanges()
    }
  }

  function handleFocusRefresh() {
    // 应用重新获得焦点或从休眠恢复时重新校验今天与范围
    checkMidnight()
  }

  function onTasksUpdated() {
    refreshAfterMutation()
  }

  onMounted(() => {
    ensureRanges()
    midnightTimer = setInterval(checkMidnight, 30 * 1000)
    window.addEventListener('focus', handleFocusRefresh)
    document.addEventListener('visibilitychange', handleFocusRefresh)
    window.electronAPI.events.on('tasks-updated', onTasksUpdated)
  })

  onUnmounted(() => {
    requestEpoch += 1 // 后到响应不能更新已离开的页面
    if (midnightTimer) clearInterval(midnightTimer)
    window.removeEventListener('focus', handleFocusRefresh)
    document.removeEventListener('visibilitychange', handleFocusRefresh)
    try {
      window.electronAPI.events.removeListener('tasks-updated', onTasksUpdated)
    } catch (error) {
      // TaskManager 卸载时会 removeAllListeners，此处忽略
    }
  })

  // 范围变化（加载更多 / 月份扩展 / 跨天）时自动补齐
  watch(wantedRanges, () => {
    ensureRanges()
  })

  // 清空搜索时恢复搜索前的日期范围（搜索期间为定位结果按需扩展的区间被回收）
  let extraSpansBeforeSearch = null
  watch(searchQuery, (query) => {
    if (query && extraSpansBeforeSearch === null) {
      extraSpansBeforeSearch = extraSpans.value.map((span) => ({ ...span }))
    } else if (!query && extraSpansBeforeSearch !== null) {
      extraSpans.value = extraSpansBeforeSearch
      extraSpansBeforeSearch = null
    }
  })

  return {
    // 状态
    todayKey,
    futureDays,
    monthWindow,
    loadedRanges,
    loadingCount,
    initialLoaded,
    hasLoadError,
    searchScopeLabel,

    // 模型
    agendaModel,
    calendarDots,
    todayPendingCount,

    // 操作
    loadMoreFuture,
    ensureDateLoaded,
    ensureMonthVisible,
    expandMonths,
    resetToToday,
    refreshAfterMutation,
    retryFailed
  }
}
