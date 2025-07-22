/**
 * 任务实体 (Task Entity)
 * 领域层核心实体，包含任务的所有业务逻辑
 */
class Task {
  constructor(id, content, status = 'todo', createdAt = new Date(), reminderTime = null) {
    this.id = id;
    this.content = content;
    this.status = status; // 'todo', 'doing', 'done'
    this.createdAt = createdAt;
    this.reminderTime = reminderTime;
    this.updatedAt = new Date();
    
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
   * 设置提醒时间
   * @param {Date} reminderTime 提醒时间
   */
  setReminder(reminderTime) {
    if (reminderTime) {
      // 检查是否是 Unix 时间戳 0 (1970-01-01T00:00:00.000Z)，这表示清除提醒
      const isUnixEpoch = reminderTime.getTime() === 0;
      
      if (!isUnixEpoch) {
        const now = new Date();
        // 允许30秒的时间容差，避免因为网络延迟或处理时间导致的问题
        const minAllowedTime = new Date(now.getTime() - 30 * 1000);
        
        if (reminderTime <= minAllowedTime) {
          throw new Error('提醒时间不能是过去的时间');
        }
      }
    }
    
    // 如果是 Unix 时间戳 0，将其设置为 null（表示无提醒）
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
    
    // 如果是今天
    if (reminder.toDateString() === now.toDateString()) {
      return `今天 ${reminder.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // 如果是明天
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (reminder.toDateString() === tomorrow.toDateString()) {
      return `明天 ${reminder.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // 其他日期
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
      completed: this.completed, // Keep for backward compatibility
      createdAt: this.createdAt.toISOString(),
      reminderTime: this.reminderTime ? this.reminderTime.toISOString() : null,
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * 从普通对象创建任务实例 (用于反序列化)
   * @param {Object} data 
   * @returns {Task}
   */
  static fromJSON(data) {
    // Handle backward compatibility
    let status = data.status;
    if (!status) {
      status = data.completed ? 'done' : 'todo';
    }
    
    return new Task(
      data.id,
      data.content,
      status,
      new Date(data.createdAt),
      data.reminderTime ? new Date(data.reminderTime) : null
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