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
      'todo',
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
      console.warn(`尝试删除不存在的任务: ${taskId}`);
      return true;
    }

    return await this.taskRepository.delete(taskId);
  }

  /**
   * 更新任务
   * @param {string} taskId 任务ID
   * @param {Object} updates 更新数据
   * @returns {Promise<Task>}
   */
  async updateTask(taskId, updates) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    // 更新内容
    if (updates.content !== undefined) {
      task.updateContent(updates.content);
    }

    // 更新描述
    if (updates.description !== undefined) {
      task.description = updates.description;
    }

    // 更新状态
    if (updates.status !== undefined) {
      task.updateStatus(updates.status);
    }

    // 更新提醒时间
    if (updates.reminderTime !== undefined) {
      if (updates.reminderTime === null) {
        task.clearReminder();
      } else {
        task.setReminder(new Date(updates.reminderTime));
      }
    }

    return await this.taskRepository.save(task);
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
    console.log("taskId: ${taskId}, reminderTime: ", reminderTime)
    task.setReminder(reminderTime);
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
   * 开始任务 - 从待办状态开始计时
   * @param {string} taskId 任务ID
   * @returns {Promise<Task>}
   */
  async startTask(taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.startTask();
    return await this.taskRepository.save(task);
  }

  /**
   * 暂停任务 - 从进行中状态暂停，累计已用时间
   * @param {string} taskId 任务ID
   * @returns {Promise<Task>}
   */
  async pauseTask(taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.pauseTask();
    return await this.taskRepository.save(task);
  }

  /**
   * 完成任务（带时间追踪）
   * @param {string} taskId 任务ID
   * @returns {Promise<Task>}
   */
  async completeTaskWithTracking(taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.completed) {
      console.log(`任务 ${taskId} 已经完成，跳过操作`);
      return task;
    }

    task.completeTask();
    return await this.taskRepository.save(task);
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
   * 获取时间统计信息
   * @returns {Promise<Object>}
   */
  async getTimeStats() {
    const allTasks = await this.getAllTasks();
    const completedTasks = allTasks.filter(task => task.isCompleted());
    const inProgressTasks = allTasks.filter(task => task.isInProgress());
    
    let totalWorkTime = 0;
    let totalCompletedTasks = 0;
    let currentActiveTime = 0;

    completedTasks.forEach(task => {
      totalWorkTime += task.getTotalWorkDuration();
      totalCompletedTasks++;
    });

    inProgressTasks.forEach(task => {
      currentActiveTime += task.getCurrentDuration();
      totalWorkTime += task.getTotalWorkDuration();
    });

    return {
      totalWorkTime,
      totalCompletedTasks,
      currentActiveTime,
      inProgressTasksCount: inProgressTasks.length,
      averageTaskTime: totalCompletedTasks > 0 ? Math.floor(totalWorkTime / totalCompletedTasks) : 0
    };
  }
}

module.exports = TaskService;