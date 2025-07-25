const schedule = require('node-schedule');

/**
 * 通知服务
 * 负责管理任务提醒的调度和通知
 */
class NotificationService {
  constructor() {
    this.scheduledJobs = new Map(); // taskId -> job
  }

  /**
   * 为任务安排提醒
   * @param {Task} task 任务对象
   * @param {Function} callback 提醒回调函数
   */
  scheduleTaskReminder(task, callback) {
    if (!task.reminderTime || task.isCompleted()) {
      return;
    }

    // 取消现有的提醒
    this.cancelTaskReminder(task.id);

    // 检查提醒时间是否已过
    const now = new Date();
    if (task.reminderTime <= now) {
      // 立即触发提醒
      setTimeout(() => callback(task), 0);
      return;
    }

    // 安排新的提醒
    const job = schedule.scheduleJob(task.reminderTime, () => {
      callback(task);
      // 提醒后移除任务
      this.scheduledJobs.delete(task.id);
    });

    if (job) {
      this.scheduledJobs.set(task.id, job);
      console.log(`已安排任务提醒: ${task.content} 在 ${task.reminderTime.toLocaleString()}`);
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
   * 重新安排所有任务的提醒
   * @param {Task[]} tasks 任务列表
   * @param {Function} callback 提醒回调函数
   */
  rescheduleAllReminders(tasks, callback) {
    // 清除所有现有的提醒
    this.clearAllSchedules();

    // 为每个需要提醒的任务安排提醒
    tasks.forEach(task => {
      if (task.reminderTime && !task.isCompleted()) {
        this.scheduleTaskReminder(task, callback);
      }
    });

    console.log(`已重新安排 ${this.scheduledJobs.size} 个任务提醒`);
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