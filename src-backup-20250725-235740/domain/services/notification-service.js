const { Notification } = require('electron');
const schedule = require('node-schedule');

/**
 * 通知服务 (Notification Service)
 * 处理系统通知和提醒调度
 */
class NotificationService {
  constructor() {
    this.scheduledJobs = new Map(); // 存储已调度的任务
  }

  /**
   * 发送系统通知
   * @param {string} title 通知标题
   * @param {string} body 通知内容
   * @param {Object} options 额外选项
   */
  sendNotification(title, body, options = {}) {
    if (!Notification.isSupported()) {
      console.warn('系统不支持通知');
      return;
    }

    const notification = new Notification({
      title,
      body,
      icon: options.icon,
      sound: options.sound !== false, // 默认播放声音
      urgency: options.urgency || 'normal',
      ...options
    });

    notification.show();

    // 处理通知点击事件
    if (options.onClick) {
      notification.on('click', options.onClick);
    }

    return notification;
  }

  /**
   * 发送任务提醒通知
   * @param {Task} task 任务对象
   * @param {Function} onClickCallback 点击回调
   */
  sendTaskReminder(task, onClickCallback) {
    return this.sendNotification(
      'MoliTodo 提醒',
      `📋 ${task.content}`,
      {
        urgency: 'critical',
        onClick: onClickCallback
      }
    );
  }

  /**
   * 调度任务提醒
   * @param {Task} task 任务对象
   * @param {Function} onReminderCallback 提醒回调
   */
  scheduleTaskReminder(task, onReminderCallback) {
    if (!task.reminderTime || task.completed) {
      return;
    }

    // 如果已经有调度，先取消
    this.cancelTaskReminder(task.id);

    const reminderDate = new Date(task.reminderTime);
    
    // 检查提醒时间是否已过
    if (reminderDate <= new Date()) {
      // 立即触发提醒
      this.triggerTaskReminder(task, onReminderCallback);
      return;
    }

    // 调度未来的提醒
    const job = schedule.scheduleJob(reminderDate, () => {
      this.triggerTaskReminder(task, onReminderCallback);
      this.scheduledJobs.delete(task.id);
    });

    if (job) {
      this.scheduledJobs.set(task.id, job);
      console.log(`已调度任务提醒: ${task.content} at ${reminderDate}`);
    }
  }

  /**
   * 触发任务提醒
   * @param {Task} task 任务对象
   * @param {Function} onReminderCallback 提醒回调
   */
  triggerTaskReminder(task, onReminderCallback) {
    // 发送系统通知
    this.sendTaskReminder(task, () => {
      if (onReminderCallback) {
        onReminderCallback(task);
      }
    });

    // 调用提醒回调
    if (onReminderCallback) {
      onReminderCallback(task);
    }
  }

  /**
   * 取消任务提醒调度
   * @param {string} taskId 任务ID
   */
  cancelTaskReminder(taskId) {
    const job = this.scheduledJobs.get(taskId);
    if (job) {
      job.cancel();
      this.scheduledJobs.delete(taskId);
      console.log(`已取消任务提醒调度: ${taskId}`);
    }
  }

  /**
   * 重新调度所有任务提醒
   * @param {Task[]} tasks 任务列表
   * @param {Function} onReminderCallback 提醒回调
   */
  rescheduleAllReminders(tasks, onReminderCallback) {
    // 清除所有现有调度
    this.clearAllSchedules();

    // 重新调度所有有提醒时间的未完成任务
    tasks
      .filter(task => !task.completed && task.reminderTime)
      .forEach(task => {
        this.scheduleTaskReminder(task, onReminderCallback);
      });
  }

  /**
   * 清除所有调度
   */
  clearAllSchedules() {
    this.scheduledJobs.forEach(job => job.cancel());
    this.scheduledJobs.clear();
  }

  /**
   * 获取当前调度的任务数量
   * @returns {number}
   */
  getScheduledCount() {
    return this.scheduledJobs.size;
  }

  /**
   * 检查是否有调度的提醒
   * @param {string} taskId 任务ID
   * @returns {boolean}
   */
  hasScheduledReminder(taskId) {
    return this.scheduledJobs.has(taskId);
  }

  /**
   * 发送应用启动通知
   */
  sendStartupNotification() {
    this.sendNotification(
      'MoliTodo',
      '悬浮待办已启动，随时为您管理任务！',
      {
        urgency: 'low'
      }
    );
  }

  /**
   * 发送任务统计通知
   * @param {number} totalTasks 总任务数
   * @param {number} completedTasks 已完成任务数
   */
  sendTaskSummaryNotification(totalTasks, completedTasks) {
    const pendingTasks = totalTasks - completedTasks;
    let message;

    if (pendingTasks === 0) {
      message = '🎉 太棒了！所有任务都已完成！';
    } else {
      message = `📊 还有 ${pendingTasks} 个任务待完成，加油！`;
    }

    this.sendNotification('任务统计', message, {
      urgency: 'low'
    });
  }
}

module.exports = NotificationService;