import { formatDate, formatTime, formatDateTime, getMinDate, getMinTime, parseDateTimeString, combineDateTimeToISO } from './date-time-utils.js';

/**
 * 重置任务编辑状态
 * @returns {Object} 重置后的状态对象
 */
function resetTaskEditState() {
  return {
    selectedDate: '',
    selectedTime: '',
    selectedReminder: null,
    selectedList: null,
    recurrenceData: {},
    content: ''
  };
}

/**
 * 从任务对象填充编辑状态
 * @param {Object} task 任务对象
 * @param {Array} customReminderOptions 自定义提醒选项
 * @param {Array} lists 列表数组
 * @returns {Object} 填充后的状态对象
 */
function fillTaskEditState(task, customReminderOptions = [], lists = []) {
  const state = resetTaskEditState();

  if (!task) return state;

  // 填充基础信息
  state.content = task.content || '';

  // 填充列表信息
  if (task.listId && lists.length > 0) {
    state.selectedList = lists.find(list => list.id === task.listId) || null;
  }

  // 填充截止日期和时间
  if (task.dueDate) {
    const { date, time } = parseDateTimeString(task.dueDate);
    state.selectedDate = date;
    state.selectedTime = time;
  }

  // 填充提醒信息
  if (task.reminderTime) {
    const reminderDate = new Date(task.reminderTime);
    const matchingOption = findMatchingReminderOption(reminderDate, customReminderOptions);
    
    if (matchingOption) {
      state.selectedReminder = matchingOption;
    } else {
      // 创建自定义提醒选项
      const customOption = {
        id: 'custom_' + Date.now(),
        value: 'custom',
        label: formatDateTime(reminderDate),
        type: 'custom',
        reminderTime: task.reminderTime,
        config: task.reminderConfig || null
      };
      state.selectedReminder = customOption;
    }
  }

  // 填充重复任务信息
  if (task.recurrence) {
    state.recurrenceData = { ...task.recurrence };
  }

  return state;
}

/**
 * 查找匹配的提醒选项
 * @param {Date} reminderDate 提醒日期
 * @param {Array} customReminderOptions 自定义提醒选项
 * @returns {Object|null} 匹配的提醒选项
 */
function findMatchingReminderOption(reminderDate, customReminderOptions) {
  const now = new Date();
  const diffMs = reminderDate.getTime() - now.getTime();

  // 尝试匹配相对时间选项
  for (const option of customReminderOptions) {
    if (option.type === 'relative') {
      let expectedMs = 0;
      switch (option.unit) {
        case 'minutes':
          expectedMs = option.value * 60 * 1000;
          break;
        case 'hours':
          expectedMs = option.value * 60 * 60 * 1000;
          break;
        case 'days':
          expectedMs = option.value * 24 * 60 * 60 * 1000;
          break;
      }

      // 允许5分钟的误差
      if (Math.abs(diffMs - expectedMs) < 5 * 60 * 1000) {
        return option;
      }
    }
  }

  // 尝试匹配绝对时间选项
  const reminderTime = reminderDate.toTimeString().slice(0, 5);
  const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const actualDayOffset = Math.round((reminderDateOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));

  for (const option of customReminderOptions) {
    if (option.type === 'absolute' && option.time === reminderTime && option.dayOffset === actualDayOffset) {
      return option;
    }
  }

  return null;
}

/**
 * 计算提醒时间
 * @param {Object} reminderData 提醒数据
 * @param {Object} recurrenceData 重复数据
 * @param {string} selectedDate 选择的日期
 * @param {string} selectedTime 选择的时间
 * @returns {Object} { reminderTime, cleanReminderConfig }
 */
function calculateReminderTime(reminderData, recurrenceData, selectedDate, selectedTime) {
  let reminderTime = null;
  let reminderConfig = null;

  // 处理重复任务的提醒时间
  if (recurrenceData && recurrenceData.reminderTime) {
    try {
      const currentDate = selectedDate ? new Date(selectedDate) : new Date();
      const [hours, minutes] = recurrenceData.reminderTime.split(':');
      currentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      reminderTime = currentDate.toISOString();
    } catch (error) {
      console.error('计算重复任务提醒时间失败:', error);
    }
  }
  
  // 处理普通任务的提醒时间
  if (!reminderTime && reminderData) {
    if (reminderData.value === 'custom' && reminderData.reminderTime) {
      reminderTime = reminderData.reminderTime;
      reminderConfig = reminderData.config;
    } else if (selectedDate && selectedTime) {
      const customReminderStr = `${selectedDate}T${selectedTime}:00`;
      reminderTime = new Date(customReminderStr).toISOString();
    }
  } else if (!reminderTime && selectedDate && selectedTime) {
    const customReminderStr = `${selectedDate}T${selectedTime}:00`;
    reminderTime = new Date(customReminderStr).toISOString();
  }

  // 清理提醒配置，确保可序列化
  let cleanReminderConfig = null;
  if (reminderConfig) {
    cleanReminderConfig = {
      type: reminderConfig.type,
      value: reminderConfig.value,
      unit: reminderConfig.unit,
      time: reminderConfig.time,
      dayOffset: reminderConfig.dayOffset,
      label: reminderConfig.label,
      id: reminderConfig.id
    };
  }

  return { reminderTime, cleanReminderConfig };
}

