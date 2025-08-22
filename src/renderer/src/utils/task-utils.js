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
 * 按状态统计任务数量
 * @param {Array} tasks - 任务列表
 * @returns {Object} 各状态的任务数量
 */
export const getTaskStatusCounts = (tasks) => {
  return {
    done: tasks.filter(task => task.status === 'done').length,
    doing: tasks.filter(task => task.status === 'doing').length,
    paused: tasks.filter(task => task.status === 'paused').length,
    pending: tasks.filter(task => task.status === 'pending').length
  }
}