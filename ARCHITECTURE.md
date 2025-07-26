# MoliTodo 架构文档

## 概述

MoliTodo 采用现代化的 **Vue 3 + Electron** 架构，结合 **领域驱动设计 (DDD)** 的分层架构模式，确保代码的可维护性、可扩展性和安全性。

## 技术栈

### 主进程 (Node.js)
- **Electron 28.x**: 桌面应用框架
- **SQLite**: 轻量级数据库，本地数据持久化
- **node-schedule**: 任务提醒调度
- **electron-store**: 配置管理

### 渲染进程 (Web)
- **Vue 3**: 前端框架 (Composition API)
- **Vue Router**: 客户端路由管理
- **Pinia**: 状态管理库
- **Vite**: 现代化构建工具

## 项目结构

```
src/
├── main/                       # 主进程代码 (Node.js)
│   ├── main.js                # 应用入口点
│   ├── window-manager.js      # 窗口管理器
│   ├── ipc-handlers.js        # IPC 通信处理器
│   └── preload.js             # 预加载脚本，安全暴露 IPC 接口
│
├── domain/                     # 领域层 - 核心业务逻辑
│   ├── entities/
│   │   └── task.js            # 任务实体
│   ├── services/
│   │   └── task-service.js    # 任务业务服务
│   └── repositories/
│       └── task-repository.js # 仓储接口定义
│
├── infrastructure/             # 基础设施层 - 技术实现
│   ├── persistence/
│   │   ├── sqlite-task-repository.js  # SQLite 数据持久化
│   │   └── file-task-repository.js    # 文件数据持久化 (备用)
│   └── notification/
│       └── notification-service.js    # 系统通知服务
│
└── renderer/                   # 表现层 - Vue 应用
    ├── src/
    │   ├── components/         # 可复用的 UI 组件
    │   │   ├── FloatingIcon.vue
    │   │   ├── TaskManager.vue
    │   │   ├── TaskPanel.vue
    │   │   └── Settings.vue
    │   ├── views/              # 页面级组件（与路由绑定）
    │   │   ├── MainView.vue
    │   │   └── SettingsView.vue
    │   ├── router/             # 路由配置
    │   │   └── index.js
    │   ├── store/              # Pinia 状态管理
    │   │   └── taskStore.js
    │   ├── App.vue             # 根组件
    │   └── main.js             # Vue 应用入口
    ├── index.html              # HTML 模板
    ├── vite.config.js          # Vite 配置
    └── README.md               # 渲染进程说明文档
```

## 数据流架构

### 完整数据流示意图

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (Vue)                   │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │   Components    │    │         Pinia Store             │ │
│  │ TaskManager.vue │◄──►│       taskStore.js              │ │
│  │ TaskPanel.vue   │    │   - createTask()                │ │
│  │ Settings.vue    │    │   - updateTask()                │ │
│  └─────────────────┘    │   - deleteTask()                │ │
│                         │   - getAllTasks()               │ │
│                         └──────────────┬───────────────────┘ │
└─────────────────────────────────────────┼─────────────────────┘
                                          │ window.electronAPI
                                          │ IPC Communication
                                          ▼
┌─────────────────────────────────────────┼─────────────────────┐
│                Main Process (Node.js)   │                     │
│  ┌──────────────────────────────────────▼───────────────────┐ │
│  │              Preload Script                              │ │
│  │               preload.js                                 │ │
│  │  - contextBridge.exposeInMainWorld()                    │ │
│  │  - 安全暴露 electronAPI 到渲染进程                        │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │ ipcRenderer.invoke()                │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                IPC Handlers                              │ │
│  │              ipc-handlers.js                             │ │
│  │  - ipcMain.handle('create-task', ...)                   │ │
│  │  - ipcMain.handle('get-all-tasks', ...)                 │ │
│  │  - ipcMain.handle('update-task', ...)                   │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │ this.taskService.createTask()       │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Domain Services                             │ │
│  │              task-service.js                             │ │
│  │  - createTask(content, reminderTime)                    │ │
│  │  - completeTask(taskId)                                 │ │
│  │  - updateTaskContent(taskId, content)                   │ │
│  │  - startTask(taskId) / pauseTask(taskId)                │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │ this.taskRepository.save(task)      │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            Infrastructure Layer                          │ │
│  │         sqlite-task-repository.js                       │ │
│  │  - save(task)                                           │ │
│  │  - findAll() / findById(id)                             │ │
│  │  - findIncomplete() / findCompleted()                   │ │
│  │  - delete(id)                                           │ │
│  └──────────────────────┬───────────────────────────────────┘ │
└─────────────────────────┼─────────────────────────────────────┘
                          │ SQL Operations
                          ▼
                    ┌─────────────┐
                    │   SQLite    │
                    │  Database   │
                    │   File      │
                    │             │
                    │ tasks.db    │
                    └─────────────┘
