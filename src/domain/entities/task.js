/**
 * 任务实体 (Task Entity)
 * 领域层核心实体，包含任务的所有业务逻辑
 */
const taskTime = require('../services/task-time');

class Task {
  constructor(idOrOptions, content, status = 'todo', createdAt = new Date(), reminderTime = null, timeTracking = {}, listId = 0, metadata = {}, recurrence = null, seriesId = null, occurrenceDate = null, dueDate = null, dueTime = null, scheduledStartAt = null, scheduledEndAt = null, reminderPolicy = null) {
    // 支持对象参数调用方式
    if (typeof idOrOptions === 'object' && idOrOptions !== null) {
      const options = idOrOptions;
      this.id = options.id;
      this.content = options.content;
      this.status = options.status || 'todo';
      this.createdAt = options.createdAt || new Date();
      this.reminderTime = options.reminderTime || null;
      this.updatedAt = new Date();
      
      // Time tracking fields
      const timeTrackingData = options.timeTracking || {};
      this.startedAt = timeTrackingData.startedAt || null;
      this.completedAt = timeTrackingData.completedAt || null;
      this.totalDuration = timeTrackingData.totalDuration || 0;
      
      // List management fields
      this.listId = options.listId || 0;
      this.metadata = options.metadata || {};
      
      // Schedule fields
      this.scheduledStartAt = options.scheduledStartAt || null;
      this.scheduledEndAt = options.scheduledEndAt || null;
      
      // Deadline fields
      this.dueDate = options.dueDate || null;
      this.dueTime = options.dueTime || null;
      this.deadlineInvalid = false;
      
      // Reminder policy
      this.reminderPolicy = options.reminderPolicy || null;
      
      // Recurring task fields
      this.recurrence = options.recurrence || null;
      this.seriesId = options.seriesId || null;
      this.occurrenceDate = options.occurrenceDate || null;
    } else {
      // 保持向后兼容：位置参数调用方式
      this.id = idOrOptions;
      this.content = content;
      this.status = status;
      this.createdAt = createdAt;
      this.reminderTime = reminderTime;
      this.updatedAt = new Date();
      
      // Time tracking fields
      this.startedAt = timeTracking.startedAt || null;
      this.completedAt = timeTracking.completedAt || null;
      this.totalDuration = timeTracking.totalDuration || 0;
      
      // List management fields
      this.listId = listId || 0;
      this.metadata = metadata || {};
      
      // Schedule fields
      this.scheduledStartAt = scheduledStartAt;
      this.scheduledEndAt = scheduledEndAt;
      
      // Deadline fields
      this.dueDate = dueDate;
      this.dueTime = dueTime;
      this.deadlineInvalid = false;
      
      // Reminder policy
      this.reminderPolicy = reminderPolicy;
      
      // Recurring task fields
      this.recurrence = recurrence;
      this.seriesId = seriesId;
      this.occurrenceDate = occurrenceDate;
    }

    this._normalizeDeadlineFields();

    // Keep backward compatibility
    this.completed = this.status === 'done';

    // 软删除（垃圾桶）：null 表示未删除；由仓储层从 deleted_at 列映射
    this.deletedAt = null;
  }

  /**
   * 移入垃圾桶（软删除）：deleted_at 非空的任务不参与任何视图与统计
   */
  markDeleted(deletedAt = new Date()) {
    this.deletedAt = deletedAt;
    this.updatedAt = new Date();
  }

  /**
   * 从垃圾桶恢复
   */
  restoreFromTrash() {
    this.deletedAt = null;
    this.updatedAt = new Date();
  }

  /**
   * 兼容读取旧 Deadline：完整 ISO 归一化为 日期 + 时间；
   * 无效旧值保留原样，不阻止加载。
   */
  _normalizeDeadlineFields() {
    if (!this.dueDate) {
      this.dueTime = this.dueTime || null;
      return;
    }
    try {
      const normalized = taskTime.normalizeDeadline(this.dueDate, this.dueTime);
      this.dueDate = normalized.dueDate;
      this.dueTime = normalized.dueTime;
    } catch (error) {
      this.deadlineInvalid = true;
    }
  }

  /**
   * 更新任务状态
   * @param {string} status 新状态 ('todo', 'doing', 'done')
   */
  updateStatus(status) {
    const validStatuses = ['todo', 'doing', 'done'];
    if (!validStatuses.includes(status)) {
      throw new Error('无效的任务状态');
    }
    this.status = status;
    this.completed = status === 'done'; // Keep backward compatibility
    this.updatedAt = new Date();
  }

