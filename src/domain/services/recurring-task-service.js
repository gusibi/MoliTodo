/**
 * 重复任务服务 (Recurring Task Service)
 * 负责重复任务的核心业务逻辑，包括重复规则计算、实例生成等
 */
const Task = require('../entities/task');

class RecurringTaskService {
  /**
   * 根据重复规则和日期范围展开重复任务实例
   * @param {Task} recurringTask 重复任务
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @returns {Task[]} 重复任务实例数组
   */
  static expandRecurringTask(recurringTask, startDate, endDate) {
    if (!recurringTask.isRecurring()) {
      return [];
    }

    const instances = [];
    const recurrence = recurringTask.recurrence;
    const baseDate = new Date(recurringTask.createdAt);
    
    // 根据重复类型生成实例
    switch (recurrence.type) {
      case 'daily':
        instances.push(...this.generateDailyInstances(recurringTask, baseDate, startDate, endDate, recurrence));
        break;
      case 'weekly':
        instances.push(...this.generateWeeklyInstances(recurringTask, baseDate, startDate, endDate, recurrence));
        break;
      case 'monthly':
        instances.push(...this.generateMonthlyInstances(recurringTask, baseDate, startDate, endDate, recurrence));
        break;
      case 'yearly':
        instances.push(...this.generateYearlyInstances(recurringTask, baseDate, startDate, endDate, recurrence));
        break;
      default:
        console.warn('未知的重复类型:', recurrence.type);
    }

    return instances;
  }

  /**
   * 生成每日重复实例
   */
  static generateDailyInstances(recurringTask, baseDate, startDate, endDate, recurrence) {
    const instances = [];
    const interval = recurrence.interval || 1;
    const current = new Date(Math.max(baseDate.getTime(), startDate.getTime()));
    
    console.log("generateDailyInstances recurringTask: ", recurringTask)
    // 调整到第一个有效日期
    const daysDiff = Math.floor((current.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000));
    const remainder = daysDiff % interval;
    if (remainder > 0) {
      current.setDate(current.getDate() + (interval - remainder));
    }

    while (current <= endDate) {
      if (current >= startDate) {
        const instanceId = `${recurringTask.id}_${current.toISOString().split('T')[0]}`;
        const instance = recurringTask.createInstance(new Date(current), instanceId);
        instances.push(instance);
      }
      current.setDate(current.getDate() + interval);
    }

    return instances;
  }

  /**
   * 生成每周重复实例
   */
  static generateWeeklyInstances(recurringTask, baseDate, startDate, endDate, recurrence) {
    const instances = [];
    const interval = recurrence.interval || 1;
    const daysOfWeek = recurrence.daysOfWeek || [baseDate.getDay()];
    
    // 从开始日期的周开始
    const current = new Date(startDate);
    current.setDate(current.getDate() - current.getDay()); // 调整到周日
    
    while (current <= endDate) {
      for (const dayOfWeek of daysOfWeek) {
        const instanceDate = new Date(current);
        instanceDate.setDate(current.getDate() + dayOfWeek);
        
        if (instanceDate >= startDate && instanceDate <= endDate && instanceDate >= baseDate) {
          const instanceId = `${recurringTask.id}_${instanceDate.toISOString().split('T')[0]}`;
          const instance = recurringTask.createInstance(instanceDate, instanceId);
          instances.push(instance);
        }
      }
      current.setDate(current.getDate() + (7 * interval));
    }

    return instances;
  }

  /**
   * 生成每月重复实例
   */
  static generateMonthlyInstances(recurringTask, baseDate, startDate, endDate, recurrence) {
    const instances = [];
    const interval = recurrence.interval || 1;
    
    // 支持 byMonthDay 数组或单个 dayOfMonth
    const daysOfMonth = recurrence.byMonthDay && recurrence.byMonthDay.length > 0 
      ? recurrence.byMonthDay 
      : [recurrence.dayOfMonth || baseDate.getDate()];
    
    const current = new Date(Math.max(baseDate.getTime(), startDate.getTime()));
    current.setDate(1); // 调整到月初
    
    while (current <= endDate) {
      // 为当前月份的每个指定日期生成实例
      for (const dayOfMonth of daysOfMonth) {
        const instanceDate = new Date(current.getFullYear(), current.getMonth(), dayOfMonth);
        
        // 处理月末日期（如31号在2月不存在）
        if (instanceDate.getMonth() !== current.getMonth()) {
          instanceDate.setDate(0); // 设置为上个月的最后一天
        }
        
        if (instanceDate >= startDate && instanceDate <= endDate && instanceDate >= baseDate) {
          const instanceId = `${recurringTask.id}_${instanceDate.toISOString().split('T')[0]}`;
          const instance = recurringTask.createInstance(instanceDate, instanceId);
          instances.push(instance);
        }
      }
      
      current.setMonth(current.getMonth() + interval);
    }

    return instances;
  }

