const Task = require('../entities/task');
const taskTime = require('./task-time');
const { AIService } = require('../../infrastructure/ai/ai-service');
const { USER_GUIDE_TASKS } = require('../../utils/user-guide-tasks');

/**
 * 任务管理服务 (Task Service)
 * 包含任务相关的业务逻辑和用例协调
 */
class TaskService {
  constructor(taskRepository, windowManager = null, taskStatusLogService = null) {
    this.taskRepository = taskRepository;
    this.windowManager = windowManager;
    this.taskStatusLogService = taskStatusLogService;
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

    const savedTask = await this.taskRepository.save(task);

    // 记录任务创建的状态日志
    if (this.taskStatusLogService) {
      await this.taskStatusLogService.logStatusChange(savedTask.id, null, savedTask.status, savedTask.createdAt);
    }

    return savedTask;
  }

  /**
   * 在指定清单中创建任务
   * @param {string} content 任务内容
   * @param {number} listId 清单ID
   * @param {Date|null} reminderTime 提醒时间
   * @param {Object} taskData 完整任务数据（包含 metadata、recurrence 等）
   * @returns {Promise<Task>}
   */
  async createTaskInList(content, listId = 0, reminderTime = undefined, taskData = {}) {
    if (!content || content.trim().length === 0) {
      throw new Error('任务内容不能为空');
    }

    if (typeof listId !== 'number' || listId < 0) {
      throw new Error('清单ID必须是非负整数');
    }

    const {
      metadata = {},
      recurrence = null
    } = taskData;

    const task = new Task(
      Task.generateId(),
      content.trim(),
      'todo',
      new Date(),
      null,
      {}, // timeTracking
      listId,
      metadata,
      recurrence
    );

    // 统一应用时间字段（安排 / 截止 / 提醒），失败不保存
    const timeUpdates = {};
    for (const key of ['scheduledStartAt', 'scheduledEndAt', 'dueDate', 'dueTime', 'reminderPolicy']) {
      if (Object.prototype.hasOwnProperty.call(taskData, key) && taskData[key] !== undefined) {
        timeUpdates[key] = taskData[key];
      }
    }
    if (reminderTime !== undefined) {
      timeUpdates.reminderTime = reminderTime;
    }
    this.applyTimeUpdate(task, timeUpdates);

    // 旧重复系列的提醒时间：没有显式提醒时按系列规则生成第一次触发时间
    if (recurrence && recurrence.reminderTime && !timeUpdates.reminderPolicy && reminderTime === undefined) {
      const seriesReminder = this.calculateRecurringReminderTime(recurrence, null);
      if (seriesReminder) {
        task.reminderTime = seriesReminder;
      }
    }

    const savedTask = await this.taskRepository.save(task);

    // 记录任务创建的状态日志
    if (this.taskStatusLogService) {
      await this.taskStatusLogService.logStatusChange(savedTask.id, null, savedTask.status, savedTask.createdAt);
    }

    return savedTask;
  }

