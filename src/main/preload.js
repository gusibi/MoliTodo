const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 IPC 接口给渲染进程
const electronAPI = {
  // 任务相关 API
  tasks: {
    getAll: () => ipcRenderer.invoke('get-all-tasks'),
    getIncomplete: () => ipcRenderer.invoke('get-tasks'),
    getCompleted: () => ipcRenderer.invoke('get-completed-tasks'),
    create: (taskData) => ipcRenderer.invoke('create-task', taskData),
    createRecurring: (taskData) => ipcRenderer.invoke('task:createRecurring', taskData),
    generateTaskList: (content, aiModel, listId) => ipcRenderer.invoke('generate-task-list', content, aiModel, listId),
    streamGenerateTaskList: (content, aiModel, listId, shouldSplitTask) => ipcRenderer.invoke('stream-generate-task-list', content, aiModel, listId, shouldSplitTask),
    update: (taskId, updates) => ipcRenderer.invoke('update-task', taskId, updates),
    complete: (taskId) => ipcRenderer.invoke('complete-task', taskId),
    delete: (taskId) => ipcRenderer.invoke('delete-task', taskId),
    start: (taskId) => ipcRenderer.invoke('start-task', taskId),
    pause: (taskId) => ipcRenderer.invoke('pause-task', taskId),
    completeWithTracking: (taskId) => ipcRenderer.invoke('complete-task-with-tracking', taskId),
    getStats: () => ipcRenderer.invoke('get-task-stats'),
    getCount: () => ipcRenderer.invoke('get-task-count'),
    setReminder: (taskId, reminderTime) => ipcRenderer.invoke('set-task-reminder', taskId, reminderTime),
    clearReminder: (taskId) => ipcRenderer.invoke('clear-task-reminder', taskId),
    getLastUpdatedTime: () => ipcRenderer.invoke('task:getLastUpdatedTime'),
    // 重复任务相关 API
    getRecurring: () => ipcRenderer.invoke('task:getRecurring'),
    expandRecurring: (params) => ipcRenderer.invoke('task:expandRecurring', params),
    updateRecurring: (params) => ipcRenderer.invoke('task:updateRecurring', params),
    completeRecurringInstance: (params) => ipcRenderer.invoke('task:completeRecurringInstance', params),
    deleteRecurringInstance: (params) => ipcRenderer.invoke('task:deleteRecurringInstance', params),
    updateRecurringInstance: (params) => ipcRenderer.invoke('task:updateRecurringInstance', params),
    deleteRecurringSeries: (params) => ipcRenderer.invoke('task:deleteRecurringSeries', params),
    getNextOccurrences: (params) => ipcRenderer.invoke('task:getNextOccurrences', params)
  },

  // 配置相关 API
  config: {
    get: () => ipcRenderer.invoke('get-config'),
    getAll: () => ipcRenderer.invoke('get-config'),
    set: (key, value) => ipcRenderer.invoke('update-config', key, value),
    update: (key, value) => ipcRenderer.invoke('update-config', key, value),
    save: () => ipcRenderer.invoke('save-config'),
    reset: () => ipcRenderer.invoke('reset-config')
  },

  // AI 相关 API
  ai: {
    testConnection: (config) => ipcRenderer.invoke('test-ai-connection', config),
    testConnectionByModel: (aiModel) => ipcRenderer.invoke('test-ai-connection-by-model', aiModel),
    generateReport: (params) => ipcRenderer.invoke('ai:generate-report', params),
    streamGenerateReport: (params) => ipcRenderer.invoke('ai:stream-generate-report', params),
    getConfig: () => ipcRenderer.invoke('ai:get-config'),
    getSelectedModel: () => ipcRenderer.invoke('ai:get-selected-model'),
    // 监听流式数据
    onReportStreamChunk: (callback) => {
      ipcRenderer.on('ai:report-stream-chunk', (event, content) => callback(content));
    },
    removeReportStreamListener: () => {
      ipcRenderer.removeAllListeners('ai:report-stream-chunk');
    }
  },

  // 窗口相关 API
  windows: {
    showTaskManager: () => ipcRenderer.invoke('show-task-manager'),
    showSettings: () => ipcRenderer.invoke('show-settings'),
    toggleTaskPanel: () => ipcRenderer.invoke('toggle-task-panel'),
    showTaskPanel: () => ipcRenderer.invoke('show-task-panel'),
    hideTaskPanel: () => ipcRenderer.invoke('hide-task-panel'),
    panelMouseEnter: () => ipcRenderer.invoke('panel-mouse-enter'),
    panelMouseLeave: () => ipcRenderer.invoke('panel-mouse-leave'),
    createFloatingTask: (taskId) => ipcRenderer.invoke('create-floating-task', taskId),
    closeFloatingTask: (taskId) => ipcRenderer.invoke('close-floating-task', taskId),
    resizeFloatingTaskWindow: (taskId, height) => ipcRenderer.invoke('resize-floating-task-window', taskId, height),
    // 窗口控制 API
    minimize: (windowType) => ipcRenderer.invoke('window-minimize', windowType),
    maximize: (windowType) => ipcRenderer.invoke('window-maximize', windowType),
    close: (windowType) => ipcRenderer.invoke('window-close', windowType),
    isMaximized: (windowType) => ipcRenderer.invoke('window-is-maximized', windowType)
  },

  // 数据管理 API
  data: {
    export: () => ipcRenderer.invoke('export-data'),
    import: () => ipcRenderer.invoke('import-data'),
    clear: () => ipcRenderer.invoke('clear-all-data'),
    getStats: () => ipcRenderer.invoke('get-database-stats')
  },

  // 应用相关 API
  app: {
    updateAppIcon: (iconPath) => ipcRenderer.invoke('update-app-icon', iconPath)
  },

  // 事件监听 API
  events: {
    on: (channel, callback) => {
      const validChannels = [
        'tasks-updated',
        'task-updated',
        'lists-updated',
        'config-updated',
        'task-reminder',
        'panel-mouse-enter',
        'panel-mouse-leave',
        'play-notification-sound'
      ];

      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, callback);
      }
    },

    off: (channel, callback) => {
      ipcRenderer.removeListener(channel, callback);
    },

    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // 通知音效 API
  onPlayNotificationSound: (callback) => {
    ipcRenderer.on('play-notification-sound', callback);
  },

  // 流式任务生成事件监听 API
  onStreamTaskGenerationChunk: (callback) => {
    ipcRenderer.on('stream-task-generation-chunk', callback);
  },
  onStreamTaskGenerationComplete: (callback) => {
    ipcRenderer.on('stream-task-generation-complete', callback);
  },
  onStreamTaskGenerationError: (callback) => {
    ipcRenderer.on('stream-task-generation-error', callback);
  },
  removeStreamTaskGenerationListeners: () => {
    ipcRenderer.removeAllListeners('stream-task-generation-chunk');
    ipcRenderer.removeAllListeners('stream-task-generation-complete');
    ipcRenderer.removeAllListeners('stream-task-generation-error');
  },

  // 拖拽相关 API
  drag: {
    getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
    startDrag: (position) => ipcRenderer.invoke('start-drag', position),
    dragWindow: (position) => ipcRenderer.invoke('drag-window', position),
    endDrag: () => ipcRenderer.invoke('end-drag')
  },

  // 工具 API
  utils: {
    log: (message, ...args) => ipcRenderer.invoke('log-message', message, ...args),
    getResourcePath: (resourcePath) => ipcRenderer.invoke('get-resource-path', resourcePath)
  },

  // 通用 IPC 调用 API（用于清单等新功能）
  invoke: (channel, ...args) => {
    // 定义允许的 IPC 通道
    const allowedChannels = [
      // 清单相关
      'list:getAll',
      'list:getById',
      'list:create',
      'list:update',
      'list:delete',
      'list:getTasks',
      'list:getTaskStats',
      'list:getAllTaskCounts',
      'list:reorder',
      'list:search',
      // 任务清单相关
      'task:moveToList',
      'task:batchMoveToList',
      'task:updateMetadata',
      'task:setComment',
      'task:getByCategory',
      'task:search',
      'task:getTimeInfo'
    ];

    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    } else {
      throw new Error(`IPC channel "${channel}" is not allowed`);
    }
  }
};

// 使用 contextBridge 安全地暴露 API
contextBridge.exposeInMainWorld('electronAPI', electronAPI);