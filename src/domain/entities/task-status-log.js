/**
 * 任务状态日志实体类
 * 记录任务状态变化的历史信息
 */
class TaskStatusLog {
  constructor({
    id = null,
    taskId,
    fromStatus = null,
    toStatus,
    createdAt = new Date().toISOString(),
    metadata = {}
  }) {
    this.id = id;
    this.taskId = taskId;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.createdAt = createdAt;
    this.metadata = metadata;

    // 验证必需字段
    if (!taskId) {
      throw new Error('TaskStatusLog: taskId is required');
    }
    if (!toStatus) {
      throw new Error('TaskStatusLog: toStatus is required');
    }
  }

  /**
   * 验证状态变化的合法性
   * @param {string|null} fromStatus 原状态
   * @param {string} toStatus 目标状态
   * @returns {boolean} 是否为合法的状态转换
   */
  static isValidStatusTransition(fromStatus, toStatus) {
    const validTransitions = {
      'todo': ['doing', 'done'],
      'doing': ['todo', 'pause', 'done'],
      'pause': ['todo', 'doing', 'done'],
      'done': ['todo']
    };
    
    // 初始化时允许任何状态（fromStatus 为 null）
    if (!fromStatus) return true;
    
    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  /**
   * 获取状态变化描述
   * @returns {string} 状态变化的中文描述
   */
  getTransitionDescription() {
    const descriptions = {
      'null->todo': '创建任务',
      'null->doing': '开始执行',
      'null->done': '直接完成',
      'null->pause': '创建并暂停',
      'todo->doing': '开始执行',
      'todo->done': '直接完成',
      'doing->todo': '停止执行',
      'doing->pause': '暂停执行',
      'doing->done': '完成任务',
      'done->todo': '重新激活',
      'pause->todo': '回到待办',
      'pause->doing': '恢复执行',
      'pause->done': '直接完成'
    };
    
    const key = `${this.fromStatus || 'null'}->${this.toStatus}`;
    return descriptions[key] || '状态变化';
  }

  /**
   * 获取状态变化类型
   * @returns {string} 变化类型：start, complete, pause, resume, reactivate
   */
  getTransitionType() {
    const fromStatus = this.fromStatus;
    const toStatus = this.toStatus;

    if (!fromStatus && toStatus === 'doing') return 'start';
    if (!fromStatus && toStatus === 'done') return 'complete';
    if (fromStatus === 'todo' && toStatus === 'doing') return 'start';
    if (fromStatus === 'doing' && toStatus === 'done') return 'complete';
    if (fromStatus === 'doing' && toStatus === 'pause') return 'pause';
    if (fromStatus === 'pause' && toStatus === 'doing') return 'resume';
    if (fromStatus === 'done' && toStatus === 'todo') return 'reactivate';
    if ((fromStatus === 'doing' || fromStatus === 'pause') && toStatus === 'todo') return 'stop';
    
    return 'change';
  }

  /**
   * 检查是否为完成状态的变化
   * @returns {boolean} 是否变为完成状态
   */
  isCompletion() {
    return this.toStatus === 'done';
  }

  /**
   * 检查是否为开始执行的变化
   * @returns {boolean} 是否开始执行
   */
  isStart() {
    return this.toStatus === 'doing' && (this.fromStatus === 'todo' || !this.fromStatus);
  }

  /**
   * 检查是否为暂停的变化
   * @returns {boolean} 是否暂停
   */
  isPause() {
    return this.toStatus === 'pause';
  }

  /**
   * 检查是否为恢复执行的变化
   * @returns {boolean} 是否恢复执行
   */
  isResume() {
    return this.fromStatus === 'pause' && this.toStatus === 'doing';
  }

  /**
   * 获取时间戳（毫秒）
   * @returns {number} 时间戳
   */
  getTimestamp() {
    return new Date(this.createdAt).getTime();
  }

  /**
   * 转换为普通对象
   * @returns {Object} 普通对象表示
   */
  toObject() {
    return {
      id: this.id,
      taskId: this.taskId,
      fromStatus: this.fromStatus,
      toStatus: this.toStatus,
      createdAt: this.createdAt,
      metadata: this.metadata
    };
  }

  /**
   * 从普通对象创建实例
   * @param {Object} obj 普通对象
   * @returns {TaskStatusLog} 实例
   */
  static fromObject(obj) {
    return new TaskStatusLog(obj);
  }

  /**
   * 验证实例的有效性
   * @returns {boolean} 是否有效
   */
  isValid() {
    try {
      // 检查必需字段
      if (!this.taskId || !this.toStatus) {
        return false;
      }

      // 检查状态转换的合法性
      if (!TaskStatusLog.isValidStatusTransition(this.fromStatus, this.toStatus)) {
        return false;
      }

      // 检查时间格式
      if (isNaN(new Date(this.createdAt).getTime())) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 克隆实例
   * @returns {TaskStatusLog} 克隆的实例
   */
  clone() {
    return new TaskStatusLog({
      id: this.id,
      taskId: this.taskId,
      fromStatus: this.fromStatus,
      toStatus: this.toStatus,
      createdAt: this.createdAt,
      metadata: { ...this.metadata }
    });
  }
}

module.exports = TaskStatusLog;