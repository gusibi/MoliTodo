# 架构设计

MoliTodo 采用现代化的分层架构设计，基于领域驱动设计 (DDD) 原则，使用 Vue 3 + Electron 技术栈。

## 整体架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    MoliTodo 应用架构                          │
├─────────────────────────────────────────────────────────────┤
│  表现层 (Presentation Layer)                                │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Vue 3 应用     │  │  Electron 窗口   │                   │
│  │  - 组件系统      │  │  - 主窗口管理    │                   │
│  │  - 路由管理      │  │  - 悬浮窗口      │                   │
│  │  - 状态管理      │  │  - 系统托盘      │                   │
│  └─────────────────┘  └─────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│  应用层 (Application Layer)                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  IPC 通信层 & 应用服务                                    │ │
│  │  - IPC 处理器    - 应用服务    - 事件总线                  │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  领域层 (Domain Layer)                                      │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │     实体         │  │    领域服务      │                   │
│  │  - Task 实体     │  │  - TaskService  │                   │
│  │  - Config 实体   │  │  - NotifyService│                   │
│  └─────────────────┘  └─────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│  基础设施层 (Infrastructure Layer)                           │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   数据持久化     │  │    外部服务      │                   │
│  │  - SQLite 仓储   │  │  - 通知服务      │                   │
│  │  - 文件仓储      │  │  - 系统集成      │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

#### 主进程 (Node.js)
- **Electron 28.x**: 桌面应用框架
- **SQLite**: 数据持久化
- **node-schedule**: 任务提醒调度
- **electron-store**: 配置管理

#### 渲染进程 (Web)
- **Vue 3**: 前端框架 (Composition API)
- **Vue Router**: 路由管理
- **Pinia**: 状态管理
- **Vite**: 现代化构建工具

## 分层架构详解

### 1. 表现层 (Presentation Layer)

负责用户界面和用户交互。

#### Vue 3 渲染进程
```
src/renderer/src/
├── components/          # 可复用组件
│   ├── FloatingIcon.vue # 悬浮图标
│   ├── TaskPanel.vue    # 任务面板
│   ├── TaskManager.vue  # 任务管理器
│   └── Settings.vue     # 设置页面
├── views/              # 页面级组件
│   ├── MainView.vue    # 主页面
│   └── SettingsView.vue# 设置页面
├── store/              # Pinia 状态管理
│   └── taskStore.js    # 任务状态
├── router/             # Vue Router
│   └── index.js        # 路由配置
├── assets/             # 静态资源
│   └── styles/         # 样式文件
└── composables/        # 组合式函数
    └── useTheme.js     # 主题管理
```

#### Electron 主进程
```
src/main/
├── main.js             # 应用入口
├── window-manager.js   # 窗口管理
├── ipc-handlers.js     # IPC 处理
└── preload.js          # 预加载脚本
```

### 2. 应用层 (Application Layer)

协调表现层和领域层，处理应用级别的逻辑。

#### IPC 通信架构
```javascript
// 安全的 IPC 通信设计
┌─────────────┐    IPC     ┌─────────────┐
│ Vue 组件     │ ────────→ │ 主进程       │
│ (渲染进程)   │           │ IPC Handler │
└─────────────┘           └─────────────┘
       │                         │
       │ electronAPI             │ 调用
       ▼                         ▼
┌─────────────┐           ┌─────────────┐
│ Preload     │           │ 领域服务     │
│ Script      │           │ (Domain)    │
└─────────────┘           └─────────────┘
```

#### IPC API 设计
```javascript
// preload.js - 安全的 API 暴露
window.electronAPI = {
  tasks: {
    create: (data) => ipcRenderer.invoke('create-task', data),
    getAll: () => ipcRenderer.invoke('get-all-tasks'),
    update: (id, data) => ipcRenderer.invoke('update-task', id, data),
    delete: (id) => ipcRenderer.invoke('delete-task', id)
  },
  config: {
    get: () => ipcRenderer.invoke('get-config'),
    update: (key, value) => ipcRenderer.invoke('update-config', key, value)
  },
  events: {
    on: (event, callback) => ipcRenderer.on(event, callback),
    removeAllListeners: (event) => ipcRenderer.removeAllListeners(event)
  }
}
```

### 3. 领域层 (Domain Layer)

包含核心业务逻辑和业务规则。

#### 实体设计
```javascript
// src/domain/entities/task.js
class Task {
  constructor(data) {
    this.id = data.id || generateId()
    this.content = data.content
    this.status = data.status || 'todo'
    this.completed = data.completed || false
    this.createdAt = data.createdAt || new Date().toISOString()
    this.updatedAt = data.updatedAt || new Date().toISOString()
    this.reminderTime = data.reminderTime || null
    this.startedAt = data.startedAt || null
    this.completedAt = data.completedAt || null
    this.totalDuration = data.totalDuration || 0
  }

  // 业务方法
  start() {
    this.status = 'doing'
    this.startedAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  complete() {
    this.status = 'completed'
    this.completed = true
    this.completedAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
    
    if (this.startedAt) {
      const duration = new Date() - new Date(this.startedAt)
      this.totalDuration += duration
    }
  }

  pause() {
    if (this.status === 'doing' && this.startedAt) {
      const duration = new Date() - new Date(this.startedAt)
      this.totalDuration += duration
      this.startedAt = null
    }
    this.status = 'todo'
    this.updatedAt = new Date().toISOString()
  }
}
```

