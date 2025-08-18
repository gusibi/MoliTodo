const RecurrenceRule = require('./recurrence-rule');
const Task = require('../entities/task');

/**
 * 任务展开服务
 * 负责将重复任务展开为具体的任务实例
 */
class TaskExpansion {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
  }

  /**
   * 展开重复任务为指定时间范围内的实例
   * @param {Task} recurringTask 重复任务
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @returns {Promise<Task[]>} 任务实例数组
   */
  async expandRecurringTask(recurringTask, startDate, endDate) {
    if (!recurringTask.isRecurring()) {
      return [];
    }

    // 计算所有应该出现的日期
    const occurrenceDates = RecurrenceRule.calculateOccurrences(
      recurringTask.recurrence,
      startDate,
      endDate,
      recurringTask.createdAt
    );

    // 获取已存在的覆盖实例
    const overrideInstances = await this.taskRepository.findOverrideInstances(recurringTask.id);
    const overrideMap = new Map();
    overrideInstances.forEach(instance => {
      overrideMap.set(instance.occurrenceDate, instance);
    });

    // 为每个日期创建或获取任务实例
    const instances = [];
    for (const date of occurrenceDates) {
      const dateStr = this.formatDate(date);
      
      if (overrideMap.has(dateStr)) {
        // 使用已存在的覆盖实例
        instances.push(overrideMap.get(dateStr));
      } else {
        // 创建虚拟实例
        const virtualInstance = this.createVirtualInstance(recurringTask, date);
        instances.push(virtualInstance);
      }
    }

    return instances;
  }

  /**
   * 展开多个重复任务
   * @param {Task[]} recurringTasks 重复任务数组
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @returns {Promise<Task[]>} 所有任务实例
   */
  async expandMultipleRecurringTasks(recurringTasks, startDate, endDate) {
    const allInstances = [];
    
    for (const task of recurringTasks) {
      const instances = await this.expandRecurringTask(task, startDate, endDate);
      allInstances.push(...instances);
    }

    // 按日期排序
    return allInstances.sort((a, b) => {
      const dateA = a.occurrenceDate ? new Date(a.occurrenceDate) : a.createdAt;
      const dateB = b.occurrenceDate ? new Date(b.occurrenceDate) : b.createdAt;
      return dateA - dateB;
    });
  }

  /**
   * 创建虚拟任务实例
   * @param {Task} recurringTask 重复任务
   * @param {Date} occurrenceDate 实例日期
   * @returns {Task} 虚拟任务实例
   */
  createVirtualInstance(recurringTask, occurrenceDate) {
    const dateStr = this.formatDate(occurrenceDate);
    
    // 创建虚拟ID（用于前端识别）
    const virtualId = `${recurringTask.id}_${dateStr}`;
    
    // 计算提醒时间（如果原任务有提醒）
    let reminderTime = null;
    if (recurringTask.recurrence && recurringTask.recurrence.reminderTime) {
      // 使用 occurrenceDate + recurrence.reminderTime
      const [hours, minutes] = recurringTask.recurrence.reminderTime.split(':').map(Number);
      const reminderDate = new Date(occurrenceDate);
      reminderDate.setHours(hours, minutes, 0, 0);
      reminderTime = reminderDate;
    } else if (recurringTask.reminderTime) {
      // 如果没有重复规则的提醒时间，但原任务有提醒时间，则使用时间差计算
      const originalReminder = new Date(recurringTask.reminderTime);
      const originalCreated = new Date(recurringTask.createdAt);
      const timeDiff = originalReminder.getTime() - originalCreated.getTime();
      reminderTime = new Date(occurrenceDate.getTime() + timeDiff);
    }

    // 创建虚拟实例
    const virtualInstance = new Task(
      virtualId,
      recurringTask.content,
      'todo', // 虚拟实例默认为待办状态
      occurrenceDate, // 使用实例日期作为创建时间
      reminderTime,
      {
        startedAt: null,
        completedAt: null,
        totalDuration: 0
      },
      recurringTask.listId,
      { ...recurringTask.metadata, isVirtual: true }, // 标记为虚拟实例
      null, // 虚拟实例没有重复规则
      recurringTask.id, // 系列ID指向原任务
      dateStr // 实例日期
    );

    virtualInstance.updatedAt = occurrenceDate;
    
    return virtualInstance;
  }

  /**
   * 将虚拟实例转换为真实实例（覆盖实例）
   * @param {Task} virtualInstance 虚拟实例
   * @returns {Promise<Task>} 真实任务实例
   */
  async materializeInstance(virtualInstance) {
    if (!virtualInstance.isRecurringInstance() || !virtualInstance.metadata?.isVirtual) {
      throw new Error('只能物化虚拟实例');
    }

    // 创建真实的任务实例
    const realInstance = new Task(
      null, // 让数据库生成新ID
      virtualInstance.content,
      virtualInstance.status,
      new Date(), // 使用当前时间作为创建时间
      virtualInstance.reminderTime,
      virtualInstance.timeTracking,
      virtualInstance.listId,
      { ...virtualInstance.metadata, isVirtual: false }, // 移除虚拟标记
      null, // 实例没有重复规则
      virtualInstance.seriesId,
      virtualInstance.occurrenceDate
    );

    // 保存到数据库
    const savedInstance = await this.taskRepository.save(realInstance);
    return savedInstance;
  }

  /**
   * 删除重复任务的特定实例
   * @param {string} seriesId 系列任务ID
   * @param {string} occurrenceDate 实例日期
   * @returns {Promise<void>}
   */
  async deleteInstance(seriesId, occurrenceDate) {
    // 查找是否存在覆盖实例
    const overrideInstance = await this.taskRepository.findOverrideInstance(seriesId, occurrenceDate);
    
    if (overrideInstance) {
      // 删除覆盖实例
      await this.taskRepository.delete(overrideInstance.id);
    } else {
      // 创建一个"已删除"的覆盖实例
      const deletedInstance = new Task(
        null,
        '', // 空内容
        'deleted', // 特殊状态表示已删除
        new Date(),
        null,
        { startedAt: null, completedAt: null, totalDuration: 0 },
        0, // 默认列表
        { isDeleted: true },
        null,
        seriesId,
        occurrenceDate
      );
      
      await this.taskRepository.save(deletedInstance);
    }
  }

  /**
   * 完成重复任务的特定实例
   * @param {Task} instance 任务实例
   * @returns {Promise<Task>} 更新后的实例
   */
  async completeInstance(instance) {
    if (instance.metadata?.isVirtual) {
      // 虚拟实例需要先物化
      const realInstance = await this.materializeInstance(instance);
      realInstance.completeTask();
      return await this.taskRepository.save(realInstance);
    } else {
      // 真实实例直接更新
      instance.completeTask();
      return await this.taskRepository.save(instance);
    }
  }

  /**
   * 修改重复任务的特定实例
   * @param {Task} instance 任务实例
   * @param {Object} updates 更新内容
   * @returns {Promise<Task>} 更新后的实例
   */
  async updateInstance(instance, updates) {
    if (instance.metadata?.isVirtual) {
      // 虚拟实例需要先物化
      const realInstance = await this.materializeInstance(instance);
      
      // 应用更新
      Object.keys(updates).forEach(key => {
        if (key === 'content') {
          realInstance.updateContent(updates[key]);
        } else if (key === 'reminderTime') {
          realInstance.setReminder(updates[key], true);
        } else if (key === 'listId') {
          realInstance.moveToList(updates[key]);
        }
        // 可以根据需要添加更多字段的更新逻辑
      });
      
      return await this.taskRepository.save(realInstance);
    } else {
      // 真实实例直接更新
      Object.keys(updates).forEach(key => {
        if (key === 'content') {
          instance.updateContent(updates[key]);
        } else if (key === 'reminderTime') {
          instance.setReminder(updates[key], true);
        } else if (key === 'listId') {
          instance.moveToList(updates[key]);
        }
      });
      
      return await this.taskRepository.save(instance);
    }
  }

  /**
   * 格式化日期为YYYY-MM-DD格式
   * @param {Date} date 日期
   * @returns {string} 格式化的日期字符串
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取重复任务的下几个实例预览
   * @param {Task} recurringTask 重复任务
   * @param {number} count 预览数量
   * @returns {Date[]} 下几个实例的日期
   */
  getNextOccurrences(recurringTask, count = 5) {
    if (!recurringTask.isRecurring()) {
      return [];
    }

    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setFullYear(futureDate.getFullYear() + 2); // 查看未来2年

    const occurrences = RecurrenceRule.calculateOccurrences(
      recurringTask.recurrence,
      now,
      futureDate,
      recurringTask.createdAt
    );

    return occurrences.slice(0, count);
  }
}

module.exports = TaskExpansion;