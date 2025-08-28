import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
// 搜索功能通过 IPC 调用主进程

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
  const showCompletedInWeekly = ref(false) // 控制在"周视图"中是否显示已完成任务
  const showCompletedInMonthly = ref(false) // 控制在"月视图"中是否显示已完成任务
  const customReminderOptions = ref([]) // 自定义提醒选项
  const expandedTasks = ref([]) // 展开后的任务（包含重复任务实例）
  const recurringTasks = ref([]) // 重复任务列表
  const showRecurringInstances = ref(false) // 是否显示重复任务实例

  // AI 相关状态
  const availableAIModels = ref([]) // 可用的AI模型列表
  const selectedAIModel = ref(null) // 当前选中的AI模型
  const isAIEnabled = ref(false) // AI功能是否启用

  // 辅助函数：判断日期是否为今天
  const isToday = (date) => {
    if (!date) return false
    const today = new Date()
    const targetDate = new Date(date)
    return today.toDateString() === targetDate.toDateString()
  }

  // 辅助函数：判断日期是否为今天
  const isTodayTask = (task) => {
    // 1. 提醒日期是今天的任务
    if (isToday(task.reminderTime)) return true

    // 2. 今天创建的任务
    if (isToday(task.createdAt)) return true

    // 3. 正在进行的任务
    if (task.status === 'doing') return true

    // 4. 有提醒时间，且已经过期还未完成的任务
    if (task.reminderTime && task.status !== 'done') {
      const reminderDate = new Date(task.reminderTime)
      const today = new Date()
      // 如果提醒时间早于今天，说明已经过期
      if (reminderDate < today && !isToday(task.reminderTime)) {
        return true
      }
    }

    return false
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

  // 统一的任务过滤方法
  const getTasksByFilter = (category, listId = null, includeCompleted = null) => {
    let filteredTasks = tasks.value

    // 根据清单过滤
    if (listId !== null) {
      filteredTasks = filteredTasks.filter(task => task.listId === listId)
    }

    // 根据分类过滤
    switch (category) {
      case 'inbox':
        filteredTasks = filteredTasks.filter(task => task.status === 'todo' && !task.reminderTime)
        break
      case 'today':
        filteredTasks = filteredTasks.filter(task => isTodayTask(task))
        // 根据设置决定是否包含已完成任务
        if (includeCompleted === false || (includeCompleted === null && !showCompletedInToday.value)) {
          filteredTasks = filteredTasks.filter(task => task.status !== 'done')
        }
        break
      case 'doing':
        filteredTasks = filteredTasks.filter(task => task.status === 'doing')
        break
      case 'paused':
        filteredTasks = filteredTasks.filter(task => task.status === 'paused')
        break
      case 'planned':
        filteredTasks = filteredTasks.filter(task => !!task.reminderTime && task.status !== 'done')
        break
      case 'all':
        // 根据设置决定是否包含已完成任务
        if (includeCompleted === false || (includeCompleted === null && !showCompletedInAll.value)) {
          filteredTasks = filteredTasks.filter(task => task.status !== 'done')
        }
        break
      case 'completed':
        filteredTasks = filteredTasks.filter(task => task.status === 'done')
        break
      default:
        break
    }

    return filteredTasks
  }

  // 获取分类任务计数
  const getCategoryCount = (category, listId = null) => {
    const filteredTasks = getTasksByFilter(category, listId)
    return filteredTasks.length
  }

  // 获取分类的完整统计信息
  const getCategoryStats = (category, listId = null) => {
    const allTasks = getTasksByFilter(category, listId, true) // 包含所有状态的任务
    const incompleteTasks = allTasks.filter(task => task.status !== 'done')
    const completedTasks = allTasks.filter(task => task.status === 'done')

    return {
      total: allTasks.length,
      incomplete: incompleteTasks.length,
      completed: completedTasks.length,
      doing: allTasks.filter(task => task.status === 'doing').length,
      paused: allTasks.filter(task => task.status === 'paused').length,
      todo: allTasks.filter(task => task.status === 'todo').length
    }
  }

  // 本地搜索函数
  const searchTasksLocally = (tasks, query, options = {}) => {
    if (!query || !query.trim()) return tasks
    
    const searchTerm = options.caseSensitive ? query.trim() : query.trim().toLowerCase()
    
    return tasks.filter(task => {
      const content = options.caseSensitive ? task.content : task.content.toLowerCase()
      const note = task.metadata?.note || ''
      const description = options.caseSensitive ? note : note.toLowerCase()
      
      return content.includes(searchTerm) || description.includes(searchTerm)
    })
  }

  // 获取排序后的任务列表
  const getSortedTasks = (category, listId = null, includeCompleted = null) => {
    let filteredTasks = getTasksByFilter(category, listId, includeCompleted)
    
    // 应用搜索过滤
    filteredTasks = searchTasksLocally(filteredTasks, searchQuery.value, searchOptions.value)

    // 排序逻辑
    if (category === 'completed') {
      // 已完成任务视图：按完成时间倒序排列（最新完成的在前面）
      filteredTasks = [...filteredTasks].sort((a, b) => {
        // 都是已完成任务，按完成时间排序
        if (a.completedAt && b.completedAt) {
          return new Date(b.completedAt) - new Date(a.completedAt)
        }
        // 如果没有完成时间，按更新时间排序
        return new Date(b.updatedAt) - new Date(a.updatedAt)
      })
    } else if (category === 'today') {
      // 今天视图的特殊排序
      filteredTasks = [...filteredTasks].sort((a, b) => {
        // 已完成的任务排在最后，并按完成时间排序
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        if (a.status === 'done' && b.status === 'done') {
          // 都是已完成任务，按完成时间排序
          if (a.completedAt && b.completedAt) {
            return new Date(b.completedAt) - new Date(a.completedAt)
          }
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        }

        // 正在进行的任务优先级最高（在未完成任务中）
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
    } else {
      // 其他视图的默认排序
      filteredTasks = [...filteredTasks].sort((a, b) => {
        // 已完成的任务排在最后，并按完成时间排序
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        if (a.status === 'done' && b.status === 'done') {
          // 都是已完成任务，按完成时间排序
          if (a.completedAt && b.completedAt) {
            return new Date(b.completedAt) - new Date(a.completedAt)
          }
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        }

        // 正在进行的任务优先级最高（在未完成任务中）
        if (a.status === 'doing' && b.status !== 'doing') return -1
        if (a.status !== 'doing' && b.status === 'doing') return 1

        // 有提醒时间的任务优先
        if (a.reminderTime && b.reminderTime) {
          return new Date(a.reminderTime) - new Date(b.reminderTime)
        }
        if (a.reminderTime && !b.reminderTime) return -1
        if (!a.reminderTime && b.reminderTime) return 1

        // 按创建时间排序（最新的在上方）
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
    }

    return filteredTasks
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

  // 计算属性：过滤后的任务
  const filteredTasks = computed(() => {
    let result = tasks.value

    // 根据清单过滤
    result = filterTasksByList(result, currentListId.value)

    // 根据分类过滤
    result = filterTasksByCategory(result, currentCategory.value)

    // 根据搜索条件过滤
    result = searchTasksLocally(result, searchQuery.value, searchOptions.value)

    // 排序逻辑
    if (currentCategory.value === 'completed') {
      // 已完成任务视图：按完成时间倒序排列（最新完成的在前面）
      result = [...result].sort((a, b) => {
        // 都是已完成任务，按完成时间排序
        if (a.completedAt && b.completedAt) {
          return new Date(b.completedAt) - new Date(a.completedAt)
        }
        // 如果没有完成时间，按更新时间排序
        return new Date(b.updatedAt) - new Date(a.updatedAt)
      })
    } else if (currentCategory.value === 'today') {
      // 今天视图的特殊排序：有提醒时间的在前，没有提醒时间的按创建时间排序（最新的在上方）
      result = [...result].sort((a, b) => {
        // 已完成的任务排在最后，并按完成时间排序
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        if (a.status === 'done' && b.status === 'done') {
          // 都是已完成任务，按完成时间排序
          if (a.completedAt && b.completedAt) {
            return new Date(b.completedAt) - new Date(a.completedAt)
          }
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        }

        // 正在进行的任务优先级最高（在未完成任务中）
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
    } else {
      // 其他视图的默认排序
      result = [...result].sort((a, b) => {
        // 已完成的任务排在最后，并按完成时间排序
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        if (a.status === 'done' && b.status === 'done') {
          // 都是已完成任务，按完成时间排序
          if (a.completedAt && b.completedAt) {
            return new Date(b.completedAt) - new Date(a.completedAt)
          }
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        }

        // 正在进行的任务优先级最高（在未完成任务中）
        if (a.status === 'doing' && b.status !== 'doing') return -1
        if (a.status !== 'doing' && b.status === 'doing') return 1

        // 有提醒时间的任务优先
        if (a.reminderTime && b.reminderTime) {
          return new Date(a.reminderTime) - new Date(b.reminderTime)
        }
        if (a.reminderTime && !b.reminderTime) return -1
        if (!a.reminderTime && b.reminderTime) return 1

        // 按创建时间排序（最新的在上方）
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
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

  // 直接设置任务数据（用于智能刷新，避免重复网络请求）
  const setTasks = (newTasks) => {
    tasks.value = newTasks
  }

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
      // 序列化数据以确保可以通过 IPC 传递
      const serializedData = JSON.parse(JSON.stringify(taskData))
      console.log('[createTask] taskData 序列化测试:', serializedData)
      
      const result = await window.electronAPI.tasks.create(serializedData)
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
      console.log("updates-----:", updates)
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
      // console.log('taskStore.startTask 被调用，任务ID:', taskId)
      const result = await window.electronAPI.tasks.start(taskId)
      // console.log('startTask 结果:', result)
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

  // 设置是否在"周视图"中显示已完成任务
  const setShowCompletedInWeekly = (show) => {
    showCompletedInWeekly.value = show
  }

  // 设置是否在"月视图"中显示已完成任务
  const setShowCompletedInMonthly = (show) => {
    showCompletedInMonthly.value = show
  }

  // 设置当前清单
  const setCurrentListId = (listId) => {
    currentListId.value = listId
    // 如果当前显示重复任务实例，需要重新展开对应列表的重复任务
    if (showRecurringInstances.value) {
      const now = new Date()
      const futureDate = new Date(now)
      futureDate.setMonth(futureDate.getMonth() + 3) // 展开未来3个月的重复任务
      expandRecurringTasks(now, futureDate, listId)
    }
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

  // 获取默认提醒选项
  const getDefaultReminderOptions = () => {
    return [
      { id: 1, label: '30分钟后', type: 'relative', value: 30, unit: 'minutes' },
      { id: 2, label: '1小时后', type: 'relative', value: 1, unit: 'hours' },
      { id: 5, label: '下周', type: 'relative', value: 7, unit: 'days' },
      { id: 6, label: '今天下午4点', type: 'absolute', time: '16:00', dayOffset: 0 },
      { id: 8, label: '3天后上午10点', type: 'absolute', time: '10:00', dayOffset: 3 }
    ]
  }

  // 加载自定义提醒选项
  const loadCustomReminderOptions = async () => {
    try {
      if (window.electronAPI && window.electronAPI.config) {
        const config = await window.electronAPI.config.getAll()
        // console.log("config reload: ", config)

        if (config.customReminders && Array.isArray(config.customReminders)) {
          // 创建新数组以确保 Vue 响应式系统检测到变化
          customReminderOptions.value = [...config.customReminders]
          // console.log("config setting: ", customReminderOptions.value)
        } else {
          customReminderOptions.value = getDefaultReminderOptions()
        }
      } else {
        customReminderOptions.value = getDefaultReminderOptions()
      }
    } catch (error) {
      console.error('加载自定义提醒选项失败:', error)
      customReminderOptions.value = getDefaultReminderOptions()
    }
  }

  // 更新自定义提醒选项（当设置页面更新时调用）
  const refreshCustomReminderOptions = async () => {
    console.log('refreshCustomReminderOptions 被调用')
    console.log('更新前的 customReminderOptions:', customReminderOptions.value)
    await loadCustomReminderOptions()
    console.log('更新后的 customReminderOptions:', customReminderOptions.value)
  }

  // 重复任务相关方法
  
  // 获取所有重复任务
  const getRecurringTasks = async () => {
    try {
      const result = await window.electronAPI.tasks.getRecurring()
      console.log("getRecurringTasks result: ", result)
      if (result.success) {
        recurringTasks.value = result.tasks
        return result.tasks
      }
      return []
    } catch (error) {
      console.error('获取重复任务失败:', error)
      return []
    }
  }

  // 展开重复任务为实例
  const expandRecurringTasks = async (startDate, endDate, listId = null) => {
    try {
      const result = await window.electronAPI.tasks.expandRecurring({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        listId: listId
      })
      console.log("expandRecurringTasks result: ", result)
      if (result.success) {
        expandedTasks.value = result.tasks
        return result.tasks
      }
      return []
    } catch (error) {
      console.error('展开重复任务失败:', error)
      return []
    }
  }

  // 创建重复任务
  const createRecurringTask = async (taskData) => {
    try {
      // 序列化数据以确保可以通过 IPC 传递
      const serializedData = JSON.parse(JSON.stringify(taskData))
      console.log('createRecurringTask taskData 序列化测试:', serializedData)
      
      const result = await window.electronAPI.tasks.createRecurring(serializedData)
      if (result.success) {
        await getAllTasks()
        await getRecurringTasks()
      }
      return result
    } catch (error) {
      console.error('创建重复任务失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 更新重复任务
  const updateRecurringTask = async (taskId, updates, recurrence = null) => {
    try {
      // 序列化检查和清理数据
      const cleanUpdates = JSON.parse(JSON.stringify(updates))
      const cleanRecurrence = recurrence ? JSON.parse(JSON.stringify(recurrence)) : null
      
      console.log('updateRecurringTask 参数:', {
        taskId,
        updates: cleanUpdates,
        recurrence: cleanRecurrence
      })
      
      const result = await window.electronAPI.tasks.updateRecurring({
        taskId,
        updates: cleanUpdates,
        recurrence: cleanRecurrence
      })
      if (result.success) {
        await getAllTasks()
        await getRecurringTasks()
      }
      return result
    } catch (error) {
      console.error('更新重复任务失败:', error)
      console.error('错误详情:', {
        taskId,
        updates,
        recurrence,
        errorMessage: error.message,
        errorStack: error.stack
      })
      return { success: false, error: error.message }
    }
  }

  // 完成重复任务实例
  const completeRecurringInstance = async (seriesId, occurrenceDate) => {
    try {
      const result = await window.electronAPI.tasks.completeRecurringInstance({
        seriesId,
        occurrenceDate
      })
      if (result.success) {
        await getAllTasks()
        // 重新展开任务以更新显示
        if (expandedTasks.value.length > 0) {
          const now = new Date()
          const futureDate = new Date(now)
          futureDate.setMonth(futureDate.getMonth() + 3)
          await expandRecurringTasks(now, futureDate, currentListId.value)
        }
      }
      return result
    } catch (error) {
      console.error('完成重复任务实例失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 删除重复任务实例
  const deleteRecurringInstance = async (seriesId, occurrenceDate) => {
    try {
      const result = await window.electronAPI.tasks.deleteRecurringInstance({
        seriesId,
        occurrenceDate
      })
      if (result.success) {
        await getAllTasks()
        // 重新展开任务以更新显示
        if (expandedTasks.value.length > 0) {
          const now = new Date()
          const futureDate = new Date(now)
          futureDate.setMonth(futureDate.getMonth() + 3)
          await expandRecurringTasks(now, futureDate, currentListId.value)
        }
      }
      return result
    } catch (error) {
      console.error('删除重复任务实例失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 更新重复任务实例
  const updateRecurringInstance = async (seriesId, occurrenceDate, updates) => {
    try {
      const result = await window.electronAPI.tasks.updateRecurringInstance({
        seriesId,
        occurrenceDate,
        updates
      })
      if (result.success) {
        await getAllTasks()
        // 重新展开任务以更新显示
        if (expandedTasks.value.length > 0) {
          const now = new Date()
          const futureDate = new Date(now)
          futureDate.setMonth(futureDate.getMonth() + 3)
          await expandRecurringTasks(now, futureDate, currentListId.value)
        }
      }
      return result
    } catch (error) {
      console.error('更新重复任务实例失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 删除整个重复任务系列
  const deleteRecurringSeries = async (seriesId) => {
    try {
      const result = await window.electronAPI.tasks.deleteRecurringSeries({
        seriesId
      })
      if (result.success) {
        await getAllTasks()
        await getRecurringTasks()
      }
      return result
    } catch (error) {
      console.error('删除重复任务系列失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 获取重复任务的下次实例预览
  const getNextOccurrences = async (taskId, count = 5) => {
    try {
      const result = await window.electronAPI.tasks.getNextOccurrences({
        taskId,
        count
      })
      return result.success ? result.occurrences : []
    } catch (error) {
      console.error('获取下次实例失败:', error)
      return []
    }
  }

  // 设置是否显示重复任务实例
  const setShowRecurringInstances = (show) => {
    showRecurringInstances.value = show
    if (show) {
      // 当显示重复实例时，自动展开重复任务
      const now = new Date()
      const futureDate = new Date(now)
      futureDate.setMonth(futureDate.getMonth() + 3) // 展开未来3个月的重复任务
      // 如果当前选中了特定列表，只展开该列表的重复任务
      expandRecurringTasks(now, futureDate, currentListId.value)
    }
  }
  
  // 切换重复任务实例显示
  const toggleRecurringInstances = () => {
    setShowRecurringInstances(!showRecurringInstances.value)
  }

  // AI 相关方法
  const loadAIModels = async () => {
    try {
      const config = await window.electronAPI.config.get()
      const aiConfig = config.ai || {}
      const providers = aiConfig.providers || {}
      
      // 构建可用的AI模型列表
      const models = []
      
      // OpenAI 模型
      if (providers.openai && providers.openai.apiKey) {
        models.push({
          id: 'openai-gpt-4o',
          name: providers.openai.model || 'GPT-4o',
          provider: 'OpenAI',
          config: {
            provider: 'openai',
            model: providers.openai.model || 'gpt-4o',
            apiKey: providers.openai.apiKey,
            baseURL: providers.openai.baseURL || 'https://api.openai.com/v1'
          }
        })
      }
      
      // Google 模型
      if (providers.google && providers.google.apiKey) {
        models.push({
          id: 'google-gemini',
          name: providers.google.model || 'Gemini 1.5 Pro',
          provider: 'Google',
          config: {
            provider: 'google',
            model: providers.google.model || 'gemini-1.5-pro',
            apiKey: providers.google.apiKey
          }
        })
      }
      
      // Anthropic 模型
      if (providers.anthropic && providers.anthropic.apiKey) {
        models.push({
          id: 'anthropic-claude',
          name: providers.anthropic.model || 'Claude 3.5 Sonnet',
          provider: 'Anthropic',
          config: {
            provider: 'anthropic',
            model: providers.anthropic.model || 'claude-3-5-sonnet-20241022',
            apiKey: providers.anthropic.apiKey
          }
        })
      }
      
      // xAI 模型
      if (providers.xai && providers.xai.apiKey) {
        models.push({
          id: 'xai-grok',
          name: providers.xai.model || 'Grok Beta',
          provider: 'xAI',
          config: {
            provider: 'xai',
            model: providers.xai.model || 'grok-beta',
            apiKey: providers.xai.apiKey,
            baseURL: providers.xai.baseURL || 'https://api.x.ai/v1'
          }
        })
      }
      
      // 自定义提供商
      if (aiConfig.customProviders && Array.isArray(aiConfig.customProviders)) {
        aiConfig.customProviders.forEach((customProvider, index) => {
          if (customProvider.apiKey && customProvider.baseURL) {
            models.push({
              id: customProvider.id,
              name: customProvider.name || `Custom Model ${index + 1}`,
              provider: 'Custom',
              config: {
                provider: 'custom',
                model: customProvider.model || 'custom-model',
                apiKey: customProvider.apiKey,
                baseURL: customProvider.baseURL
              }
            })
          }
        })
      }
      
      availableAIModels.value = models
      
      // 如果之前有选择的模型，尝试恢复
      const savedModelId = localStorage.getItem('taskStore-selectedAIModel')
      if (savedModelId) {
        const savedModel = models.find(m => m.id === savedModelId)
        if (savedModel) {
          selectedAIModel.value = savedModel
          isAIEnabled.value = true
        }
      }
    } catch (error) {
      console.error('加载AI模型配置失败:', error)
    }
  }
  
  const selectAIModel = (model) => {
    selectedAIModel.value = model
    if (model) {
      isAIEnabled.value = true
      localStorage.setItem('taskStore-selectedAIModel', model.id)
    } else {
      isAIEnabled.value = false
      localStorage.removeItem('taskStore-selectedAIModel')
    }
  }
  
  const toggleAI = () => {
    isAIEnabled.value = !isAIEnabled.value
    if (!isAIEnabled.value) {
      selectedAIModel.value = null
      localStorage.removeItem('taskStore-selectedAIModel')
    }
  }
  
  const getSelectedAIModel = () => {
    return selectedAIModel.value
  }
  
  const isAIAvailable = () => {
    return availableAIModels.value.length > 0
  }

  // 流式生成任务列表
  const streamGenerateTaskList = async (content, onChunk, onComplete, onError) => {
    console.log('[taskStore] streamGenerateTaskList 开始', { content, onChunk: !!onChunk, onComplete: !!onComplete, onError: !!onError })
    
    try {
      if (!selectedAIModel.value || !isAIEnabled.value) {
        throw new Error('请先选择AI模型')
      }

      if (!content || content.trim().length === 0) {
        throw new Error('输入内容不能为空')
      }

      const listId = currentListId.value || 0
      const aiModelData = {
        id: selectedAIModel.value.id,
        name: selectedAIModel.value.name,
        provider: selectedAIModel.value.provider
      }

      console.log('[taskStore] AI模型和列表信息:', { aiModelData, listId })

      // 设置事件监听器
      if (onChunk) {
        console.log('[taskStore] 设置onChunk监听器')
        window.electronAPI.onStreamTaskGenerationChunk((event, text) => {
          console.log('[taskStore] 接收到chunk事件:', text)
          onChunk(text)
        })
      }

      if (onComplete) {
        console.log('[taskStore] 设置onComplete监听器')
        window.electronAPI.onStreamTaskGenerationComplete((event, result) => {
          console.log('[taskStore] 接收到complete事件:', result)
          // 清理监听器
          window.electronAPI.removeStreamTaskGenerationListeners()
          
          if (result.success) {
            onComplete({
              success: true,
              message: result.message,
              tasks: result.tasks,
              taskCount: result.tasks.length
            })
          } else {
            onComplete({
              success: false,
              error: result.error
            })
          }
        })
      }

      if (onError) {
        console.log('[taskStore] 设置onError监听器')
        window.electronAPI.onStreamTaskGenerationError((event, errorResult) => {
          console.log('[taskStore] 接收到error事件:', errorResult)
          // 清理监听器
          window.electronAPI.removeStreamTaskGenerationListeners()
          onError({
            success: false,
            error: errorResult.error
          })
        })
      }

      console.log('[taskStore] 调用AI流式生成任务列表:', { content, aiModelData, listId })
      
      // 启动流式生成
      const result = await window.electronAPI.tasks.streamGenerateTaskList(content, aiModelData, listId)
      
      console.log('[taskStore] streamGenerateTaskList IPC返回结果:', result)
      return result
    } catch (error) {
      console.error('AI流式生成任务列表失败:', error)
      // 清理监听器
      window.electronAPI.removeStreamTaskGenerationListeners()
      
      if (onError) {
        onError({
          success: false,
          error: error.message
        })
      }
      
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 使用AI生成任务列表
  const generateTaskList = async (content) => {
    try {
      if (!selectedAIModel.value || !isAIEnabled.value) {
        throw new Error('请先选择AI模型')
      }

      if (!content || content.trim().length === 0) {
        throw new Error('输入内容不能为空')
      }

      const listId = currentListId.value || 0
      // 只传递基本的AI模型信息，配置由后端从 electron-store 获取
      const aiModelData = {
        id: selectedAIModel.value.id,
        name: selectedAIModel.value.name,
        provider: selectedAIModel.value.provider
      }
      console.log('[generateTaskList] 调用AI生成任务列表:', { content, aiModelData, listId })
      const result = await window.electronAPI.tasks.generateTaskList(content, aiModelData, listId)
      
      if (result.success) {
        // 直接返回生成的任务数据，不自动创建
        return {
          success: true,
          message: result.message,
          tasks: result.tasks,
          taskCount: result.tasks.length
        }
      } else {
        return {
          success: false,
          error: result.error
        }
      }
    } catch (error) {
      console.error('AI生成任务列表失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
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
    showCompletedInWeekly,
    showCompletedInMonthly,
    customReminderOptions,
    expandedTasks,
    recurringTasks,
    showRecurringInstances,

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
    setTasks,
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
    setShowCompletedInWeekly,
    setShowCompletedInMonthly,

    // 辅助函数
    getStatusText,
    formatTimeDisplay,
    formatDuration,
    isToday,
    isTodayTask,

    // 统一过滤和计数方法
    getTasksByFilter,
    getCategoryCount,
    getCategoryStats,
    getSortedTasks,

    // 自定义提醒选项方法
    getDefaultReminderOptions,
    loadCustomReminderOptions,
    refreshCustomReminderOptions,

    // 重复任务方法
    getRecurringTasks,
    expandRecurringTasks,
    createRecurringTask,
    updateRecurringTask,
    completeRecurringInstance,
    deleteRecurringInstance,
    updateRecurringInstance,
    deleteRecurringSeries,
    getNextOccurrences,
    setShowRecurringInstances,
    toggleRecurringInstances,

    // AI 相关方法
    loadAIModels,
    selectAIModel,
    toggleAI,
    getSelectedAIModel,
    isAIAvailable,
    generateTaskList,
    streamGenerateTaskList,

    // AI 相关状态
    availableAIModels,
    selectedAIModel,
    isAIEnabled
  }
})