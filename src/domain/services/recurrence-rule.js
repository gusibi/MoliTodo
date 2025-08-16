/**
 * 重复规则计算服务
 * 负责根据重复规则计算任务实例的出现日期
 */
class RecurrenceRule {
  /**
   * 根据重复规则计算指定时间范围内的所有实例日期
   * @param {Object} recurrence 重复规则对象
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @param {Date} baseDate 基准日期（任务创建日期）
   * @returns {Date[]} 实例日期数组
   */
  static calculateOccurrences(recurrence, startDate, endDate, baseDate) {
    if (!recurrence || !recurrence.type) {
      return [];
    }

    const occurrences = [];
    let currentDate = new Date(baseDate);
    
    // 确保开始日期不早于基准日期
    if (currentDate < startDate) {
      currentDate = this.getNextOccurrence(recurrence, startDate, baseDate);
    }

    let iterationCount = 0;
    const maxIterations = 1000; // 防止无限循环

    while (currentDate && currentDate <= endDate && iterationCount < maxIterations) {
      // 检查是否超过结束条件
      if (this.isAfterEndCondition(recurrence, currentDate, baseDate, occurrences.length)) {
        break;
      }

      if (currentDate >= startDate) {
        occurrences.push(new Date(currentDate));
      }

      currentDate = this.getNextOccurrence(recurrence, currentDate, baseDate);
      iterationCount++;
    }

    return occurrences;
  }

  /**
   * 获取下一个实例日期
   * @param {Object} recurrence 重复规则
   * @param {Date} currentDate 当前日期
   * @param {Date} baseDate 基准日期
   * @returns {Date|null} 下一个实例日期
   */
  static getNextOccurrence(recurrence, currentDate, baseDate) {
    const nextDate = new Date(currentDate);

    switch (recurrence.type) {
      case 'daily':
        return this.getNextDaily(nextDate, recurrence);
      case 'weekly':
        return this.getNextWeekly(nextDate, recurrence);
      case 'monthly':
        return this.getNextMonthly(nextDate, recurrence, baseDate);
      case 'yearly':
        return this.getNextYearly(nextDate, recurrence, baseDate);
      default:
        return null;
    }
  }

  /**
   * 计算每日重复的下一个日期
   */
  static getNextDaily(currentDate, recurrence) {
    const interval = recurrence.interval || 1;
    currentDate.setDate(currentDate.getDate() + interval);
    return currentDate;
  }

  /**
   * 计算每周重复的下一个日期
   */
  static getNextWeekly(currentDate, recurrence) {
    const interval = recurrence.interval || 1;
    const daysOfWeek = recurrence.daysOfWeek || [currentDate.getDay()];
    
    // 找到当前日期在一周中的位置
    const currentDay = currentDate.getDay();
    const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
    
    // 查找下一个工作日
    let nextDay = sortedDays.find(day => day > currentDay);
    
    if (nextDay !== undefined) {
      // 在同一周内找到下一个日期
      const daysToAdd = nextDay - currentDay;
      currentDate.setDate(currentDate.getDate() + daysToAdd);
    } else {
      // 需要到下一个周期
      const firstDay = sortedDays[0];
      const daysToNextWeek = 7 - currentDay + firstDay;
      const weeksToAdd = (interval - 1) * 7;
      currentDate.setDate(currentDate.getDate() + daysToNextWeek + weeksToAdd);
    }
    
    return currentDate;
  }

  /**
   * 计算每月重复的下一个日期
   */
  static getNextMonthly(currentDate, recurrence, baseDate) {
    const interval = recurrence.interval || 1;
    
    if (recurrence.byMonthDay) {
      // 按月份中的日期重复
      const targetDay = recurrence.byMonthDay;
      currentDate.setMonth(currentDate.getMonth() + interval);
      
      // 处理月末日期（如31号在2月不存在）
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      currentDate.setDate(Math.min(targetDay, lastDayOfMonth));
    } else if (recurrence.byWeekDay) {
      // 按月份中的第几个星期几重复（如每月第二个星期一）
      const { weekday, week } = recurrence.byWeekDay;
      currentDate.setMonth(currentDate.getMonth() + interval);
      currentDate = this.getNthWeekdayOfMonth(currentDate.getFullYear(), currentDate.getMonth(), weekday, week);
    } else {
      // 默认按基准日期的日期重复
      const targetDay = baseDate.getDate();
      currentDate.setMonth(currentDate.getMonth() + interval);
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      currentDate.setDate(Math.min(targetDay, lastDayOfMonth));
    }
    
    return currentDate;
  }