/**
 * 准备任务数据用于添加或更新
 * @param {Object} taskData 原始任务数据
 * @param {Object} options 选项
 * @returns {Object} 处理后的任务数据
 */
function prepareTaskData(taskData, options = {}) {
  const {
    content,
    selectedDate,
    selectedTime,
    selectedReminder,
    selectedList,
    recurrenceData,
    isEditing = false,
    originalTask = null
  } = taskData;

  // 基础任务数据
  const preparedData = {
    content: content?.trim() || '',
    listId: selectedList?.id || 0
  };

  // 处理截止日期和时间
  if (selectedDate && selectedTime) {
    preparedData.dueDate = combineDateTimeToISO(selectedDate, selectedTime);
  } else if (selectedDate) {
    preparedData.dueDate = combineDateTimeToISO(selectedDate, '23:59');
  }

  // 处理提醒时间
  const { reminderTime, cleanReminderConfig } = calculateReminderTime(
    selectedReminder,
    recurrenceData,
    selectedDate,
    selectedTime
  );

  if (reminderTime) {
    preparedData.reminderTime = reminderTime;
  }

  if (cleanReminderConfig) {
    preparedData.reminderConfig = cleanReminderConfig;
  }

  // 处理重复任务数据
  if (recurrenceData && Object.keys(recurrenceData).length > 0) {
    preparedData.recurrence = cleanRecurrenceData(recurrenceData);
  }

  return preparedData;
}

/**
 * 准备任务更新数据
 * @param {Object} taskData 任务数据
 * @returns {Object} 更新数据
 */
function prepareTaskUpdates(taskData) {
  return prepareTaskData(taskData, { isEditing: true });
}

/**
 * 清理重复任务数据，确保可序列化
 * @param {Object} recurrenceData 重复任务数据
 * @returns {Object} 清理后的重复任务数据
 */
function cleanRecurrenceData(recurrenceData) {
  if (!recurrenceData || typeof recurrenceData !== 'object') {
    return {};
  }

  const cleanData = {};
  
  // 只保留需要的字段
  const allowedFields = [
    'type', 'interval', 'daysOfWeek', 'dayOfMonth', 'monthOfYear',
    'endDate', 'count', 'reminderTime', 'enabled'
  ];
  
  for (const field of allowedFields) {
    if (recurrenceData.hasOwnProperty(field) && recurrenceData[field] !== undefined) {
      cleanData[field] = recurrenceData[field];
    }
  }
  
  return cleanData;
}

/**
 * 验证提醒时间是否有效（不能是过去时间）
 * @param {Object} reminderData 提醒数据
 * @param {string} selectedDate 选择的日期
 * @param {string} selectedTime 选择的时间
 * @returns {boolean} 是否有效
 */
function isReminderTimeValid(reminderData, selectedDate, selectedTime) {
  if (!reminderData && !selectedDate) {
    return true;
  }

  const now = new Date();

  if (reminderData && reminderData.value === 'custom') {
    if (reminderData.reminderTime) {
      const customReminderTime = new Date(reminderData.reminderTime);
      return customReminderTime > now;
    } else if (selectedDate && selectedTime) {
      const customReminderStr = `${selectedDate}T${selectedTime}:00`;
      const customReminderTime = new Date(customReminderStr);
      return customReminderTime > now;
    }
  } else if (!reminderData && selectedDate && selectedTime) {
    const customReminderStr = `${selectedDate}T${selectedTime}:00`;
    const customReminderTime = new Date(customReminderStr);
    return customReminderTime > now;
  }

  return true;
}

export {
  resetTaskEditState,
  fillTaskEditState,
  findMatchingReminderOption,
  calculateReminderTime,
  prepareTaskData,
  prepareTaskUpdates,
  cleanRecurrenceData,
  isReminderTimeValid
};