  /**
   * 统一的任务时间字段应用与校验。
   * 未传字段保持原值，显式 null 表示清除；全部校验通过后才写入，保证原子性。
   * @param {Task} task
   * @param {Object} updates
   * @returns {{warning: string|null}}
   */
  applyTimeUpdate(task, updates = {}) {
    const has = (key) => Object.prototype.hasOwnProperty.call(updates, key) && updates[key] !== undefined;

    // 计划安排（开始 / 结束）
    let scheduledStartAt = task.scheduledStartAt;
    let scheduledEndAt = task.scheduledEndAt;
    if (has('scheduledStartAt') || has('scheduledEndAt')) {
      let rawStart = has('scheduledStartAt') ? updates.scheduledStartAt : task.scheduledStartAt;
      let rawEnd = has('scheduledEndAt') ? updates.scheduledEndAt : task.scheduledEndAt;
      if (has('scheduledStartAt') && (rawStart === null || rawStart === '')) {
        rawStart = null;
        rawEnd = null; // 清除开始时同步清除结束
      }
      const normalized = taskTime.normalizeSchedule(rawStart, rawEnd);
      scheduledStartAt = normalized.scheduledStartAt;
      scheduledEndAt = normalized.scheduledEndAt;
    }

    // 截止（日期 / 时间）
    let dueDate = task.dueDate;
    let dueTime = task.dueTime;
    const deadlineTouched = has('dueDate') || has('dueTime');
    if (deadlineTouched) {
      let rawDate = has('dueDate') ? updates.dueDate : task.dueDate;
      let rawTime = has('dueTime') ? updates.dueTime : task.dueTime;
      if (has('dueDate') && (rawDate === null || rawDate === '')) {
        rawDate = null;
        rawTime = null; // 清除日期同步清除时间
      }
      const normalized = taskTime.normalizeDeadline(rawDate, rawTime);
      dueDate = normalized.dueDate;
      dueTime = normalized.dueTime;
    }

    // 提醒
    let reminderPolicy = task.reminderPolicy;
    let reminderTime = task.reminderTime;
    const hasPolicy = has('reminderPolicy');
    const hasReminder = has('reminderTime');
    const now = new Date();

    if (hasPolicy && updates.reminderPolicy === null) {
      reminderPolicy = null;
      reminderTime = null;
    } else if (hasPolicy) {
      const explicitReminder = hasReminder ? updates.reminderTime : null;
      const policyMode = updates.reminderPolicy.mode || updates.reminderPolicy.type;
      const fallbackReminder = policyMode === taskTime.REMINDER_MODES.ABSOLUTE ? task.reminderTime : null;
      const normalized = taskTime.normalizeReminderPolicy(
        updates.reminderPolicy,
        hasReminder ? explicitReminder : fallbackReminder,
        scheduledStartAt
      );

      if (normalized.mode === taskTime.REMINDER_MODES.RELATIVE) {
        reminderTime = new Date(scheduledStartAt.getTime() - normalized.minutesBefore * 60 * 1000);
      } else if (normalized.mode === taskTime.REMINDER_MODES.ABSOLUTE) {
        reminderTime = taskTime.toDate(hasReminder ? explicitReminder : task.reminderTime);
        if (!reminderTime) {
          throw new Error('提醒时间格式无效');
        }
        if (reminderTime <= now && !updates.recurrence) {
          throw new Error('提醒时间不能是过去的时间');
        }
      } else {
        reminderTime = null;
      }
      reminderPolicy = normalized;
    } else if (hasReminder) {
      if (updates.reminderTime === null || updates.reminderTime === '') {
        reminderPolicy = { mode: taskTime.REMINDER_MODES.DISABLED, minutesBefore: null };
        reminderTime = null;
      } else {
        const date = taskTime.toDate(updates.reminderTime);
        if (!date) {
          throw new Error('提醒时间格式无效');
        }
        if (date <= now && !updates.recurrence) {
          throw new Error('提醒时间不能是过去的时间');
        }
        reminderPolicy = { mode: taskTime.REMINDER_MODES.ABSOLUTE, minutesBefore: null };
        reminderTime = date;
      }
    } else if (task.reminderPolicy && task.reminderPolicy.mode === taskTime.REMINDER_MODES.RELATIVE) {
      if (!scheduledStartAt) {
        reminderPolicy = { mode: taskTime.REMINDER_MODES.DISABLED, minutesBefore: null };
        reminderTime = null;
      } else {
        reminderTime = new Date(scheduledStartAt.getTime() - task.reminderPolicy.minutesBefore * 60 * 1000);
      }
    }

    // 计划晚于截止：只提示，不修改
    let warning = null;
    if (scheduledStartAt && dueDate) {
      const boundary = taskTime.deadlineBoundary(dueDate, dueTime);
      if (boundary && scheduledStartAt.getTime() > boundary.getTime()) {
        warning = '计划开始时间晚于截止时间';
      }
    }

    // 相对提醒计算结果已过：不补发通知，仅提示错过，改期后会重新计算
    if (
      reminderPolicy &&
      reminderPolicy.mode === taskTime.REMINDER_MODES.RELATIVE &&
      reminderTime &&
      reminderTime.getTime() <= now.getTime()
    ) {
      warning = warning
        ? `${warning}；该次提醒已错过，改期后将按新安排重新计算`
        : '该次提醒已错过，改期后将按新安排重新计算';
    }

    task.scheduledStartAt = scheduledStartAt;
    task.scheduledEndAt = scheduledEndAt;
    task.dueDate = dueDate;
    task.dueTime = dueTime;
    if (deadlineTouched) {
      task.deadlineInvalid = false;
    }
    task.reminderPolicy = reminderPolicy;
    task.reminderTime = reminderTime;
    task.timeWarning = warning;
    task.updatedAt = new Date();

    return { warning };
  }

  /**
   * 设置通知调度钩子：由外层（IpcHandlers / UseCases）注入，
   * 用于服务内部生成重复实例后注册提醒。
   * @param {Function} scheduleFn (task) => void
   */
  setNotificationScheduler(scheduleFn) {
    this._scheduleNotification = scheduleFn;
  }

