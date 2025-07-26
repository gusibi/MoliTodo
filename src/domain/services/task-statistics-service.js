/**
 * 任务统计服务 (Task Statistics Service)
 * 提供任务相关的统计计算功能
 */
const Task = require('../entities/task.js');

export class TaskStatisticsService {
  /**
   * 计算任务分类统计
   * @param {Array} tasks 任务列表
   * @returns {Object} 分类统计结果
   */
  static calculateCategoryCounts(tasks = []) {
    return {
      inbox: tasks.filter(t => t.isInboxTask ? t.isInboxTask() : (t.status === 'todo' && !t.reminderTime)).length,
      today: tasks.filter(t => t.isTodayTask ? t.isTodayTask() : (Task.isToday(t.reminderTime) || t.status === 'doing')).length,
      doing: tasks.filter(t => t.isDoingTask ? t.isDoingTask() : (t.status === 'doing')).length,
      paused: tasks.filter(t => t.isPausedTask ? t.isPausedTask() : (t.status === 'paused')).length,
      planned: tasks.filter(t => t.isPlannedTask ? t.isPlannedTask() : !!t.reminderTime).length,
      all: tasks.length,
      completed: tasks.filter(t => t.isCompletedTask ? t.isCompletedTask() : (t.status === 'done')).length
    }
  }

  /**
   * 计算任务状态统计
   * @param {Array} tasks 任务列表
   * @returns {Object} 状态统计结果
   */
  static calculateStatusCounts(tasks = []) {
    return {
      todo: tasks.filter(task => task.status === 'todo').length,
      doing: tasks.filter(task => task.status === 'doing').length,
      paused: tasks.filter(task => task.status === 'paused').length,
      done: tasks.filter(task => task.status === 'done').length,
      total: tasks.length
    }
  }

  /**
   * 计算总耗时
   * @param {Array} tasks 任务列表
   * @returns {number} 总耗时（毫秒）
   */
  static calculateTotalDuration(tasks = []) {
    return tasks.reduce((sum, task) => {
      let taskDuration = task.totalDuration || 0
      
      // 如果任务正在进行中，加上当前进行时长
      if (task.status === 'doing' && task.startedAt) {
        const currentDuration = Date.now() - new Date(task.startedAt).getTime()
        taskDuration += currentDuration
      }
      
      return sum + taskDuration
    }, 0)
  }

  /**
   * 计算平均完成时间
   * @param {Array} tasks 任务列表
   * @returns {number} 平均完成时间（毫秒）
   */
  static calculateAverageCompletionTime(tasks = []) {
    const completedTasks = tasks.filter(task => task.status === 'done' && task.totalDuration)
    if (completedTasks.length === 0) return 0
    
    const totalDuration = completedTasks.reduce((sum, task) => sum + (task.totalDuration || 0), 0)
    return totalDuration / completedTasks.length
  }

  /**
   * 计算今日统计
   * @param {Array} tasks 任务列表
   * @returns {Object} 今日统计结果
   */
  static calculateTodayStats(tasks = []) {
    const todayTasks = tasks.filter(task => {
      return Task.isToday(task.reminderTime) || 
             Task.isToday(task.createdAt) || 
             task.status === 'doing'
    })

    return {
      total: todayTasks.length,
      completed: todayTasks.filter(task => task.status === 'done').length,
      inProgress: todayTasks.filter(task => task.status === 'doing').length,
      pending: todayTasks.filter(task => task.status === 'todo').length,
      totalDuration: this.calculateTotalDuration(todayTasks)
    }
  }

  /**
   * 计算完整的任务统计信息
   * @param {Array} tasks 任务列表
   * @returns {Object} 完整统计结果
   */
  static calculateFullStatistics(tasks = []) {
    const statusCounts = this.calculateStatusCounts(tasks)
    const categoryCounts = this.calculateCategoryCounts(tasks)
    const todayStats = this.calculateTodayStats(tasks)
    
    return {
      // 状态统计
      status: statusCounts,
      
      // 分类统计
      categories: categoryCounts,
      
      // 今日统计
      today: todayStats,
      
      // 时间统计
      duration: {
        total: this.calculateTotalDuration(tasks),
        average: this.calculateAverageCompletionTime(tasks)
      },
      
      // 进度统计
      progress: {
        completionRate: tasks.length > 0 ? (statusCounts.done / tasks.length * 100).toFixed(1) : 0,
        activeTasksCount: statusCounts.doing + statusCounts.paused
      }
    }
  }

  /**
   * 格式化时长显示
   * @param {number} milliseconds 毫秒数
   * @param {boolean} compact 是否使用紧凑格式
   * @returns {string} 格式化后的时长字符串
   */
  static formatDuration(milliseconds, compact = false) {
    if (!milliseconds || milliseconds < 1000) {
      return compact ? '0m' : '0分钟'
    }

    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (compact) {
      if (days > 0) {
        return `${days}d${hours % 24}h`
      } else if (hours > 0) {
        return `${hours}h${minutes % 60}m`
      } else {
        return `${minutes}m`
      }
    } else {
      if (days > 0) {
        return `${days}天${hours % 24}小时`
      } else if (hours > 0) {
        return `${hours}小时${minutes % 60}分钟`
      } else {
        return `${minutes}分钟`
      }
    }
  }

