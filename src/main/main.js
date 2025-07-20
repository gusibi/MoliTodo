const { app, BrowserWindow, ipcMain, Menu, Tray, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 导入服务和仓储
const FileTaskRepository = require('../infrastructure/persistence/file-task-repository');
const TaskService = require('../domain/services/task-service');
const NotificationService = require('../domain/services/notification-service');

class MoliTodoApp {
  constructor() {
    this.floatingWindow = null;
    this.taskPanelWindow = null;
    this.tray = null;
    
    // 初始化服务
    this.taskRepository = new FileTaskRepository();
    this.taskService = new TaskService(this.taskRepository);
    this.notificationService = new NotificationService();
    
    // 应用配置存储
    this.configStore = new Store({
      name: 'config',
      defaults: {
        floatingIcon: {
          x: 100,
          y: 100,
          size: 60
        },
        autoStart: false,
        showNotifications: true
      }
    });

    this.isQuitting = false;
    this.alertState = false; // 提醒状态
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

    // 创建悬浮窗口
    this.createFloatingWindow();
    
    // 创建系统托盘 (暂时注释，需要PNG图标)
    // this.createTray();
    
    // 设置IPC处理器
    this.setupIpcHandlers();
    
    // 初始化提醒调度
    await this.initializeReminders();
    
    // 应用事件监听
    this.setupAppEvents();

    console.log('MoliTodo 应用已启动');
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
   * 创建系统托盘
   */
  createTray() {
    // 使用SVG图标路径
    const trayIconPath = path.join(__dirname, '../presentation/assets/icons/tray-icon.svg');
    
    try {
      this.tray = new Tray(trayIconPath);
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: '显示/隐藏悬浮图标',
          click: () => {
            if (this.floatingWindow.isVisible()) {
              this.floatingWindow.hide();
            } else {
              this.floatingWindow.show();
            }
          }
        },
        { type: 'separator' },
        {
          label: '设置',
          click: () => {
            // TODO: 打开设置窗口
          }
        },
        {
          label: '关于',
          click: () => {
            // TODO: 打开关于窗口
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            this.isQuitting = true;
            app.quit();
          }
        }
      ]);

      this.tray.setContextMenu(contextMenu);
      this.tray.setToolTip('MoliTodo - 悬浮待办');
      
    } catch (error) {
      console.warn('无法创建系统托盘:', error.message);
    }
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
    ipcMain.handle('complete-task', async (event, taskId) => {
      const task = await this.taskService.completeTask(taskId);
      this.notificationService.cancelTaskReminder(taskId);
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
  }

  /**
   * 设置应用事件
   */
  setupAppEvents() {
    app.on('window-all-closed', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
      }
    });

    app.on('before-quit', () => {
      this.isQuitting = true;
      this.notificationService.clearAllSchedules();
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
