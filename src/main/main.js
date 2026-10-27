const { app, powerMonitor, BrowserWindow } = require('electron');
const path = require('path');
const WindowManager = require('./window-manager');
const IpcHandlers = require('./ipc-handlers');
const UpdateService = require('./update-service');
const LocalApiServer = require('./local-api-server');
const ToolsRuntime = require('./tools-runtime');
const { createClock } = require('./clock');

// E2E 测试：使用独立用户数据目录与临时数据库，绝不读写开发者或用户真实数据
if (process.env.MOLI_E2E_USER_DATA) {
  app.setPath('userData', process.env.MOLI_E2E_USER_DATA);
}

// 导入业务层
const FileTaskRepository = require('../infrastructure/persistence/file-task-repository');
const SqliteTaskRepository = require('../infrastructure/persistence/sqlite-task-repository');
const SqliteListRepository = require('../infrastructure/persistence/sqlite-list-repository');
const SqliteTaskStatusLogRepository = require('../infrastructure/persistence/sqlite-task-status-log-repository');
const TaskService = require('../domain/services/task-service');
const ListService = require('../domain/services/list-service');
const TaskStatusLogService = require('../domain/services/task-status-log-service');
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
    this.localApiServer = null;
    this.toolsRuntime = null;
    this.updateService = null;
    
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

      // 工具域运行时：花园初始化、提醒心跳、读模型与弹窗
      if (this.taskRepository && this.taskRepository.db) {
        try {
          this.toolsRuntime = new ToolsRuntime({
            db: this.taskRepository.db,
            windowManager: this.windowManager,
            clock: createClock()
          });
          await this.toolsRuntime.initialize();
          powerMonitor.on('suspend', () => {
            this.toolsRuntime.handleSuspend().catch((error) => {
              console.error('休眠暂停专注失败:', error);
            });
          });
          powerMonitor.on('resume', () => {
            this.toolsRuntime.handleResume().catch((error) => {
              console.error('唤醒恢复专注失败:', error);
            });
          });
        } catch (error) {
          console.error('工具域初始化失败，健康提醒与小院暂不可用:', error);
          this.toolsRuntime = null;
        }
      }

      this.localApiServer = new LocalApiServer({
        taskService: this.taskService,
        listService: this.listService,
        notificationService: this.notificationService,
        windowManager: this.windowManager
      });
      await this.localApiServer.initialize();

      // 初始化 IPC 处理器
      this.updateService = new UpdateService({
        broadcast: (channel, payload) => {
          for (const window of BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) {
              window.webContents.send(channel, payload);
            }
          }
        },
        quitApp: () => this.quit()
      });

      this.ipcHandlers = new IpcHandlers({
        taskService: this.taskService,
        listService: this.listService,
        notificationService: this.notificationService,
        windowManager: this.windowManager,
        taskStatusLogService: this.taskStatusLogService,
        localApiServer: this.localApiServer,
        toolsRuntime: this.toolsRuntime,
        updateService: this.updateService
      });
      this.ipcHandlers.initialize();

      // 恢复已持久化任务的提醒调度（旧绝对提醒保持既有恢复行为）
      await this.ipcHandlers.restoreReminderSchedules();

      // E2E 测试：暴露应用实例以便测试夹具注入任务，并直接打开任务管理窗口
      if (process.env.MOLI_E2E_USER_DATA) {
        global.__moliTodoApp = this;
        this.windowManager.createTaskManagerWindow();
      }

      // 设置应用事件
      this.setupAppEvents();

      // 启动后静默检查更新（仅打包版本；开发与 E2E 不访问网络）
      if (app.isPackaged && !process.env.MOLI_E2E_USER_DATA) {
        setTimeout(() => {
          this.updateService.check({ manual: false }).catch((error) => {
            console.warn('自动检查更新失败:', error);
          });
        }, 15000);
      }

      console.log('MoliTodo Vue 应用已启动');
      
      // 应用完全启动后的初始化任务
      setTimeout(async () => {
        try {
          // 检测首次启动并创建用户引导任务
          await this.handleFirstLaunchSetup();

          // 任务时间模型升级的一次性说明
          await this.showTimeModelUpgradeNotice();

          // 初始化任务状态日志
          if (this.taskStatusLogService) {
            console.log('开始初始化任务状态日志...');
            const initResult = await this.taskStatusLogService.initializeExistingTasksLogs(false); // 强制重新初始化
            
            if (initResult.initialized > 0 || initResult.skipped > 0) {
              console.log(`任务状态日志初始化完成: 初始化了 ${initResult.initialized} 个任务，跳过了 ${initResult.skipped} 个任务，错误 ${initResult.errors} 个`);
            } else {
              console.log('任务状态日志无需初始化');
            }
          }
          
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
      
      // 初始化任务状态日志仓储（使用相同的数据库连接）
      this.taskStatusLogRepository = new SqliteTaskStatusLogRepository(this.taskRepository.db);
      
      // 初始化任务状态日志服务
      this.taskStatusLogService = new TaskStatusLogService(this.taskStatusLogRepository, this.taskRepository);
      
      // 初始化服务（注入状态日志服务）
      this.taskService = new TaskService(this.taskRepository, null, this.taskStatusLogService);
      this.listService = new ListService(this.listRepository, this.taskRepository);
      
      console.log('业务服务初始化完成 - 使用 SQLite');
    } catch (error) {
      console.error('SQLite 初始化失败，回退到文件存储:', error);
      console.error('错误详情:', error.stack);
      
      try {
        // 回退到文件存储
        this.taskRepository = new FileTaskRepository();
        await this.taskRepository.initialize();
        
        // 文件存储模式下的服务初始化
        this.taskService = new TaskService(this.taskRepository);
        this.listService = null; // 文件存储暂不支持清单
        this.taskStatusLogService = null; // 文件存储暂不支持状态日志
        
        console.log('业务服务初始化完成 - 使用文件存储（功能受限：不支持清单和状态日志）');
        console.warn('注意：当前使用文件存储模式，部分功能可能不可用');
      } catch (fallbackError) {
        console.error('文件存储初始化也失败:', fallbackError);
        console.error('文件存储错误详情:', fallbackError.stack);
        throw new Error(`数据存储初始化失败: SQLite错误(${error.message}) 和 文件存储错误(${fallbackError.message})`);
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
        if (this.toolsRuntime) {
          this.toolsRuntime.dispose();
        }
        if (this.localApiServer) {
          this.localApiServer.dispose().catch(console.error);
        }
        
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
      // E2E 测试使用干净数据库，不注入引导任务
      if (process.env.MOLI_E2E_USER_DATA) {
        this.windowManager.markFirstLaunchCompleted();
        return;
      }

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

  /**
   * 任务时间模型升级的一次性提示：
   * 旧版本中仅有提醒的任务会自动占据日历日期，升级后不再如此。
   * 提醒本身不受影响；老用户存在这类任务时提示一次。
   */
  async showTimeModelUpgradeNotice() {
    try {
      if (!this.windowManager || !this.windowManager.configStore) return;
      if (this.windowManager.configStore.get('timeModelUpgradeNoticeShown', false)) return;
      // 新用户没有旧展示习惯，无需提示
      if (this.windowManager.isFirstLaunch()) return;

      this.windowManager.configStore.set('timeModelUpgradeNoticeShown', true);

      const tasks = await this.taskService.getAllTasks();
      const affected = tasks.filter((task) => {
        if (!task.reminderTime || task.status === 'done') return false;
        return !task.scheduledStartAt && !task.dueDate;
      });
      if (!affected.length) return;

      const { Notification } = require('electron');
      if (!Notification.isSupported()) return;
      const notice = new Notification({
        title: '任务时间模型已升级',
        body: `你有 ${affected.length} 个仅设置提醒的任务：提醒仍然有效，但不再自动显示在日历日期上。可在编辑任务时补充"安排"或"截止"。`
      });
      notice.show();
    } catch (error) {
      console.error('时间模型升级提示失败:', error);
    }
  }

  // 添加方法供 WindowManager 调用来退出应用
  quit() {
    this.isQuitting = true;
    this.notificationService.clearAllSchedules();
    if (this.localApiServer) {
      this.localApiServer.dispose().catch(console.error);
    }
    app.quit();
  }
}

// 创建应用实例并初始化
const moliTodoApp = new MoliTodoApp();
moliTodoApp.initialize().catch(console.error);
