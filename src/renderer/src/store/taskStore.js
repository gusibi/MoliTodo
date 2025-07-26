import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref([])
  const loading = ref(false)

  // 获取所有任务
  const getAllTasks = async () => {
    try {
      loading.value = true
      const result = await window.electronAPI.tasks.getAll()
      tasks.value = result
      return result
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

  // 获取任务统计
  const getTaskStats = async () => {
    try {
      return await window.electronAPI.tasks.getStats()
    } catch (error) {
      console.error('获取任务统计失败:', error)
      return {
        totalWorkTime: 0,
        totalCompletedTasks: 0,
        currentActiveTime: 0,
        inProgressTasksCount: 0,
        averageTaskTime: 0
      }
    }
  }

  return {
    tasks,
    loading,
    getAllTasks,
    getIncompleteTasks,
    getCompletedTasks,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    startTask,
    pauseTask,
    getTaskStats
  }
})