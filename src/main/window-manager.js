const { BrowserWindow, screen, nativeImage, Tray, Menu, app } = require('electron');
const path = require('path');
const Store = require('electron-store');

class WindowManager {
  constructor(appInstance = null) {
    this.floatingWindow = null;
    this.taskPanelWindow = null;
    this.taskManagerWindow = null;
    this.settingsWindow = null;
    this.floatingTaskWindows = new Map(); // 存储悬浮任务窗口
    this.tray = null;
    this.appInstance = appInstance;
    this.taskService = null; // 将在main.js中设置

    this.configStore = new Store({
      name: 'config',
      defaults: {
        // 首次启动检测
        isFirstLaunch: true,
        userGuideCompleted: false,
        floatingIcon: {
          x: 100,
          y: 100,
          size: 50,
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
      }
    });

    // 获取开发服务器端口
    this.devPort = process.env.VITE_DEV_PORT || '5173';
    this.devBaseUrl = `http://localhost:${this.devPort}`;
  }

  async initialize() {
    this.createFloatingWindow();
    this.createTray();

    // 延迟更新托盘菜单，确保taskService已经完全初始化
    setTimeout(() => {
      if (this.tray && this.taskService) {
        console.log('延迟更新托盘菜单...');
        this.updateTrayMenu().catch(console.error);
      }
    }, 1000);
  }

  createFloatingWindow() {
    const config = this.configStore.get('floatingIcon');
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const x = Math.min(Math.max(config.x, 0), width - config.size);
    const y = Math.min(Math.max(config.y, 0), height - config.size);

    this.floatingWindow = new BrowserWindow({
      width: config.size,
      height: config.size,
      x: x,
      y: y,
      frame: false,
      transparent: true, // 设置窗口为透明背景
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        enableRemoteModule: false,
        nodeIntegration: false
      }
    });

    // 开发环境加载开发服务器，生产环境加载构建文件
    if (process.env.NODE_ENV === 'development') {
      this.floatingWindow.loadURL(this.devBaseUrl).catch(error => {
        console.error('无法加载开发服务器:', error);
        // 尝试加载本地文件作为后备
        const fallbackPath = path.join(__dirname, '../renderer/dist/index.html');
        if (require('fs').existsSync(fallbackPath)) {
          this.floatingWindow.loadFile(fallbackPath);
        }
      });
    } else {
      this.floatingWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
    }

    this.floatingWindow.once('ready-to-show', () => {
      this.floatingWindow.show();
      this.applyFloatingIconConfig();

      // 开发环境下开启开发者工具用于调试
      if (process.env.NODE_ENV === 'development') {
        this.floatingWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });

    this.floatingWindow.on('moved', () => {
      const [x, y] = this.floatingWindow.getPosition();
      this.configStore.set('floatingIcon.x', x);
      this.configStore.set('floatingIcon.y', y);
    });

    this.floatingWindow.on('closed', () => {
      this.floatingWindow = null;
    });
  }

  createTaskManagerWindow() {
    if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
      this.taskManagerWindow.focus();
      return;
    }

    const currentIcon = this.getCurrentAppIcon();

    this.taskManagerWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      title: 'MoliTodo - 任务管理',
      icon: currentIcon,
      frame: false, // 禁用原生标题栏
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden', // macOS 保留红绿灯按钮
      show: false,
      vibrancy: 'sidebar',
      transparent: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    });

    if (process.env.NODE_ENV === 'development') {
      this.taskManagerWindow.loadURL(`${this.devBaseUrl}/#/task-manager`);
    } else {
      this.taskManagerWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'), {
        hash: 'task-manager'
      });
    }

    this.taskManagerWindow.once('ready-to-show', () => {
      this.taskManagerWindow.show();
    });

    this.taskManagerWindow.on('closed', () => {
      this.taskManagerWindow = null;
    });
  }

  createSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus();
      return;
    }

    const currentIcon = this.getCurrentAppIcon();

    this.settingsWindow = new BrowserWindow({
      width: 900,
      height: 650,
      resizable: false,
      title: '设置',
      icon: currentIcon,
      frame: false, // 禁用原生标题栏
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden', // macOS 保留红绿灯按钮
      show: false,
      transparent: true,
      vibrancy: 'under-window', // 毛玻璃效果
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    });

    if (process.env.NODE_ENV === 'development') {
      this.settingsWindow.loadURL(`${this.devBaseUrl}/#/settings`);
    } else {
      this.settingsWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'), {
        hash: 'settings'
      });
    }

    this.settingsWindow.once('ready-to-show', () => {
      this.settingsWindow.show();
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

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
    const maxHeight = Math.min(480, workArea.height * 0.7);
    if (panelY + maxHeight > workArea.y + workArea.height) {
      panelY = workArea.y + workArea.height - maxHeight;
    }

    const currentIcon = this.getCurrentAppIcon();

    this.taskPanelWindow = new BrowserWindow({
      width: 320,
      height: maxHeight,
      x: panelX,
      y: panelY,
      icon: currentIcon,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      vibrancy: 'sidebar', // 毛玻璃效果
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    });

    if (process.env.NODE_ENV === 'development') {
      this.taskPanelWindow.loadURL(`${this.devBaseUrl}/#/task-panel`);
    } else {
      this.taskPanelWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'), {
        hash: 'task-panel'
      });
    }

    this.taskPanelWindow.once('ready-to-show', () => {
      this.taskPanelWindow.show();
    });

    // 面板关闭时清理引用
    this.taskPanelWindow.on('closed', () => {
      this.taskPanelWindow = null;
    });
  }

  toggleTaskPanel() {
    if (this.taskPanelWindow && !this.taskPanelWindow.isDestroyed()) {
      this.taskPanelWindow.close();
    } else {
      this.createTaskPanel();
    }
  }

  createTray() {
    try {
      // 在开发环境和生产环境下使用不同的路径
      let trayIconPath;
      if (process.env.NODE_ENV === 'development') {
        trayIconPath = path.join(__dirname, '../../resources/tray-icon.png');
      } else {
        // 在打包后的应用中，资源文件位于应用根目录的 resources 文件夹
        trayIconPath = path.join(process.resourcesPath, 'resources/tray-icon.png');
      }

      // 检查图标文件是否存在
      const fs = require('fs');
      if (!fs.existsSync(trayIconPath)) {
        console.warn('托盘图标文件不存在，跳过托盘创建');
        console.warn('尝试的路径:', trayIconPath);
        return;
      }

      const image = nativeImage.createFromPath(trayIconPath);

      // 检查图像是否为空
      if (image.isEmpty()) {
        console.warn('托盘图标为空，跳过托盘创建');
        return;
      }

      const resizedImage = image.resize({ width: 16, height: 16 });

      this.tray = new Tray(resizedImage);
      this.tray.setToolTip('MoliTodo - 悬浮待办');

      this.updateTrayMenu().catch(console.error);

      this.tray.on('click', () => {
        this.tray.popUpContextMenu();
      });
    } catch (error) {
      console.warn('无法创建系统托盘:', error.message);
    }
  }

  async updateTrayMenu() {
    const floatingIconVisible = this.configStore.get('floatingIcon.visible', true);

    // 获取今日任务数量
    let todayTaskCount = 0;
    try {
      if (this.taskService) {
        const allTasks = await this.taskService.getAllTasks();

        // 计算今日任务数量（与FloatingIcon.vue保持一致的逻辑）
        const todayTasks = allTasks.filter(task => {
          // 提醒日期是今天的任务
          if (this.isToday(task.reminderTime)) return true;
          // 今天创建的任务
          if (this.isToday(task.createdAt)) return true;
          // 正在进行的任务
          if (task.status === 'doing') return true;
          // 有提醒时间，且已经过期还未完成的任务
          if (task.reminderTime && task.status !== 'done') {
            const reminderDate = new Date(task.reminderTime);
            const today = new Date();
            if (reminderDate < today && !this.isToday(task.reminderTime)) {
              return true;
            }
          }
          return false;
        });

        // 过滤掉已完成的任务（与FloatingIcon.vue保持一致）
        todayTaskCount = todayTasks.filter(task => task.status !== 'done').length;
        console.log('托盘菜单更新 - 今日未完成任务数量:', todayTaskCount);
      }
    } catch (error) {
      console.error('获取今日任务数量失败:', error);
    }

    // 构建菜单标签
    const taskManagerLabel = todayTaskCount > 0 ? `任务管理 (${todayTaskCount > 99 ? '99+' : todayTaskCount})` : '任务管理';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: floatingIconVisible ? '隐藏悬浮图标' : '显示悬浮图标',
        click: () => {
          const newVisible = !floatingIconVisible;
          this.configStore.set('floatingIcon.visible', newVisible);
          this.applyFloatingIconConfig();
          this.updateTrayMenu().catch(console.error);
        }
      },
      { type: 'separator' },
      {
        label: taskManagerLabel,
        click: () => this.createTaskManagerWindow()
      },
      {
        label: '设置',
        click: () => this.createSettingsWindow()
      },
      { type: 'separator' },
      {
        label: '退出 MoliTodo',
        click: () => {
          this.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);

    // 更新托盘工具提示显示任务数量
    const tooltipText = todayTaskCount > 0
      ? `MoliTodo - 悬浮待办 (今日任务: ${todayTaskCount > 99 ? '99+' : todayTaskCount})`
      : 'MoliTodo - 悬浮待办';
    this.tray.setToolTip(tooltipText);

    // 在macOS上，尝试设置托盘标题显示数字
    if (process.platform === 'darwin' && this.tray) {
      if (todayTaskCount > 0) {
        const displayCount = todayTaskCount > 99 ? '99+' : todayTaskCount.toString();
        this.tray.setTitle(displayCount);
        console.log('托盘标题已更新，显示数字:', displayCount);
      } else {
        this.tray.setTitle('');
        console.log('清除托盘标题');
      }
    }

    // 暂时注释掉图标更新，确保原图标正常显示
    // if (this.tray) {
    //   const iconWithBadge = this.createTrayIconWithBadge(todayTaskCount);
    //   if (iconWithBadge) {
    //     this.tray.setImage(iconWithBadge);
    //     console.log('托盘图标已更新，显示数字:', todayTaskCount);
    //   } else {
    //     console.log('创建带数字的图标失败，保持原图标');
    //   }
    // }
  }

  // 辅助函数：判断日期是否为今天
  isToday(date) {
    if (!date) return false;
    const today = new Date();
    const targetDate = new Date(date);
    return today.toDateString() === targetDate.toDateString();
  }

  // 手动刷新托盘菜单（用于调试）
  async refreshTrayMenu() {
    if (this.tray) {
      console.log('手动刷新托盘菜单...');
      await this.updateTrayMenu();
    } else {
      console.log('托盘不存在，无法刷新');
    }
  }

  // 创建带有数字角标的托盘图标
  createTrayIconWithBadge(count = 0) {
    try {
      let trayIconPath;
      if (process.env.NODE_ENV === 'development') {
        trayIconPath = path.join(__dirname, '../../resources/tray-icon.png');
      } else {
        // 在打包后的应用中，资源文件位于应用根目录的 resources 文件夹
        trayIconPath = path.join(process.resourcesPath, 'resources/tray-icon.png');
      }
      const fs = require('fs');

      // 先确保原始图标存在并可用
      if (!fs.existsSync(trayIconPath)) {
        console.warn('托盘图标文件不存在，路径:', trayIconPath);
        return null;
      }

      let baseImage = nativeImage.createFromPath(trayIconPath);
      if (baseImage.isEmpty()) {
        console.warn('托盘图标为空');
        return null;
      }

      // 如果没有任务数量，直接返回原图标
      if (count <= 0) {
        console.log('没有任务，返回原始图标');
        return baseImage.resize({ width: 16, height: 16 });
      }

      // 尝试使用简单的PNG生成方法
      try {
        console.log('尝试创建带数字的图标，任务数:', count);

        // 创建一个简单的16x16像素的图标
        const displayCount = count > 99 ? '99+' : count.toString();

        // 使用更简单的方法：创建一个基于原图标的副本，然后尝试添加文字
        // 如果失败，就返回原图标
        const resizedBase = baseImage.resize({ width: 16, height: 16 });

        // 暂时返回原图标，但在控制台显示我们正在处理数字
        console.log('返回原始图标，数字:', displayCount);
        return resizedBase;

      } catch (numberError) {
        console.log('数字图标创建失败，返回原图标:', numberError.message);
        return baseImage.resize({ width: 16, height: 16 });
      }

    } catch (error) {
      console.error('创建托盘图标失败:', error);
      return null;
    }
  }



  applyFloatingIconConfig() {
    if (!this.floatingWindow || this.floatingWindow.isDestroyed()) {
      return;
    }

    const config = this.configStore.get('floatingIcon');

    this.floatingWindow.setSize(config.size, config.size);
    this.floatingWindow.setOpacity(config.opacity / 100);

    if (config.visible) {
      this.floatingWindow.show();
    } else {
      this.floatingWindow.hide();
    }

    // 通知渲染进程配置更新
    this.floatingWindow.webContents.send('config-updated', config);
  }

  hasWindows() {
    return !!(this.floatingWindow || this.taskManagerWindow || this.settingsWindow);
  }

  getConfig() {
    return this.configStore.store;
  }

  updateConfig(key, value) {
    this.configStore.set(key, value);

    if (key.startsWith('floatingIcon.')) {
      this.applyFloatingIconConfig();
    }

    return this.configStore.get(key);
  }

  // 检测是否为首次启动
  isFirstLaunch() {
    return this.configStore.get('isFirstLaunch', true);
  }

  // 标记首次启动完成
  markFirstLaunchCompleted() {
    this.configStore.set('isFirstLaunch', false);
  }

  // 检测用户引导是否完成
  isUserGuideCompleted() {
    return this.configStore.get('userGuideCompleted', false);
  }

  // 标记用户引导完成
  markUserGuideCompleted() {
    this.configStore.set('userGuideCompleted', true);
  }

  // 获取当前应用图标
  getCurrentAppIcon() {
    const selectedLogo = this.configStore.get('selectedLogo', 'default');
    let iconPath;

    // 根据选中的logo ID获取对应的资源路径
    const logoMap = {
      'icon-3': 'resources/icon-3.png',
      'default': 'resources/icon.png',
      'icon-v1': 'resources/icon-v1.png',
      'icon-1': 'resources/icon-1.png',
      'icon-2': 'resources/icon-2.png',
      'icon-4': 'resources/icon-4.png'
    };

    const resourcePath = logoMap[selectedLogo] || logoMap['default'];

    if (process.env.NODE_ENV === 'development') {
      iconPath = path.join(__dirname, '../../', resourcePath);
    } else {
      iconPath = path.join(process.resourcesPath, resourcePath);
    }

    try {
      return nativeImage.createFromPath(iconPath);
    } catch (error) {
      console.warn('无法加载应用图标，使用默认图标:', error);
      return null;
    }
  }

  // 窗口控制方法
  minimizeWindow(windowType) {
    const window = this.getWindowByType(windowType);
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
  }

  maximizeWindow(windowType) {
    const window = this.getWindowByType(windowType);
    if (window && !window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  }

  closeWindow(windowType) {
    const window = this.getWindowByType(windowType);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  isWindowMaximized(windowType) {
    const window = this.getWindowByType(windowType);
    return window && !window.isDestroyed() ? window.isMaximized() : false;
  }

  getWindowByType(windowType) {
    switch (windowType) {
      case 'taskManager':
        return this.taskManagerWindow;
      case 'settings':
        return this.settingsWindow;
      default:
        return null;
    }
  }

  createFloatingTask(taskId) {
    // 如果已经存在该任务的悬浮窗口，则聚焦它
    if (this.floatingTaskWindows.has(taskId)) {
      const existingWindow = this.floatingTaskWindows.get(taskId);
      if (!existingWindow.isDestroyed()) {
        existingWindow.focus();
        return;
      } else {
        this.floatingTaskWindows.delete(taskId);
      }
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // 随机位置，避免重叠
    const x = Math.floor(Math.random() * (width - 280)) + 20;
    const y = Math.floor(Math.random() * (height - 200)) + 20;

    const currentIcon = this.getCurrentAppIcon();

    const floatingTaskWindow = new BrowserWindow({
      width: 420, // 扩大窗口宽度以适配内容
      height: 80, // 初始高度
      maxHeight: 140, // 最大高度限制
      minHeight: 80, // 最小高度限制
      x: x,
      y: y,
      icon: currentIcon,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true, // 允许调整大小以适应内容
      movable: true, // 允许移动
      show: false,
      vibrancy: 'sidebar', // 毛玻璃效果
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        enableRemoteModule: false,
        nodeIntegration: false
      }
    });

    if (process.env.NODE_ENV === 'development') {
      floatingTaskWindow.loadURL(`${this.devBaseUrl}/#/floating-task/${taskId}`);
      floatingTaskWindow.webContents.openDevTools({ mode: 'detach' });

    } else {
      floatingTaskWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'), {
        hash: `floating-task/${taskId}`
      });
    }

    floatingTaskWindow.once('ready-to-show', () => {
      floatingTaskWindow.show();
    });

    floatingTaskWindow.on('closed', () => {
      this.floatingTaskWindows.delete(taskId);
    });

    this.floatingTaskWindows.set(taskId, floatingTaskWindow);
  }

  closeFloatingTask(taskId) {
    const window = this.floatingTaskWindows.get(taskId);
    if (window && !window.isDestroyed()) {
      window.close();
    }
    this.floatingTaskWindows.delete(taskId);
  }

  resizeFloatingTaskWindow(taskId, height) {
    const window = this.floatingTaskWindows.get(taskId);
    if (window && !window.isDestroyed()) {
      const [width] = window.getSize();
      const constrainedHeight = Math.min(Math.max(height, 80), 140);
      // console.log(`调整悬浮任务窗口 ${taskId} 高度: ${height} -> ${constrainedHeight}`);
      window.setSize(width, constrainedHeight);
    }
  }

  quit() {
    // Clean up windows before quitting
    if (this.taskPanelWindow && !this.taskPanelWindow.isDestroyed()) {
      this.taskPanelWindow.close();
    }
    if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
      this.taskManagerWindow.close();
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close();
    }

    // Close all floating task windows
    this.floatingTaskWindows.forEach((window, taskId) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.floatingTaskWindows.clear();

    // Force close floating window even if closable is false
    if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
      this.floatingWindow.setClosable(true);
      this.floatingWindow.close();
    }

    // Destroy tray
    if (this.tray) {
      this.tray.destroy();
    }

    // Use app instance if available, otherwise fallback to direct app.quit()
    if (this.appInstance && typeof this.appInstance.quit === 'function') {
      this.appInstance.quit();
    } else {
      app.quit();
    }
  }

  // 清理窗口但不退出应用（用于 before-quit 事件）
  cleanup() {
    // Clean up windows
    if (this.taskPanelWindow && !this.taskPanelWindow.isDestroyed()) {
      this.taskPanelWindow.close();
    }
    if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
      this.taskManagerWindow.close();
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close();
    }

    // Close all floating task windows
    this.floatingTaskWindows.forEach((window, taskId) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.floatingTaskWindows.clear();

    // Force close floating window even if closable is false
    if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
      this.floatingWindow.setClosable(true);
      this.floatingWindow.close();
    }

    // Destroy tray
    if (this.tray) {
      this.tray.destroy();
    }
  }
}

module.exports = WindowManager;