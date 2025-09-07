const Task = require('../entities/task');
const { AIService } = require('../../infrastructure/ai/ai-service');
const { USER_GUIDE_TASKS } = require('../../utils/user-guide-tasks');

/**
 * 任务管理服务 (Task Service)
 * 包含任务相关的业务逻辑和用例协调
 */
class TaskService {
  constructor(taskRepository, windowManager = null) {
    this.taskRepository = taskRepository;
    this.windowManager = windowManager;
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

    console.log("createTask: content: ", content)
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
   * @param {Object} taskData 完整任务数据（包含 metadata、recurrence 等）
   * @returns {Promise<Task>}
   */
  async createTaskInList(content, listId = 0, reminderTime = null, taskData = {}) {
    if (!content || content.trim().length === 0) {
      throw new Error('任务内容不能为空');
    }

    if (typeof listId !== 'number' || listId < 0) {
      throw new Error('清单ID必须是非负整数');
    }

    // console.log("createTaskInList: content: ", content)
    // console.log("createTaskInList: listId: ", listId)
    // console.log("createTaskInList: reminderTime: ", reminderTime)
    console.log("createTaskInList: taskData: ", taskData)
    // 从 taskData 中提取各个字段
    const {
      metadata = {},
      recurrence = null,
      dueDate = null,
      dueTime = null
    } = taskData;

    // 处理提醒时间：重复任务从 recurrence 中提取，普通任务使用传入的 reminderTime
    let finalReminderTime = reminderTime;
    if (recurrence && recurrence.reminderTime) {
      finalReminderTime = this.calculateRecurringReminderTime(recurrence, reminderTime);
      console.log("createTaskInList: finalReminderTime: ", finalReminderTime)
    }

    const task = new Task(
      Task.generateId(),
      content.trim(),
      'todo',
      new Date(),
      finalReminderTime,
      {}, // timeTracking
      listId,
      metadata,
      recurrence
    );
    // 设置到期日期和时间
    if (dueDate) {
      task.dueDate = dueDate;
    }
    if (dueTime) {
      task.dueTime = dueTime;
    }

    console.log("createTaskInList: save task ", task)
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

    // 如果是重复任务，创建下一个实例
    if (task.isRecurring()) {
      await this.createNextRecurringInstance(task);
    }

    task.markAsCompleted();
    return await this.taskRepository.save(task);
  }

  /**
   * 创建重复任务的下一个实例
   * @param {Task} recurringTask 重复任务
   * @param {Date} fromDate 从哪个日期开始计算下一个实例，如果不提供则使用任务的生效日期
   * @returns {Promise<Task|null>}
   */
  async createNextRecurringInstance(recurringTask, fromDate = null) {
    try {
      console.log('createNextRecurringInstance recurringTask: ', recurringTask, fromDate)
      
      // 确定起始日期：如果提供了 fromDate 则使用它，否则使用任务的生效日期
      let startDate = fromDate;
      if (!startDate) {
        // 如果是实例任务，使用 occurrenceDate；否则使用 createdAt
        startDate = recurringTask.occurrenceDate 
          ? new Date(recurringTask.occurrenceDate)
          : new Date(recurringTask.createdAt);
      }
      
      console.log('计算下一个实例的起始日期:', startDate)
      
      const RecurringTaskService = require('./recurring-task-service');
      const nextOccurrences = RecurringTaskService.getNextOccurrences(recurringTask, 1, startDate);
      console.log('nextOccurrences: ', nextOccurrences)
      
      if (nextOccurrences.length === 0) {
        console.log('没有找到下一个重复实例');
        return null;
      }

      const nextDate = nextOccurrences[0];
      
      // 计算下一个实例的提醒时间
      let nextReminderTime = null;
      const reminderDate = new Date(nextDate);
      
      // 使用 recurrence.reminderTime，如果没有则使用默认值 9:00
      const reminderTimeStr = recurringTask.recurrence?.reminderTime || '9:00';
      const [hours, minutes] = reminderTimeStr.split(':').map(Number);
      
      // 将 reminderDate 与 reminderTime 的时间部分组合
      reminderDate.setHours(hours, minutes, 0, 0);
      nextReminderTime = reminderDate;
      console.log('nextReminderTime: ', nextReminderTime)

      // 设置 seriesId：优先使用 recurringTask.seriesId，否则使用 recurringTask.id
      const seriesId = recurringTask.seriesId || recurringTask.id;
      
      // 设置 occurrenceDate：当天 0 点时间戳
      const occurrenceDate = new Date(nextDate);
      occurrenceDate.setHours(0, 0, 0, 0);
      console.log("occurrenceDate: ------", occurrenceDate)
      
      // 创建新的任务实例
      const nextInstance = new Task({
        id: Task.generateId(),
        content: recurringTask.content,
        status: 'todo',
        createdAt: new Date(),
        reminderTime: nextReminderTime,
        timeTracking: {},
        listId: recurringTask.listId,
        metadata: { ...recurringTask.metadata },
        recurrence: recurringTask.recurrence, // 保持重复规则
        seriesId: seriesId, // 使用正确的 seriesId
        occurrenceDate: occurrenceDate, // 使用当天 0 点时间戳
        dueDate: recurringTask.dueDate, // 到期日期
        dueTime: recurringTask.dueTime // 到期时间
      });

      console.log("nextInstance: ------", nextInstance)
      await this.taskRepository.save(nextInstance);
      return nextInstance;
    } catch (error) {
      console.error('创建下一个重复任务实例失败:', error);
      return null;
    }
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

    console.log("[updateTask] task service updateTask updates: ------", updates)

    if (task.reminderTime === null && updates.reminderTime === null && updates.recurrence && updates.recurrence != ""){ // 如果重复配置有值, 尝试获取第一次的提醒时间
        reminderTime = this.calculateRecurringReminderTime(updates.recurrence, updates.reminderTime);
    }
    // 更新内容
    if (updates.content !== undefined) {
      task.updateContent(updates.content);
    }

 
    // 更新状态
    if (updates.status !== undefined) {
      task.updateStatus(updates.status);
    }

    // 更新提醒时间
    if (updates.reminderTime !== undefined) {
      if (updates.reminderTime === null) {
        task.clearReminder();
      } else if (updates.recurrence && updates.recurrence != "") {
        console.log("重复任务不校验, recurrence: ", updates.recurrence)
        task.setReminder(new Date(updates.reminderTime), true, task.reminderTime);
      }else{
        // 统一处理：所有提醒时间都应该是 Date 对象或 ISO 字符串
        // 传入原始提醒时间用于对比，避免对未变化的提醒时间进行过去时间验证
        task.setReminder(new Date(updates.reminderTime), false, task.reminderTime);
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

    // 更新重复规则
    if (updates.recurrence !== undefined) {
      if (updates.recurrence === null) {
        task.clearRecurrence();
      } else {
        task.setRecurrence(updates.recurrence);
      }
    }

    // console.log("task service task: ------ final", task)
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
    // 传入原始提醒时间用于对比，避免对未变化的提醒时间进行过去时间验证
    task.setReminder(reminderTime, false, task.reminderTime);
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
    console.log('更新任务元数据', taskId, metadata)
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

  /**
   * 获取任务表的最新更新时间
   * @returns {Promise<Date|null>}
   */
  async getLastUpdatedTime() {
    return await this.taskRepository.getLastUpdatedTime();
  }

  // ==================== 重复任务相关方法 ====================

  /**
   * 获取所有重复任务
   * @param {number|null} listId 可选的列表ID，null表示所有列表
   * @returns {Promise<Task[]>}
   */
  async getRecurringTasks(listId = null) {
    return await this.taskRepository.findRecurringTasks(listId);
  }

  /**
   * 展开重复任务为指定时间范围内的实例
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @param {number|null} listId 可选的列表ID，null表示所有列表
   * @returns {Promise<Task[]>}
   */
  async expandRecurringTasks(startDate, endDate, listId = null) {
    const recurringTasks = await this.getRecurringTasks(listId);
    console.log("expandRecurringTasks recurringTasks: ", recurringTasks)
    const RecurringTaskService = require('./recurring-task-service');
    return RecurringTaskService.expandRecurringTasks(recurringTasks, startDate, endDate);
  }

  /**
   * 计算重复任务的提醒时间
   * @param {Object} recurrence 重复规则
   * @param {Date|null} fallbackReminderTime 备用提醒时间
   * @returns {Date|null} 计算后的提醒时间
   */
  calculateRecurringReminderTime(recurrence, fallbackReminderTime = null) {
    if (!recurrence || !recurrence.reminderTime) {
      return fallbackReminderTime;
    }

    // 对于重复任务，需要计算第一个符合重复规则的日期
    const RecurrenceRule = require('./recurrence-rule');
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setFullYear(futureDate.getFullYear() + 1); // 查看未来1年
    
    // 计算第一个发生日期
    const occurrences = RecurrenceRule.calculateOccurrences(
      recurrence,
      now,
      futureDate,
      now // 使用当前时间作为基准日期
    );
    
    if (occurrences.length > 0) {
      // 使用第一个发生日期 + recurrence.reminderTime
      const [hours, minutes] = recurrence.reminderTime.split(':').map(Number);
      const reminderDate = new Date(occurrences[0]);
      reminderDate.setHours(hours, minutes, 0, 0);
      return reminderDate;
    } else {
      // 如果没有找到发生日期，使用今天 + reminderTime 作为fallback
      const [hours, minutes] = recurrence.reminderTime.split(':').map(Number);
      const reminderDate = new Date();
      reminderDate.setHours(hours, minutes, 0, 0);
      return reminderDate;
    }
  }

  /**
   * 更新重复任务
   * @param {string} taskId 任务ID
   * @param {Object} updates 更新数据
   * @param {Object} recurrence 重复规则
   * @returns {Promise<Task>}
   */
  async updateRecurringTask(taskId, updates, recurrence = null) {
    console.log("[updateRecurringTask] taskId: ", taskId, recurrence)
    // 如果有重复规则且包含提醒时间，重新计算提醒时间
    if (recurrence && recurrence.reminderTime) {
      updates.reminderTime = this.calculateRecurringReminderTime(recurrence, updates.reminderTime);
      // console.log("updateRecurringTask: calculated reminderTime:", updates.reminderTime);
    }
    
    // console.log("updateRecurringTask: updates:", updates)
    const task = await this.updateTask(taskId, updates);
    if (recurrence) {
      task.setRecurrence(recurrence);
      await this.taskRepository.save(task);
    }
    return task;
  }

  /**
   * 完成重复任务实例
   * @param {string} seriesId 系列ID
   * @param {string} occurrenceDate 实例日期
   * @returns {Promise<Object>}
   */
  async completeRecurringInstance(seriesId, occurrenceDate) {
    // 查找是否已存在该实例的覆盖记录
    const existingInstance = await this.taskRepository.findOverrideInstance(seriesId, occurrenceDate);
    
    if (existingInstance) {
      // 如果存在，直接完成该实例
      await this.completeTask(existingInstance.id);
    } else {
      // 如果不存在，创建一个已完成的覆盖实例
      const recurringTask = await this.taskRepository.findById(seriesId);
      if (!recurringTask) {
        throw new Error('重复任务不存在');
      }
      
      const overrideInstance = new Task(
        Task.generateId(),
        recurringTask.content,
        'done',
        new Date(),
        null,
        {}, // timeTracking
        recurringTask.listId,
        recurringTask.metadata,
        null, // recurrence
        seriesId,
        occurrenceDate
      );
      
      overrideInstance.markAsCompleted();
      await this.taskRepository.save(overrideInstance);
    }
    
    return { success: true };
  }

  /**
   * 删除重复任务实例
   * @param {string} seriesId 系列ID
   * @param {string} occurrenceDate 实例日期
   * @returns {Promise<Object>}
   */
  async deleteRecurringInstance(seriesId, occurrenceDate) {
    // 查找是否已存在该实例的覆盖记录
    const existingInstance = await this.taskRepository.findOverrideInstance(seriesId, occurrenceDate);
    
    if (existingInstance) {
      // 如果存在覆盖实例，删除它
      await this.deleteTask(existingInstance.id);
    } else {
      // 如果不存在覆盖实例，创建一个已删除的标记
      const recurringTask = await this.taskRepository.findById(seriesId);
      if (!recurringTask) {
        throw new Error('重复任务不存在');
      }
      
      const deletedInstance = new Task(
        Task.generateId(),
        recurringTask.content,
        'deleted',
        new Date(),
        null,
        {}, // timeTracking
        recurringTask.listId,
        { ...recurringTask.metadata, deleted: true },
        null, // recurrence
        seriesId,
        occurrenceDate
      );
      
      await this.taskRepository.save(deletedInstance);
    }
    
    return { success: true };
  }

  /**
   * 更新重复任务实例
   * @param {string} seriesId 系列ID
   * @param {string} occurrenceDate 实例日期
   * @param {Object} updates 更新数据
   * @returns {Promise<Object>}
   */
  async updateRecurringInstance(seriesId, occurrenceDate, updates) {
    // 查找是否已存在该实例的覆盖记录
    let existingInstance = await this.taskRepository.findOverrideInstance(seriesId, occurrenceDate);
    
    if (existingInstance) {
      // 如果存在，更新该实例
      await this.updateTask(existingInstance.id, updates);
    } else {
      // 如果不存在，创建一个覆盖实例
      const recurringTask = await this.taskRepository.findById(seriesId);
      if (!recurringTask) {
        throw new Error('重复任务不存在');
      }
      
      const overrideInstance = new Task(
        Task.generateId(),
        updates.content || recurringTask.content,
        updates.status || 'todo',
        new Date(),
        updates.reminderTime || null,
        {}, // timeTracking
        updates.listId !== undefined ? updates.listId : recurringTask.listId,
        { ...recurringTask.metadata, ...updates.metadata },
        null, // recurrence
        seriesId,
        occurrenceDate
      );
      
      await this.taskRepository.save(overrideInstance);
    }
    
    return { success: true };
  }

  /**
   * 删除重复任务系列
   * @param {string} seriesId 系列ID
   * @returns {Promise<Object>}
   */
  async deleteRecurringSeries(seriesId) {
    // 删除主重复任务
    await this.deleteTask(seriesId);
    
    // 删除所有相关的覆盖实例
    const overrideInstances = await this.taskRepository.findOverrideInstances(seriesId);
    for (const instance of overrideInstances) {
      await this.deleteTask(instance.id);
    }
    
    return { success: true };
  }

  /**
   * 获取重复任务的下几个实例预览
   * @param {string} taskId 任务ID
   * @param {number} count 预览数量
   * @returns {Promise<Date[]>}
   */
  async getNextOccurrences(taskId, count = 5) {
    const task = await this.taskRepository.findById(taskId);
    if (!task || !task.isRecurring()) {
      return [];
    }
    
    const RecurringTaskService = require('./recurring-task-service');
    return RecurringTaskService.getNextOccurrences(task, count);
  }

  /**
   * 获取指定时间范围内的覆盖实例
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @returns {Promise<Task[]>}
   */
  async getOverrideInstances(startDate, endDate) {
    const allTasks = await this.getAllTasks();
    return allTasks.filter(task => {
      // 筛选覆盖实例：有 seriesId 和 occurrenceDate
      if (!task.seriesId || !task.occurrenceDate) {
        return false;
      }
      
      // 检查实例日期是否在指定范围内
      const occurrenceDate = new Date(task.occurrenceDate);
      return occurrenceDate >= startDate && occurrenceDate <= endDate;
    });
  }

  /**
   * 使用AI生成任务列表
   * @param {string} content 用户输入的内容
   * @param {Object} aiModel AI模型信息 { id, name, provider }
   * @param {number} listId 清单ID
   * @returns {Promise<Array>} 生成的任务列表
   */
  async generateTaskList(content, aiModel, listId = 0) {
    if (!content || content.trim().length === 0) {
      throw new Error('输入内容不能为空');
    }

    if (!aiModel || !aiModel.id) {
      throw new Error('AI模型信息不完整');
    }

    if (!this.windowManager) {
      throw new Error('WindowManager 未初始化，无法获取配置');
    }

    try {
      // 调用AI服务生成任务列表
      const result = await AIService.generateTaskList(content, aiModel, this.windowManager);
      const generatedTasks = result.tasks;
      
      // 为生成的任务添加 listId
      const tasksWithListId = generatedTasks.map(task => ({
        ...task,
        listId: listId
      }));

      return {
        success: true,
        tasks: tasksWithListId,
        message: `成功使用 ${aiModel.name} (${aiModel.provider}) 生成了 ${tasksWithListId.length} 个任务`
      };
    } catch (error) {
      console.error('[TaskService] AI生成任务列表失败:', error);
      return {
        success: false,
        error: error.message,
        tasks: []
      };
    }
  }

  /**
   * 流式生成任务列表
   * @param {string} content - 用户输入的内容
   * @param {Object} aiModel - AI模型信息
   * @param {number} listId - 列表ID
   * @param {Function} onChunk - 流式数据回调函数
   * @param {boolean} shouldSplitTask - 是否拆分任务
   * @returns {Promise<Array>} 生成的任务列表
   */
  async streamGenerateTaskList(content, aiModel, listId = 0, onChunk, shouldSplitTask = false) {
    console.log('[TaskService] streamGenerateTaskList 开始', { content, aiModel, listId, onChunk: !!onChunk, shouldSplitTask });
    
    if (!content || content.trim().length === 0) {
      throw new Error('输入内容不能为空');
    }

    if (!aiModel || !aiModel.id) {
      throw new Error('AI模型信息不完整');
    }

    if (!this.windowManager) {
      throw new Error('WindowManager 未初始化，无法获取配置');
    }

    try {
      console.log('[TaskService] 调用AIService.streamGenerateTaskList');
      // 调用AI服务流式生成任务列表
      const result = await AIService.streamGenerateTaskList(content, aiModel, this.windowManager, onChunk, shouldSplitTask);
      console.log('[TaskService] AIService返回结果:', result);
      
      const generatedTasks = result.tasks;
      
      // 为生成的任务添加 listId
      const tasksWithListId = generatedTasks.map(task => ({
        ...task,
        listId: listId
      }));

      const finalResult = {
        success: true,
        tasks: tasksWithListId,
        message: `成功使用 ${aiModel.name} (${aiModel.provider}) 生成了 ${tasksWithListId.length} 个任务`
      };
      
      console.log('[TaskService] 最终返回结果:', finalResult);
      return finalResult;
    } catch (error) {
      console.error('[TaskService] AI流式生成任务列表失败:', error);
      return {
        success: false,
        error: error.message,
        tasks: []
      };
    }
  }

  /**
   * 批量创建用户引导任务
   * @param {number} listId 目标清单ID，默认为0（默认清单）
   * @returns {Promise<Task[]>} 创建的任务列表
   */
  async createUserGuideTasks(listId = 0) {
    try {
      console.log('[TaskService] 开始创建用户引导任务，目标清单ID:', listId);
      
      const createdTasks = [];
      
      for (const guideTask of USER_GUIDE_TASKS) {
        const taskData = {
          metadata: guideTask.metadata || {},
          dueDate: null,
          dueTime: null,
          recurrence: null
        };
        
        const task = await this.createTaskInList(
          guideTask.content,
          listId,
          null, // reminderTime
          taskData
        );
        
        createdTasks.push(task);
        console.log('[TaskService] 创建引导任务:', guideTask.content);
      }
      
      console.log('[TaskService] 用户引导任务创建完成，共创建', createdTasks.length, '个任务');
      return createdTasks;
    } catch (error) {
      console.error('[TaskService] 创建用户引导任务失败:', error);
      throw error;
    }
  }
}

module.exports = TaskService;