/**
 * 重复规则处理类
 * 用于处理任务的重复规则计算和实例生成
 */
export class RecurrenceRule {
  constructor(rule) {
    this.type = rule.type || 'daily'
    this.interval = rule.interval || 1
    this.daysOfWeek = rule.daysOfWeek || []
    this.byMonthDay = rule.byMonthDay || null
    this.byWeekDay = rule.byWeekDay || null
    this.byMonth = rule.byMonth || null
    this.endDate = rule.endDate ? new Date(rule.endDate) : null
    this.count = rule.count || null
  }

  /**
   * 生成重复任务实例
   * @param {Date} startDate 开始日期
   * @param {number} maxCount 最大生成数量
   * @returns {Date[]} 重复实例日期数组
   */
  generateOccurrences(startDate, maxCount = 50) {
    const occurrences = []
    let currentDate = new Date(startDate)
    let count = 0

    while (count < maxCount) {
      if (this.endDate && currentDate > this.endDate) {
        break
      }

      if (this.count && count >= this.count) {
        break
      }

      occurrences.push(new Date(currentDate))
      count++

      currentDate = this.getNextOccurrence(currentDate)
      if (!currentDate) {
        break
      }
    }

    return occurrences
  }

  /**
   * 计算指定时间范围内的重复实例
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @param {number} maxCount 最大生成数量
   * @returns {Date[]} 重复实例日期数组
   */
  calculateOccurrences(startDate, endDate, maxCount = 50) {
    const occurrences = []
    let currentDate = new Date(startDate)
    let count = 0

    while (count < maxCount && currentDate <= endDate) {
      if (this.endDate && currentDate > this.endDate) {
        break
      }

      if (this.count && count >= this.count) {
        break
      }

      occurrences.push(new Date(currentDate))
      count++

      currentDate = this.getNextOccurrence(currentDate)
      if (!currentDate) {
        break
      }
    }

    return occurrences
  }

  /**
   * 获取下一个重复实例日期
   * @param {Date} currentDate 当前日期
   * @returns {Date|null} 下一个重复日期
   */
  getNextOccurrence(currentDate) {
    const nextDate = new Date(currentDate)

    switch (this.type) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + this.interval)
        break

      case 'weekly':
        return this.getNextWeeklyOccurrence(nextDate)

      case 'monthly':
        return this.getNextMonthlyOccurrence(nextDate)

      case 'yearly':
        return this.getNextYearlyOccurrence(nextDate)

