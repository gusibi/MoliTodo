const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;

class IpcHandlers {
  constructor({ taskService, notificationService, windowManager }) {
    this.taskService = taskService;
    this.notificationService = notificationService;
    this.windowManager = windowManager;
  }

  initialize() {
    this.setupTaskHandlers();
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
      const { content, reminderTime } = taskData;
      const task = await this.taskService.createTask(
        content, 
        reminderTime ? new Date(reminderTime) : null
      );

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
    ipcMain.handle('get-task-stats', async () => {
      return await this.taskService.getTimeStats();
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
  }

  setupConfigHandlers() {
    ipcMain.handle('get-config', () => {
      return this.windowManager.getConfig();
    });

    ipcMain.handle('update-config', (event, key, value) => {
      return this.windowManager.updateConfig(key, value);
    });

    ipcMain.handle('save-config', (event, config) => {
      Object.entries(config).forEach(([key, value]) => {
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
          const exportData = {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            tasks: allTasks.map(task => task.toJSON()),
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
          return { success: true, taskCount: importData.tasks.length };
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
    windows.forEach(window => {
      if (window && !window.isDestroyed()) {
        console.log(`主进程: 已向 ${window.id} 窗口广播任务更新`);
        window.webContents.send('tasks-updated');
      }
    });
  }

  // 处理任务提醒
  handleTaskReminder(task) {
    console.log('IPC处理任务提醒:', task);
    if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
      console.log('发送任务提醒事件到悬浮窗口');
      this.windowManager.floatingWindow.webContents.send('task-reminder', task);
    } else {
      console.log('悬浮窗口不存在或已销毁，无法发送提醒事件');
    }
  }
}

module.exports = IpcHandlers;