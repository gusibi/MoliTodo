const { app } = require('electron');
const WindowManager = require('./window-manager');
const IpcHandlers = require('./ipc-handlers');

// 导入业务层
const FileTaskRepository = require('../infrastructure/persistence/file-task-repository');
const SqliteTaskRepository = require('../infrastructure/persistence/sqlite-task-repository');
const TaskService = require('../domain/services/task-service');
const NotificationService = require('../infrastructure/notification/notification-service');

class MoliTodoApp {
  constructor() {
    this.windowManager = null;
    this.ipcHandlers = null;
    
    // 业务服务
    this.taskRepository = null;
    this.taskService = null;
    this.notificationService = new NotificationService();
    
    this.isQuitting = false;
  }

  async initialize() {
    try {
      await app.whenReady();

      // 设置应用为单例
      if (!app.requestSingleInstanceLock()) {
        app.quit();
        return;
      }

      // 初始化数据库和服务
      await this.initializeServices();

      // 初始化窗口管理器
      this.windowManager = new WindowManager();
      await this.windowManager.initialize();

      // 初始化 IPC 处理器
      this.ipcHandlers = new IpcHandlers({
        taskService: this.taskService,
        notificationService: this.notificationService,
        windowManager: this.windowManager
      });
      this.ipcHandlers.initialize();

      // 设置应用事件
      this.setupAppEvents();

      console.log('MoliTodo Vue 应用已启动');
    } catch (error) {
      console.error('应用初始化失败:', error);
      app.quit();
    }
  }

  async initializeServices() {
    try {
      // 这里可以根据配置选择不同的存储方式
      this.taskRepository = new SqliteTaskRepository();
      await this.taskRepository.initialize();
      
      this.taskService = new TaskService(this.taskRepository);
      
      console.log('业务服务初始化完成 - 使用 SQLite');
    } catch (error) {
      console.error('SQLite 初始化失败，回退到文件存储:', error);
      try {
        // 回退到文件存储
        this.taskRepository = new FileTaskRepository();
        await this.taskRepository.initialize();
        this.taskService = new TaskService(this.taskRepository);
        console.log('业务服务初始化完成 - 使用文件存储');
      } catch (fallbackError) {
        console.error('文件存储初始化也失败:', fallbackError);
        throw fallbackError;
      }
    }
  }

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
      if (!this.windowManager.hasWindows()) {
        this.windowManager.createFloatingWindow();
      }
    });
  }
}

// 创建应用实例并初始化
const moliTodoApp = new MoliTodoApp();
moliTodoApp.initialize().catch(console.error);