#### 领域服务
```javascript
// src/domain/services/task-service.js
class TaskService {
  constructor(taskRepository, notificationService) {
    this.taskRepository = taskRepository
    this.notificationService = notificationService
  }

  async createTask(taskData) {
    const task = new Task(taskData)
    await this.taskRepository.save(task)
    
    if (task.reminderTime) {
      await this.notificationService.scheduleReminder(task)
    }
    
    return task
  }

  async startTask(taskId) {
    const task = await this.taskRepository.findById(taskId)
    if (!task) throw new Error('Task not found')
    
    task.start()
    await this.taskRepository.save(task)
    
    return task
  }

  async completeTask(taskId) {
    const task = await this.taskRepository.findById(taskId)
    if (!task) throw new Error('Task not found')
    
    task.complete()
    await this.taskRepository.save(task)
    
    return task
  }
}
```

### 4. 基础设施层 (Infrastructure Layer)

提供技术实现和外部服务集成。

#### 数据持久化
```javascript
// src/infrastructure/persistence/sqlite-task-repository.js
class SQLiteTaskRepository {
  constructor(dbPath) {
    this.db = new Database(dbPath)
    this.initializeSchema()
  }

  async save(task) {
    const sql = `
      INSERT OR REPLACE INTO tasks 
      (id, content, status, completed, createdAt, updatedAt, reminderTime, startedAt, completedAt, totalDuration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    return this.db.prepare(sql).run(
      task.id, task.content, task.status, task.completed,
      task.createdAt, task.updatedAt, task.reminderTime,
      task.startedAt, task.completedAt, task.totalDuration
    )
  }

  async findById(id) {
    const sql = 'SELECT * FROM tasks WHERE id = ?'
    const row = this.db.prepare(sql).get(id)
    return row ? new Task(row) : null
  }

  async findAll() {
    const sql = 'SELECT * FROM tasks ORDER BY createdAt DESC'
    const rows = this.db.prepare(sql).all()
    return rows.map(row => new Task(row))
  }
}
```

## 数据流架构

### 数据流向图

```
┌─────────────┐    用户操作    ┌─────────────┐
│ Vue 组件     │ ──────────→  │ Pinia Store │
└─────────────┘              └─────────────┘
       │                            │
       │ 状态更新                    │ API 调用
       ▼                            ▼
┌─────────────┐              ┌─────────────┐
│ UI 重新渲染  │              │ electronAPI │
└─────────────┘              └─────────────┘
                                     │
                              IPC 通信 │
                                     ▼
                             ┌─────────────┐
                             │ 主进程       │
                             │ IPC Handler │
                             └─────────────┘
                                     │
                              调用服务 │
                                     ▼
                             ┌─────────────┐
                             │ 领域服务     │
                             │ TaskService │
                             └─────────────┘
                                     │
                              数据操作 │
                                     ▼
                             ┌─────────────┐
                             │ 数据仓储     │
                             │ Repository  │
                             └─────────────┘
                                     │
                              持久化   │
                                     ▼
                             ┌─────────────┐
                             │ SQLite      │
                             │ Database    │
                             └─────────────┘
```

### 事件驱动架构

```javascript
// 事件总线设计
class EventBus {
  constructor() {
    this.events = new Map()
  }

  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(callback)
  }

  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(callback => callback(data))
    }
  }

  off(event, callback) {
    if (this.events.has(event)) {
      const callbacks = this.events.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }
}

// 使用示例
eventBus.on('task-created', (task) => {
  // 更新 UI
  // 发送通知
  // 更新统计
})

eventBus.emit('task-created', newTask)
```

## 安全架构

### IPC 安全设计

```javascript
// 安全的 IPC 通信
// 1. 使用 contextBridge 隔离
// 2. 白名单 API 暴露
// 3. 参数验证
// 4. 权限检查

// preload.js
const { contextBridge, ipcRenderer } = require('electron')

// 只暴露必要的 API
contextBridge.exposeInMainWorld('electronAPI', {
  tasks: {
    create: (data) => {
      // 参数验证
      if (!data || typeof data.content !== 'string') {
        throw new Error('Invalid task data')
      }
      return ipcRenderer.invoke('create-task', data)
    }
  }
})
```

### 数据安全

```javascript
// 数据验证和清理
class DataValidator {
  static validateTask(data) {
    const errors = []
    
    if (!data.content || data.content.trim().length === 0) {
      errors.push('Task content is required')
    }
    
    if (data.content && data.content.length > 500) {
      errors.push('Task content too long')
    }
    
    if (data.reminderTime && !this.isValidDate(data.reminderTime)) {
      errors.push('Invalid reminder time')
    }
    
    return errors
  }
  
