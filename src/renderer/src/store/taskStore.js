import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref([])
  const loading = ref(false)
  const currentCategory = ref('inbox')
  const searchQuery = ref('')
  const searchOptions = ref({
    content: true,
    status: true,
    date: false,
    caseSensitive: false
  })

  // 辅助函数：判断日期是否为今天
  const isToday = (date) => {
    if (!date) return false
    const today = new Date()
    const targetDate = new Date(date)
    return today.toDateString() === targetDate.toDateString()
  }

  // 辅助函数：获取状态显示文本
  const getStatusText = (status) => {
    const statusMap = {
      'todo': '待办',
      'doing': '进行中',
      'paused': '暂停中',
      'done': '已完成'
    }
    return statusMap[status] || status
  }

  // 辅助函数：格式化时间显示
  const formatTimeDisplay = (dateString, type = 'created') => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    
    if (type === 'reminder') {
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
    } else {
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
  }

  // 计算属性：根据分类过滤任务
  const filterTasksByCategory = (taskList, category) => {
    if (category === 'all') {
      return taskList
    }

    return taskList.filter(task => {
      switch (category) {
        case 'inbox':
          return task.status === 'todo' && !task.reminderTime
        case 'today':
          return (isToday(task.reminderTime) && task.status !== 'done') || (task.status === 'doing')
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

  // 计算属性：根据搜索条件过滤任务
  const searchTasks = (taskList, query, options) => {
    if (!query) {
      return taskList
    }

    const searchQuery = options.caseSensitive ? query : query.toLowerCase()

    return taskList.filter(task => {
      let matches = false
      
      // 搜索内容和描述
      if (options.content) {
        const content = options.caseSensitive ? task.content : task.content.toLowerCase()
        const description = options.caseSensitive ? (task.description || '') : (task.description || '').toLowerCase()
        matches = matches || content.includes(searchQuery) || description.includes(searchQuery)
      }
      
      // 搜索状态
      if (options.status) {
        const statusText = getStatusText(task.status)
        const status = options.caseSensitive ? statusText : statusText.toLowerCase()
        matches = matches || status.includes(searchQuery)
      }
      
      // 搜索日期
      if (options.date) {
        const dateTexts = [
          task.createdAt ? formatTimeDisplay(task.createdAt, 'created') : '',
          task.reminderTime ? formatTimeDisplay(task.reminderTime, 'reminder') : '',
          task.completedAt ? formatTimeDisplay(task.completedAt, 'created') : ''
        ]
        
        for (const dateText of dateTexts) {
          const date = options.caseSensitive ? dateText : dateText.toLowerCase()
          if (date.includes(searchQuery)) {
            matches = true
            break
          }
        }
      }
      
      return matches
    })
  }

  // 计算属性：过滤后的任务
  const filteredTasks = computed(() => {
    let result = tasks.value

    // 根据分类过滤
    result = filterTasksByCategory(result, currentCategory.value)

    // 根据搜索条件过滤
    result = searchTasks(result, searchQuery.value, searchOptions.value)

    return result
  })

  // 计算属性：分类统计
  const categoryCounts = computed(() => {
    return {
      inbox: tasks.value.filter(t => t.status === 'todo' && !t.reminderTime).length,
      today: tasks.value.filter(t => (isToday(t.reminderTime) && t.status !== 'done') || t.status === 'doing').length,
      doing: tasks.value.filter(t => t.status === 'doing').length,
      paused: tasks.value.filter(t => t.status === 'paused').length,
      planned: tasks.value.filter(t => !!t.reminderTime).length,
      all: tasks.value.length,
      completed: tasks.value.filter(t => t.status === 'done').length
    }
  })

  // 计算属性：状态统计（基于当前过滤的任务）
  const statusCounts = computed(() => {
    const currentTasks = filteredTasks.value
    return {
      todo: currentTasks.filter(task => task.status === 'todo').length,
      doing: currentTasks.filter(task => task.status === 'doing').length,
      paused: currentTasks.filter(task => task.status === 'paused').length,
      done: currentTasks.filter(task => task.status === 'done').length,
      total: currentTasks.length
    }
  })

  // 计算属性：总耗时（基于当前过滤的任务）
  const totalDuration = computed(() => {
    const currentTasks = filteredTasks.value
    return currentTasks.reduce((sum, task) => {
      let taskDuration = task.totalDuration || 0
      
      // 如果任务正在进行中，加上当前进行时长
      if (task.status === 'doing' && task.startedAt) {
        const currentDuration = Date.now() - new Date(task.startedAt).getTime()
        taskDuration += currentDuration
      }
      
      return sum + taskDuration
    }, 0)
  })

  // 格式化时长显示
  const formatDuration = (milliseconds, compact = false) => {
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

  // 计算平均完成时间
  const calculateAverageCompletionTime = (taskList) => {
    const completedTasks = taskList.filter(task => task.status === 'done' && task.totalDuration)
    if (completedTasks.length === 0) return 0
    
    const totalDuration = completedTasks.reduce((sum, task) => sum + (task.totalDuration || 0), 0)
    return Math.floor(totalDuration / completedTasks.length)
  }

  // 计算属性：完整统计（用于Settings页面）
  const fullStatistics = computed(() => {
    const allTasks = tasks.value
    const statusStats = {
      todo: allTasks.filter(task => task.status === 'todo').length,
      doing: allTasks.filter(task => task.status === 'doing').length,
      paused: allTasks.filter(task => task.status === 'paused').length,
      done: allTasks.filter(task => task.status === 'done').length,
      total: allTasks.length
    }

    const totalDur = allTasks.reduce((sum, task) => {
      let taskDuration = task.totalDuration || 0
      if (task.status === 'doing' && task.startedAt) {
        const currentDuration = Date.now() - new Date(task.startedAt).getTime()
        taskDuration += currentDuration
      }
      return sum + taskDuration
    }, 0)

    return {
      status: statusStats,
      duration: {
        total: totalDur,
        average: calculateAverageCompletionTime(allTasks)
      },
      progress: {
        completionRate: allTasks.length > 0 ? (statusStats.done / allTasks.length * 100).toFixed(1) : 0,
        activeTasksCount: statusStats.doing + statusStats.paused
      }
    }
  })

  // 获取所有任务
  const getAllTasks = async () => {
    try {
      loading.value = true
      const result = await window.electronAPI.tasks.getAll()
      // 直接使用从后端返回的任务数据，不需要转换为Task实例
      // 因为渲染进程应该通过领域服务与任务交互，而不是直接操作Task实体
      tasks.value = result
      return tasks.value
    } catch (error) {
      console.error('获取所有任务失败:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  // 获取未完成任务
  const getIncompleteTasks = async () => {
    try {
      loading.value = true
      const result = await window.electronAPI.tasks.getIncomplete()
      tasks.value = result
      return result
    } catch (error) {
      console.error('获取未完成任务失败:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  // 获取已完成任务
  const getCompletedTasks = async () => {
    try {
      loading.value = true
      const result = await window.electronAPI.tasks.getCompleted()
      return result
    } catch (error) {
      console.error('获取已完成任务失败:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  // 创建任务
  const createTask = async (taskData) => {
    try {
      const result = await window.electronAPI.tasks.create(taskData)
      if (result.success) {
        await getAllTasks() // 重新获取任务列表
      }
      return result
    } catch (error) {
      console.error('创建任务失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 更新任务
  const updateTask = async (taskId, updates) => {
    try {
      const result = await window.electronAPI.tasks.update(taskId, updates)
      if (result.success) {
        await getAllTasks() // 重新获取任务列表
      }
      return result
    } catch (error) {
      console.error('更新任务失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 完成任务
  const completeTask = async (taskId) => {
    try {
      const result = await window.electronAPI.tasks.complete(taskId)
      if (result.success) {
        await getAllTasks() // 重新获取任务列表
      }
      return result
    } catch (error) {
      console.error('完成任务失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 删除任务
  const deleteTask = async (taskId) => {
    try {
      const result = await window.electronAPI.tasks.delete(taskId)
      if (result.success) {
        await getAllTasks() // 重新获取任务列表
      }
      return result
    } catch (error) {
      console.error('删除任务失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 开始任务
  const startTask = async (taskId) => {
    try {
      console.log('taskStore.startTask 被调用，任务ID:', taskId)
      const result = await window.electronAPI.tasks.start(taskId)
      console.log('startTask 结果:', result)
      if (result.success) {
        await getAllTasks()
      } else {
        // 显示错误信息
        console.error('开始任务失败:', result.error)
        alert(`开始任务失败: ${result.error}`)
      }
      return result
    } catch (error) {
      console.error('开始任务失败:', error)
      alert(`开始任务失败: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  // 暂停任务
  const pauseTask = async (taskId) => {
    try {
      const result = await window.electronAPI.tasks.pause(taskId)
      if (result.success) {
        await getAllTasks()
      }
      return result
    } catch (error) {
      console.error('暂停任务失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 设置当前分类
  const setCurrentCategory = (category) => {
    currentCategory.value = category
  }

  // 设置搜索查询
  const setSearchQuery = (query) => {
    searchQuery.value = query
  }

  // 设置搜索选项
  const setSearchOptions = (options) => {
    searchOptions.value = { ...searchOptions.value, ...options }
  }

  // 清除搜索
  const clearSearch = () => {
    searchQuery.value = ''
  }

  return {
    // 状态
    tasks,
    loading,
    currentCategory,
    searchQuery,
    searchOptions,
    
    // 计算属性
    filteredTasks,
    categoryCounts,
    statusCounts,
    totalDuration,
    fullStatistics,
    
    // 任务操作方法
    getAllTasks,
    getIncompleteTasks,
    getCompletedTasks,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    startTask,
    pauseTask,
    
    // 过滤和搜索方法
    setCurrentCategory,
    setSearchQuery,
    setSearchOptions,
    clearSearch,
    
    // 辅助函数
    getStatusText,
    formatTimeDisplay,
    formatDuration
  }
})