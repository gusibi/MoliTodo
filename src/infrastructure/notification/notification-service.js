const schedule = require('node-schedule');
const taskTime = require('../../domain/services/task-time');

/**
 * 通知服务
 * 负责管理任务提醒的调度和通知
 *
 * 过期提醒的处理规则（任务时间模型）：
 * - 相对提醒计算结果已过：不补发即时通知，等待改期后重新计算；
 * - 旧绝对提醒（无策略或绝对策略）恢复：保持原有的立即触发行为；
 * - 显式传入 skipPast（如重复系列注入的提醒、虚拟实例）：一律跳过过期项。
 */
class NotificationService {
  constructor() {
    this.scheduledJobs = new Map(); // taskId -> job
  }

  _isCompleted(task) {
    if (!task) return true;
    if (typeof task.isCompleted === 'function') return task.isCompleted();
    return task.status === 'done' || task.completed === true;
  }

  /**
   * 为任务安排提醒
   * @param {Task} task 任务对象
   * @param {Function} callback 提醒回调函数
   * @param {Object} [options]
   * @param {boolean} [options.skipPast] 提醒时间已过时直接跳过（不触发）
   */
  scheduleTaskReminder(task, callback, options = {}) {
    if (!task || !task.reminderTime || this._isCompleted(task)) {
      return;
    }

    const reminderTime = task.reminderTime instanceof Date
      ? task.reminderTime
      : new Date(task.reminderTime);
    if (Number.isNaN(reminderTime.getTime())) {
      return;
    }

    // 取消现有的提醒
    this.cancelTaskReminder(task.id);

    // 检查提醒时间是否已过
    const now = new Date();
    if (reminderTime <= now) {
      const isRelative = taskTime.isRelativePolicy(task);
      if (options.skipPast || isRelative) {
        // 相对提醒的过期计算结果只提示错过，不补发即时通知
        console.log(`跳过已错过的提醒: ${task.content}`);
        return;
      }
      // 旧绝对提醒恢复：立即触发提醒（沿用既有行为）
      setTimeout(() => callback(task), 0);
      return;
    }

    // 安排新的提醒
    const job = schedule.scheduleJob(reminderTime, () => {
      callback(task);
      // 提醒后移除任务
      this.scheduledJobs.delete(task.id);
    });

    if (job) {
      this.scheduledJobs.set(task.id, job);
      console.log(`已安排任务提醒: ${task.content} 在 ${reminderTime.toLocaleString()}`);
    } else {
      console.warn(`无法安排任务提醒: ${task.content}`);
    }
  }

  /**
   * 取消任务提醒
   * @param {string} taskId 任务ID
   */
  cancelTaskReminder(taskId) {
    const job = this.scheduledJobs.get(taskId);
    if (job) {
      job.cancel();
      this.scheduledJobs.delete(taskId);
      console.log(`已取消任务提醒: ${taskId}`);
    }
  }

  /**
   * 应用启动时恢复已持久化任务的提醒。
   * 旧绝对提醒保持现有恢复行为（过期立即触发）；相对提醒过期时跳过。
   * @param {Task[]} tasks 任务列表
   * @param {Function} callback 提醒回调函数
   */
  restoreReminders(tasks, callback) {
    this.clearAllSchedules();

    let restored = 0;
    tasks.forEach(task => {
      if (task.reminderTime && !this._isCompleted(task)) {
        const before = this.scheduledJobs.size;
        this.scheduleTaskReminder(task, callback);
        if (this.scheduledJobs.size > before) restored++;
      }
    });

    console.log(`已恢复 ${restored} 个任务提醒`);
  }

  /**
   * 重新安排所有任务的提醒
   * @param {Task[]} tasks 任务列表
   * @param {Function} callback 提醒回调函数
   */
  rescheduleAllReminders(tasks, callback) {
    this.restoreReminders(tasks, callback);
  }

  /**
   * 清除所有提醒调度
   */
  clearAllSchedules() {
    this.scheduledJobs.forEach((job, taskId) => {
      job.cancel();
    });
    this.scheduledJobs.clear();
    console.log('已清除所有任务提醒');
  }

  /**
   * 获取当前调度的提醒数量
   * @returns {number}
   */
  getScheduledCount() {
    return this.scheduledJobs.size;
  }

  /**
   * 获取所有调度的任务ID
   * @returns {string[]}
   */
  getScheduledTaskIds() {
    return Array.from(this.scheduledJobs.keys());
  }

  /**
   * 检查任务是否有调度的提醒
   * @param {string} taskId 任务ID
   * @returns {boolean}
   */
  hasScheduledReminder(taskId) {
    return this.scheduledJobs.has(taskId);
  }
}

module.exports = NotificationService;