  static sanitizeInput(input) {
    return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  }
}
```

## 性能架构

### 渲染性能优化

```javascript
// Vue 3 性能优化策略
// 1. 使用 v-memo 缓存渲染结果
// 2. 合理使用 computed 和 watch
// 3. 组件懒加载
// 4. 虚拟滚动 (大列表)

// 示例：任务列表优化
<template>
  <div class="task-list">
    <div
      v-for="task in visibleTasks"
      :key="task.id"
      v-memo="[task.content, task.status, task.updatedAt]"
      class="task-item"
    >
      <!-- 任务内容 -->
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const tasks = ref([])
const scrollTop = ref(0)

// 虚拟滚动 - 只渲染可见的任务
const visibleTasks = computed(() => {
  const itemHeight = 60
  const containerHeight = 400
  const startIndex = Math.floor(scrollTop.value / itemHeight)
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    tasks.value.length
  )
  
  return tasks.value.slice(startIndex, endIndex)
})
</script>
```

### 内存管理

```javascript
// 内存泄漏防护
class MemoryManager {
  constructor() {
    this.timers = new Set()
    this.listeners = new Map()
  }

  addTimer(timer) {
    this.timers.add(timer)
  }

  addListener(element, event, callback) {
    if (!this.listeners.has(element)) {
      this.listeners.set(element, [])
    }
    this.listeners.get(element).push({ event, callback })
    element.addEventListener(event, callback)
  }

  cleanup() {
    // 清理定时器
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()

    // 清理事件监听器
    this.listeners.forEach((listeners, element) => {
      listeners.forEach(({ event, callback }) => {
        element.removeEventListener(event, callback)
      })
    })
    this.listeners.clear()
  }
}
```

## 扩展架构

### 插件系统设计

```javascript
// 插件接口定义
class PluginInterface {
  constructor(name, version) {
    this.name = name
    this.version = version
  }

  // 插件生命周期
  async install(app) {
    throw new Error('install method must be implemented')
  }

  async uninstall(app) {
    throw new Error('uninstall method must be implemented')
  }

  // 插件能力
  getCapabilities() {
    return []
  }
}

// 插件管理器
class PluginManager {
  constructor() {
    this.plugins = new Map()
  }

  async loadPlugin(pluginPath) {
    const plugin = require(pluginPath)
    await plugin.install(this.app)
    this.plugins.set(plugin.name, plugin)
  }

  async unloadPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (plugin) {
      await plugin.uninstall(this.app)
      this.plugins.delete(pluginName)
    }
  }
}
```

### 微服务架构准备

```javascript
// 为未来的微服务架构做准备
// 1. 服务接口标准化
// 2. 数据格式统一
// 3. 通信协议定义

class ServiceInterface {
  constructor(name) {
    this.name = name
  }

  async call(method, params) {
    // 统一的服务调用接口
    return await this.invoke(method, params)
  }

  async invoke(method, params) {
    throw new Error('invoke method must be implemented')
  }
}

// 本地服务实现
class LocalTaskService extends ServiceInterface {
  constructor(taskRepository) {
    super('TaskService')
    this.taskRepository = taskRepository
  }

  async invoke(method, params) {
    switch (method) {
      case 'createTask':
        return await this.createTask(params)
      case 'getTasks':
        return await this.getTasks(params)
      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }
}
```

## 测试架构

### 测试策略

```javascript
// 分层测试策略
// 1. 单元测试 - 测试单个函数/方法
// 2. 集成测试 - 测试组件间交互
// 3. E2E 测试 - 测试完整用户流程

// 单元测试示例
describe('Task Entity', () => {
  test('should create task with default values', () => {
    const task = new Task({ content: 'Test task' })
    
    expect(task.content).toBe('Test task')
    expect(task.status).toBe('todo')
    expect(task.completed).toBe(false)
  })

  test('should start task correctly', () => {
    const task = new Task({ content: 'Test task' })
    task.start()
    
    expect(task.status).toBe('doing')
    expect(task.startedAt).toBeTruthy()
  })
})

// 集成测试示例
describe('Task Service Integration', () => {
  test('should create and save task', async () => {
    const mockRepository = new MockTaskRepository()
    const service = new TaskService(mockRepository)
    
    const task = await service.createTask({ content: 'Test task' })
    
    expect(task.id).toBeTruthy()
    expect(mockRepository.saved).toContain(task)
  })
})
```

## 部署架构

### 构建流水线

```yaml
# GitHub Actions 构建流水线
name: Build and Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Package application
        run: npm run package:${{ matrix.os }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: dist/
```

## 监控架构

### 应用监控

```javascript
// 性能监控
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map()
  }

  startTimer(name) {
    this.metrics.set(name, Date.now())
  }

  endTimer(name) {
    const startTime = this.metrics.get(name)
    if (startTime) {
      const duration = Date.now() - startTime
      console.log(`${name}: ${duration}ms`)
      this.metrics.delete(name)
      return duration
    }
  }

  measureMemory() {
    if (process.memoryUsage) {
      const usage = process.memoryUsage()
      console.log('Memory usage:', {
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`
      })
    }
  }
}
```

---

*这个架构设计确保了 MoliTodo 的可维护性、可扩展性和高性能，为未来的功能扩展奠定了坚实的基础。*