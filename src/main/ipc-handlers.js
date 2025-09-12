const { ipcMain, dialog, app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class IpcHandlers {
  constructor({ taskService, listService, notificationService, windowManager, taskStatusLogService }) {
    this.taskService = taskService;
    this.listService = listService;
    this.notificationService = notificationService;
    this.windowManager = windowManager;
    this.taskStatusLogService = taskStatusLogService;
  }

  // 基于任务数据生成活跃度数据的降级方法
  async generateActivityDataFromTasks(days = 365) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days + 1);
      
      // 获取所有任务
      const allTasks = await this.taskService.getAllTasks();
      
      // 初始化活跃度数据
      const activityData = {};
      
      // 遍历每一天
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        activityData[dateStr] = 0;
      }
      
      // 统计任务活动 - 简化为纯计数
      allTasks.forEach(task => {
        // 任务创建日期
        if (task.createdAt) {
          const createdDate = new Date(task.createdAt).toISOString().split('T')[0];
          if (activityData.hasOwnProperty(createdDate)) {
            activityData[createdDate] += 1;
          }
        }
        
        // 任务完成日期
        if (task.completedAt) {
          const completedDate = new Date(task.completedAt).toISOString().split('T')[0];
          if (activityData.hasOwnProperty(completedDate)) {
            activityData[completedDate] += 1;
          }
        }
      });
      
      // 转换为数组格式
      return Object.entries(activityData).map(([date, count]) => ({
        date,
        count
      }));
    } catch (error) {
      console.error('生成任务活跃度数据失败:', error);
      throw error;
    }
  }

  initialize() {
    this.setupTaskHandlers();
    this.setupListHandlers();
    this.setupConfigHandlers();
    this.setupWindowHandlers();
    this.setupDataHandlers();
    this.setupUtilityHandlers();
    this.setupAIHandlers();
    this.setupTaskStatusLogHandlers();
  }

  setupTaskHandlers() {
    // 获取任务列表
    ipcMain.handle('get-tasks', async () => {
      return await this.taskService.getIncompleteTasks();
    });

    ipcMain.handle('get-completed-tasks', async () => {
      return await this.taskService.getCompletedTasks();
    });

    ipcMain.handle('get-all-tasks', async () => {
      return await this.taskService.getAllTasks();
    });

    // 创建任务
    ipcMain.handle('create-task', async (event, taskData) => {
      const { content, reminderTime, listId, metadata, recurrence, dueDate, dueTime } = taskData;

      // 如果有提醒时间，转换为Date对象
      const calculatedReminderTime = reminderTime ? new Date(reminderTime) : null;

      // 构建完整的任务数据
      const fullTaskData = {
        content,
        reminderTime: calculatedReminderTime,
        listId: listId || 0,
        metadata: metadata || {},
        recurrence: recurrence || null,
        dueDate: dueDate || null,
        dueTime: dueTime || null
      };

      let task;
      if (recurrence || listId !== undefined || metadata !== undefined || dueDate || dueTime) {
        // 使用扩展的创建方法
        task = await this.taskService.createTaskInList(
          content,
          listId || 0,
          calculatedReminderTime,
          fullTaskData
        );
      } else {
        // 使用原有的创建方法（向后兼容）
        task = await this.taskService.createTask(
          content,
          calculatedReminderTime
        );
      }

      if (task.reminderTime) {
        this.notificationService.scheduleTaskReminder(task, (task) => {
          this.handleTaskReminder(task);
        });
      }

      this.broadcastTaskUpdates();
      return { success: true, task };
    });

    // 使用AI生成任务列表
    ipcMain.handle('generate-task-list', async (event, content, aiModel, listId) => {
      try {
        console.log('[IPC] 收到AI生成任务列表请求:', { content, aiModel, listId });
        const result = await this.taskService.generateTaskList(content, aiModel, listId);

        console.log('[IPC] AI生成任务列表结果:', result);
        if (result.success) {
          this.broadcastTaskUpdates();
        }

        return result;
      } catch (error) {
        console.error('[IPC] AI生成任务列表失败:', error);
        return {
          success: false,
          error: error.message,
          tasks: []
        };
      }
    });

    // 流式生成任务列表
    ipcMain.handle('stream-generate-task-list', async (event, content, aiModel, listId, shouldSplitTask = false) => {
      try {
        console.log('[IPC] 收到AI流式生成任务列表请求:', { content, aiModel, listId, shouldSplitTask });

        // 流式数据回调函数
        const onChunk = (text) => {
          // console.log('[IPC] 发送chunk到渲染进程:', text);
          // 发送流式数据到渲染进程
          event.sender.send('stream-task-generation-chunk', text);
        };

        console.log('[IPC] 调用taskService.streamGenerateTaskList');
        const result = await this.taskService.streamGenerateTaskList(content, aiModel, listId, onChunk, shouldSplitTask);

        console.log('[IPC] AI流式生成任务列表结果:', result);

        // 发送完成信号
        console.log('[IPC] 发送complete事件到渲染进程');
        event.sender.send('stream-task-generation-complete', result);

        return result;
      } catch (error) {
        console.error('[IPC] AI流式生成任务列表失败:', error);

        // 发送错误信号
        const errorResult = {
          success: false,
          error: error.message,
          tasks: []
        };
        console.log('[IPC] 发送error事件到渲染进程:', errorResult);
        event.sender.send('stream-task-generation-error', errorResult);

        return errorResult;
      }
    });

    // 更新任务
    ipcMain.handle('update-task', async (event, taskId, updates) => {
      const task = await this.taskService.updateTask(taskId, updates);

      // 处理提醒时间的通知调度
      if (updates.reminderTime !== undefined) {
        // 先取消现有的提醒
        this.notificationService.cancelTaskReminder(taskId);

        // 如果设置了新的提醒时间，则重新调度
        if (task.reminderTime) {
          this.notificationService.scheduleTaskReminder(task, (task) => {
            this.handleTaskReminder(task);
          });
        }
      }

      this.broadcastTaskUpdates();
      return { success: true, task };
    });

    // 完成任务
    ipcMain.handle('complete-task', async (event, taskId) => {
      const task = await this.taskService.completeTask(taskId);
      this.notificationService.cancelTaskReminder(taskId);
      this.broadcastTaskUpdates();
      return { success: true, task };
    });

    // 删除任务
    ipcMain.handle('delete-task', async (event, taskId) => {
      const success = await this.taskService.deleteTask(taskId);
      this.notificationService.cancelTaskReminder(taskId);
      this.broadcastTaskUpdates();
      return { success };
    });

    // 时间追踪相关
    ipcMain.handle('start-task', async (event, taskId) => {
      try {
        const task = await this.taskService.startTask(taskId);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('开始任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('pause-task', async (event, taskId) => {
      try {
        const task = await this.taskService.pauseTask(taskId);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('暂停任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('complete-task-with-tracking', async (event, taskId) => {
      try {
        const task = await this.taskService.completeTaskWithTracking(taskId);
        this.notificationService.cancelTaskReminder(taskId);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('完成任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取任务统计
    ipcMain.handle('get-task-stats', async (event, { listId } = {}) => {
      return await this.taskService.getTimeStats(listId);
    });

    // 移动任务到清单
    ipcMain.handle('task:moveToList', async (event, { taskId, targetListId }) => {
      try {
        const task = await this.taskService.moveTaskToList(taskId, targetListId);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('移动任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 批量移动任务到清单
    ipcMain.handle('task:batchMoveToList', async (event, { taskIds, targetListId }) => {
      try {
        const tasks = await this.taskService.batchMoveTasksToList(taskIds, targetListId);
        this.broadcastTaskUpdates();
        return { success: true, tasks };
      } catch (error) {
        console.error('批量移动任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 更新任务元数据
    ipcMain.handle('task:updateMetadata', async (event, { taskId, metadata }) => {
      try {
        const task = await this.taskService.updateTaskMetadata(taskId, metadata);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('更新任务元数据失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 设置任务备注
    ipcMain.handle('task:setComment', async (event, { taskId, comment }) => {
      try {
        const task = await this.taskService.setTaskComment(taskId, comment);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('设置任务备注失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 按分类获取任务
    ipcMain.handle('task:getByCategory', async (event, { category, listId }) => {
      try {
        const tasks = await this.taskService.getTasksByCategory(category, listId);
        return { success: true, tasks };
      } catch (error) {
        console.error('按分类获取任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 搜索任务
    ipcMain.handle('task:search', async (event, { query, listId }) => {
      try {
        const tasks = await this.taskService.searchTasks(query, listId);
        return { success: true, tasks };
      } catch (error) {
        console.error('搜索任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取任务时间信息
    ipcMain.handle('task:getTimeInfo', async (event, { taskId }) => {
      try {
        const timeInfo = await this.taskService.getTaskTimeInfo(taskId);
        return { success: true, timeInfo };
      } catch (error) {
        console.error('获取任务时间信息失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取任务表最新更新时间
    ipcMain.handle('task:getLastUpdatedTime', async (event) => {
      try {
        const lastUpdatedTime = await this.taskService.getLastUpdatedTime();
        return { success: true, lastUpdatedTime };
      } catch (error) {
        console.error('获取任务最新更新时间失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 设置任务提醒
    ipcMain.handle('set-task-reminder', async (event, taskId, reminderTime) => {
      const task = await this.taskService.setTaskReminder(taskId, new Date(reminderTime));
      this.notificationService.scheduleTaskReminder(task, (task) => {
        this.handleTaskReminder(task);
      });
      this.broadcastTaskUpdates();
      return { success: true, task };
    });

    // 清除任务提醒
    ipcMain.handle('clear-task-reminder', async (event, taskId) => {
      const task = await this.taskService.clearTaskReminder(taskId);
      this.notificationService.cancelTaskReminder(taskId);
      this.broadcastTaskUpdates();
      return { success: true, task };
    });

    // 创建重复任务
    ipcMain.handle('task:createRecurring', async (event, taskData) => {
      const { content, reminderTime, listId, metadata, recurrence, dueDate, dueTime } = taskData;

      // 计算提醒时间
      let calculatedReminderTime = null;
      if (reminderTime) {
        calculatedReminderTime = new Date(reminderTime);
      } else if (dueDate && dueTime) {
        // 如果没有设置提醒时间，但有截止日期和时间，则设置为截止时间前30分钟
        const dueDateTime = new Date(`${dueDate}T${dueTime}`);
        if (!isNaN(dueDateTime.getTime())) {
          calculatedReminderTime = new Date(dueDateTime.getTime() - 30 * 60 * 1000); // 提前30分钟
        }
      }

      // 构建完整的任务数据
      const fullTaskData = {
        content,
        reminderTime: calculatedReminderTime,
        listId: listId || 0,
        metadata: metadata || {},
        recurrence: recurrence || null,
        dueDate: dueDate || null,
        dueTime: dueTime || null
      };

      try {
        const task = await this.taskService.createTaskInList(
          content,
          listId || 0,
          calculatedReminderTime,
          fullTaskData
        );

        if (task.reminderTime) {
          this.notificationService.scheduleTaskReminder(task, (task) => {
            this.handleTaskReminder(task);
          });
        }

        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('创建重复任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取所有重复任务
    ipcMain.handle('task:getRecurring', async (event) => {
      try {
        const tasks = await this.taskService.getRecurringTasks();
        return { success: true, tasks };
      } catch (error) {
        console.error('获取重复任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 展开重复任务为实例
    ipcMain.handle('task:expandRecurring', async (event, { startDate, endDate, listId = null }) => {
      try {
        const tasks = await this.taskService.expandRecurringTasks(new Date(startDate), new Date(endDate), listId);
        return { success: true, tasks };
      } catch (error) {
        console.error('展开重复任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 更新重复任务
    ipcMain.handle('task:updateRecurring', async (event, { taskId, updates, recurrence }) => {
      try {
        const task = await this.taskService.updateRecurringTask(taskId, updates, recurrence);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('更新重复任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 完成重复任务实例
    ipcMain.handle('task:completeRecurringInstance', async (event, { seriesId, occurrenceDate }) => {
      try {
        const task = await this.taskService.completeRecurringInstance(seriesId, occurrenceDate);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('完成重复任务实例失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 删除重复任务实例
    ipcMain.handle('task:deleteRecurringInstance', async (event, { seriesId, occurrenceDate }) => {
      try {
        const success = await this.taskService.deleteRecurringInstance(seriesId, occurrenceDate);
        this.broadcastTaskUpdates();
        return { success };
      } catch (error) {
        console.error('删除重复任务实例失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 更新重复任务实例
    ipcMain.handle('task:updateRecurringInstance', async (event, { seriesId, occurrenceDate, updates }) => {
      try {
        const task = await this.taskService.updateRecurringInstance(seriesId, occurrenceDate, updates);
        this.broadcastTaskUpdates();
        return { success: true, task };
      } catch (error) {
        console.error('更新重复任务实例失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 删除整个重复任务系列
    ipcMain.handle('task:deleteRecurringSeries', async (event, { seriesId }) => {
      try {
        const success = await this.taskService.deleteRecurringSeries(seriesId);
        this.broadcastTaskUpdates();
        return { success };
      } catch (error) {
        console.error('删除重复任务系列失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取重复任务的下次实例预览
    ipcMain.handle('task:getNextOccurrences', async (event, { taskId, count }) => {
      try {
        const occurrences = await this.taskService.getNextOccurrences(taskId, count);
        return { success: true, occurrences };
      } catch (error) {
        console.error('获取下次实例失败:', error);
        return { success: false, error: error.message };
      }
    });
  }

  setupListHandlers() {
    // 获取所有清单
    ipcMain.handle('list:getAll', async () => {
      try {
        const lists = await this.listService.getAllLists();
        return { success: true, lists };
      } catch (error) {
        console.error('获取清单列表失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 根据ID获取清单
    ipcMain.handle('list:getById', async (event, listId) => {
      try {
        const list = await this.listService.getListById(listId);
        return { success: true, list };
      } catch (error) {
        console.error('获取清单失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 创建清单
    ipcMain.handle('list:create', async (event, { name, color, icon }) => {
      try {
        const list = await this.listService.createList(name, color, icon);
        this.broadcastListUpdates();
        return { success: true, list };
      } catch (error) {
        console.error('创建清单失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 更新清单
    ipcMain.handle('list:update', async (event, { listId, updates }) => {
      try {
        const list = await this.listService.updateList(listId, updates);
        this.broadcastListUpdates();
        return { success: true, list };
      } catch (error) {
        console.error('更新清单失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 删除清单
    ipcMain.handle('list:delete', async (event, { listId, taskHandling }) => {
      try {
        const success = await this.listService.deleteList(listId, taskHandling);
        this.broadcastListUpdates();
        this.broadcastTaskUpdates(); // 任务可能被移动或删除
        return { success };
      } catch (error) {
        console.error('删除清单失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取清单的任务
    ipcMain.handle('list:getTasks', async (event, { listId }) => {
      try {
        const tasks = await this.taskService.getTasksByListId(listId);
        return { success: true, tasks };
      } catch (error) {
        console.error('获取清单任务失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取清单任务统计
    ipcMain.handle('list:getTaskStats', async (event, { listId }) => {
      try {
        const stats = await this.listService.getListStatistics(listId);
        return { success: true, stats };
      } catch (error) {
        console.error('获取清单统计失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取所有清单的任务统计
    ipcMain.handle('list:getAllTaskCounts', async () => {
      try {
        const counts = await this.listService.getAllListTaskCounts();
        return { success: true, counts };
      } catch (error) {
        console.error('获取清单任务统计失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 重新排序清单
    ipcMain.handle('list:reorder', async (event, { sortOrders }) => {
      try {
        await this.listService.reorderLists(sortOrders);
        this.broadcastListUpdates();
        return { success: true };
      } catch (error) {
        console.error('重新排序清单失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 搜索清单
    ipcMain.handle('list:search', async (event, { query }) => {
      try {
        const lists = await this.listService.searchLists(query);
        return { success: true, lists };
      } catch (error) {
        console.error('搜索清单失败:', error);
        return { success: false, error: error.message };
      }
    });
  }

  setupConfigHandlers() {
    ipcMain.handle('get-config', () => {
      return this.windowManager.getConfig();
    });

    ipcMain.handle('update-config', (event, key, value) => {
      return this.windowManager.updateConfig(key, value);
    });

    ipcMain.handle('save-config', () => {
      // 配置已经通过 update-config 实时保存，这里只需要返回成功状态
      return { success: true };
    });

    ipcMain.handle('reset-config', () => {
      // 重置为默认配置
      const defaultConfig = {
        floatingIcon: {
          x: 100,
          y: 100,
          size: 60,
          opacity: 100,
          visible: true
        },
        autoStart: false,
        showNotifications: true,
        notificationSound: {
          enabled: true,
          soundFile: 'ding-126626.mp3',
          volume: 50
        },
        theme: 'system',
        customReminders: [
          { id: 1, label: '30分钟后', type: 'relative', value: 30, unit: 'minutes' },
          { id: 2, label: '1小时后', type: 'relative', value: 1, unit: 'hours' },
          { id: 3, label: '2小时后', type: 'relative', value: 2, unit: 'hours' },
          { id: 4, label: '1天后', type: 'relative', value: 1, unit: 'days' },
          { id: 5, label: '下周', type: 'relative', value: 7, unit: 'days' },
          { id: 6, label: '今天下午4点', type: 'absolute', time: '16:00', dayOffset: 0 },
          { id: 7, label: '明天9点', type: 'absolute', time: '09:00', dayOffset: 1 },
          { id: 8, label: '3天后上午10点', type: 'absolute', time: '10:00', dayOffset: 3 }
        ],
        ai: {
          enabled: true,
          selectedProvider: '',
          providers: {
            openai: {
              apiKey: '',
              baseURL: 'https://api.openai.com/v1',
              model: 'gpt-4o'
            },
            google: {
              apiKey: '',
              model: 'gemini-1.5-pro'
            },
            anthropic: {
              apiKey: '',
              model: 'claude-3-5-sonnet-20241022'
            },
            xai: {
              apiKey: '',
              baseURL: 'https://api.x.ai/v1',
              model: 'grok-beta'
            }
          },
          customProviders: [],
          features: {
            taskSuggestions: true,
            autoCategories: false,
            smartReminders: false
          }
        }
      };

      Object.entries(defaultConfig).forEach(([key, value]) => {
        this.windowManager.updateConfig(key, value);
      });

      return { success: true };
    });

    // AI 连接测试
    ipcMain.handle('test-ai-connection', async (event, config) => {
      const { AIService } = require('../infrastructure/ai/ai-service');
      console.log("测试连接配置:", config);
      return await AIService.testConnection(config);
    });

    // AI 连接测试 - 使用模型信息
    ipcMain.handle('test-ai-connection-by-model', async (event, aiModel) => {
      const { AIService } = require('../infrastructure/ai/ai-service');
      try {
        const modelConfig = AIService.getModelConfig(aiModel, this.windowManager);
        return await AIService.testConnection(modelConfig);
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  setupWindowHandlers() {
    ipcMain.handle('show-task-manager', () => {
      this.windowManager.createTaskManagerWindow();
    });

    ipcMain.handle('show-settings', () => {
      this.windowManager.createSettingsWindow();
    });

    ipcMain.handle('toggle-task-panel', () => {
      this.windowManager.toggleTaskPanel();
    });

    ipcMain.handle('show-task-panel', () => {
      this.windowManager.createTaskPanel();
    });

    ipcMain.handle('hide-task-panel', () => {
      if (this.windowManager.taskPanelWindow) {
        this.windowManager.taskPanelWindow.close();
      }
    });

    // 面板鼠标进入事件
    ipcMain.handle('panel-mouse-enter', () => {
      // 通知悬浮图标面板正在被使用
      if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
        this.windowManager.floatingWindow.webContents.send('panel-mouse-enter');
      }
    });

    // 面板鼠标离开事件
    ipcMain.handle('panel-mouse-leave', () => {
      // 通知悬浮图标鼠标离开了面板
      if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
        this.windowManager.floatingWindow.webContents.send('panel-mouse-leave');
      }
    });

    // 悬浮任务相关
    ipcMain.handle('create-floating-task', (event, taskId) => {
      this.windowManager.createFloatingTask(taskId);
    });

    ipcMain.handle('close-floating-task', (event, taskId) => {
      this.windowManager.closeFloatingTask(taskId);
    });

    ipcMain.handle('resize-floating-task-window', (event, taskId, height) => {
      this.windowManager.resizeFloatingTaskWindow(taskId, height);
    });

    // 窗口控制相关
    ipcMain.handle('window-minimize', (event, windowType) => {
      this.windowManager.minimizeWindow(windowType);
    });

    ipcMain.handle('window-maximize', (event, windowType) => {
      this.windowManager.maximizeWindow(windowType);
    });

    ipcMain.handle('window-close', (event, windowType) => {
      this.windowManager.closeWindow(windowType);
    });

    ipcMain.handle('window-is-maximized', (event, windowType) => {
      return this.windowManager.isWindowMaximized(windowType);
    });
  }

  setupDataHandlers() {
    // 导出数据
    ipcMain.handle('export-data', async () => {
      try {
        const result = await dialog.showSaveDialog({
          title: '导出数据',
          defaultPath: `MoliTodo-backup-${new Date().toISOString().split('T')[0]}.json`,
          filters: [
            { name: 'JSON Files', extensions: ['json'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          const allTasks = await this.taskService.getAllTasks();
          const allLists = this.listService ? await this.listService.getAllLists() : [];
          const exportData = {
            version: '2.0.0', // 升级版本以支持清单
            exportDate: new Date().toISOString(),
            tasks: allTasks.map(task => task.toJSON()),
            lists: allLists.map(list => list.toJSON()),
            config: this.windowManager.getConfig()
          };

          await fs.writeFile(result.filePath, JSON.stringify(exportData, null, 2), 'utf8');
          return { success: true, path: result.filePath };
        }

        return { success: false, canceled: true };
      } catch (error) {
        console.error('导出数据失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 导入数据
    ipcMain.handle('import-data', async () => {
      try {
        const result = await dialog.showOpenDialog({
          title: '导入数据',
          filters: [
            { name: 'JSON Files', extensions: ['json'] }
          ],
          properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          const fileContent = await fs.readFile(filePath, 'utf8');
          const importData = JSON.parse(fileContent);

          if (!importData.tasks || !Array.isArray(importData.tasks)) {
            throw new Error('无效的数据格式');
          }

          // 清除现有数据
          await this.taskService.clearAllTasks();
          this.notificationService.clearAllSchedules();

          // 导入清单（如果存在）
          let importedLists = 0;
          if (this.listService && importData.lists && Array.isArray(importData.lists)) {
            try {
              const result = await this.listService.importListData(importData, {
                overwriteExisting: true,
                handleNameConflicts: 'rename'
              });
              importedLists = result.importedLists;
            } catch (error) {
              console.warn('导入清单失败:', error);
            }
          }

          // 导入任务
          for (const taskData of importData.tasks) {
            await this.taskService.importTask(taskData);
          }

          // 导入配置
          if (importData.config) {
            Object.entries(importData.config).forEach(([key, value]) => {
              this.windowManager.updateConfig(key, value);
            });
          }

          this.broadcastTaskUpdates();
          if (this.listService) {
            this.broadcastListUpdates();
          }

          return {
            success: true,
            taskCount: importData.tasks.length,
            listCount: importedLists
          };
        }

        return { success: false, canceled: true };
      } catch (error) {
        console.error('导入数据失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 清除所有数据
    ipcMain.handle('clear-all-data', async () => {
      try {
        await this.taskService.clearAllTasks();
        this.notificationService.clearAllSchedules();
        this.broadcastTaskUpdates();
        return { success: true };
      } catch (error) {
        console.error('清除数据失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取数据库统计
    ipcMain.handle('get-database-stats', async () => {
      try {
        if (this.taskService.taskRepository && typeof this.taskService.taskRepository.getStats === 'function') {
          return await this.taskService.taskRepository.getStats();
        }
        return { taskCount: 0, fileSize: 0 };
      } catch (error) {
        console.error('获取数据库统计失败:', error);
        return { taskCount: 0, fileSize: 0 };
      }
    });
  }

  setupUtilityHandlers() {
    // 日志处理
    ipcMain.handle('log-message', (event, message, ...args) => {
      console.log(message, ...args);
    });

    // 获取资源路径
    ipcMain.handle('get-resource-path', (event, resourcePath) => {
      const path = require('path');
      let fullPath;

      if (process.env.NODE_ENV === 'development') {
        // 开发环境：相对于项目根目录
        fullPath = path.join(__dirname, '../../', resourcePath);
      } else {
        // 生产环境：使用 process.resourcesPath
        fullPath = path.join(process.resourcesPath, resourcePath);
      }

      return fullPath;
    });

    // 获取任务数量
    ipcMain.handle('get-task-count', async () => {
      return await this.taskService.getIncompleteTaskCount();
    });

    // 悬浮窗口拖拽相关
    ipcMain.handle('get-window-position', () => {
      if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
        const [x, y] = this.windowManager.floatingWindow.getPosition();
        return { x, y };
      }
      return { x: 0, y: 0 };
    });

    ipcMain.handle('start-drag', (event, position) => {
      if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
        this.windowManager.floatingWindow.setPosition(position.x, position.y);
      }
    });

    ipcMain.handle('drag-window', (event, position) => {
      if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
        this.windowManager.floatingWindow.setPosition(position.x, position.y);
      }
    });

    ipcMain.handle('end-drag', () => {
      if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
        const [x, y] = this.windowManager.floatingWindow.getPosition();
        this.windowManager.updateConfig('floatingIcon.x', x);
        this.windowManager.updateConfig('floatingIcon.y', y);
      }
    });

    // 应用图标更新
    ipcMain.handle('update-app-icon', async (event, iconPath) => {
      try {
        // 解析图标路径
        let fullIconPath;

        if (path.isAbsolute(iconPath)) {
          fullIconPath = iconPath;
        } else {
          // 相对路径处理
          if (process.env.NODE_ENV === 'development') {
            // 开发环境：相对于项目根目录
            fullIconPath = path.join(__dirname, '../../', iconPath);
          } else {
            // 生产环境：使用 process.resourcesPath
            fullIconPath = path.join(process.resourcesPath, iconPath);
          }
        }

        // 检查文件是否存在
        try {
          await fs.access(fullIconPath);
        } catch (error) {
          throw new Error(`图标文件不存在: ${fullIconPath}`);
        }

        // 更新运行时图标
        if (process.platform === 'darwin') {
          app.dock.setIcon(fullIconPath);
        } else {
          app.setIcon(fullIconPath);
        }

        // 更新所有窗口的图标
        const { nativeImage } = require('electron');
        const windowIcon = nativeImage.createFromPath(fullIconPath);

        const windows = [
          this.windowManager.floatingWindow,
          this.windowManager.taskManagerWindow,
          this.windowManager.settingsWindow,
          this.windowManager.taskPanelWindow
        ];

        windows.forEach(window => {
          if (window && !window.isDestroyed()) {
            window.setIcon(windowIcon);
          }
        });

        if (this.windowManager.floatingTaskWindows) {
          this.windowManager.floatingTaskWindows.forEach(window => {
            if (window && !window.isDestroyed()) {
              window.setIcon(windowIcon);
            }
          });
        }

        // macOS 特殊处理：尝试更新应用包图标和清除缓存
        if (process.platform === 'darwin') {
          try {
            await this.refreshMacIconCache();
          } catch (error) {
            console.warn('刷新 macOS 图标缓存失败:', error.message);
          }
        }

        console.log(`应用图标已更新: ${fullIconPath}`);
        return { success: true, iconPath: fullIconPath };
      } catch (error) {
        console.error('更新应用图标失败:', error);
        return { success: false, error: error.message };
      }
    });
  }

  // 刷新 macOS 图标缓存
  async refreshMacIconCache() {
    if (process.platform !== 'darwin') {
      return;
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // 清除图标缓存
      await execAsync('sudo find /private/var/folders/ -name com.apple.dock.iconcache -delete 2>/dev/null || true');
      await execAsync('sudo find /private/var/folders/ -name com.apple.iconservices -delete 2>/dev/null || true');

      // 重启相关服务
      await execAsync('killall Dock 2>/dev/null || true');
      await execAsync('killall Finder 2>/dev/null || true');

      console.log('macOS 图标缓存已刷新');
    } catch (error) {
      // 如果没有 sudo 权限，尝试用户级别的缓存清理
      try {
        await execAsync('rm -rf ~/Library/Caches/com.apple.iconservices.store 2>/dev/null || true');
        await execAsync('killall Dock 2>/dev/null || true');
        console.log('用户级别的 macOS 图标缓存已刷新');
      } catch (userError) {
        throw new Error(`刷新图标缓存失败: ${error.message}`);
      }
    }
  }

  // 广播任务更新到所有窗口
  broadcastTaskUpdates() {
    const windows = [
      this.windowManager.floatingWindow,
      this.windowManager.taskManagerWindow,
      this.windowManager.settingsWindow
    ];

    // 向主要窗口广播
    windows.forEach(window => {
      if (window && !window.isDestroyed()) {
        console.log(`主进程: 已向 ${window.id} 窗口广播任务更新`);
        window.webContents.send('tasks-updated');
      }
    });

    // 向所有悬浮任务窗口广播
    this.windowManager.floatingTaskWindows.forEach((window, taskId) => {
      if (window && !window.isDestroyed()) {
        console.log(`主进程: 已向悬浮任务窗口 ${taskId} 广播任务更新`);
        window.webContents.send('tasks-updated');
      }
    });

    // 更新托盘菜单中的任务数量
    if (this.windowManager && this.windowManager.updateTrayMenu) {
      this.windowManager.updateTrayMenu().catch(console.error);
    }
  }

  // 广播清单更新到所有窗口
  broadcastListUpdates() {
    const windows = [
      this.windowManager.floatingWindow,
      this.windowManager.taskManagerWindow,
      this.windowManager.settingsWindow
    ];

    // 向主要窗口广播
    windows.forEach(window => {
      if (window && !window.isDestroyed()) {
        console.log(`主进程: 已向 ${window.id} 窗口广播清单更新`);
        window.webContents.send('lists-updated');
      }
    });

    // 向所有悬浮任务窗口广播
    this.windowManager.floatingTaskWindows.forEach((window, taskId) => {
      if (window && !window.isDestroyed()) {
        console.log(`主进程: 已向悬浮任务窗口 ${taskId} 广播清单更新`);
        window.webContents.send('lists-updated');
      }
    });
  }

  // 处理任务提醒
  handleTaskReminder(task) {
    console.log('IPC处理任务提醒:', task);

    // 发送通知音效播放请求到所有窗口
    const windows = [
      this.windowManager.floatingWindow,
      this.windowManager.taskManagerWindow,
      this.windowManager.settingsWindow
    ];

    windows.forEach(window => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('play-notification-sound');
      }
    });

    // 强提醒：自动创建悬浮任务窗口
    if (task && task.id) {
      console.log('任务提醒触发，自动创建悬浮任务窗口，任务ID:', task.id);
      this.windowManager.createFloatingTask(task.id);
    }

    if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
      console.log('发送任务提醒事件到悬浮窗口');
      this.windowManager.floatingWindow.webContents.send('task-reminder', task);
    } else {
      console.log('悬浮窗口不存在或已销毁，无法发送提醒事件');
    }
  }

  setupAIHandlers() {
    console.log('[IPC] 正在设置 AI 处理器...');

    // AI 报告生成
    console.log('[IPC] 注册 ai:generate-report 处理器');
    ipcMain.handle('ai:generate-report', async (event, { prompt, aiModel }) => {
      try {
        console.log('[IPC] 收到AI报告生成请求');

        const { AIService } = require('../infrastructure/ai/ai-service');
        const result = await AIService.generateReport(prompt, aiModel, this.windowManager);

        console.log('[IPC] AI报告生成成功');
        return result;
      } catch (error) {
        console.error('[IPC] AI报告生成失败:', error);
        throw error;
      }
    });

    // AI 流式报告生成
    console.log('[IPC] 注册 ai:stream-generate-report 处理器');
    ipcMain.handle('ai:stream-generate-report', async (event, { prompt, aiModel }) => {
      try {
        console.log('[IPC] 收到AI流式报告生成请求');

        const { AIService } = require('../infrastructure/ai/ai-service');

        // 创建流式回调函数
        const onChunk = (content) => {
          // 发送流式数据到渲染进程
          event.sender.send('ai:report-stream-chunk', content);
        };

        const result = await AIService.streamGenerateReport(prompt, aiModel, this.windowManager, onChunk);

        console.log('[IPC] AI流式报告生成完成');
        return result;
      } catch (error) {
        console.error('[IPC] AI流式报告生成失败:', error);
        throw error;
      }
    });

    // 获取 AI 配置（用于报告生成）
    console.log('[IPC] 注册 ai:get-config 处理器');
    ipcMain.handle('ai:get-config', async () => {
      try {
        const config = this.windowManager.getConfig();
        return config.ai || {};
      } catch (error) {
        console.error('[IPC] 获取AI配置失败:', error);
        throw error;
      }
    });

    // 获取当前选中的 AI 模型信息
    console.log('[IPC] 注册 ai:get-selected-model 处理器');
    ipcMain.handle('ai:get-selected-model', async () => {
      try {
        const config = this.windowManager.getConfig();
        const aiConfig = config.ai || {};

        if (!aiConfig.selectedProvider) {
          throw new Error('未选择AI提供商');
        }

        // 构建模型信息
        let aiModel = null;

        if (aiConfig.selectedProvider.startsWith('custom-')) {
          const customProvider = aiConfig.customProviders?.find(p => p.id === aiConfig.selectedProvider);
          if (customProvider) {
            aiModel = {
              id: aiConfig.selectedProvider,
              name: customProvider.name || '自定义配置',
              provider: 'Custom'
            };
          }
        } else {
          const providerNames = {
            'openai': 'OpenAI',
            'google': 'Google',
            'anthropic': 'Anthropic',
            'xai': 'xAI'
          };

          aiModel = {
            id: aiConfig.selectedProvider,
            name: providerNames[aiConfig.selectedProvider] || aiConfig.selectedProvider,
            provider: providerNames[aiConfig.selectedProvider] || aiConfig.selectedProvider
          };
        }

        if (!aiModel) {
          throw new Error('无法获取AI模型信息');
        }

        return aiModel;
      } catch (error) {
        console.error('[IPC] 获取AI模型信息失败:', error);
        throw error;
      }
    });

    console.log('[IPC] AI 处理器设置完成');
  }

  setupTaskStatusLogHandlers() {
    // 获取任务状态历史
    ipcMain.handle('get-task-status-history', async (event, taskId) => {
      try {
        if (!this.taskStatusLogService) {
          return { success: false, error: '任务状态日志服务未初始化' };
        }
        
        const history = await this.taskStatusLogService.getTaskStatusHistory(taskId);
        return { success: true, history };
      } catch (error) {
        console.error('获取任务状态历史失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取状态变化统计
    ipcMain.handle('get-status-change-statistics', async (event, dateRange = null) => {
      try {
        if (!this.taskStatusLogService) {
          return { success: false, error: '任务状态日志服务未初始化' };
        }
        
        console.log("ipc handler get-status-change-statistics dateRange", dateRange)
        const statistics = await this.taskStatusLogService.getStatusChangeStatistics(dateRange);
        return { success: true, statistics };
      } catch (error) {
        console.error('获取状态变化统计失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取任务效率统计
    ipcMain.handle('get-task-efficiency-stats', async (event, dateRange = null) => {
      try {
        if (!this.taskStatusLogService) {
          return { success: false, error: '任务状态日志服务未初始化' };
        }
        
        const stats = await this.taskStatusLogService.getTaskEfficiencyStats(dateRange);
        return { success: true, stats };
      } catch (error) {
        console.error('获取任务效率统计失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 清理过期日志
    ipcMain.handle('cleanup-old-task-logs', async (event, daysToKeep = 90) => {
      try {
        if (!this.taskStatusLogService) {
          return { success: false, error: '任务状态日志服务未初始化' };
        }
        
        const result = await this.taskStatusLogService.cleanupOldLogs(daysToKeep);
        return { success: true, result };
      } catch (error) {
        console.error('清理过期日志失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取完成统计
    ipcMain.handle('get-completion-statistics', async (event, dateRange = null) => {
      try {
        if (!this.taskStatusLogService) {
          return { success: false, error: '任务状态日志服务未初始化' };
        }
        
        const statistics = await this.taskStatusLogService.getCompletionStatistics(dateRange);
        return { success: true, statistics };
      } catch (error) {
        console.error('获取完成统计失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取日志统计
    ipcMain.handle('get-log-statistics', async (event) => {
      try {
        if (!this.taskStatusLogService) {
          return { success: false, error: '任务状态日志服务未初始化' };
        }
        
        const statistics = await this.taskStatusLogService.getLogStatistics();
        return { success: true, statistics };
      } catch (error) {
        console.error('获取日志统计失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 初始化现有任务日志
    ipcMain.handle('initialize-existing-task-logs', async (event, force = false) => {
      try {
        if (!this.taskStatusLogService) {
          return { success: false, error: '任务状态日志服务未初始化' };
        }
        
        const result = await this.taskStatusLogService.initializeExistingTasksLogs(force);
        return { success: true, result };
      } catch (error) {
        console.error('初始化现有任务日志失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取每日活跃度数据（用于GitHub风格图表）
    ipcMain.handle('get-daily-activity-data', async (event, { days = 365 } = {}) => {
      try {
        if (!this.taskStatusLogService) {
          // 如果任务状态日志服务未初始化，返回基于任务创建和完成时间的数据
          return await this.generateActivityDataFromTasks(days);
        }
        
        const data = await this.taskStatusLogService.getDailyActivityData(days);
        return { success: true, data };
      } catch (error) {
        console.error('获取每日活跃度数据失败:', error);
        // 降级到基于任务数据生成
        try {
          const fallbackData = await this.generateActivityDataFromTasks(days);
          return { success: true, data: fallbackData };
        } catch (fallbackError) {
          console.error('生成降级活跃度数据失败:', fallbackError);
          return { success: false, error: error.message };
        }
      }
    });
  }
}

module.exports = IpcHandlers;