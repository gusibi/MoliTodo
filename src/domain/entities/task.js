/**
 * 任务实体 (Task Entity)
 * 领域层核心实体，包含任务的所有业务逻辑
 */
class Task {
  constructor(id, content, status = 'todo', createdAt = new Date(), reminderTime = null, timeTracking = {}, listId = 0, metadata = {}) {
    this.id = id;
    this.content = content;
    this.status = status; // 'todo', 'doing', 'done'
    this.createdAt = createdAt;
    this.reminderTime = reminderTime;
    this.updatedAt = new Date();
    
    // Time tracking fields
    this.startedAt = timeTracking.startedAt || null;
    this.completedAt = timeTracking.completedAt || null;
    this.totalDuration = timeTracking.totalDuration || 0; // milliseconds
    
    // List management fields
    this.listId = listId || 0; // 0 表示默认清单
    this.metadata = metadata || {}; // JSON 元数据，包含备注等信息
    
    // Keep backward compatibility
    this.completed = status === 'done';
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
   * 收件箱：待办状态且没有提醒时间的任务
   * @returns {boolean}
   */
  isInboxTask() {
    return this.status === 'todo' && !this.reminderTime;
  }

  /**
   * 检查任务是否属于今日分类
   * 今日：提醒时间是今天且未完成的任务，或正在进行中的任务
   * @returns {boolean}
   */
  isTodayTask() {
    return (Task.isToday(this.reminderTime) && this.status !== 'done') || 
           (this.status === 'doing');
  }

  /**
   * 检查任务是否属于计划分类
   * 计划：有提醒时间的任务
   * @returns {boolean}
   */
  isPlannedTask() {
    return !!this.reminderTime;
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
      case 'completed':
        return this.isCompletedTask();
      default:
        return false;
    }
  }

  /**
   * 设置提醒时间
   * @param {Date} reminderTime 提醒时间
   */
  setReminder(reminderTime) {
    if (reminderTime) {
      const isUnixEpoch = reminderTime.getTime() === 0;
      
      if (!isUnixEpoch) {
        const now = new Date();
        const minAllowedTime = new Date(now.getTime() - 30 * 1000);
        
        if (reminderTime <= minAllowedTime) {
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
      metadata: this.metadata
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
      data.metadata || {}
    );
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