  /**
   * 计算每年重复的下一个日期
   */
  static getNextYearly(currentDate, recurrence, baseDate) {
    const interval = recurrence.interval || 1;
    
    // 如果有 byMonth 字段，需要在指定月份中循环
    if (recurrence.byMonth && Array.isArray(recurrence.byMonth) && recurrence.byMonth.length > 0) {
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      // 找到下一个有效月份
      let nextMonth = null;
      let nextYear = currentYear;
      
      // 在当前年份中查找下一个月份
      for (const month of recurrence.byMonth.sort((a, b) => a - b)) {
        if (month > currentMonth) {
          nextMonth = month;
          break;
        }
      }
      
      // 如果当前年份没有找到，则使用下一个周期年份的第一个月份
      if (nextMonth === null) {
        nextYear = currentYear + interval;
        nextMonth = recurrence.byMonth.sort((a, b) => a - b)[0];
      }
      
      // 设置新的年月日
      currentDate.setFullYear(nextYear);
      currentDate.setMonth(nextMonth);
      
      // 处理日期溢出（如31号在没有31天的月份）
      const originalDay = baseDate.getDate();
      const lastDayOfMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
      const targetDay = Math.min(originalDay, lastDayOfMonth);
      currentDate.setDate(targetDay);
    } else {
      // 没有 byMonth 字段，使用原有逻辑
      currentDate.setFullYear(currentDate.getFullYear() + interval);
      
      // 处理闰年2月29日的情况
      if (baseDate.getMonth() === 1 && baseDate.getDate() === 29) {
        const isLeapYear = this.isLeapYear(currentDate.getFullYear());
        if (!isLeapYear) {
          currentDate.setMonth(1, 28); // 设置为2月28日
        }
      }
    }
    
    return currentDate;
  }

  /**
   * 获取指定月份的第N个星期几
   */
  static getNthWeekdayOfMonth(year, month, weekday, week) {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    
    // 计算第一个指定星期几的日期
    let firstOccurrence = 1 + (weekday - firstWeekday + 7) % 7;
    
    // 计算第N个出现的日期
    const targetDate = firstOccurrence + (week - 1) * 7;
    
    // 检查日期是否在当月内
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    if (targetDate > lastDayOfMonth) {
      return null; // 该月没有第N个指定星期几
    }
    
    return new Date(year, month, targetDate);
  }

  /**
   * 检查是否为闰年
   */
  static isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * 检查是否超过结束条件
   */
  static isAfterEndCondition(recurrence, currentDate, baseDate, occurrenceCount) {
    if (!recurrence.endCondition) {
      return false;
    }

    switch (recurrence.endCondition.type) {
      case 'date':
        return currentDate > new Date(recurrence.endCondition.endDate);
      case 'count':
        return occurrenceCount >= recurrence.endCondition.count;
      default:
        return false;
    }
  }

  /**
   * 验证重复规则的有效性
   * @param {Object} recurrence 重复规则
   * @returns {boolean} 是否有效
   */
  static isValidRecurrence(recurrence) {
    if (!recurrence || typeof recurrence !== 'object') {
      return false;
    }

    const validTypes = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validTypes.includes(recurrence.type)) {
      return false;
    }

    // 检查间隔
    if (recurrence.interval && (typeof recurrence.interval !== 'number' || recurrence.interval < 1)) {
      return false;
    }

    // 检查周重复的星期几
    if (recurrence.type === 'weekly' && recurrence.daysOfWeek) {
      if (!Array.isArray(recurrence.daysOfWeek) || 
          !recurrence.daysOfWeek.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) {
        return false;
      }
    }

    // 检查结束条件
    if (recurrence.endCondition) {
      const { type, endDate, count } = recurrence.endCondition;
      if (type === 'date' && (!endDate || isNaN(new Date(endDate).getTime()))) {
        return false;
      }
      if (type === 'count' && (typeof count !== 'number' || count < 1)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 创建重复规则的人类可读描述
   * @param {Object} recurrence 重复规则
   * @returns {string} 描述文本
   */
  static getDescription(recurrence) {
    if (!recurrence || !this.isValidRecurrence(recurrence)) {
      return '无重复';
    }

    const interval = recurrence.interval || 1;
    let description = '';

    switch (recurrence.type) {
      case 'daily':
        description = interval === 1 ? '每天' : `每${interval}天`;
        break;
      case 'weekly':
        if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          const days = recurrence.daysOfWeek.map(day => dayNames[day]).join('、');
          description = interval === 1 ? `每周${days}` : `每${interval}周${days}`;
        } else {
          description = interval === 1 ? '每周' : `每${interval}周`;
        }
        break;
      case 'monthly':
        description = interval === 1 ? '每月' : `每${interval}个月`;
        break;
      case 'yearly':
        description = interval === 1 ? '每年' : `每${interval}年`;
        break;
    }

    // 添加结束条件描述
    if (recurrence.endCondition) {
      const { type, endDate, count } = recurrence.endCondition;
      if (type === 'date') {
        const date = new Date(endDate);
        description += `，直到${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
      } else if (type === 'count') {
        description += `，共${count}次`;
      }
    }

    return description;
  }
}

module.exports = RecurrenceRule;