  /**
   * 标记任务为已完成
   */
  markAsCompleted() {
    this.updateStatus('done');
  }

  /**
   * 标记任务为未完成
   */
  markAsIncomplete() {
    this.updateStatus('todo');
  }

  /**
   * 标记任务为进行中
   */
  markAsInProgress() {
    this.updateStatus('doing');
  }

  /**
   * 开始任务 - 从待办或暂停状态开始计时
   */
  startTask() {
    if (this.status !== 'todo' && this.status !== 'paused') {
      throw new Error('只能从待办或暂停状态开始任务');
    }
    this.status = 'doing';
    this.startedAt = new Date();
    this.completed = false;
    this.updatedAt = new Date();
  }

  /**
   * 暂停任务 - 从进行中状态暂停，累计已用时间
   */
  pauseTask() {
    if (this.status !== 'doing') {
      throw new Error('只能暂停进行中的任务');
    }
    if (this.startedAt) {
      const currentDuration = Date.now() - this.startedAt.getTime();
      this.totalDuration += currentDuration;
    }
    this.status = 'paused';
    this.startedAt = null;
    this.completed = false;
    this.updatedAt = new Date();
  }

  /**
   * 完成任务 - 记录完成时间和总耗时
   */
  completeTask() {
    if (this.status === 'doing' && this.startedAt) {
      const currentDuration = Date.now() - this.startedAt.getTime();
      this.totalDuration += currentDuration;
    }
    this.status = 'done';
    this.completed = true;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 重新开始任务 - 从已完成状态重新开始
   */
  restartTask() {
    this.status = 'todo';
    this.completed = false;
    this.startedAt = null;
    this.completedAt = null;
    // 保留 totalDuration，作为历史记录
    this.updatedAt = new Date();
  }

  /**
   * 获取当前进行时长（毫秒）
   * @returns {number}
   */
  getCurrentDuration() {
    if (this.status !== 'doing' || !this.startedAt) {
      return 0;
    }
    return Date.now() - this.startedAt.getTime();
  }

  /**
   * 获取总工作时长（毫秒）
   * @returns {number}
   */
  getTotalWorkDuration() {
    return this.totalDuration + this.getCurrentDuration();
  }

  /**
   * 格式化时长显示
   * @param {number} milliseconds 毫秒数
   * @param {boolean} compact 是否使用紧凑格式
   * @returns {string}
   */
  static formatDuration(milliseconds, compact = false) {
    if (milliseconds < 1000) {
      return compact ? '0m' : '0秒';
    }

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (compact) {
      if (hours > 0) {
        return `${hours}h${minutes % 60}m`;
      } else {
        return `${minutes}m`;
      }
    } else {
      if (hours > 0) {
        return `${hours}小时${minutes % 60}分钟`;
      } else if (minutes > 0) {
        return `${minutes}分钟`;
      } else {
        return `${seconds}秒`;
      }
    }
  }

  /**
   * 获取格式化的工作时长
   * @param {boolean} compact 是否使用紧凑格式
   * @returns {string}
   */
  getFormattedDuration(compact = false) {
    return Task.formatDuration(this.getTotalWorkDuration(), compact);
  }

  /**
   * 获取状态显示文本
   * @returns {string}
   */
  getStatusText() {
    const statusMap = {
      'todo': '待办',
      'doing': '进行中',
      'done': '已完成'
    };
    return statusMap[this.status] || '未知';
  }

  /**
   * 检查是否已完成
   * @returns {boolean}
   */
  isCompleted() {
    return this.status === 'done';
  }

  /**
   * 检查是否进行中
   * @returns {boolean}
   */
  isInProgress() {
    return this.status === 'doing';
  }

  /**
   * 检查是否待办
   * @returns {boolean}
   */
  isTodo() {
    return this.status === 'todo';
  }

  /**
   * 检查是否暂停中
   * @returns {boolean}
   */
  isPaused() {
    return this.status === 'paused';
  }

  /**
   * 检查日期是否为今天
   * @param {string|Date} dateString 日期字符串或Date对象
   * @returns {boolean} 是否为今天
   */
  static isToday(dateString) {
    if (!dateString) return false
    
    const today = new Date()
    const date = new Date(dateString)
    
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate()
  }

  /**
   * 检查任务是否属于收件箱分类
   * 收件箱：待办状态且没有安排与截止（只有提醒不妨碍进入收件箱）
   * @returns {boolean}
   */
  isInboxTask() {
    return taskTime.isTaskInbox(this);
  }

  /**
   * 检查任务是否属于今日分类
   * 今日：今天有安排/截止、截止逾期、过去安排未完成，或正在进行中
   * @returns {boolean}
   */
  isTodayTask() {
    return taskTime.isTaskToday(this);
  }

  /**
   * 检查任务是否属于计划分类
   * 计划：未完成且有安排或截止
   * @returns {boolean}
   */
  isPlannedTask() {
    return taskTime.isTaskPlanned(this);
  }

  /**
   * 检查任务是否未安排
   * @returns {boolean}
   */
  isUnscheduledTask() {
    return taskTime.isTaskUnscheduled(this);
  }

  /**
   * 是否有计划安排
   * @returns {boolean}
   */
  hasSchedule() {
    return taskTime.hasSchedule(this);
  }

  /**
   * 是否有截止
   * @returns {boolean}
   */
  hasDeadline() {
    return taskTime.hasDeadline(this);
  }

  /**
   * 是否逾期
   * @returns {boolean}
   */
  isOverdue() {
    return taskTime.isOverdue(this);
  }

  /**
   * 获取主日期信息
   * @returns {{date: string, kind: string}|null}
   */
  getMainDateInfo() {
    return taskTime.getMainDateInfo(this);
  }

  /**
   * 检查任务是否属于已完成分类
   * @returns {boolean}
   */
  isCompletedTask() {
    return this.status === 'done';
  }

  /**
   * 检查任务是否属于进行中分类
   * @returns {boolean}
   */
  isDoingTask() {
    return this.status === 'doing';
  }

  /**
   * 检查任务是否属于暂停中分类
   * @returns {boolean}
   */
  isPausedTask() {
    return this.status === 'paused';
  }

  /**
   * 获取任务所属的分类
   * @returns {string[]} 任务所属的分类数组
   */
  getCategories() {
    const categories = ['all']; // 所有任务都属于'all'分类
    
    if (this.isInboxTask()) categories.push('inbox');
    if (this.isTodayTask()) categories.push('today');
    if (this.isDoingTask()) categories.push('doing');
    if (this.isPausedTask()) categories.push('paused');
    if (this.isPlannedTask()) categories.push('planned');
    if (this.isUnscheduledTask()) categories.push('unscheduled');
    if (this.isCompletedTask()) categories.push('completed');
    
    return categories;
  }

  /**
   * 检查任务是否属于指定分类
   * @param {string} category 分类名称
   * @returns {boolean}
   */
  belongsToCategory(category) {
    switch (category) {
      case 'all':
        return true;
      case 'inbox':
        return this.isInboxTask();
      case 'today':
        return this.isTodayTask();
      case 'doing':
        return this.isDoingTask();
      case 'paused':
        return this.isPausedTask();
      case 'planned':
        return this.isPlannedTask();
      case 'unscheduled':
        return this.isUnscheduledTask();
      case 'completed':
        return this.isCompletedTask();
      default:
        return false;
    }
  }

  /**
   * 设置提醒时间
   * @param {Date} reminderTime 提醒时间
   * @param {boolean} allowBeforeTime 是否允许设置过去的时间
   * @param {Date} originalReminderTime 原始提醒时间（用于编辑模式对比）
   */
  setReminder(reminderTime, allowBeforeTime=false, originalReminderTime=null) {
    if (reminderTime) {
      const isUnixEpoch = reminderTime.getTime() === 0;
      
      if (!isUnixEpoch) {
        const now = new Date();
        const minAllowedTime = new Date(now.getTime() - 30 * 1000);
        
        // 如果提供了原始提醒时间，且新时间与原时间相同（精确到分钟），跳过验证
        if (originalReminderTime) {
          const timeDiff = Math.abs(reminderTime.getTime() - originalReminderTime.getTime());
          if (timeDiff < 60000) { // 小于1分钟认为没有变化
            // 时间没有变化，跳过过去时间验证
          } else if (reminderTime <= minAllowedTime && !allowBeforeTime) {
            throw new Error('提醒时间不能是过去的时间');
          }
        } else if (reminderTime <= minAllowedTime && !allowBeforeTime) {
          throw new Error('提醒时间不能是过去的时间');
        }
      }
    }
    
    this.reminderTime = (reminderTime && reminderTime.getTime() === 0) ? null : reminderTime;
    this.updatedAt = new Date();
  }

  /**
   * 清除提醒
   */
  clearReminder() {
    this.reminderTime = null;
    this.updatedAt = new Date();
  }

  /**
   * 设置计划安排。开始必填，结束可选且不得早于开始。
   * @param {Date|string} scheduledStartAt
   * @param {Date|string|null} scheduledEndAt
   */
  setSchedule(scheduledStartAt, scheduledEndAt = null) {
    const normalized = taskTime.normalizeSchedule(scheduledStartAt, scheduledEndAt);
    this.scheduledStartAt = normalized.scheduledStartAt;
    this.scheduledEndAt = normalized.scheduledEndAt;
    this.updatedAt = new Date();
    this._recomputeRelativeReminder();
  }

  /**
   * 清除计划安排（同时清除结束时间）。
   * 相对提醒随之转为关闭。
   */
  clearSchedule() {
    this.scheduledStartAt = null;
    this.scheduledEndAt = null;
    if (this.reminderPolicy && this.reminderPolicy.mode === taskTime.REMINDER_MODES.RELATIVE) {
      this.reminderPolicy = { mode: taskTime.REMINDER_MODES.DISABLED, minutesBefore: null };
      this.reminderTime = null;
    }
    this.updatedAt = new Date();
  }

  /**
   * 设置截止日期 / 时间。日期必填，时间可选。
   * @param {string|null} dueDate
   * @param {string|null} dueTime
   */
  setDeadline(dueDate, dueTime = null) {
    const normalized = taskTime.normalizeDeadline(dueDate, dueTime);
    this.dueDate = normalized.dueDate;
    this.dueTime = normalized.dueTime;
    this.deadlineInvalid = false;
    this.updatedAt = new Date();
  }

  /**
   * 清除截止（日期与时间同步清除）。
   */
  clearDeadline() {
    this.dueDate = null;
    this.dueTime = null;
    this.deadlineInvalid = false;
    this.updatedAt = new Date();
  }

  /**
   * 设置提醒策略。相对策略会立即按开始时间计算触发时间。
   * @param {Object|null} policy { mode, minutesBefore? }
   * @param {Date|string|null} reminderTime 绝对提醒时间
   */
  setReminderPolicy(policy, reminderTime = null) {
    const normalized = taskTime.normalizeReminderPolicy(policy, reminderTime, this.scheduledStartAt);
    this.reminderPolicy = normalized;

    if (normalized === null) {
      return;
    }

    if (normalized.mode === taskTime.REMINDER_MODES.RELATIVE) {
      const derived = taskTime.deriveReminderTime(this);
      this.reminderTime = derived;
    } else if (normalized.mode === taskTime.REMINDER_MODES.ABSOLUTE) {
      this.reminderTime = taskTime.toDate(reminderTime);
    } else {
      this.reminderTime = null;
    }

    this.updatedAt = new Date();
  }

  /**
   * 获取生效的提醒策略。无策略时按绝对提醒解释（旧数据兼容）。
   * @returns {{mode: string, minutesBefore: number|null, legacy: boolean}}
   */
  getEffectiveReminderPolicy() {
    if (this.reminderPolicy) {
      return { ...this.reminderPolicy, legacy: false };
    }
    if (this.reminderTime) {
      return { mode: taskTime.REMINDER_MODES.ABSOLUTE, minutesBefore: null, legacy: true };
    }
    return { mode: taskTime.REMINDER_MODES.DEFAULT, minutesBefore: null, legacy: true };
  }

  _recomputeRelativeReminder() {
    if (this.reminderPolicy && this.reminderPolicy.mode === taskTime.REMINDER_MODES.RELATIVE) {
      this.reminderTime = taskTime.deriveReminderTime(this);
    }
  }

  /**
   * 更新任务内容
   * @param {string} content 新的任务内容
   */
  updateContent(content) {
    if (!content || content.trim().length === 0) {
      throw new Error('任务内容不能为空');
    }
    this.content = content.trim();
    this.updatedAt = new Date();
  }

  /**
   * 移动任务到指定清单
   * @param {number} listId 目标清单ID
   */
  moveToList(listId) {
    if (typeof listId !== 'number' || listId < 0) {
      throw new Error('清单ID必须是非负整数');
    }
    this.listId = listId;
    this.updatedAt = new Date();
  }

  /**
   * 更新任务元数据
   * @param {Object} metadata 元数据对象
   */
  updateMetadata(metadata) {
    if (typeof metadata !== 'object' || metadata === null) {
      throw new Error('元数据必须是对象');
    }
    this.metadata = { ...this.metadata, ...metadata };
    this.updatedAt = new Date();
  }

  /**
   * 设置任务备注
   * @param {string} comment 备注内容
   */
  setComment(comment) {
    if (comment && typeof comment !== 'string') {
      throw new Error('备注必须是字符串');
    }
    
    if (comment && comment.length > 1000) {
      throw new Error('备注不能超过1000个字符');
    }
    
    this.updateMetadata({ comment: comment ? comment.trim() : null });
  }

  /**
   * 获取任务备注
   * @returns {string|null}
   */
  getComment() {
    return this.metadata.comment || null;
  }

  /**
   * 检查任务是否有备注
   * @returns {boolean}
   */
  hasComment() {
    return !!(this.metadata.comment && this.metadata.comment.trim());
  }

  /**
   * 检查任务是否属于指定清单
   * @param {number} listId 清单ID
   * @returns {boolean}
   */
  belongsToList(listId) {
    return this.listId === listId;
  }

  /**
   * 检查任务是否在默认清单中
   * @returns {boolean}
   */
  isInDefaultList() {
    return this.listId === 0;
  }

  /**
   * 检查是否需要提醒
   * @returns {boolean}
   */
  shouldRemind() {
    if (!this.reminderTime || this.isCompleted()) {
      return false;
    }
    return new Date() >= this.reminderTime;
  }

  /**
   * 获取格式化的提醒时间
   * @returns {string|null}
   */
  getFormattedReminderTime() {
    if (!this.reminderTime) {
      return null;
    }
    
    const now = new Date();
    const reminder = new Date(this.reminderTime);
    
    if (reminder.toDateString() === now.toDateString()) {
      return `今天 ${reminder.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (reminder.toDateString() === tomorrow.toDateString()) {
      return `明天 ${reminder.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return reminder.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 转换为普通对象 (用于序列化)
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      content: this.content,
      status: this.status,
      completed: this.completed,
      createdAt: this.createdAt.toISOString(),
      reminderTime: this.reminderTime ? this.reminderTime.toISOString() : null,
      updatedAt: this.updatedAt.toISOString(),
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      completedAt: this.completedAt ? this.completedAt.toISOString() : null,
      totalDuration: this.totalDuration,
      listId: this.listId,
      metadata: this.metadata,
      recurrence: this.recurrence,
      seriesId: this.seriesId,
      occurrenceDate: this.occurrenceDate instanceof Date
        ? this.occurrenceDate.toISOString()
        : this.occurrenceDate,
      dueDate: this.dueDate,
      dueTime: this.dueTime,
      scheduledStartAt: this.scheduledStartAt ? this.scheduledStartAt.toISOString() : null,
      scheduledEndAt: this.scheduledEndAt ? this.scheduledEndAt.toISOString() : null,
      reminderPolicy: this.reminderPolicy
    };
  }

  /**
   * 从普通对象创建任务实例 (用于反序列化)
   * @param {Object} data 
   * @returns {Task}
   */
  static fromJSON(data) {
    let status = data.status;
    if (!status) {
      status = data.completed ? 'done' : 'todo';
    }
    
    const timeTracking = {
      startedAt: data.startedAt ? new Date(data.startedAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      totalDuration: data.totalDuration || 0
    };
    
    return new Task(
      data.id,
      data.content,
      status,
      new Date(data.createdAt),
      data.reminderTime ? new Date(data.reminderTime) : null,
      timeTracking,
      data.listId || 0,
      data.metadata || {},
      data.recurrence || null,
      data.seriesId || null,
      data.occurrenceDate || null,
      data.dueDate || null,
      data.dueTime || null,
      data.scheduledStartAt ? new Date(data.scheduledStartAt) : null,
      data.scheduledEndAt ? new Date(data.scheduledEndAt) : null,
      data.reminderPolicy || null
    );
  }

  /**
   * 检查是否为重复任务
   * @returns {boolean}
   */
  isRecurring() {
    return this.recurrence !== null && this.recurrence !== undefined;
  }

  /**
   * 检查是否为重复任务实例
   * @returns {boolean}
   */
  isRecurringInstance() {
    return this.seriesId !== null && this.seriesId !== undefined;
  }

  /**
   * 获取重复任务的系列ID（如果是实例则返回seriesId，否则返回自身ID）
   * @returns {string}
   */
  getSeriesId() {
    return this.seriesId || this.id;
  }

  /**
   * 设置重复规则
   * @param {Object} recurrence 重复规则对象
   */
  setRecurrence(recurrence) {
    this.recurrence = recurrence;
    this.updatedAt = new Date();
  }

  /**
   * 清除重复规则
   */
  clearRecurrence() {
    this.recurrence = null;
    this.updatedAt = new Date();
  }

  /**
   * 创建重复任务实例
   * @param {Date} occurrenceDate 实例日期
   * @param {string} newId 新实例ID
   * @returns {Task}
   */
  createInstance(occurrenceDate, newId) {
    const occurrence = new Date(occurrenceDate);
    const templateStart = this.scheduledStartAt ? new Date(this.scheduledStartAt) : null;
    const templateEnd = this.scheduledEndAt ? new Date(this.scheduledEndAt) : null;

    // 实例安排：使用模板的开始时刻，结束按模板的本地日期偏移生成（支持跨天）
    let scheduledStartAt = null;
    let scheduledEndAt = null;
    if (templateStart) {
      scheduledStartAt = new Date(occurrence);
      scheduledStartAt.setHours(templateStart.getHours(), templateStart.getMinutes(), 0, 0);

      if (templateEnd) {
        const dayOffset = taskTime.localDayOffset(templateStart, templateEnd);
        scheduledEndAt = new Date(occurrence);
        scheduledEndAt.setDate(scheduledEndAt.getDate() + dayOffset);
        scheduledEndAt.setHours(templateEnd.getHours(), templateEnd.getMinutes(), 0, 0);
      }
    }

    // 实例截止：新系列按模板相对起始日期的日历日偏移生成；
    // 旧日期型系列不凭空增加截止，已有实例的 Deadline 原样保留。
    let dueDate = null;
    let dueTime = null;
    if (this.dueDate && templateStart) {
      const dueAnchor = new Date(`${this.dueDate}T00:00:00`);
      const dayOffset = taskTime.localDayOffset(templateStart, dueAnchor);
      const instanceDue = new Date(occurrence);
      instanceDue.setDate(instanceDue.getDate() + dayOffset);
      dueDate = taskTime.localDateKey(instanceDue);
      dueTime = this.dueTime || null;
    }

    // 实例提醒
    let reminderPolicy = null;
    let reminderTime = null;
    const relativePolicy = this.reminderPolicy && this.reminderPolicy.mode === taskTime.REMINDER_MODES.RELATIVE
      ? this.reminderPolicy
      : null;

    if (relativePolicy && scheduledStartAt) {
      reminderPolicy = { mode: taskTime.REMINDER_MODES.RELATIVE, minutesBefore: relativePolicy.minutesBefore };
      reminderTime = new Date(scheduledStartAt.getTime() - relativePolicy.minutesBefore * 60 * 1000);
    } else {
      // 系列级提醒：按模板提醒相对起始日期的日历日偏移及本地时刻重复（支持前一天）
      let reminderTimeOfDay = null;
      let reminderDayOffset = 0;
      if (this.recurrence && this.recurrence.reminderTime) {
        reminderTimeOfDay = this.recurrence.reminderTime;
      } else if (this.reminderTime && templateStart) {
        const reminderDate = new Date(this.reminderTime);
        reminderTimeOfDay = taskTime.localTimeKey(reminderDate);
        reminderDayOffset = taskTime.localDayOffset(templateStart, reminderDate);
      } else if (this.reminderTime && !templateStart) {
        reminderTimeOfDay = taskTime.localTimeKey(new Date(this.reminderTime));
      }

      if (reminderTimeOfDay) {
        const [hours, minutes] = reminderTimeOfDay.split(':').map(Number);
        reminderTime = new Date(occurrence);
        reminderTime.setDate(reminderTime.getDate() + reminderDayOffset);
        reminderTime.setHours(hours, minutes, 0, 0);
        reminderPolicy = { mode: taskTime.REMINDER_MODES.ABSOLUTE, minutesBefore: null };
      }
    }

    const instance = new Task(
      newId,
      this.content,
      'todo',
      new Date(),
      reminderTime,
      {},
      this.listId,
      this.metadata,
      null, // 实例不包含重复规则
      this.getSeriesId(),
      occurrence,
      dueDate, // 未设置截止则不生成
      dueTime,
      scheduledStartAt,
      scheduledEndAt,
      reminderPolicy
    );

    return instance;
  }

  /**
   * 生成唯一ID
   * @returns {string}
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

module.exports = Task;