      default:
        return null
    }

    return nextDate
  }

  /**
   * 获取下一个周重复实例
   * @param {Date} currentDate 当前日期
   * @returns {Date} 下一个周重复日期
   */
  getNextWeeklyOccurrence(currentDate) {
    if (!this.daysOfWeek || this.daysOfWeek.length === 0) {
      // 如果没有指定星期几，默认按当前星期几重复
      const nextDate = new Date(currentDate)
      nextDate.setDate(nextDate.getDate() + 7 * this.interval)
      return nextDate
    }

    const currentDay = currentDate.getDay()
    const sortedDays = [...this.daysOfWeek].sort((a, b) => a - b)
    
    // 查找当前星期内的下一个重复日
    const nextDayInWeek = sortedDays.find(day => day > currentDay)
    
    if (nextDayInWeek !== undefined) {
      // 在当前星期内找到下一个重复日
      const nextDate = new Date(currentDate)
      nextDate.setDate(nextDate.getDate() + (nextDayInWeek - currentDay))
      return nextDate
    } else {
      // 需要到下一个重复周期
      const nextDate = new Date(currentDate)
      const daysToAdd = (7 * this.interval) - currentDay + sortedDays[0]
      nextDate.setDate(nextDate.getDate() + daysToAdd)
      return nextDate
    }
  }

  /**
   * 获取下一个月重复实例
   * @param {Date} currentDate 当前日期
   * @returns {Date} 下一个月重复日期
   */
  getNextMonthlyOccurrence(currentDate) {
    const nextDate = new Date(currentDate)
    
    if (this.byMonthDay) {
      // 按月份中的某一天重复
      nextDate.setMonth(nextDate.getMonth() + this.interval)
      nextDate.setDate(this.byMonthDay)
      
      // 处理月末日期（如31号在2月不存在）
      if (nextDate.getDate() !== this.byMonthDay) {
        nextDate.setDate(0) // 设置为上个月的最后一天
      }
    } else if (this.byWeekDay) {
      // 按月份中的第几个星期几重复（如第二个星期一）
      nextDate.setMonth(nextDate.getMonth() + this.interval)
      nextDate.setDate(1)
      
      const { week, day } = this.byWeekDay
      const firstDayOfMonth = nextDate.getDay()
      const daysToAdd = (day - firstDayOfMonth + 7) % 7 + (week - 1) * 7
      nextDate.setDate(1 + daysToAdd)
    } else {
      // 默认按当前日期重复
      const originalDay = currentDate.getDate()
      nextDate.setMonth(nextDate.getMonth() + this.interval)
      nextDate.setDate(originalDay)
      
      // 处理月末日期
      if (nextDate.getDate() !== originalDay) {
        nextDate.setDate(0)
      }
    }
    
    return nextDate
  }

  /**
   * 获取下一个年重复实例
   * @param {Date} currentDate 当前日期
   * @returns {Date} 下一个年重复日期
   */
  getNextYearlyOccurrence(currentDate) {
    const nextDate = new Date(currentDate)
    
    // 如果有 byMonth 字段，需要在指定月份中循环
    if (this.byMonth && Array.isArray(this.byMonth) && this.byMonth.length > 0) {
      const currentMonth = currentDate.getMonth()
      const currentYear = currentDate.getFullYear()
      
      // 找到下一个有效月份
      let nextMonth = null
      let nextYear = currentYear
      
      // 在当前年份中查找下一个月份
      for (const month of this.byMonth.sort((a, b) => a - b)) {
        if (month > currentMonth) {
          nextMonth = month
          break
        }
      }
      
      // 如果当前年份没有找到，则使用下一个周期年份的第一个月份
      if (nextMonth === null) {
        nextYear = currentYear + this.interval
        nextMonth = this.byMonth.sort((a, b) => a - b)[0]
      }
      
      // 设置新的年月日
      nextDate.setFullYear(nextYear)
      nextDate.setMonth(nextMonth)
      
      // 处理日期溢出（如31号在没有31天的月份）
      const originalDay = currentDate.getDate()
      const lastDayOfMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
      const targetDay = Math.min(originalDay, lastDayOfMonth)
      nextDate.setDate(targetDay)
    } else {
      // 没有 byMonth 字段，使用原有逻辑
      nextDate.setFullYear(nextDate.getFullYear() + this.interval)
    }
    
    return nextDate
  }

  /**
   * 获取重复规则的描述文本
   * @returns {string} 描述文本
   */
  getDescription() {
    const intervalText = this.interval === 1 ? '' : `每${this.interval}`
    
    switch (this.type) {
      case 'daily':
        return `${intervalText}天重复`
        
      case 'weekly':
        if (this.daysOfWeek && this.daysOfWeek.length > 0) {
          const dayNames = ['日', '一', '二', '三', '四', '五', '六']
          const days = this.daysOfWeek.map(day => dayNames[day]).join('、')
          return `${intervalText}周的星期${days}重复`
        }
        return `${intervalText}周重复`
        
      case 'monthly':
        if (this.byMonthDay) {
          return `${intervalText}月的第${this.byMonthDay}天重复`
        } else if (this.byWeekDay) {
          const { week, day } = this.byWeekDay
          const dayNames = ['日', '一', '二', '三', '四', '五', '六']
          const weekNames = ['第一个', '第二个', '第三个', '第四个', '最后一个']
          return `${intervalText}月的${weekNames[week - 1]}星期${dayNames[day]}重复`
        }
        return `${intervalText}月重复`
        
      case 'yearly':
        return `${intervalText}年重复`
        
      default:
        return '未知重复规则'
    }
  }

  /**
   * 检查指定日期是否匹配重复规则
   * @param {Date} date 要检查的日期
   * @param {Date} startDate 重复开始日期
   * @returns {boolean} 是否匹配
   */
  matches(date, startDate) {
    if (date < startDate) {
      return false
    }

    if (this.endDate && date > this.endDate) {
      return false
    }

    const daysDiff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24))
    
    switch (this.type) {
      case 'daily':
        return daysDiff % this.interval === 0
        
      case 'weekly':
        if (this.daysOfWeek && this.daysOfWeek.length > 0) {
          const weeksDiff = Math.floor(daysDiff / 7)
          return weeksDiff % this.interval === 0 && this.daysOfWeek.includes(date.getDay())
        }
        return daysDiff % (7 * this.interval) === 0
        
      case 'monthly':
        // 简化的月份匹配逻辑
        const monthsDiff = (date.getFullYear() - startDate.getFullYear()) * 12 + 
                          (date.getMonth() - startDate.getMonth())
        return monthsDiff % this.interval === 0 && date.getDate() === startDate.getDate()
        
      case 'yearly':
        const yearsDiff = date.getFullYear() - startDate.getFullYear()
        return yearsDiff % this.interval === 0 && 
               date.getMonth() === startDate.getMonth() && 
               date.getDate() === startDate.getDate()
        
      default:
        return false
    }
  }
}

/**
 * 创建重复规则实例的工厂函数
 * @param {Object} rule 重复规则配置
 * @returns {RecurrenceRule} 重复规则实例
 */
export function createRecurrenceRule(rule) {
  return new RecurrenceRule(rule)
}

/**
 * 解析重复规则字符串
 * @param {string} ruleString 重复规则字符串
 * @returns {RecurrenceRule|null} 重复规则实例或null
 */
export function parseRecurrenceRule(ruleString) {
  try {
    const rule = JSON.parse(ruleString)
    return new RecurrenceRule(rule)
  } catch (error) {
    console.error('Failed to parse recurrence rule:', error)
    return null
  }
}