  _notifySchedule(task) {
    if (typeof this._scheduleNotification !== 'function') return;
    if (!task || !task.reminderTime) return;
    if (task.status === 'done' || task.status === 'deleted') return;
    try {
      this._scheduleNotification(task);
    } catch (error) {
      console.warn('注册任务提醒失败:', error && error.message);
    }
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

    const oldStatus = task.status;

    // 如果是重复任务，创建下一个实例
    let nextInstanceCreated = false;
    if (task.isRecurring()) {
      const nextInstance = await this.createNextRecurringInstance(task);
      nextInstanceCreated = nextInstance !== null;

      // 如果成功创建了新实例，清理当前任务的重复数据
      if (nextInstanceCreated) {
        task.clearRecurrence();
      }
    }

    // 设置完成时间、累计进行中耗时并标记为完成
    task.completeTask();
    const updatedTask = await this.taskRepository.save(task);

    // 记录状态变化日志
    if (this.taskStatusLogService && oldStatus !== updatedTask.status) {
      await this.taskStatusLogService.logStatusChange(taskId, oldStatus, updatedTask.status);
    }

    return updatedTask;
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

      // 设置 occurrenceDate：当天 0 点时间戳
      const occurrenceDate = new Date(nextDate);
      occurrenceDate.setHours(0, 0, 0, 0);

      // 按统一的实例生成规则创建下一个实例（安排 / 截止 / 提醒）
      const nextInstance = recurringTask.createInstance(occurrenceDate, Task.generateId());
      nextInstance.metadata = { ...recurringTask.metadata };
      nextInstance.recurrence = recurringTask.recurrence; // 保持重复规则
      console.log("nextInstance: ------", nextInstance)
      const savedInstance = await this.taskRepository.save(nextInstance);
      this._notifySchedule(savedInstance);

      // 记录任务创建的状态日志
      if (this.taskStatusLogService) {
        await this.taskStatusLogService.logStatusChange(savedInstance.id, null, savedInstance.status, savedInstance.createdAt);
      }

      return savedInstance;
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

    const oldStatus = task.status;
    task.markAsIncomplete();
    const updatedTask = await this.taskRepository.save(task);

    // 记录状态变化日志
    if (this.taskStatusLogService && oldStatus !== updatedTask.status) {
      await this.taskStatusLogService.logStatusChange(taskId, oldStatus, updatedTask.status);
    }

    return updatedTask;
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

    // 统一应用时间字段（安排 / 截止 / 提醒），任何校验失败都不会写入
    this.applyTimeUpdate(task, updates);

    // 更新内容
    if (updates.content !== undefined) {
      task.updateContent(updates.content);
    }

    // 更新状态
    if (updates.status !== undefined) {
      const oldStatus = task.status;
      task.updateStatus(updates.status);

      // 记录状态变化日志
      if (this.taskStatusLogService && oldStatus !== updates.status) {
        // 延迟记录，等任务保存成功后再记录
        this._pendingStatusLog = { taskId, oldStatus, newStatus: updates.status };
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
    const updatedTask = await this.taskRepository.save(task);

    // 处理延迟的状态日志记录
    if (this._pendingStatusLog) {
      await this.taskStatusLogService.logStatusChange(
        this._pendingStatusLog.taskId,
        this._pendingStatusLog.oldStatus,
        this._pendingStatusLog.newStatus
      );
      this._pendingStatusLog = null;
    }

    return updatedTask;
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

    const oldStatus = task.status;
    task.updateStatus(status);
    const updatedTask = await this.taskRepository.save(task);

    // 记录状态变化日志
    if (this.taskStatusLogService && oldStatus !== status) {
      await this.taskStatusLogService.logStatusChange(taskId, oldStatus, status);
    }

    return updatedTask;
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
    this.applyTimeUpdate(task, { reminderTime });
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

  async getTaskById(taskId) {
    return await this.taskRepository.findById(taskId);
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

    const oldStatus = task.status;
    task.startTask();
    const updatedTask = await this.taskRepository.save(task);

    // 记录状态变化日志
    if (this.taskStatusLogService && oldStatus !== updatedTask.status) {
      await this.taskStatusLogService.logStatusChange(taskId, oldStatus, updatedTask.status);
    }

    return updatedTask;
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

    const oldStatus = task.status;
    task.pauseTask();
    const updatedTask = await this.taskRepository.save(task);

    // 记录状态变化日志
    if (this.taskStatusLogService && oldStatus !== updatedTask.status) {
      await this.taskStatusLogService.logStatusChange(taskId, oldStatus, updatedTask.status);
    }

    return updatedTask;
  }

  /**
   * 完成任务（带时间追踪）
   * @param {string} taskId 任务ID
   * @returns {Promise<Task>}
   */
  async completeTaskWithTracking(taskId) {
    return this.completeTask(taskId);
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
    // console.log('更新任务元数据', taskId, metadata)
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
    const RecurringTaskService = require('./recurring-task-service');
    const instances = RecurringTaskService.expandRecurringTasks(recurringTasks, startDate, endDate);
    return this.mergeOverrideInstances(recurringTasks, instances);
  }

  /**
   * 合并覆盖实例：某次发生已有物化记录（完成 / 单独编辑 / 删除标记）时，
   * 不再返回该日期的虚拟实例，避免同一实例重复展示。
   * @param {Task[]} recurringTasks 重复任务模板
   * @param {Task[]} instances 展开出的虚拟实例
   * @returns {Promise<Task[]>}
   */
  async mergeOverrideInstances(recurringTasks, instances) {
    if (!instances.length) return instances;

    const RecurringTaskService = require('./recurring-task-service');
    const overrideKeys = new Set();
    for (const recurringTask of recurringTasks) {
      const overrides = await this.taskRepository.findOverrideInstances(recurringTask.id);
      for (const override of overrides) {
        const key = RecurringTaskService.instanceKey(recurringTask.id, override.occurrenceDate);
        if (key) overrideKeys.add(key);
      }
    }
    if (!overrideKeys.size) return instances;

    return instances.filter((instance) => {
      const key = RecurringTaskService.instanceKey(instance.seriesId, instance.occurrenceDate);
      return !key || !overrideKeys.has(key);
    });
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
    // 如果有重复规则且包含提醒时间，重新计算提醒时间。
    // 已使用相对 / 关闭 / 默认策略（或本次更新正在设置这些策略）的系列
    // 以策略为准，不用系列提醒时间覆盖，避免静默改写成绝对提醒。
    if (recurrence && recurrence.reminderTime) {
      const existing = await this.taskRepository.findById(taskId);
      const updatesPolicyMode = updates.reminderPolicy && (updates.reminderPolicy.mode || updates.reminderPolicy.type);
      const modernPolicy =
        updatesPolicyMode === taskTime.REMINDER_MODES.RELATIVE ||
        updatesPolicyMode === taskTime.REMINDER_MODES.DISABLED ||
        updatesPolicyMode === taskTime.REMINDER_MODES.DEFAULT ||
        (existing &&
          existing.reminderPolicy &&
          existing.reminderPolicy.mode !== taskTime.REMINDER_MODES.ABSOLUTE);

      if (!modernPolicy) {
        updates.reminderTime = this.calculateRecurringReminderTime(recurrence, updates.reminderTime);
        // 重复任务允许提醒时间为已计算的触发点，不按新绝对提醒校验未来
      }
      updates.recurrence = recurrence;
    }

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
      // 如果不存在，按统一实例规则物化（保留安排 / 截止 / 提醒）后标记完成
      const recurringTask = await this.taskRepository.findById(seriesId);
      if (!recurringTask) {
        throw new Error('重复任务不存在');
      }

      const occurrence = taskTime.toDate(occurrenceDate);
      if (!occurrence) {
        throw new Error('实例日期无效');
      }

      const overrideInstance = recurringTask.createInstance(occurrence, Task.generateId());
      overrideInstance.completeTask();
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
    const existingInstance = await this.taskRepository.findOverrideInstance(seriesId, occurrenceDate);

    if (existingInstance) {
      // 如果存在，更新该实例（走统一的时间字段校验）
      const task = await this.updateTask(existingInstance.id, updates);
      return { success: true, task };
    }

    // 如果不存在，按统一实例规则物化一个覆盖实例，保留安排 / 截止 / 提醒，
    // 再应用本次更新；任何校验失败都不会保存。
    const recurringTask = await this.taskRepository.findById(seriesId);
    if (!recurringTask) {
      throw new Error('重复任务不存在');
    }

    const occurrence = taskTime.toDate(occurrenceDate);
    if (!occurrence) {
      throw new Error('实例日期无效');
    }

    const overrideInstance = recurringTask.createInstance(occurrence, Task.generateId());

    if (updates.content !== undefined) {
      overrideInstance.updateContent(updates.content);
    }
    if (updates.status !== undefined) {
      overrideInstance.updateStatus(updates.status);
    }
    if (updates.listId !== undefined) {
      overrideInstance.moveToList(updates.listId);
    }
    if (updates.metadata !== undefined) {
      overrideInstance.updateMetadata(updates.metadata);
    }
    this.applyTimeUpdate(overrideInstance, updates);

    const savedInstance = await this.taskRepository.save(overrideInstance);
    this._notifySchedule(savedInstance);
    return { success: true, task: savedInstance };
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