```

### 数据流详细说明

#### 1. **前端组件层 (Vue Components)**
```javascript
// TaskManager.vue 中的操作示例
const addTask = async () => {
  if (!newTaskContent.value.trim()) return
  
  try {
    // 调用 Pinia store
    await taskStore.createTask({
      content: newTaskContent.value.trim()
    })
    newTaskContent.value = ''
    showAddModal.value = false
    await loadTasks()
  } catch (error) {
    console.error('添加任务失败:', error)
  }
}
```

#### 2. **状态管理层 (Pinia Store)**
```javascript
// taskStore.js
const createTask = async (taskData) => {
  try {
    // 通过 electronAPI 调用主进程
    const result = await window.electronAPI.tasks.create(taskData)
    if (result.success) {
      await getIncompleteTasks() // 重新获取任务列表
    }
    return result
  } catch (error) {
    console.error('创建任务失败:', error)
    return { success: false, error: error.message }
  }
}
```

#### 3. **IPC 通信层 (Preload Script)**
```javascript
// preload.js - 安全暴露 API
const electronAPI = {
  tasks: {
    create: (taskData) => ipcRenderer.invoke('create-task', taskData),
    getAll: () => ipcRenderer.invoke('get-all-tasks'),
    update: (taskId, updates) => ipcRenderer.invoke('update-task', taskId, updates),
    delete: (taskId) => ipcRenderer.invoke('delete-task', taskId),
    // ... 其他任务操作
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
```

#### 4. **IPC 处理层 (Main Process)**
```javascript
// ipc-handlers.js
ipcMain.handle('create-task', async (event, taskData) => {
  const { content, reminderTime } = taskData
  
  // 调用业务服务层
  const task = await this.taskService.createTask(
    content, 
    reminderTime ? new Date(reminderTime) : null
  )

  // 设置提醒
  if (task.reminderTime) {
    this.notificationService.scheduleTaskReminder(task, (task) => {
      this.handleTaskReminder(task)
    })
  }

  // 广播更新事件到所有窗口
  this.broadcastTaskUpdates()
  return { success: true, task }
})
```

#### 5. **业务服务层 (Domain Service)**
```javascript
// task-service.js
async createTask(content, reminderTime = null) {
  if (!content || content.trim().length === 0) {
    throw new Error('任务内容不能为空')
  }

  // 创建任务实体
  const task = new Task(
    Task.generateId(),
    content.trim(),
    'todo',
    new Date(),
    reminderTime
  )

  // 调用仓储层保存
  return await this.taskRepository.save(task)
}
```

#### 6. **数据持久化层 (SQLite Repository)**
```javascript
// sqlite-task-repository.js
async save(task) {
  if (!this.db) {
    throw new Error('数据库未初始化')
  }

  const row = this.taskToRow(task)
  
  // 检查任务是否已存在
  const existing = await this.findById(task.id)
  
  if (existing) {
    // 更新现有任务
    await this.db.run(`
      UPDATE tasks SET 
        content = ?, status = ?, completed = ?, updated_at = ?,
        reminder_time = ?, completed_at = ?, started_at = ?, total_duration = ?
      WHERE id = ?
    `, [/* 参数 */])
  } else {
    // 插入新任务
    await this.db.run(`
      INSERT INTO tasks (
        id, content, status, completed, created_at, updated_at, 
        reminder_time, completed_at, started_at, total_duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [/* 参数 */])
  }
  
  return task
}
```

#### 7. **SQLite 数据库表结构**
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reminder_time TEXT,
  completed_at TEXT,
  started_at TEXT,
  total_duration INTEGER DEFAULT 0
)
```

## 架构特性

### 🔒 **安全的 IPC 通信**
- 使用 `contextBridge` 安全暴露 API，避免直接暴露 Node.js API
- 预加载脚本限制可访问的 IPC 通道
- 主进程验证所有请求，防止恶意调用

### 📊 **实时数据同步**
- 数据变更后自动广播 `tasks-updated` 事件到所有窗口
- 前端监听事件自动刷新数据
- 支持多窗口数据一致性

### ⚡ **高性能架构**
- 分层架构，职责清晰，便于维护和测试
- SQLite 本地数据库，读写性能优异
- 异步操作，不阻塞 UI 线程

### 🔄 **完整的 CRUD 操作**
- **Create**: 创建任务 (`createTask`)
- **Read**: 查询任务 (`getAllTasks`, `getIncompleteTasks`, `getCompletedTasks`)
- **Update**: 更新任务内容、状态、提醒时间 (`updateTask`, `startTask`, `pauseTask`)
- **Delete**: 删除任务 (`deleteTask`)

### ⏱️ **时间追踪功能**
- 任务开始/暂停/完成时间记录
- 总耗时统计和实时进行时长计算
- 支持任务状态切换：`todo` → `doing` → `done`

### 🔔 **智能提醒系统**
- 基于 `node-schedule` 的任务调度
- 系统原生通知支持
- 提醒时间管理和取消机制

## 数据模型

### Task 实体结构
```javascript
{
  id: string,              // 唯一标识
  content: string,         // 任务内容
  status: 'todo'|'doing'|'done',  // 任务状态
  completed: boolean,      // 是否完成（向后兼容）
  createdAt: Date,        // 创建时间
  updatedAt: Date,        // 更新时间
  reminderTime: Date|null, // 提醒时间
  completedAt: Date|null,  // 完成时间
  startedAt: Date|null,    // 开始时间
  totalDuration: number    // 总耗时（毫秒）
}
```

## 扩展性设计

### 插件化架构
- 仓储层接口化，支持多种数据存储方式
- 通知服务可扩展支持多种通知方式
- 组件化的前端架构，便于功能扩展

### 多窗口支持
- 统一的窗口管理器
- 事件驱动的窗口间通信
- 独立的窗口生命周期管理

### 配置管理
- 基于 `electron-store` 的持久化配置
- 支持运行时配置更新
- 配置变更事件通知

这个架构确保了 MoliTodo 的高可维护性、安全性和扩展性，为后续功能开发提供了坚实的基础。