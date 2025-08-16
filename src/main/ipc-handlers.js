const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;

class IpcHandlers {
  constructor({ taskService, listService, notificationService, windowManager }) {
    this.taskService = taskService;
    this.listService = listService;
    this.notificationService = notificationService;
    this.windowManager = windowManager;
  }

  initialize() {
    this.setupTaskHandlers();
    this.setupListHandlers();
    this.setupConfigHandlers();
    this.setupWindowHandlers();
    this.setupDataHandlers();
    this.setupUtilityHandlers();
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
    ipcMain.handle('task:expandRecurring', async (event, { startDate, endDate }) => {
      try {
        const tasks = await this.taskService.expandRecurringTasks(new Date(startDate), new Date(endDate));
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
        ]
      };
      
      Object.entries(defaultConfig).forEach(([key, value]) => {
        this.windowManager.updateConfig(key, value);
      });
      
      return { success: true };
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
    
    if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
      console.log('发送任务提醒事件到悬浮窗口');
      this.windowManager.floatingWindow.webContents.send('task-reminder', task);
    } else {
      console.log('悬浮窗口不存在或已销毁，无法发送提醒事件');
    }
  }
}

module.exports = IpcHandlers;