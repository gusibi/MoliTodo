const { app } = require('electron');
const WindowManager = require('./window-manager');
const IpcHandlers = require('./ipc-handlers');

// 导入业务层
const FileTaskRepository = require('../infrastructure/persistence/file-task-repository');
const SqliteTaskRepository = require('../infrastructure/persistence/sqlite-task-repository');
const SqliteListRepository = require('../infrastructure/persistence/sqlite-list-repository');
const TaskService = require('../domain/services/task-service');
const ListService = require('../domain/services/list-service');
const NotificationService = require('../infrastructure/notification/notification-service');

class MoliTodoApp {
  constructor() {
    this.windowManager = null;
    this.ipcHandlers = null;
    
    // 业务服务
    this.taskRepository = null;
    this.listRepository = null;
    this.taskService = null;
    this.listService = null;
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
      this.windowManager = new WindowManager(this);
      // 将 TaskService 传递给 WindowManager
      this.windowManager.taskService = this.taskService;
      await this.windowManager.initialize();
      
      // 将 WindowManager 传递给 TaskService
      this.taskService.windowManager = this.windowManager;

      // 初始化 IPC 处理器
      this.ipcHandlers = new IpcHandlers({
        taskService: this.taskService,
        listService: this.listService,
        notificationService: this.notificationService,
        windowManager: this.windowManager
      });
      this.ipcHandlers.initialize();

      // 设置应用事件
      this.setupAppEvents();

      console.log('MoliTodo Vue 应用已启动');
      
      // 应用完全启动后的初始化任务
      setTimeout(async () => {
        try {
          // 检测首次启动并创建用户引导任务
          await this.handleFirstLaunchSetup();
          
          // 更新托盘菜单显示任务数量
          if (this.windowManager && this.windowManager.tray) {
            console.log('应用启动完成，更新托盘菜单...');
            await this.windowManager.updateTrayMenu();
          }
        } catch (error) {
          console.error('应用启动后初始化任务失败:', error);
        }
      }, 2000);
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
      
      // 初始化清单仓储（使用相同的数据库连接）
      this.listRepository = new SqliteListRepository(this.taskRepository.db);
      
      // 初始化服务
      this.taskService = new TaskService(this.taskRepository);
      this.listService = new ListService(this.listRepository, this.taskRepository);
      
      console.log('业务服务初始化完成 - 使用 SQLite');
    } catch (error) {
      console.error('SQLite 初始化失败，回退到文件存储:', error);
      try {
        // 回退到文件存储（暂时不支持清单功能）
        this.taskRepository = new FileTaskRepository();
        await this.taskRepository.initialize();
        this.taskService = new TaskService(this.taskRepository);
        this.listService = null; // 文件存储暂不支持清单
        console.log('业务服务初始化完成 - 使用文件存储（不支持清单功能）');
      } catch (fallbackError) {
        console.error('文件存储初始化也失败:', fallbackError);
        throw fallbackError;
      }
    }
  }

  setupAppEvents() {
    // 处理所有窗口关闭事件
    app.on('window-all-closed', (event) => {
      // 在 macOS 上，除非用户明确退出，否则应用应该保持运行
      if (process.platform === 'darwin' && !this.isQuitting) {
        event.preventDefault();
      } else if (!this.isQuitting) {
        // 在其他平台上，如果不是主动退出，也阻止默认行为
        event.preventDefault();
      }
      // 如果是主动退出（isQuitting = true），则允许应用正常退出
    });

    // 处理应用即将退出事件（Cmd+Q, Alt+F4 等）
    app.on('before-quit', (event) => {
      if (!this.isQuitting) {
        this.isQuitting = true;
        this.notificationService.clearAllSchedules();
        
        // 清理所有窗口但不重复调用 app.quit()
        if (this.windowManager) {
          this.windowManager.cleanup();
        }
      }
    });

    // 处理应用激活事件（macOS dock 点击等）
    app.on('activate', () => {
      if (!this.windowManager.hasWindows()) {
        this.windowManager.createFloatingWindow();
      }
    });

    // 处理第二个实例启动（单例模式）
    app.on('second-instance', () => {
      // 如果有任务管理窗口，聚焦它
      if (this.windowManager.taskManagerWindow && !this.windowManager.taskManagerWindow.isDestroyed()) {
        this.windowManager.taskManagerWindow.focus();
      } else {
        // 否则显示悬浮图标
        if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
          this.windowManager.floatingWindow.show();
        }
      }
    });
  }

  /**
   * 处理首次启动设置
   * 检测是否为首次启动，如果是则创建用户引导任务
   */
  async handleFirstLaunchSetup() {
    try {
      // 检测是否为首次启动
      if (!this.windowManager.isFirstLaunch()) {
        console.log('[FirstLaunch] 非首次启动，跳过用户引导任务创建');
        return;
      }

      console.log('[FirstLaunch] 检测到首次启动，开始创建用户引导任务');

      // 确保有默认清单存在
       if (this.listService) {
         await this.listService.getAllLists();
       }

      // 创建用户引导任务（无论默认清单是否有任务）
      const guideTasks = await this.taskService.createUserGuideTasks(0);
      console.log('[FirstLaunch] 用户引导任务创建完成，共创建', guideTasks.length, '个任务');

      // 标记首次启动完成
      this.windowManager.markFirstLaunchCompleted();
      
    } catch (error) {
      console.error('[FirstLaunch] 首次启动设置失败:', error);
      // 即使失败也要标记首次启动完成，避免重复尝试
      this.windowManager.markFirstLaunchCompleted();
    }
  }

  // 添加方法供 WindowManager 调用来退出应用
  quit() {
    this.isQuitting = true;
    this.notificationService.clearAllSchedules();
    app.quit();
  }
}

// 创建应用实例并初始化
const moliTodoApp = new MoliTodoApp();
moliTodoApp.initialize().catch(console.error);