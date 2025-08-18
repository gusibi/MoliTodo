/**
 * 日期时间格式化工具函数
 * 从TaskService中提取的纯函数，用于处理日期时间格式化
 */

/**
 * 格式化日期为本地日期字符串 (YYYY-MM-DD)
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  if (!date) return ''
  
  const dateObj = date instanceof Date ? date : new Date(date)
  if (isNaN(dateObj.getTime())) return ''
  
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * 格式化时间为本地时间字符串 (HH:MM)
 * @param {Date|string} time - 时间对象或时间字符串
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(time) {
  if (!time) return ''
  
  const timeObj = time instanceof Date ? time : new Date(time)
  if (isNaN(timeObj.getTime())) return ''
  
  const hours = String(timeObj.getHours()).padStart(2, '0')
  const minutes = String(timeObj.getMinutes()).padStart(2, '0')
  
  return `${hours}:${minutes}`
}

/**
 * 格式化日期时间为可读字符串
 * @param {Date|string} dateTime - 日期时间对象或字符串
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(dateTime) {
  if (!dateTime) return ''
  
  const dateObj = dateTime instanceof Date ? dateTime : new Date(dateTime)
  if (isNaN(dateObj.getTime())) return ''
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())
  
  const dayDiff = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24))
  
  let dateStr
  if (dayDiff === 0) {
    dateStr = '今天'
  } else if (dayDiff === 1) {
    dateStr = '明天'
  } else if (dayDiff === -1) {
    dateStr = '昨天'
  } else {
    dateStr = formatDate(dateObj)
  }
  
  const timeStr = formatTime(dateObj)
  return timeStr ? `${dateStr} ${timeStr}` : dateStr
}

/**
 * 获取最小日期（今天）
 * @returns {string} 今天的日期字符串 (YYYY-MM-DD)
 */
function getMinDate() {
  const today = new Date()
  return formatDate(today)
}

/**
 * 获取指定日期的最小时间
 * @param {string} selectedDate - 选中的日期字符串 (YYYY-MM-DD)
 * @returns {string} 最小时间字符串 (HH:MM)
 */
function getMinTime(selectedDate) {
  if (!selectedDate) return ''
  
  const today = new Date()
  const selected = new Date(selectedDate)
  
  // 如果选择的是今天，返回当前时间的下一个小时
  if (formatDate(today) === selectedDate) {
    const nextHour = new Date(today)
    nextHour.setHours(today.getHours() + 1, 0, 0, 0)
    return formatTime(nextHour)
  }
  
  // 如果选择的是未来日期，返回空字符串（无限制）
  return ''
}

/**
 * 解析日期时间字符串
 * @param {string} dateTimeStr - 日期时间字符串
 * @returns {Object} 包含date和time的对象
 */
function parseDateTimeString(dateTimeStr) {
  if (!dateTimeStr) {
    return { date: '', time: '' }
  }
  
  try {
    const dateObj = new Date(dateTimeStr)
    if (isNaN(dateObj.getTime())) {
      return { date: '', time: '' }
    }
    
    return {
      date: formatDate(dateObj),
      time: formatTime(dateObj)
    }
  } catch (error) {
    console.error('解析日期时间字符串失败:', error)
    return { date: '', time: '' }
  }
}

/**
 * 将日期和时间组合为ISO字符串
 * @param {string} date - 日期字符串 (YYYY-MM-DD)
 * @param {string} time - 时间字符串 (HH:MM)
 * @returns {string} ISO格式的日期时间字符串
 */
function combineDateTimeToISO(date, time) {
  if (!date || !time) return ''
  
  try {
    const dateTimeStr = `${date}T${time}:00`
    const dateObj = new Date(dateTimeStr)
    
    if (isNaN(dateObj.getTime())) {
      return ''
    }
    
    return dateObj.toISOString()
  } catch (error) {
    console.error('组合日期时间失败:', error)
    return ''
  }
}

// ES6 exports for renderer process
export {
  formatDate,
  formatTime,
  formatDateTime,
  getMinDate,
  getMinTime,
  parseDateTimeString,
  combineDateTimeToISO
}
