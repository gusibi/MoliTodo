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
   * 在指定清单中创建任务
   * @param {string} content 任务内容
   * @param {number} listId 清单ID
   * @param {Date|null} reminderTime 提醒时间
   * @param {Object} metadata 元数据
   * @returns {Promise<Task>}
   */
  async createTaskInList(content, listId = 0, reminderTime = null, metadata = {}) {
    if (!content || content.trim().length === 0) {
      throw new Error('任务内容不能为空');
    }

    if (typeof listId !== 'number' || listId < 0) {
      throw new Error('清单ID必须是非负整数');
    }

    const task = new Task(
      Task.generateId(),
      content.trim(),
      'todo',
      new Date(),
      reminderTime,
      {}, // timeTracking
      listId,
      metadata
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

    // 更新清单关联
    if (updates.listId !== undefined) {
      task.moveToList(updates.listId);
    }

    // 更新元数据
    if (updates.metadata !== undefined) {
      task.updateMetadata(updates.metadata);
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
   * 获取指定清单中的任务
   * @param {number} listId 清单ID
   * @returns {Promise<Task[]>}
   */
  async getTasksByListId(listId) {
    if (this.taskRepository.findByListId) {
      return await this.taskRepository.findByListId(listId);
    } else {
      // 如果仓储没有实现按清单查询，则从所有任务中过滤
      const allTasks = await this.getAllTasks();
      return allTasks.filter(task => task.belongsToList(listId));
    }
  }

  /**
   * 移动任务到指定清单
   * @param {string} taskId 任务ID
   * @param {number} targetListId 目标清单ID
   * @returns {Promise<Task>}
   */
  async moveTaskToList(taskId, targetListId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (typeof targetListId !== 'number' || targetListId < 0) {
      throw new Error('目标清单ID必须是非负整数');
    }

    task.moveToList(targetListId);
    return await this.taskRepository.save(task);
  }

  /**
   * 批量移动任务到指定清单
   * @param {string[]} taskIds 任务ID数组
   * @param {number} targetListId 目标清单ID
   * @returns {Promise<Task[]>}
   */
  async batchMoveTasksToList(taskIds, targetListId) {
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new Error('任务ID数组不能为空');
    }

    if (typeof targetListId !== 'number' || targetListId < 0) {
      throw new Error('目标清单ID必须是非负整数');
    }

    const updatedTasks = [];
    
    for (const taskId of taskIds) {
      try {
        const task = await this.moveTaskToList(taskId, targetListId);
        updatedTasks.push(task);
      } catch (error) {
        console.warn(`移动任务 ${taskId} 失败:`, error.message);
      }
    }

    return updatedTasks;
  }

  /**
   * 更新任务元数据
   * @param {string} taskId 任务ID
   * @param {Object} metadata 元数据
   * @returns {Promise<Task>}
   */
  async updateTaskMetadata(taskId, metadata) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (typeof metadata !== 'object' || metadata === null) {
      throw new Error('元数据必须是对象');
    }

    task.updateMetadata(metadata);
    return await this.taskRepository.save(task);
  }

  /**
   * 设置任务备注
   * @param {string} taskId 任务ID
   * @param {string} comment 备注内容
   * @returns {Promise<Task>}
   */
  async setTaskComment(taskId, comment) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.setComment(comment);
    return await this.taskRepository.save(task);
  }

  /**
   * 获取指定清单的未完成任务
   * @param {number} listId 清单ID
   * @returns {Promise<Task[]>}
   */
  async getIncompleteTasksByListId(listId) {
    const tasks = await this.getTasksByListId(listId);
    return tasks.filter(task => !task.isCompleted());
  }

  /**
   * 获取指定清单的已完成任务
   * @param {number} listId 清单ID
   * @returns {Promise<Task[]>}
   */
  async getCompletedTasksByListId(listId) {
    const tasks = await this.getTasksByListId(listId);
    return tasks.filter(task => task.isCompleted());
  }

  /**
   * 按分类获取任务（支持清单过滤）
   * @param {string} category 分类名称
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Task[]>}
   */
  async getTasksByCategory(category, listId = null) {
    let tasks;
    
    if (listId !== null) {
      tasks = await this.getTasksByListId(listId);
    } else {
      tasks = await this.getAllTasks();
    }

    return tasks.filter(task => task.belongsToCategory(category));
  }

  /**
   * 搜索任务（支持清单过滤）
   * @param {string} query 搜索关键词
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Task[]>}
   */
  async searchTasks(query, listId = null) {
    if (!query || query.trim().length === 0) {
      return listId !== null ? await this.getTasksByListId(listId) : await this.getAllTasks();
    }

    let tasks;
    if (listId !== null) {
      tasks = await this.getTasksByListId(listId);
    } else {
      tasks = await this.getAllTasks();
    }

    const searchTerm = query.trim().toLowerCase();
    
    return tasks.filter(task => {
      // 搜索任务内容
      if (task.content.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // 搜索备注内容
      const comment = task.getComment();
      if (comment && comment.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * 获取任务时间信息
   * @param {string} taskId 任务ID
   * @returns {Promise<Object>}
   */
  async getTaskTimeInfo(taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    return {
      taskId: task.id,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      currentDuration: task.getCurrentDuration(),
      totalDuration: task.totalDuration,
      totalWorkDuration: task.getTotalWorkDuration(),
      formattedDuration: task.getFormattedDuration(),
      formattedCompactDuration: task.getFormattedDuration(true)
    };
  }

  /**
   * 获取时间统计信息（支持清单过滤）
   * @param {number|null} listId 清单ID，null表示所有清单
   * @returns {Promise<Object>}
   */
  async getTimeStats(listId = null) {
    let allTasks;
    if (listId !== null) {
      allTasks = await this.getTasksByListId(listId);
    } else {
      allTasks = await this.getAllTasks();
    }

    const completedTasks = allTasks.filter(task => task.isCompleted());
    const inProgressTasks = allTasks.filter(task => task.isInProgress());
    const pausedTasks = allTasks.filter(task => task.isPaused());
    
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

    pausedTasks.forEach(task => {
      totalWorkTime += task.getTotalWorkDuration();
    });

    return {
      listId,
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      pausedTasks: pausedTasks.length,
      todoTasks: allTasks.filter(task => task.isTodo()).length,
      totalWorkTime,
      currentActiveTime,
      averageTaskTime: totalCompletedTasks > 0 ? Math.floor(totalWorkTime / totalCompletedTasks) : 0,
      completionRate: allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0
    };
  }
}

module.exports = TaskService;