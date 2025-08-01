import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref([])
  const lists = ref([])
  const loading = ref(false)
  const listsLoading = ref(false)
  const currentCategory = ref('today')
  const currentListId = ref(null) // null表示显示所有清单的任务
  const searchQuery = ref('')
  const searchOptions = ref({
    content: true,
    status: true,
    date: false,
    caseSensitive: false
  })
  const showCompletedInAll = ref(false) // 控制在"所有任务"分类中是否显示已完成任务
  const showCompletedInToday = ref(false) // 控制在"今天"分类中是否显示已完成任务

  // 辅助函数：判断日期是否为今天
  const isToday = (date) => {
    if (!date) return false
    const today = new Date()
    const targetDate = new Date(date)
    return today.toDateString() === targetDate.toDateString()
  }

  // 辅助函数：判断日期是否为今天
  const isTodayTask = (task) => {
    return isToday(task.reminderTime) || isToday(task.createdAt)  || task.status === 'doing'
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
      // 在"所有任务"分类中，根据设置决定是否显示已完成任务
      return showCompletedInAll.value ? taskList : taskList.filter(task => task.status !== 'done')
    }
    
    let filteredTasks = taskList.filter(task => {
      switch (category) {
        case 'inbox':
          return task.status === 'todo' && !task.reminderTime
        case 'today':
          // 今天视图：包含提醒日期是今天的任务、今天创建的任务、以及正在进行的任务
          return isTodayTask(task)
        case 'doing':
          return task.status === 'doing'
        case 'paused':
          return task.status === 'paused'
        case 'planned':
          return !!task.reminderTime && task.status !== 'done'
        case 'completed':
          return task.status === 'done'
        default:
          return true
      }
    })
    
    // 对于今天视图，根据设置决定是否显示已完成任务
    if (category === 'today' && !showCompletedInToday.value) {
      filteredTasks = filteredTasks.filter(task => task.status !== 'done')
    }
    
    return filteredTasks
  }

  // 计算属性：根据清单过滤任务
  const filterTasksByList = (taskList, listId) => {
    if (listId === null) {
      return taskList // 显示所有清单的任务
    }
    return taskList.filter(task => task.listId === listId)
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

    // 根据清单过滤
    result = filterTasksByList(result, currentListId.value)

    // 根据分类过滤
    result = filterTasksByCategory(result, currentCategory.value)

    // 根据搜索条件过滤
    result = searchTasks(result, searchQuery.value, searchOptions.value)

    // 排序逻辑
    if (currentCategory.value === 'today') {
      // 今天视图的特殊排序：有提醒时间的在前，没有提醒时间的按创建时间排序（最新的在上方）
      result = [...result].sort((a, b) => {
        // 正在进行的任务优先级最高
        if (a.status === 'doing' && b.status !== 'doing') return -1
        if (a.status !== 'doing' && b.status === 'doing') return 1

        // 有提醒时间的任务优先
        if (a.reminderTime && b.reminderTime) {
          return new Date(a.reminderTime) - new Date(b.reminderTime)
        }
        if (a.reminderTime && !b.reminderTime) return -1
        if (!a.reminderTime && b.reminderTime) return 1

        // 都没有提醒时间，按创建时间排序（最新的在上方）
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
    // } else {
    //   // 其他视图的默认排序
    //   result = [...result].sort((a, b) => {
    //     // 正在进行的任务优先级最高
    //     if (a.status === 'doing' && b.status !== 'doing') return -1
    //     if (a.status !== 'doing' && b.status === 'doing') return 1

    //     // 有提醒时间的任务优先
    //     if (a.reminderTime && b.reminderTime) {
    //       return new Date(a.reminderTime) - new Date(b.reminderTime)
    //     }
    //     if (a.reminderTime && !b.reminderTime) return -1
    //     if (!a.reminderTime && b.reminderTime) return 1

    //     // 按创建时间排序（最新的在上方）
    //     return new Date(b.createdAt) - new Date(a.createdAt)
    //   })
    }

    return result
  })

  // 计算属性：分类统计
  const categoryCounts = computed(() => {
    // 根据当前选中的清单过滤任务
    const currentTasks = filterTasksByList(tasks.value, currentListId.value)
    const todayTasks = currentTasks.filter(t => isTodayTask(t))
    const todayCount = showCompletedInToday.value ? todayTasks.length : todayTasks.filter(t => t.status !== 'done').length
    
    return {
      inbox: currentTasks.filter(t => t.status === 'todo' && !t.reminderTime).length,
      today: todayCount,
      doing: currentTasks.filter(t => t.status === 'doing').length,
      paused: currentTasks.filter(t => t.status === 'paused').length,
      planned: currentTasks.filter(t => !!t.reminderTime && t.status !== 'done').length,
      all: showCompletedInAll.value ? currentTasks.length : currentTasks.filter(t => t.status !== 'done').length,
      completed: currentTasks.filter(t => t.status === 'done').length
    }
  })

  // 计算属性：清单任务统计
  const listTaskCounts = computed(() => {
    const counts = {}
    lists.value.forEach(list => {
      const listTasks = tasks.value.filter(task => task.listId === list.id)
      counts[list.id] = {
        total: listTasks.length,
        incomplete: listTasks.filter(task => task.status !== 'done').length,
        completed: listTasks.filter(task => task.status === 'done').length,
        doing: listTasks.filter(task => task.status === 'doing').length,
        paused: listTasks.filter(task => task.status === 'paused').length
      }
    })
    return counts
  })

  // 计算属性：当前选中的清单
  const currentList = computed(() => {
    if (currentListId.value === null) return null
    return lists.value.find(list => list.id === currentListId.value) || null
  })

  // 计算属性：排序后的清单列表
  const sortedLists = computed(() => {
    return [...lists.value].sort((a, b) => {
      // 默认清单始终在最前面
      if (a.isDefault) return -1
      if (b.isDefault) return 1
      // 其他清单按排序顺序排列
      return (a.sortOrder || 0) - (b.sortOrder || 0)
    })
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

  // 移动任务到清单
  const moveTaskToList = async (taskId, targetListId) => {
    try {
      const result = await window.electronAPI.invoke('task:moveToList', { taskId, targetListId })
      if (result.success) {
        await getAllTasks()
      }
      return result
    } catch (error) {
      console.error('移动任务失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 批量移动任务到清单
  const batchMoveTasksToList = async (taskIds, targetListId) => {
    try {
      const result = await window.electronAPI.invoke('task:batchMoveToList', { taskIds, targetListId })
      if (result.success) {
        await getAllTasks()
      }
      return result
    } catch (error) {
      console.error('批量移动任务失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 更新任务元数据
  const updateTaskMetadata = async (taskId, metadata) => {
    try {
      const result = await window.electronAPI.invoke('task:updateMetadata', { taskId, metadata })
      if (result.success) {
        await getAllTasks()
      }
      return result
    } catch (error) {
      console.error('更新任务元数据失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 设置任务备注
  const setTaskComment = async (taskId, comment) => {
    try {
      const result = await window.electronAPI.invoke('task:setComment', { taskId, comment })
      if (result.success) {
        await getAllTasks()
      }
      return result
    } catch (error) {
      console.error('设置任务备注失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 按分类获取任务
  const getTasksByCategory = async (category, listId = null) => {
    try {
      const result = await window.electronAPI.invoke('task:getByCategory', { category, listId })
      return result.success ? result.tasks : []
    } catch (error) {
      console.error('按分类获取任务失败:', error)
      return []
    }
  }

  // 搜索任务
  const searchTasksInBackend = async (query, listId = null) => {
    try {
      const result = await window.electronAPI.invoke('task:search', { query, listId })
      return result.success ? result.tasks : []
    } catch (error) {
      console.error('搜索任务失败:', error)
      return []
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

  // 设置是否在"所有任务"中显示已完成任务
  const setShowCompletedInAll = (show) => {
    showCompletedInAll.value = show
  }

  // 设置是否在"今天"中显示已完成任务
  const setShowCompletedInToday = (show) => {
    showCompletedInToday.value = show
  }

  // 设置当前清单
  const setCurrentListId = (listId) => {
    currentListId.value = listId
  }

  // 获取所有清单
  const getAllLists = async () => {
    try {
      listsLoading.value = true
      const result = await window.electronAPI.invoke('list:getAll')
      if (result.success) {
        lists.value = result.lists
      }
      return result.success ? result.lists : []
    } catch (error) {
      console.error('获取清单列表失败:', error)
      return []
    } finally {
      listsLoading.value = false
    }
  }

  // 创建清单
  const createList = async (name, color = '#007AFF', icon = 'list') => {
    try {
      const result = await window.electronAPI.invoke('list:create', { name, color, icon })
      if (result.success) {
        await getAllLists()
      }
      return result
    } catch (error) {
      console.error('创建清单失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 更新清单
  const updateList = async (listId, updates) => {
    try {
      const result = await window.electronAPI.invoke('list:update', { listId, updates })
      if (result.success) {
        await getAllLists()
      }
      return result
    } catch (error) {
      console.error('更新清单失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 删除清单
  const deleteList = async (listId, taskHandling = 'move') => {
    try {
      const result = await window.electronAPI.invoke('list:delete', { listId, taskHandling })
      if (result.success) {
        await getAllLists()
        await getAllTasks() // 任务可能被移动或删除
        
        // 如果删除的是当前选中的清单，清除选择
        if (currentListId.value === listId) {
          currentListId.value = null
        }
      }
      return result
    } catch (error) {
      console.error('删除清单失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 获取清单任务统计
  const getListTaskStats = async (listId) => {
    try {
      const result = await window.electronAPI.invoke('list:getTaskStats', { listId })
      return result.success ? result.stats : null
    } catch (error) {
      console.error('获取清单统计失败:', error)
      return null
    }
  }

  // 获取所有清单的任务统计
  const getAllListTaskCounts = async () => {
    try {
      const result = await window.electronAPI.invoke('list:getAllTaskCounts')
      return result.success ? result.counts : {}
    } catch (error) {
      console.error('获取清单任务统计失败:', error)
      return {}
    }
  }

  // 重新排序清单
  const reorderLists = async (sortOrders) => {
    try {
      const result = await window.electronAPI.invoke('list:reorder', { sortOrders })
      if (result.success) {
        await getAllLists()
      }
      return result
    } catch (error) {
      console.error('重新排序清单失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 搜索清单
  const searchLists = async (query) => {
    try {
      const result = await window.electronAPI.invoke('list:search', { query })
      return result.success ? result.lists : []
    } catch (error) {
      console.error('搜索清单失败:', error)
      return []
    }
  }

  // 根据ID获取清单
  const getListById = (listId) => {
    return lists.value.find(list => list.id === listId) || null
  }

  // 获取清单名称
  const getListName = (listId) => {
    const list = getListById(listId)
    return list ? list.name : '未知清单'
  }

  return {
    // 状态
    tasks,
    lists,
    loading,
    listsLoading,
    currentCategory,
    currentListId,
    searchQuery,
    searchOptions,
    showCompletedInAll,
    showCompletedInToday,

    // 计算属性
    filteredTasks,
    categoryCounts,
    listTaskCounts,
    currentList,
    sortedLists,
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
    moveTaskToList,
    batchMoveTasksToList,
    updateTaskMetadata,
    setTaskComment,
    getTasksByCategory,
    searchTasksInBackend,

    // 清单操作方法
    getAllLists,
    createList,
    updateList,
    deleteList,
    getListTaskStats,
    getAllListTaskCounts,
    reorderLists,
    searchLists,
    getListById,
    getListName,

    // 过滤和搜索方法
    setCurrentCategory,
    setCurrentListId,
    setSearchQuery,
    setSearchOptions,
    clearSearch,
    setShowCompletedInAll,
    setShowCompletedInToday,

    // 辅助函数
    getStatusText,
    formatTimeDisplay,
    formatDuration
  }
})