  /**
   * 获取状态显示文本
   * @param {string} status 状态值
   * @returns {string} 状态显示文本
   */
  static getStatusText(status) {
    const statusMap = {
      'todo': '待办',
      'doing': '进行中',
      'paused': '暂停中',
      'done': '已完成'
    }
    return statusMap[status] || status
  }

  /**
   * 计算任务优先级分布
   * @param {Array} tasks 任务列表
   * @returns {Object} 优先级分布统计
   */
  static calculatePriorityDistribution(tasks = []) {
    return {
      high: tasks.filter(task => task.priority === 'high').length,
      medium: tasks.filter(task => task.priority === 'medium').length,
      low: tasks.filter(task => task.priority === 'low').length,
      none: tasks.filter(task => !task.priority).length
    }
  }

  /**
   * 计算任务创建趋势（按日期）
   * @param {Array} tasks 任务列表
   * @param {number} days 统计天数，默认7天
   * @returns {Array} 每日创建任务数量
   */
  static calculateCreationTrend(tasks = [], days = 7) {
    const trend = []
    const today = new Date()
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      const dayTasks = tasks.filter(task => {
        const taskDate = new Date(task.createdAt)
        return taskDate.getFullYear() === date.getFullYear() &&
               taskDate.getMonth() === date.getMonth() &&
               taskDate.getDate() === date.getDate()
      })
      
      trend.push({
        date: date.toISOString().split('T')[0],
        count: dayTasks.length,
        completed: dayTasks.filter(task => task.status === 'done').length
      })
    }
    
    return trend
  }

  /**
   * 根据分类过滤任务
   * @param {Array} tasks 任务列表
   * @param {string} category 分类名称
   * @returns {Array} 过滤后的任务列表
   */
  static filterTasksByCategory(tasks = [], category = 'all') {
    if (category === 'all') {
      return tasks
    }

    return tasks.filter(task => {
      switch (category) {
        case 'inbox':
          return task.status === 'todo' && !task.reminderTime
        case 'today':
          return (Task.isToday(task.reminderTime) && task.status !== 'done') || (task.status === 'doing')
        case 'doing':
          return task.status === 'doing'
        case 'paused':
          return task.status === 'paused'
        case 'planned':
          return !!task.reminderTime
        case 'completed':
          return task.status === 'done'
        default:
          return true
      }
    })
  }

  /**
   * 根据搜索条件过滤任务
   * @param {Array} tasks 任务列表
   * @param {string} query 搜索查询
   * @param {Object} options 搜索选项
   * @returns {Array} 过滤后的任务列表
   */
  static searchTasks(tasks = [], query = '', options = {}) {
    if (!query) {
      return tasks
    }

    const defaultOptions = {
      content: true,
      status: true,
      date: false,
      caseSensitive: false
    }
    
    const searchOptions = { ...defaultOptions, ...options }
    const searchQuery = searchOptions.caseSensitive ? query : query.toLowerCase()

    return tasks.filter(task => {
      let matches = false
      
      // 搜索内容和描述
      if (searchOptions.content) {
        const content = searchOptions.caseSensitive ? task.content : task.content.toLowerCase()
        const description = searchOptions.caseSensitive ? (task.description || '') : (task.description || '').toLowerCase()
        matches = matches || content.includes(searchQuery) || description.includes(searchQuery)
      }
      
      // 搜索状态
      if (searchOptions.status) {
        const statusText = this.getStatusText(task.status)
        const status = searchOptions.caseSensitive ? statusText : statusText.toLowerCase()
        matches = matches || status.includes(searchQuery)
      }
      
      // 搜索日期
      if (searchOptions.date) {
        const dateTexts = [
          task.createdAt ? this.formatCreatedTime(task.createdAt) : '',
          task.reminderTime ? this.formatReminderTime(task.reminderTime) : '',
          task.completedAt ? this.formatCompletedTime(task.completedAt) : ''
        ]
        
        for (const dateText of dateTexts) {
          const date = searchOptions.caseSensitive ? dateText : dateText.toLowerCase()
          if (date.includes(searchQuery)) {
            matches = true
            break
          }
        }
      }
      
      return matches
    })
  }

  /**
   * 格式化提醒时间显示
   * @param {string} dateString 日期字符串
   * @returns {string} 格式化后的时间字符串
   */
  static formatReminderTime(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    if (taskDate.getTime() === today.getTime()) {
      return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    } else if (taskDate.getTime() === tomorrow.getTime()) {
      return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleString('zh-CN', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  /**
   * 格式化创建时间显示
   * @param {string} dateString 日期字符串
   * @returns {string} 格式化后的时间字符串
   */
  static formatCreatedTime(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return '今天'
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }

  /**
   * 格式化完成时间显示
   * @param {string} dateString 日期字符串
   * @returns {string} 格式化后的时间字符串
   */
  static formatCompletedTime(dateString) {
    if (!dateString) return ''
    return this.formatCreatedTime(dateString)
  }
}