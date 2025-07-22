const Task = require('../entities/task');

/**
 * 任务管理服务 (Task Service)
 * 包含任务相关的业务逻辑和用例协调
 */
class TaskService {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
  }

  /**
   * 创建新任务
   * @param {string} content 任务内容
   * @param {Date|null} reminderTime 提醒时间
   * @returns {Promise<Task>}
   */
  async createTask(content, reminderTime = null) {
    if (!content || content.trim().length === 0) {
      throw new Error('任务内容不能为空');
    }

    const task = new Task(
      Task.generateId(),
      content.trim(),
      'todo', // Default status
      new Date(),
      reminderTime
    );

    return await this.taskRepository.save(task);
  }

  /**
   * 完成任务
   * @param {string} taskId 任务ID
   * @returns {Promise<Task>}
   */
  async completeTask(taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    // 如果任务已经完成，直接返回任务，不抛出错误
    if (task.completed) {
      console.log(`任务 ${taskId} 已经完成，跳过操作`);
      return task;
    }

    task.markAsCompleted();
    return await this.taskRepository.save(task);
  }

  /**
   * 取消完成任务
   * @param {string} taskId 任务ID
   * @returns {Promise<Task>}
   */
  async uncompleteTask(taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.markAsIncomplete();
    return await this.taskRepository.save(task);
  }

  /**
   * 删除任务
   * @param {string} taskId 任务ID
   * @returns {Promise<boolean>}
   */
  async deleteTask(taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    return await this.taskRepository.delete(taskId);
  }

  /**
   * 更新任务内容
   * @param {string} taskId 任务ID
   * @param {string} content 新内容
   * @returns {Promise<Task>}
   */
  async updateTaskContent(taskId, content) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.updateContent(content);
    return await this.taskRepository.save(task);
  }

  /**
   * 更新任务状态
   * @param {string} taskId 任务ID
   * @param {string} status 新状态 ('todo', 'doing', 'done')
   * @returns {Promise<Task>}
   */
  async updateTaskStatus(taskId, status) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.updateStatus(status);
    return await this.taskRepository.save(task);
  }

  /**
   * 设置任务提醒
   * @param {string} taskId 任务ID
   * @param {Date} reminderTime 提醒时间
   * @returns {Promise<Task>}
   */
  async setTaskReminder(taskId, reminderTime) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.setReminder(reminderTime);
    return await this.taskRepository.save(task);
  }

  /**
   * 清除任务提醒
   * @param {string} taskId 任务ID
   * @returns {Promise<Task>}
   */
  async clearTaskReminder(taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.clearReminder();
    return await this.taskRepository.save(task);
  }

  /**
   * 获取所有未完成任务
   * @returns {Promise<Task[]>}
   */
  async getIncompleteTasks() {
    return await this.taskRepository.findIncomplete();
  }

  /**
   * 获取所有已完成任务
   * @returns {Promise<Task[]>}
   */
  async getCompletedTasks() {
    return await this.taskRepository.findCompleted();
  }

  /**
   * 获取所有任务
   * @returns {Promise<Task[]>}
   */
  async getAllTasks() {
    return await this.taskRepository.findAll();
  }

  /**
   * 获取未完成任务数量
   * @returns {Promise<number>}
   */
  async getIncompleteTaskCount() {
    return await this.taskRepository.getIncompleteCount();
  }

  /**
   * 获取需要提醒的任务
   * @returns {Promise<Task[]>}
   */
  async getTasksToRemind() {
    return await this.taskRepository.findTasksToRemind();
  }

  /**
   * 批量完成任务
   * @param {string[]} taskIds 任务ID数组
   * @returns {Promise<Task[]>}
   */
  async completeMultipleTasks(taskIds) {
    const completedTasks = [];
    
    for (const taskId of taskIds) {
      try {
        const task = await this.completeTask(taskId);
        completedTasks.push(task);
      } catch (error) {
        console.warn(`Failed to complete task ${taskId}:`, error.message);
      }
    }
    
    return completedTasks;
  }

  /**
   * 批量删除任务
   * @param {string[]} taskIds 任务ID数组
   * @returns {Promise<number>} 成功删除的任务数量
   */
  async deleteMultipleTasks(taskIds) {
    let deletedCount = 0;
    
    for (const taskId of taskIds) {
      try {
        const success = await this.deleteTask(taskId);
        if (success) {
          deletedCount++;
        }
      } catch (error) {
        console.warn(`Failed to delete task ${taskId}:`, error.message);
      }
    }
    
    return deletedCount;
  }

  /**
   * 清空所有任务
   * @returns {Promise<void>}
   */
  async clearAllTasks() {
    return await this.taskRepository.clear();
  }

  /**
   * 导入任务
   * @param {Object} taskData 任务数据
   * @returns {Promise<Task>}
   */
  async importTask(taskData) {
    const task = Task.fromJSON(taskData);
    return await this.taskRepository.save(task);
  }

  /**
   * 根据状态获取任务
   * @param {string} status 状态 ('todo', 'doing', 'done')
   * @returns {Promise<Task[]>}
   */
  async getTasksByStatus(status) {
    if (typeof this.taskRepository.findByStatus === 'function') {
      return await this.taskRepository.findByStatus(status);
    }
    
    // 回退到过滤所有任务
    const allTasks = await this.taskRepository.findAll();
    return allTasks.filter(task => {
      const taskStatus = task.status || (task.completed ? 'done' : 'todo');
      return taskStatus === status;
    });
  }
}

module.exports = TaskService;