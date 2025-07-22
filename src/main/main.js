const { app, BrowserWindow, ipcMain, Menu, Tray, screen, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 导入服务和仓储
const FileTaskRepository = require('../infrastructure/persistence/file-task-repository');
const SqliteTaskRepository = require('../infrastructure/persistence/sqlite-task-repository');
const TaskService = require('../domain/services/task-service');
const NotificationService = require('../domain/services/notification-service');

class MoliTodoApp {
  constructor() {
    this.floatingWindow = null;
    this.taskPanelWindow = null;
    this.taskManagerWindow = null;
    this.settingsWindow = null;
    this.tray = null;

    // 初始化服务 - 稍后在 initialize 方法中设置
    this.taskRepository = null;
    this.taskService = null;
    this.notificationService = new NotificationService();

    // 应用配置存储
    this.configStore = new Store({
      name: 'config',
      defaults: {
        floatingIcon: {
          x: 100,
          y: 100,
          size: 60,
          opacity: 100,
          visible: true
        },
        autoStart: false,
        showNotifications: true,
        alertSound: 'system', // 'none', 'system', 'chime', 'digital'
        theme: 'system', // 'light', 'dark', 'system'
        database: {
          type: 'sqlite', // 'file' or 'sqlite'
          path: null // null 表示使用默认路径
        }
      }
    });

    this.isQuitting = false;
    this.alertState = false; // 提醒状态
  }

  /**
   * 显示任务管理窗口
   */
  showTaskManagerWindow() {
    if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
      if (this.taskManagerWindow.isVisible()) {
        this.taskManagerWindow.focus();
      } else {
        this.taskManagerWindow.show();
      }
      return;
    }

    this.taskManagerWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      resizable: true,
      minimizable: true,
      maximizable: true,
      title: 'MoliTodo - 任务管理',
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.taskManagerWindow.loadFile(path.join(__dirname, '../presentation/task-manager/task-manager.html'));

    this.taskManagerWindow.once('ready-to-show', () => {
      this.taskManagerWindow.show();
    });

    // 阻止窗口关闭，只是隐藏
    this.taskManagerWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.taskManagerWindow.hide();
      }
    });

    // 只有在应用退出时才清理引用
    this.taskManagerWindow.on('closed', () => {
      this.taskManagerWindow = null;
    });
  }

  /**
   * 初始化应用
   */
  async initialize() {
    await app.whenReady();

    // 设置应用为单例
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return;
    }

    // 初始化数据库和服务
    await this.initializeDatabase();

    // 创建悬浮窗口
    this.createFloatingWindow();

    // 创建系统托盘
    this.createTray();

    // 设置IPC处理器
    this.setupIpcHandlers();

    // 初始化提醒调度
    await this.initializeReminders();

    // 应用事件监听
    this.setupAppEvents();

    console.log('MoliTodo 应用已启动');
  }

  /**
   * 初始化数据库
   */
  async initializeDatabase() {
    const dbConfig = this.configStore.get('database', { type: 'sqlite', path: null });

    try {
      if (dbConfig.type === 'sqlite') {
        // 使用 SQLite 数据库
        const dbPath = dbConfig.path || this.getDefaultDatabasePath();
        console.log('初始化 SQLite 数据库:', dbPath);

        this.taskRepository = new SqliteTaskRepository(dbPath);
        await this.taskRepository.initialize();
      } else {
        // 使用文件存储（向后兼容）
        console.log('使用文件存储');
        this.taskRepository = new FileTaskRepository();
      }

      this.taskService = new TaskService(this.taskRepository);
      console.log('数据库初始化完成');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      // 回退到文件存储
      console.log('回退到文件存储');
      this.taskRepository = new FileTaskRepository();
      this.taskService = new TaskService(this.taskRepository);
    }
  }

  /**
   * 获取默认数据库路径
   */
  getDefaultDatabasePath() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'tasks.db');
  }

  /**
   * 重新初始化数据库
   */
  async reinitializeDatabase() {
    // 关闭当前数据库连接
    if (this.taskRepository && typeof this.taskRepository.close === 'function') {
      await this.taskRepository.close();
    }

    // 清除提醒调度
    this.notificationService.clearAllSchedules();

    // 重新初始化
    await this.initializeDatabase();

    // 重新设置提醒
    await this.initializeReminders();
  }

  /**
   * 创建悬浮窗口
   */
  createFloatingWindow() {
    console.log('主进程: 开始创建悬浮窗口');

    const config = this.configStore.get('floatingIcon');
    console.log('主进程: 悬浮窗口配置:', config);

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    console.log('主进程: 屏幕工作区域:', { width, height });

    // 确保窗口位置在屏幕范围内
    const x = Math.min(Math.max(config.x, 0), width - config.size);
    const y = Math.min(Math.max(config.y, 0), height - config.size);
    console.log('主进程: 计算后的窗口位置:', { x, y, size: config.size });

    this.floatingWindow = new BrowserWindow({
      width: config.size,
      height: config.size,
      x: x,
      y: y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: true, // 启用焦点，允许鼠标事件
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    console.log('主进程: BrowserWindow创建完成');

    // 加载悬浮图标页面
    const htmlPath = path.join(__dirname, '../presentation/floating-icon/floating-icon.html');
    console.log('主进程: 准备加载HTML文件:', htmlPath);

    this.floatingWindow.loadFile(htmlPath);

    // 窗口准备好后显示
    this.floatingWindow.once('ready-to-show', () => {
      console.log('主进程: 悬浮窗口ready-to-show事件触发');
      this.floatingWindow.show();
      console.log('主进程: 悬浮窗口已显示');
      this.updateFloatingIcon();
      // 立即应用配置以确保透明度正确
      this.applyFloatingIconConfig();
    });

    // 添加webContents事件监听
    this.floatingWindow.webContents.on('did-finish-load', () => {
      console.log('主进程: 悬浮窗口页面加载完成');
    });

    this.floatingWindow.webContents.on('dom-ready', () => {
      console.log('主进程: 悬浮窗口DOM准备完成');
    });

    // 监听窗口移动，保存位置
    this.floatingWindow.on('moved', () => {
      const [x, y] = this.floatingWindow.getPosition();
      this.configStore.set('floatingIcon.x', x);
      this.configStore.set('floatingIcon.y', y);
    });

    // 处理悬浮窗口关闭事件
    this.floatingWindow.on('close', (event) => {
      if (!this.isQuitting) {
        // 如果不是应用退出，阻止关闭（悬浮窗口应该始终存在）
        event.preventDefault();
      }
    });

    // 悬浮窗口关闭时清理引用
    this.floatingWindow.on('closed', () => {
      this.floatingWindow = null;
    });

    // 初始状态不启用鼠标穿透，让图标可以接收事件
    // 我们将通过CSS和窗口形状来控制可点击区域
    console.log('主进程: 悬浮窗口创建流程完成');
  }

  /**
   * 创建任务面板窗口
   */
  createTaskPanel() {
    if (this.taskPanelWindow) {
      return;
    }

    const floatingBounds = this.floatingWindow.getBounds();
    const { screen } = require('electron');
    const display = screen.getDisplayNearestPoint({ x: floatingBounds.x, y: floatingBounds.y });
    const workArea = display.workArea;

    // 计算面板位置，确保不超出屏幕边界
    let panelX = floatingBounds.x + floatingBounds.width + 10;
    let panelY = floatingBounds.y;

    // 如果右侧空间不够，显示在左侧
    if (panelX + 320 > workArea.x + workArea.width) {
      panelX = floatingBounds.x - 320 - 10;
    }

    // 确保不超出屏幕顶部和底部
    const maxHeight = Math.min(600, workArea.height * 0.8);
    if (panelY + maxHeight > workArea.y + workArea.height) {
      panelY = workArea.y + workArea.height - maxHeight;
    }

    this.taskPanelWindow = new BrowserWindow({
      width: 320,
      height: maxHeight,
      x: panelX,
      y: panelY,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.taskPanelWindow.loadFile(path.join(__dirname, '../presentation/task-panel/task-panel.html'));

    this.taskPanelWindow.once('ready-to-show', () => {
      this.taskPanelWindow.show();
      this.sendTasksToPanel();
    });

    // 面板关闭时清理引用
    this.taskPanelWindow.on('closed', () => {
      this.taskPanelWindow = null;
    });
  }

  /**
   * 显示设置窗口
   */
  showSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isVisible()) {
        this.settingsWindow.focus();
      } else {
        this.settingsWindow.show();
      }
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 600,
      height: 500,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: '设置',
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.settingsWindow.loadFile(path.join(__dirname, '../presentation/settings/settings.html'));

    this.settingsWindow.once('ready-to-show', () => {
      this.settingsWindow.show();
    });

    // 阻止窗口关闭，只是隐藏
    this.settingsWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.settingsWindow.hide();
      }
    });

    // 只有在应用退出时才清理引用
    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  /**
   * 显示关于对话框
   */
  showAboutDialog() {
    const { dialog } = require('electron');

    dialog.showMessageBox(this.floatingWindow || null, {
      type: 'info',
      title: '关于 MoliTodo',
      message: 'MoliTodo',
      detail: `版本: 1.0.0
一款常驻在桌面边缘的悬浮式待办事项应用

© 2024 MoliTodo Team
MIT License`,
      buttons: ['确定']
    });
  }

  /**
   * 创建系统托盘
   */
  createTray() {
    // 使用PNG图标，因为SVG在某些系统上可能不支持
    const trayIconPath = path.join(__dirname, '../presentation/assets/icons/app-icon-256x256.png');

    try {
      // 创建图标并调整大小
      const image = nativeImage.createFromPath(trayIconPath);
      const resizedImage = image.resize({ width: 16, height: 16 });

      this.tray = new Tray(resizedImage);
      this.tray.setToolTip('MoliTodo - 悬浮待办');

      this.updateTrayMenu();

      // macOS 上的左键点击事件
      this.tray.on('click', () => {
        this.tray.popUpContextMenu();
      });

    } catch (error) {
      console.warn('无法创建系统托盘:', error.message);
    }
  }

  /**
   * 更新托盘菜单
   */
  updateTrayMenu() {
    const floatingIconVisible = this.configStore.get('floatingIcon.visible', true);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: floatingIconVisible ? '隐藏悬浮图标' : '显示悬浮图标',
        type: 'normal',
        click: () => {
          // 每次点击时重新获取当前状态
          const currentVisible = this.configStore.get('floatingIcon.visible', true);
          const newVisible = !currentVisible;

          this.configStore.set('floatingIcon.visible', newVisible);
          this.applyFloatingIconConfig();
          this.updateTrayMenu(); // 更新菜单文本
        }
      },
      { type: 'separator' },
      {
        label: '任务管理...',
        click: () => {
          this.showTaskManagerWindow();
        }
      },
      {
        label: '设置...',
        click: () => {
          this.showSettingsWindow();
        }
      },
      { type: 'separator' },
      {
        label: '关于 MoliTodo',
        click: () => {
          this.showAboutDialog();
        }
      },
      {
        label: '退出 MoliTodo',
        click: () => {
          console.log('用户点击退出菜单');
          this.isQuitting = true;

          // 立即关闭所有窗口
          if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
            this.floatingWindow.close();
          }
          if (this.taskPanelWindow && !this.taskPanelWindow.isDestroyed()) {
            this.taskPanelWindow.close();
          }
          if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
            this.taskManagerWindow.close();
          }
          if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
            this.settingsWindow.close();
          }

          // 延迟一点时间确保窗口关闭完成，然后退出应用
          setTimeout(() => {
            app.quit();
          }, 100);
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * 设置IPC处理器
   */
  setupIpcHandlers() {
    // 日志消息处理器
    ipcMain.handle('log-message', (event, message, ...args) => {
      console.log(message, ...args);
    });

    // 获取任务列表
    ipcMain.handle('get-tasks', async () => {
      return await this.taskService.getIncompleteTasks();
    });

    // 获取已完成任务列表
    ipcMain.handle('get-completed-tasks', async () => {
      return await this.taskService.getCompletedTasks();
    });

    // 创建任务
    ipcMain.handle('create-task', async (event, content, reminderTime) => {
      const task = await this.taskService.createTask(content, reminderTime ? new Date(reminderTime) : null);

      if (task.reminderTime) {
        this.notificationService.scheduleTaskReminder(task, (task) => {
          this.handleTaskReminder(task);
        });
      }

      this.updateFloatingIcon();
      this.sendTasksToPanel(); // 更新任务面板
      return task;
    });

    // 完成任务
    ipcMain.handle('complete-task', async (event, taskId, completed = true) => {
      let task;
      if (completed) {
        task = await this.taskService.completeTask(taskId);
        this.notificationService.cancelTaskReminder(taskId);
      } else {
        task = await this.taskService.uncompleteTask(taskId);
        // 如果任务有提醒时间，重新设置提醒
        if (task.reminderTime) {
          this.notificationService.scheduleTaskReminder(task, (task) => {
            this.handleTaskReminder(task);
          });
        }
      }

      this.updateFloatingIcon();
      this.sendTasksToPanel(); // 更新任务面板
      return task;
    });

    // 删除任务
    ipcMain.handle('delete-task', async (event, taskId) => {
      const success = await this.taskService.deleteTask(taskId);
      this.notificationService.cancelTaskReminder(taskId);
      this.updateFloatingIcon();
      this.sendTasksToPanel(); // 更新任务面板
      return success;
    });

    // 设置任务提醒
    ipcMain.handle('set-task-reminder', async (event, taskId, reminderTime) => {
      const task = await this.taskService.setTaskReminder(taskId, new Date(reminderTime));
      this.notificationService.scheduleTaskReminder(task, (task) => {
        this.handleTaskReminder(task);
      });
      return task;
    });

    // 更新任务内容
    ipcMain.handle('update-task-content', async (event, taskId, content) => {
      const task = await this.taskService.updateTaskContent(taskId, content);
      this.sendTasksToPanel(); // 更新任务面板
      return task;
    });

    // 更新任务状态
    ipcMain.handle('update-task-status', async (event, taskId, status) => {
      const task = await this.taskService.updateTaskStatus(taskId, status);
      this.updateFloatingIcon();
      this.sendTasksToPanel(); // 更新任务面板
      return task;
    });

    // 显示任务面板
    ipcMain.handle('show-task-panel', () => {
      this.createTaskPanel();
    });

    // 隐藏任务面板
    ipcMain.handle('hide-task-panel', () => {
      if (this.taskPanelWindow) {
        this.taskPanelWindow.close();
      }
    });

    // 显示任务管理窗口
    ipcMain.handle('show-task-manager', () => {
      this.showTaskManagerWindow();
    });

    // 设置鼠标穿透状态
    ipcMain.handle('set-mouse-ignore', (event, ignore) => {
      console.log(`Main: 设置鼠标穿透状态为 ${ignore}`);
      if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
        this.floatingWindow.setIgnoreMouseEvents(ignore, { forward: true });
        console.log(`Main: 鼠标穿透状态已设置为 ${ignore}`);
      } else {
        console.log('Main: 悬浮窗口不存在或已销毁');
      }
    });

    // 清除提醒状态
    ipcMain.handle('clear-alert-state', () => {
      this.alertState = false;
      this.updateFloatingIcon();
    });

    // 面板鼠标进入事件
    ipcMain.handle('panel-mouse-enter', () => {
      // 通知悬浮图标面板正在被使用
      if (this.floatingWindow) {
        this.floatingWindow.webContents.send('panel-mouse-enter');
      }
    });

    // 面板鼠标离开事件
    ipcMain.handle('panel-mouse-leave', () => {
      // 通知悬浮图标鼠标离开了面板
      if (this.floatingWindow) {
        this.floatingWindow.webContents.send('panel-mouse-leave');
      }
    });

    // 获取窗口位置
    ipcMain.handle('get-window-position', () => {
      if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
        const [x, y] = this.floatingWindow.getPosition();
        console.log('主进程: 获取窗口位置', { x, y });
        return { x, y };
      }
      return { x: 0, y: 0 };
    });

    // 开始拖拽
    ipcMain.handle('start-drag', (event, position) => {
      console.log('主进程: 开始拖拽', position);
      if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
        // 设置窗口位置
        this.floatingWindow.setPosition(position.x, position.y);
      }
    });

    // 拖拽窗口
    ipcMain.handle('drag-window', (event, position) => {
      if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
        // 直接更新窗口位置，不进行额外的检查和日志
        this.floatingWindow.setPosition(position.x, position.y);
      }
    });

    // 结束拖拽
    ipcMain.handle('end-drag', () => {
      console.log('主进程: 结束拖拽');
      if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
        // 保存最终位置
        const [x, y] = this.floatingWindow.getPosition();
        this.configStore.set('floatingIcon.x', x);
        this.configStore.set('floatingIcon.y', y);
        console.log('主进程: 保存拖拽后位置', { x, y });
      }
    });

    // ========== 设置相关的IPC处理器 ==========

    // 获取应用配置
    ipcMain.handle('get-config', () => {
      return this.configStore.store;
    });

    // 更新配置
    ipcMain.handle('update-config', (event, key, value) => {
      this.configStore.set(key, value);

      // 如果是悬浮图标相关配置，立即应用
      if (key.startsWith('floatingIcon.')) {
        this.applyFloatingIconConfig();
      }

      return this.configStore.get(key);
    });

    // 导出数据
    ipcMain.handle('export-data', async () => {
      const { dialog } = require('electron');
      const fs = require('fs').promises;

      try {
        const result = await dialog.showSaveDialog(this.settingsWindow || this.floatingWindow, {
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
            tasks: allTasks,
            config: this.configStore.store
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
      const { dialog } = require('electron');
      const fs = require('fs').promises;

      try {
        const result = await dialog.showOpenDialog(this.settingsWindow || this.floatingWindow, {
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

          // 验证数据格式
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

          // 导入配置（可选）
          if (importData.config) {
            for (const [key, value] of Object.entries(importData.config)) {
              this.configStore.set(key, value);
            }
            this.applyFloatingIconConfig();
          }

          // 重新初始化提醒
          await this.initializeReminders();
          this.updateFloatingIcon();
          this.sendTasksToPanel();

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
        this.updateFloatingIcon();
        this.sendTasksToPanel();
        return { success: true };
      } catch (error) {
        console.error('清除数据失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 设置开机自启动
    ipcMain.handle('set-auto-start', (event, enabled) => {
      try {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          path: app.getPath('exe')
        });
        this.configStore.set('autoStart', enabled);
        return { success: true };
      } catch (error) {
        console.error('设置开机自启动失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 播放提醒声音
    ipcMain.handle('play-alert-sound', (event, soundType) => {
      // TODO: 实现声音播放
      console.log('播放提醒声音:', soundType);
      return { success: true };
    });

    // ========== 数据库相关的IPC处理器 ==========

    // 获取数据库统计信息
    ipcMain.handle('get-database-stats', async () => {
      try {
        if (this.taskRepository && typeof this.taskRepository.getStats === 'function') {
          return await this.taskRepository.getStats();
        }
        return { error: '数据库统计信息不可用' };
      } catch (error) {
        console.error('获取数据库统计失败:', error);
        return { error: error.message };
      }
    });

    // 设置数据库路径
    ipcMain.handle('set-database-path', async (event, newPath) => {
      try {
        const { dialog } = require('electron');

        // 如果没有提供路径，打开文件选择对话框
        if (!newPath) {
          const result = await dialog.showSaveDialog(this.settingsWindow || this.floatingWindow, {
            title: '选择数据库保存位置',
            defaultPath: 'tasks.db',
            filters: [
              { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }
            ]
          });

          if (result.canceled || !result.filePath) {
            return { success: false, canceled: true };
          }

          newPath = result.filePath;
        }

        // 验证路径
        const fs = require('fs').promises;
        const newDir = path.dirname(newPath);

        try {
          await fs.mkdir(newDir, { recursive: true });
        } catch (error) {
          return { success: false, error: '无法创建目录: ' + error.message };
        }

        // 保存配置
        this.configStore.set('database.path', newPath);

        // 重新初始化数据库
        await this.reinitializeDatabase();

        return { success: true, path: newPath };
      } catch (error) {
        console.error('设置数据库路径失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 迁移数据库
    ipcMain.handle('migrate-database', async (event, fromType, toType) => {
      try {
        // 导出当前数据
        const exportData = await this.taskRepository.exportData();

        // 切换数据库类型
        this.configStore.set('database.type', toType);

        // 重新初始化数据库
        await this.reinitializeDatabase();

        // 导入数据到新数据库
        await this.taskRepository.importData(exportData);

        // 更新UI
        this.updateFloatingIcon();
        this.sendTasksToPanel();

        return { success: true, taskCount: exportData.tasks.length };
      } catch (error) {
        console.error('数据库迁移失败:', error);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * 应用悬浮图标配置
   */
  applyFloatingIconConfig() {
    if (!this.floatingWindow || this.floatingWindow.isDestroyed()) {
      return;
    }

    const config = this.configStore.get('floatingIcon', {
      size: 60,
      opacity: 100,
      visible: true,
      x: null,
      y: null
    });

    // 如果当前配置的透明度不是100，强制更新为100
    if (config.opacity !== 100) {
      this.configStore.set('floatingIcon.opacity', 100);
      config.opacity = 100;
    }

    // 应用大小
    this.floatingWindow.setSize(config.size, config.size);

    // 应用透明度 - 确保opacity是有效数值
    const opacity = typeof config.opacity === 'number' && !isNaN(config.opacity) ? config.opacity : 100;
    this.floatingWindow.setOpacity(opacity / 100);

    // 确保窗口位置在屏幕范围内
    const { screen } = require('electron');
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    if (config.x !== null && config.y !== null) {
      const x = Math.min(Math.max(config.x, 0), width - config.size);
      const y = Math.min(Math.max(config.y, 0), height - config.size);
      this.floatingWindow.setPosition(x, y);
    } else {
      // 如果没有保存的位置，设置到屏幕右边缘
      const x = width - config.size - 20;
      const y = Math.floor(height / 2);
      this.floatingWindow.setPosition(x, y);
      this.configStore.set('floatingIcon.x', x);
      this.configStore.set('floatingIcon.y', y);
    }

    // 应用可见性
    if (config.visible) {
      // 确保窗口已经准备好再显示
      if (this.floatingWindow.webContents.isLoading()) {
        this.floatingWindow.webContents.once('did-finish-load', () => {
          this.floatingWindow.show();
          this.floatingWindow.focus();
        });
      } else {
        this.floatingWindow.show();
        this.floatingWindow.focus();
      }
    } else {
      this.floatingWindow.hide();
    }

    // 通知渲染进程更新
    if (!this.floatingWindow.webContents.isLoading()) {
      this.floatingWindow.webContents.send('config-updated', config);
    }

    // 更新托盘菜单
    if (this.tray) {
      this.updateTrayMenu();
    }
  }

  /**
   * 设置应用事件
   */
  setupAppEvents() {
    app.on('window-all-closed', (event) => {
      console.log('所有窗口已关闭，isQuitting:', this.isQuitting);
      if (!this.isQuitting) {
        event.preventDefault();
        console.log('阻止应用退出');
      } else {
        console.log('允许应用退出');
      }
    });

    app.on('before-quit', () => {
      console.log('应用准备退出...');
      this.isQuitting = true;
      this.notificationService.clearAllSchedules();

      // 确保所有窗口都能正常关闭
      if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
        this.floatingWindow.destroy();
      }
      if (this.taskPanelWindow && !this.taskPanelWindow.isDestroyed()) {
        this.taskPanelWindow.destroy();
      }
      if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
        this.taskManagerWindow.destroy();
      }
      if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
        this.settingsWindow.destroy();
      }
    });

    app.on('will-quit', (event) => {
      console.log('应用即将退出...');
      if (!this.isQuitting) {
        console.log('意外的退出尝试，阻止退出');
        event.preventDefault();
      }
    });

    app.on('activate', () => {
      if (!this.floatingWindow) {
        this.createFloatingWindow();
      }
    });
  }

  /**
   * 初始化提醒调度
   */
  async initializeReminders() {
    const tasks = await this.taskService.getAllTasks();
    this.notificationService.rescheduleAllReminders(tasks, (task) => {
      this.handleTaskReminder(task);
    });
  }

  /**
   * 处理任务提醒
   */
  handleTaskReminder(task) {
    this.alertState = true;
    this.updateFloatingIcon();

    // 发送通知到悬浮窗口
    if (this.floatingWindow) {
      this.floatingWindow.webContents.send('task-reminder', task);
    }
  }

  /**
   * 更新悬浮图标
   */
  async updateFloatingIcon() {
    const count = await this.taskService.getIncompleteTaskCount();

    if (this.floatingWindow) {
      this.floatingWindow.webContents.send('update-badge', {
        count,
        alertState: this.alertState
      });
    }
  }

  /**
   * 发送任务到面板
   */
  async sendTasksToPanel() {
    if (this.taskPanelWindow) {
      const tasks = await this.taskService.getIncompleteTasks();
      this.taskPanelWindow.webContents.send('update-tasks', tasks);
    }
  }
}

// Create and initialize app instance
const todoApp = new MoliTodoApp();
todoApp.initialize().catch(console.error);

// Prevent app from being garbage collected
module.exports = todoApp;
