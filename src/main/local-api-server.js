const http = require('http');
const { URL } = require('url');

class LocalApiServer {
  constructor({ taskService, listService, notificationService, windowManager }) {
    this.taskService = taskService;
    this.listService = listService;
    this.notificationService = notificationService;
    this.windowManager = windowManager;
    this.server = null;
    this.state = {
      enabled: false,
      running: false,
      host: '127.0.0.1',
      port: 1234,
      baseUrl: 'http://127.0.0.1:1234',
      docsUrl: 'http://127.0.0.1:1234/api/docs',
      openApiUrl: 'http://127.0.0.1:1234/api/openapi.json',
      lastError: null
    };
  }

  async initialize() {
    await this.applyConfig(this.windowManager.getConfig());
  }

  async applyConfig(config = {}) {
    const apiConfig = this.normalizeConfig(config.apiServer || {});
    const shouldRestart = (
      this.state.host !== apiConfig.host ||
      this.state.port !== apiConfig.port ||
      this.state.enabled !== apiConfig.enabled
    );

    this.state = {
      ...this.state,
      ...apiConfig,
      running: this.isRunning(),
      lastError: shouldRestart ? null : this.state.lastError
    };

    if (!shouldRestart) {
      return this.getState();
    }

    if (!apiConfig.enabled) {
      await this.stop();
      return this.getState();
    }

    await this.restart();
    return this.getState();
  }

  normalizeConfig(apiConfig = {}) {
    const host = apiConfig.host === 'localhost' ? '127.0.0.1' : (apiConfig.host || '127.0.0.1');
    const parsedPort = Number.parseInt(apiConfig.port, 10);
    const port = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? parsedPort : 1234;
    const enabled = Boolean(apiConfig.enabled);
    const baseUrl = `http://${host}:${port}`;

    return {
      enabled,
      host,
      port,
      baseUrl,
      docsUrl: `${baseUrl}/api/docs`,
      openApiUrl: `${baseUrl}/api/openapi.json`
    };
  }

  getState() {
    return {
      ...this.state,
      running: this.isRunning()
    };
  }

  isRunning() {
    return Boolean(this.server && this.server.listening);
  }

  async restart() {
    await this.stop();
    await this.start();
  }

