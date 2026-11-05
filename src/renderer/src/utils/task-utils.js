/**
 * 任务相关工具函数
 * 统一管理时间格式化、任务状态判断等逻辑
 */

/**
 * 判断任务是否超时
 * @param {Object} task - 任务对象
 * @returns {boolean} 是否超时
 */
export const isTaskOvertime = (task) => {
  if (task.status !== 'doing' || !task.startedAt) return false
  const currentDuration = getCurrentDuration(task)
  return currentDuration > 2 * 60 * 60 * 1000 // 超过2小时
}

/**
 * 获取任务当前持续时间
 * @param {Object} task - 任务对象
 * @returns {number} 当前持续时间（毫秒）
 */
export const getCurrentDuration = (task) => {
  if (!task.startedAt) return task.totalDuration || 0
  const now = Date.now()
  const sessionDuration = now - new Date(task.startedAt).getTime()
  return (task.totalDuration || 0) + sessionDuration
}

/**
 * 格式化持续时间（中文格式）
 * @param {number} duration - 持续时间（毫秒）
 * @returns {string} 格式化后的时间字符串
 */
export const formatDuration = (duration) => {
  if (!duration) return '0分钟'

  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  }
  return `${minutes}分钟`
}

/**
 * 格式化持续时间（英文格式）
 * @param {number} duration - 持续时间（毫秒）
 * @returns {string} 格式化后的时间字符串
 */
export const formatDurationEn = (duration) => {
  if (!duration) return '0s'

  const totalSeconds = Math.floor(duration / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * 计算任务列表的总持续时间
 * @param {Array} tasks - 任务列表
 * @returns {number} 总持续时间（毫秒）
 */
export const calculateTotalDuration = (tasks) => {
  return tasks.reduce((total, task) => {
    return total + (task.totalDuration || 0)
  }, 0)
}

/**
 * 判断提醒时间是否已过（行上提醒 pill 的逾期红状态）
 * @param {string|Date} reminderTime - 提醒时间
 * @returns {boolean} 是否已过期
 */
export const isReminderOverdue = (reminderTime) => {
  return new Date(reminderTime) < new Date()
}

/**
 * 格式化提醒时间
 * @param {string|Date} reminderTime - 提醒时间
 * @returns {string} 格式化后的提醒时间字符串
 */
export const formatReminderTime = (reminderTime) => {
  const date = new Date(reminderTime)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (taskDate.getTime() === today.getTime()) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (taskDate.getTime() === tomorrow.getTime()) {
    return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
}
