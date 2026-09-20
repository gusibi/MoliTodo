/**
 * 渲染层任务时间规则（与 src/domain/services/task-time.js 保持一致）
 *
 * 主进程使用 CommonJS，渲染层使用 ESM，构建边界无法直接共享源码，
 * 因此这里维护一份等价实现。渲染层所有视图都必须从这里引用规则，
 * 不要在组件内各自复制。
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function toDate(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  // 日期型字符串按本地午夜解析：new Date('YYYY-MM-DD') 会得到 UTC 午夜，
  // 在西半球时区会被归属到前一天。
  if (isDateOnly(value)) {
    const match = DATE_ONLY_PATTERN.exec(value.trim())
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

export function localDateKey(value) {
  if (isDateOnly(value)) return value.trim()
  const date = toDate(value)
  if (!date) return null
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function isDateOnly(value) {
  return typeof value === 'string' && DATE_ONLY_PATTERN.test(value.trim())
}

function normalizeDueTime(value) {
  if (value === null || value === undefined || value === '') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim())
  if (!match) throw new Error('截止时间格式无效')
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error('截止时间格式无效')
  return `${pad2(hours)}:${pad2(minutes)}`
}

export function deadlineBoundary(dueDate, dueTime) {
  if (!dueDate) return null
  try {
    let dateStr = dueDate
    let timeStr = dueTime
    if (!isDateOnly(dateStr)) {
      const parsed = toDate(dateStr)
      if (!parsed) return null
      dateStr = localDateKey(parsed)
      if (timeStr === null || timeStr === undefined || timeStr === '') {
        timeStr = `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`
      }
    }
    const normalizedTime = normalizeDueTime(timeStr)
    if (normalizedTime) return toDate(`${dateStr}T${normalizedTime}:00`)
    const startOfDay = new Date(`${dateStr}T00:00:00`)
    if (Number.isNaN(startOfDay.getTime())) return null
    startOfDay.setDate(startOfDay.getDate() + 1)
    return startOfDay
  } catch (error) {
    return null
  }
}

export function isCompleted(task) {
  return Boolean(task) && (task.status === 'done' || task.completed === true)
}

export function isOverdue(task, now = new Date()) {
  if (!task || isCompleted(task)) return false
  const boundary = deadlineBoundary(task.dueDate, task.dueTime)
  if (!boundary) return false
  return toDate(now).getTime() >= boundary.getTime()
}

export function isLegacyRecurringDateInstance(task) {
  return Boolean(task && task.seriesId && task.occurrenceDate && !toDate(task.scheduledStartAt))
}

export function hasSchedule(task) {
  if (!task) return false
  if (toDate(task.scheduledStartAt)) return true
  return isLegacyRecurringDateInstance(task)
}

export function hasDeadline(task) {
  return Boolean(task && task.dueDate)
}

export function scheduleStartDate(task) {
  const start = toDate(task && task.scheduledStartAt)
  if (start) return start
  if (isLegacyRecurringDateInstance(task)) return toDate(task.occurrenceDate)
  return null
}

export function getMainDateInfo(task) {
  if (!task) return null
  const start = toDate(task.scheduledStartAt)
  if (start) return { date: localDateKey(start), kind: 'schedule', at: start }
  if (isLegacyRecurringDateInstance(task)) {
    const occurrence = toDate(task.occurrenceDate)
    return { date: localDateKey(occurrence), kind: 'schedule', at: occurrence, legacyRecurrence: true }
  }
  if (task.dueDate) {
    const dateKey = isDateOnly(task.dueDate) ? task.dueDate.trim() : localDateKey(task.dueDate)
    const due = dateKey ? toDate(`${dateKey}T00:00:00`) : null
    if (due) return { date: dateKey, kind: 'deadline', at: due }
  }
  return null
}

export function isMainDateToday(task, now = new Date()) {
  const main = getMainDateInfo(task)
  return Boolean(main) && main.date === localDateKey(now)
}

export function isMainDateTomorrow(task, now = new Date()) {
  const main = getMainDateInfo(task)
  if (!main) return false
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return main.date === localDateKey(tomorrow)
}

export function isMainDateThisWeek(task, now = new Date()) {
  const main = getMainDateInfo(task)
  if (!main) return false
  const target = new Date(`${main.date}T00:00:00`)
  const startOfWeek = new Date(now)
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  startOfWeek.setDate(now.getDate() + diff)
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  return target >= startOfWeek && target <= endOfWeek
}

export function isTaskPlanned(task) {
  if (!task || isCompleted(task)) return false
  return hasSchedule(task) || hasDeadline(task)
}

export function isTaskInbox(task) {
  if (!task) return false
  return task.status === 'todo' && !hasSchedule(task) && !hasDeadline(task)
}

export function isTaskUnscheduled(task) {
  if (!task || isCompleted(task)) return false
  return !hasSchedule(task) && !hasDeadline(task)
}

export function isPastScheduled(task, now = new Date()) {
  if (!task || isCompleted(task)) return false
  const start = scheduleStartDate(task)
  if (!start) return false
  return localDateKey(start) < localDateKey(now)
}

export function isTaskToday(task, now = new Date()) {
  if (!task || isCompleted(task)) return false
  const todayKey = localDateKey(now)
  const main = getMainDateInfo(task)
  if (main && main.date === todayKey) return true
  if (hasDeadline(task) && localDateKey(task.dueDate) === todayKey) return true
  if (isOverdue(task, now)) return true
  if (isPastScheduled(task, now)) return true
  if (task.status === 'doing') return true
  return false
}

export function belongsToCategory(task, category) {
  switch (category) {
    case 'all':
      return true
    case 'inbox':
      return isTaskInbox(task)
    case 'today':
      return isTaskToday(task)
    case 'doing':
      return Boolean(task) && task.status === 'doing'
    case 'paused':
      return Boolean(task) && task.status === 'paused'
    case 'planned':
      return isTaskPlanned(task)
    case 'unscheduled':
      return isTaskUnscheduled(task)
    case 'completed':
      return isCompleted(task)
    default:
      return false
  }
}

/**
 * 同一日期内的稳定排序：有安排的按开始时间升序；只有截止的排在其后。
 */
export function compareTasksForDate(a, b) {
  const rank = (task) => (hasSchedule(task) ? 0 : 1)
  const rankDiff = rank(a) - rank(b)
  if (rankDiff !== 0) return rankDiff

  const sortValue = (task) => {
    if (hasSchedule(task)) {
      const start = scheduleStartDate(task)
      return start ? start.getTime() : Number.MAX_SAFE_INTEGER
    }
    if (task.dueDate) {
      const boundary = deadlineBoundary(task.dueDate, task.dueTime)
      // 同一日期内按截止时刻排序；rank 已保证截止任务排在安排任务之后，
      // 这里减一天只用于保留时刻的相对顺序。
      if (task.dueTime && boundary) return boundary.getTime() - 24 * 60 * 60 * 1000
      return Number.MAX_SAFE_INTEGER
    }
    return Number.MAX_SAFE_INTEGER
  }

  const valueDiff = sortValue(a) - sortValue(b)
  if (valueDiff !== 0) return valueDiff

  const createdA = toDate(a.createdAt)
  const createdB = toDate(b.createdAt)
  if (createdA && createdB && createdA.getTime() !== createdB.getTime()) {
    return createdA.getTime() - createdB.getTime()
  }
  return String(a.id).localeCompare(String(b.id))
}