  async start() {
    if (!this.state.enabled) {
      return this.getState();
    }

    this.server = http.createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        console.error('[LocalApiServer] 请求处理失败:', error);
        this.sendError(response, 500, error.message || 'Internal server error');
      });
    });

    this.server.on('error', (error) => {
      console.error('[LocalApiServer] 服务异常:', error);
      this.state.lastError = error.message;
    });

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.state.port, this.state.host, () => {
        this.server.off('error', reject);
        resolve();
      });
    });

    this.state.running = true;
    this.state.lastError = null;
    console.log(`[LocalApiServer] 已启动: ${this.state.baseUrl}`);
    return this.getState();
  }

  async stop() {
    if (!this.server) {
      this.state.running = false;
      return this.getState();
    }

    const currentServer = this.server;
    this.server = null;

    await new Promise((resolve, reject) => {
      currentServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }).catch((error) => {
      console.error('[LocalApiServer] 关闭服务失败:', error);
      this.state.lastError = error.message;
    });

    this.state.running = false;
    return this.getState();
  }

  async dispose() {
    await this.stop();
  }

  async handleRequest(request, response) {
    this.setCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url, this.state.baseUrl);
    const { pathname, searchParams } = url;

    if (pathname === '/' || pathname === '/api') {
      this.sendJson(response, 200, {
        name: 'MoliTodo Local API',
        version: '1.0.0',
        baseUrl: this.state.baseUrl,
        docsUrl: this.state.docsUrl,
        openApiUrl: this.state.openApiUrl
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      this.sendJson(response, 200, {
        ok: true,
        server: 'MoliTodo Local API',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/docs') {
      this.sendJson(response, 200, this.buildDocs());
      return;
    }

    if (request.method === 'GET' && pathname === '/api/openapi.json') {
      this.sendJson(response, 200, this.buildOpenApiSpec());
      return;
    }

    if (request.method === 'GET' && pathname === '/api/lists') {
      this.ensureListService();
      const lists = await this.listService.getAllLists();
      this.sendJson(response, 200, {
        success: true,
        data: lists.map((list) => list.toJSON())
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/lists') {
      this.ensureListService();
      const body = await this.readJsonBody(request);
      const list = await this.listService.createList(body.name, body.color, body.icon);
      this.sendJson(response, 201, {
        success: true,
        data: list.toJSON()
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/tasks') {
      const tasks = await this.queryTasks(searchParams);
      this.sendJson(response, 200, {
        success: true,
        data: tasks.map((task) => this.serializeTask(task))
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/tasks') {
      const body = await this.readJsonBody(request);
      const task = await this.createTaskFromRequest(body);
      this.sendJson(response, 201, {
        success: true,
        data: this.serializeTask(task)
      });
      return;
    }

    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const taskId = decodeURIComponent(taskMatch[1]);

      if (request.method === 'PATCH') {
        const body = await this.readJsonBody(request);
        const task = await this.taskService.updateTask(taskId, body);
        await this.syncReminder(taskId, body, task);
        this.sendJson(response, 200, {
          success: true,
          data: this.serializeTask(task)
        });
        return;
      }

      if (request.method === 'DELETE') {
        const success = await this.taskService.deleteTask(taskId);
        this.notificationService.cancelTaskReminder(taskId);
        this.sendJson(response, 200, {
          success
        });
        return;
      }
    }

    const taskActionMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/(start|pause|complete)$/);
    if (taskActionMatch && request.method === 'POST') {
      const taskId = decodeURIComponent(taskActionMatch[1]);
      const action = taskActionMatch[2];
      const task = await this.runTaskAction(taskId, action);
      this.sendJson(response, 200, {
        success: true,
        data: this.serializeTask(task)
      });
      return;
    }

    this.sendError(response, 404, 'API route not found');
  }

  async queryTasks(searchParams) {
    const status = searchParams.get('status');
    const listIdValue = searchParams.get('listId');
    const category = searchParams.get('category');
    const query = searchParams.get('query');
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    let tasks;

    if (query) {
      tasks = await this.taskService.searchTasks(query, this.parseOptionalListId(listIdValue));
    } else if (category) {
      tasks = await this.taskService.getTasksByCategory(category, this.parseOptionalListId(listIdValue));
    } else if (listIdValue !== null) {
      tasks = await this.taskService.getTasksByListId(this.parseRequiredListId(listIdValue));
    } else if (includeCompleted) {
      tasks = await this.taskService.getAllTasks();
    } else {
      tasks = await this.taskService.getIncompleteTasks();
    }

    if (!status) {
      return tasks;
    }

    return tasks.filter((task) => task.status === status);
  }

  async createTaskFromRequest(body = {}) {
    if (!body || typeof body !== 'object') {
      throw new Error('请求体必须是 JSON 对象');
    }

    const taskData = {
      content: body.content,
      reminderTime: body.reminderTime || null,
      listId: body.listId ?? 0,
      metadata: body.metadata || {},
      recurrence: body.recurrence || null,
      dueDate: body.dueDate || null,
      dueTime: body.dueTime || null
    };

    const reminderTime = taskData.reminderTime ? new Date(taskData.reminderTime) : null;
    const task = await this.taskService.createTaskInList(
      taskData.content,
      Number.parseInt(taskData.listId, 10) || 0,
      reminderTime,
      taskData
    );

    if (task.reminderTime) {
      this.notificationService.scheduleTaskReminder(task, (scheduledTask) => {
        this.handleTaskReminder(scheduledTask);
      });
    }

    return task;
  }

  async runTaskAction(taskId, action) {
    if (action === 'start') {
      return this.taskService.startTask(taskId);
    }

    if (action === 'pause') {
      return this.taskService.pauseTask(taskId);
    }

    if (action === 'complete') {
      const task = await this.taskService.completeTaskWithTracking(taskId);
      this.notificationService.cancelTaskReminder(taskId);
      return task;
    }

    throw new Error(`不支持的任务动作: ${action}`);
  }

  async syncReminder(taskId, updates, task) {
    if (updates.reminderTime === undefined) {
      return;
    }

    this.notificationService.cancelTaskReminder(taskId);
    if (task.reminderTime) {
      this.notificationService.scheduleTaskReminder(task, (scheduledTask) => {
        this.handleTaskReminder(scheduledTask);
      });
    }
  }

  serializeTask(task) {
    return {
      id: task.id,
      content: task.content,
      status: task.status,
      completed: task.completed,
      createdAt: this.toIso(task.createdAt),
      updatedAt: this.toIso(task.updatedAt),
      reminderTime: this.toIso(task.reminderTime),
      startedAt: this.toIso(task.startedAt),
      completedAt: this.toIso(task.completedAt),
      totalDuration: task.totalDuration,
      listId: task.listId,
      metadata: task.metadata,
      recurrence: task.recurrence,
      seriesId: task.seriesId,
      occurrenceDate: task.occurrenceDate,
      dueDate: task.dueDate,
      dueTime: task.dueTime
    };
  }

  toIso(value) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  parseRequiredListId(value) {
    const listId = Number.parseInt(value, 10);
    if (!Number.isInteger(listId) || listId < 0) {
      throw new Error('listId 必须是非负整数');
    }
    return listId;
  }

  parseOptionalListId(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return this.parseRequiredListId(value);
  }

  async readJsonBody(request) {
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(chunk);
    }

    if (chunks.length === 0) {
      return {};
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error('请求体不是合法的 JSON');
    }
  }

  setCorsHeaders(response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify(payload, null, 2));
  }

  sendError(response, statusCode, message) {
    this.sendJson(response, statusCode, {
      success: false,
      error: message
    });
  }

  handleTaskReminder(task) {
    const windows = [
      this.windowManager.floatingWindow,
      this.windowManager.taskManagerWindow,
      this.windowManager.settingsWindow
    ];

    windows.forEach((window) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('play-notification-sound');
      }
    });

    if (task && task.id) {
      this.windowManager.createFloatingTask(task.id);
    }

    if (this.windowManager.floatingWindow && !this.windowManager.floatingWindow.isDestroyed()) {
      this.windowManager.floatingWindow.webContents.send('task-reminder', task);
    }
  }

  ensureListService() {
    if (!this.listService) {
      throw new Error('当前数据模式不支持清单接口');
    }
  }

  buildDocs() {
    return {
      name: 'MoliTodo Local API',
      baseUrl: this.state.baseUrl,
      docsUrl: this.state.docsUrl,
      openApiUrl: this.state.openApiUrl,
      notes: [
        '默认只监听本机 localhost，可直接给本地 AI、脚本或自动化工具调用。',
        '所有请求和响应都使用 JSON。',
        '建议先调用 /api/health 和 /api/docs 了解服务状态和接口列表。'
      ],
      endpoints: [
        { method: 'GET', path: '/api/health', description: '检查服务是否在线' },
        { method: 'GET', path: '/api/docs', description: '读取接口说明和调用示例' },
        { method: 'GET', path: '/api/openapi.json', description: '读取 OpenAPI 规范' },
        { method: 'GET', path: '/api/lists', description: '获取所有清单' },
        { method: 'POST', path: '/api/lists', description: '创建清单' },
        { method: 'GET', path: '/api/tasks', description: '查询任务，支持 status、listId、category、query、includeCompleted 参数' },
        { method: 'POST', path: '/api/tasks', description: '创建任务' },
        { method: 'PATCH', path: '/api/tasks/:id', description: '更新任务内容、提醒、清单、备注等字段' },
        { method: 'POST', path: '/api/tasks/:id/start', description: '开始任务' },
        { method: 'POST', path: '/api/tasks/:id/pause', description: '暂停任务' },
        { method: 'POST', path: '/api/tasks/:id/complete', description: '完成任务' },
        { method: 'DELETE', path: '/api/tasks/:id', description: '删除任务' }
      ],
      examples: {
        health: `curl ${this.state.baseUrl}/api/health`,
        listTasks: `curl ${this.state.baseUrl}/api/tasks?includeCompleted=true`,
        createTask: `curl -X POST ${this.state.baseUrl}/api/tasks -H "Content-Type: application/json" -d '{"content":"写接口联调说明","listId":0}'`,
        updateTask: `curl -X PATCH ${this.state.baseUrl}/api/tasks/TASK_ID -H "Content-Type: application/json" -d '{"content":"新的任务标题"}'`,
        completeTask: `curl -X POST ${this.state.baseUrl}/api/tasks/TASK_ID/complete`
      }
    };
  }

  buildOpenApiSpec() {
    return {
      openapi: '3.1.0',
      info: {
        title: 'MoliTodo Local API',
        version: '1.0.0',
        description: 'MoliTodo 桌面应用开放出来的本地接口。'
      },
      servers: [
        {
          url: this.state.baseUrl
        }
      ],
      paths: {
        '/api/health': {
          get: {
            summary: '检查服务状态'
          }
        },
        '/api/docs': {
          get: {
            summary: '读取接口文档'
          }
        },
        '/api/openapi.json': {
          get: {
            summary: '读取 OpenAPI 规范'
          }
        },
        '/api/lists': {
          get: {
            summary: '获取清单列表'
          },
          post: {
            summary: '创建清单'
          }
        },
        '/api/tasks': {
          get: {
            summary: '查询任务'
          },
          post: {
            summary: '创建任务'
          }
        },
        '/api/tasks/{taskId}': {
          patch: {
            summary: '更新任务'
          },
          delete: {
            summary: '删除任务'
          }
        },
        '/api/tasks/{taskId}/start': {
          post: {
            summary: '开始任务'
          }
        },
        '/api/tasks/{taskId}/pause': {
          post: {
            summary: '暂停任务'
          }
        },
        '/api/tasks/{taskId}/complete': {
          post: {
            summary: '完成任务'
          }
        }
      }
    };
  }
}

module.exports = LocalApiServer;