  /**
   * 生成每年重复实例
   */
  static generateYearlyInstances(recurringTask, baseDate, startDate, endDate, recurrence) {
    const instances = [];
    const interval = recurrence.interval || 1;
    
    // 支持 byMonth 数组或单个 month
    // 注意：byMonth 存储 1-12 的月份，baseDate.getMonth() 返回 0-11
    const months = recurrence.byMonth && recurrence.byMonth.length > 0 
      ? recurrence.byMonth 
      : [recurrence.month !== undefined ? recurrence.month : baseDate.getMonth() + 1];
    
    // 支持 byMonthDay 数组或单个 dayOfMonth
    const daysOfMonth = recurrence.byMonthDay && recurrence.byMonthDay.length > 0 
      ? recurrence.byMonthDay 
      : [recurrence.dayOfMonth || baseDate.getDate()];
    
    const startYear = Math.max(baseDate.getFullYear(), startDate.getFullYear());
    
    for (let year = startYear; year <= endDate.getFullYear(); year += interval) {
      // 为每个指定月份和日期生成实例
      for (const month of months) {
        for (const dayOfMonth of daysOfMonth) {
          // byMonth 存储的是 1-12 的月份，但 Date 构造函数需要 0-11 的索引
          const instanceDate = new Date(year, month - 1, dayOfMonth);
          
          // 处理月末日期（如31号在2月不存在）
          if (instanceDate.getMonth() !== month - 1) {
            instanceDate.setDate(0); // 设置为上个月的最后一天
          }
          
          if (instanceDate >= startDate && instanceDate <= endDate && instanceDate >= baseDate) {
            const instanceId = `${recurringTask.id}_${instanceDate.toISOString().split('T')[0]}`;
            const instance = recurringTask.createInstance(new Date(instanceDate), instanceId);
            instances.push(instance);
          }
        }
      }
    }

    return instances;
  }

  /**
   * 批量展开多个重复任务
   * @param {Task[]} recurringTasks 重复任务数组
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @returns {Task[]} 所有重复任务实例
   */
  static expandRecurringTasks(recurringTasks, startDate, endDate) {
    const allInstances = [];
    
    for (const task of recurringTasks) {
      if (task.isRecurring()) {
        const instances = this.expandRecurringTask(task, startDate, endDate);
        allInstances.push(...instances);
      }
    }
    
    return allInstances;
  }

  /**
   * 获取重复任务的下几个实例（用于预览）
   * @param {Task} recurringTask 重复任务
   * @param {number} count 实例数量
   * @param {Date} fromDate 起始日期，如果不提供则使用当前时间
   * @returns {Date[]} 下几个实例的日期
   */
  static getNextOccurrences(recurringTask, count = 5, fromDate = null) {
    if (!recurringTask.isRecurring()) {
      return [];
    }

    let startDate = fromDate || new Date();
    
    // 如果提供了 fromDate，说明我们要从特定日期之后开始查找下一个实例
    // 将起始日期向前推进一天，确保获取的是真正的"下一个"实例
    if (fromDate) {
      startDate = new Date(fromDate);
      startDate.setDate(startDate.getDate() + 1);
    }
    
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 2); // 向前看2年
    
    console.log("getNextOccurrences: recurringTask: ", recurringTask)
    console.log("getNextOccurrences: fromDate: ", fromDate)
    console.log("getNextOccurrences: startDate: ", startDate)
    const instances = this.expandRecurringTask(recurringTask, startDate, endDate);
    return instances.slice(0, count).map(instance => new Date(instance.occurrenceDate));
  }

  /**
   * 验证重复规则的有效性
   * @param {Object} recurrence 重复规则
   * @returns {boolean} 是否有效
   */
  static validateRecurrence(recurrence) {
    if (!recurrence || typeof recurrence !== 'object') {
      return false;
    }

    const validTypes = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validTypes.includes(recurrence.type)) {
      return false;
    }

    // 验证间隔
    if (recurrence.interval && (typeof recurrence.interval !== 'number' || recurrence.interval < 1)) {
      return false;
    }

    // 根据类型验证特定字段
    switch (recurrence.type) {
      case 'weekly':
        if (recurrence.daysOfWeek && (!Array.isArray(recurrence.daysOfWeek) || 
            !recurrence.daysOfWeek.every(day => day >= 0 && day <= 6))) {
          return false;
        }
        break;
      case 'monthly':
        if (recurrence.dayOfMonth && (recurrence.dayOfMonth < 1 || recurrence.dayOfMonth > 31)) {
          return false;
        }
        break;
      case 'yearly':
        if (recurrence.month !== undefined && (recurrence.month < 0 || recurrence.month > 11)) {
          return false;
        }
        if (recurrence.dayOfMonth && (recurrence.dayOfMonth < 1 || recurrence.dayOfMonth > 31)) {
          return false;
        }
        break;
    }

    return true;
  }

  /**
   * 创建重复规则对象
   * @param {string} type 重复类型
   * @param {Object} options 选项
   * @returns {Object} 重复规则对象
   */
  static createRecurrence(type, options = {}) {
    const recurrence = {
      type,
      interval: options.interval || 1
    };

    switch (type) {
      case 'weekly':
        if (options.daysOfWeek) {
          recurrence.daysOfWeek = options.daysOfWeek;
        }
        break;
      case 'monthly':
        if (options.dayOfMonth) {
          recurrence.dayOfMonth = options.dayOfMonth;
        }
        break;
      case 'yearly':
        if (options.month !== undefined) {
          recurrence.month = options.month;
        }
        if (options.dayOfMonth) {
          recurrence.dayOfMonth = options.dayOfMonth;
        }
        break;
    }

    return recurrence;
  }
}

module.exports = RecurringTaskService;