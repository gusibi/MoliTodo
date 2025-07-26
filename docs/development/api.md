# API 文档

本文档详细说明了 MoliTodo 的 IPC 通信接口和内部 API。

## IPC 通信架构

MoliTodo 使用 Electron 的 IPC (Inter-Process Communication) 机制实现主进程和渲染进程之间的通信。

### 安全设计

```javascript
// preload.js - 安全的 API 暴露
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 只暴露必要的 API，确保安全性
  tasks: { /* 任务相关 API */ },
  config: { /* 配置相关 API */ },
  windows: { /* 窗口相关 API */ },
  events: { /* 事件相关 API */ }
})
```

## 任务管理 API

### tasks.create(data)

创建新任务。

**参数**:
- `data` (Object): 任务数据
  - `content` (string): 任务内容，必填
  - `reminderTime` (string, optional): 提醒时间，ISO 8601 格式

**返回值**: Promise<Task>

**示例**:
```javascript
const task = await window.electronAPI.tasks.create({
  content: '完成项目文档',
  reminderTime: '2024-07-27T10:00:00.000Z'
})
```

### tasks.getAll()

获取所有任务。

**返回值**: Promise<Task[]>

**示例**:
```javascript
const tasks = await window.electronAPI.tasks.getAll()
```

### tasks.getIncomplete()

获取未完成的任务。

**返回值**: Promise<Task[]>

**示例**:
```javascript
const incompleteTasks = await window.electronAPI.tasks.getIncomplete()
```

### tasks.getCompleted()

获取已完成的任务。

**返回值**: Promise<Task[]>

**示例**:
```javascript
const completedTasks = await window.electronAPI.tasks.getCompleted()
```

### tasks.update(id, data)

更新任务。

**参数**:
- `id` (string): 任务 ID
- `data` (Object): 更新的数据

**返回值**: Promise<Task>

**示例**:
```javascript
const updatedTask = await window.electronAPI.tasks.update('task-id', {
  content: '更新后的任务内容'
})
```

### tasks.start(id)

开始任务（设置为进行中状态）。

**参数**:
- `id` (string): 任务 ID

**返回值**: Promise<Task>

**示例**:
```javascript
const task = await window.electronAPI.tasks.start('task-id')
```

### tasks.pause(id)

暂停任务（从进行中状态回到待办状态）。

**参数**:
- `id` (string): 任务 ID

**返回值**: Promise<Task>

**示例**:
```javascript
const task = await window.electronAPI.tasks.pause('task-id')
```

### tasks.complete(id)

完成任务。

**参数**:
- `id` (string): 任务 ID

**返回值**: Promise<Task>

**示例**:
```javascript
const task = await window.electronAPI.tasks.complete('task-id')
```

### tasks.delete(id)

删除任务。

**参数**:
- `id` (string): 任务 ID

**返回值**: Promise<boolean>

**示例**:
```javascript
const success = await window.electronAPI.tasks.delete('task-id')
```

### tasks.setReminder(id, reminderTime)

设置任务提醒。

**参数**:
- `id` (string): 任务 ID
- `reminderTime` (string): 提醒时间，ISO 8601 格式

**返回值**: Promise<Task>

**示例**:
```javascript
const task = await window.electronAPI.tasks.setReminder(
  'task-id',
  '2024-07-27T15:30:00.000Z'
)
```

### tasks.getCount()

获取任务数量统计。

**返回值**: Promise<number>

**示例**:
```javascript
const count = await window.electronAPI.tasks.getCount()
```

## 配置管理 API

### config.get()

获取应用配置。

**返回值**: Promise<Config>

**示例**:
```javascript
const config = await window.electronAPI.config.get()
```

### config.update(key, value)

更新配置项。

**参数**:
- `key` (string): 配置键名
- `value` (any): 配置值

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.config.update('theme', 'dark')
await window.electronAPI.config.update('floatingIcon.size', 80)
```

### config.reset()

重置配置到默认值。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.config.reset()
```

## 窗口管理 API

### windows.showTaskManager()

显示任务管理器窗口。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.windows.showTaskManager()
```

### windows.hideTaskManager()

隐藏任务管理器窗口。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.windows.hideTaskManager()
```

### windows.showTaskPanel()

显示任务面板。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.windows.showTaskPanel()
```

### windows.hideTaskPanel()

隐藏任务面板。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.windows.hideTaskPanel()
```

### windows.toggleTaskPanel()

切换任务面板显示状态。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.windows.toggleTaskPanel()
```

### windows.panelMouseEnter()

通知主进程面板鼠标进入事件。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.windows.panelMouseEnter()
```

### windows.panelMouseLeave()

通知主进程面板鼠标离开事件。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.windows.panelMouseLeave()
```

## 数据管理 API

### data.export()

导出应用数据。

**返回值**: Promise<{success: boolean, path?: string, error?: string}>

**示例**:
```javascript
const result = await window.electronAPI.data.export()
if (result.success) {
  console.log('数据已导出到:', result.path)
}
```

### data.import()

导入应用数据。

**返回值**: Promise<{success: boolean, taskCount?: number, error?: string}>

**示例**:
```javascript
const result = await window.electronAPI.data.import()
if (result.success) {
  console.log('成功导入', result.taskCount, '个任务')
}
```

### data.clear()

清除所有数据。

**返回值**: Promise<{success: boolean, error?: string}>

**示例**:
```javascript
const result = await window.electronAPI.data.clear()
if (result.success) {
  console.log('数据已清除')
}
```

### data.getStats()

获取数据库统计信息。

**返回值**: Promise<{taskCount: number, fileSize: number, path: string}>

**示例**:
```javascript
const stats = await window.electronAPI.data.getStats()
console.log('任务数量:', stats.taskCount)
console.log('数据库大小:', stats.fileSize)
```

## 事件系统 API

### events.on(event, callback)

监听事件。

**参数**:
- `event` (string): 事件名称
- `callback` (function): 回调函数

**示例**:
```javascript
window.electronAPI.events.on('tasks-updated', () => {
  console.log('任务列表已更新')
  // 刷新任务列表
})

window.electronAPI.events.on('task-reminder', (event, task) => {
  console.log('任务提醒:', task.content)
})
```

### events.removeAllListeners(event)

移除事件监听器。

**参数**:
- `event` (string): 事件名称

**示例**:
```javascript
window.electronAPI.events.removeAllListeners('tasks-updated')
```

## 拖拽 API

### drag.getWindowPosition()

获取窗口位置。

**返回值**: Promise<{x: number, y: number}>

**示例**:
```javascript
const position = await window.electronAPI.drag.getWindowPosition()
```

### drag.dragWindow(position)

拖拽窗口到指定位置。

**参数**:
- `position` (Object): 位置信息
  - `x` (number): X 坐标
  - `y` (number): Y 坐标

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.drag.dragWindow({ x: 100, y: 200 })
```

### drag.endDrag()

结束拖拽操作。

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.drag.endDrag()
```

## 工具 API

### utils.log(message, details)

发送日志到主进程。

**参数**:
- `message` (string): 日志消息
- `details` (any, optional): 详细信息

**返回值**: Promise<void>

**示例**:
```javascript
await window.electronAPI.utils.log('用户操作', { action: 'create-task' })
```

## 数据类型定义

### Task

```typescript
interface Task {
  id: string
  content: string
  status: 'todo' | 'doing' | 'completed'
  completed: boolean
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  reminderTime?: string // ISO 8601
  startedAt?: string // ISO 8601
  completedAt?: string // ISO 8601
  totalDuration: number // 毫秒
}
```

### Config

```typescript
interface Config {
  autoStart: boolean
  showNotifications: boolean
  theme: 'light' | 'dark'
  floatingIcon: {
    visible: boolean
    size: number
    opacity: number
    position: { x: number, y: number }
  }
}
```

## 错误处理

所有 API 调用都可能抛出错误，建议使用 try-catch 处理：

```javascript
try {
  const task = await window.electronAPI.tasks.create({
    content: '新任务'
  })
  console.log('任务创建成功:', task)
} catch (error) {
  console.error('任务创建失败:', error.message)
  // 显示错误提示给用户
}
```

## 事件列表

### 系统事件

- `tasks-updated`: 任务列表更新时触发
- `task-reminder`: 任务提醒时触发
- `config-updated`: 配置更新时触发
- `panel-mouse-enter`: 面板鼠标进入时触发
- `panel-mouse-leave`: 面板鼠标离开时触发

### 事件数据格式

```javascript
// tasks-updated 事件
// 无额外数据

// task-reminder 事件
{
  task: Task // 提醒的任务对象
}

// config-updated 事件
{
  key: string,   // 更新的配置键
  value: any,    // 新的配置值
  config: Config // 完整的配置对象
}
```

## 最佳实践

### 1. 错误处理

```javascript
// 统一的错误处理函数
const handleApiError = (error, operation) => {
  console.error(`${operation} 失败:`, error)
  // 显示用户友好的错误消息
  showErrorMessage(`操作失败: ${error.message}`)
}

// 使用示例
try {
  await window.electronAPI.tasks.create(taskData)
} catch (error) {
  handleApiError(error, '创建任务')
}
```

### 2. 事件监听管理

```javascript
// 在 Vue 组件中正确管理事件监听
import { onMounted, onUnmounted } from 'vue'

export default {
  setup() {
    const handleTasksUpdated = () => {
      // 处理任务更新
    }

    onMounted(() => {
      window.electronAPI.events.on('tasks-updated', handleTasksUpdated)
    })

    onUnmounted(() => {
      window.electronAPI.events.removeAllListeners('tasks-updated')
    })
  }
}
```

### 3. 数据缓存

```javascript
// 使用 Pinia 缓存数据，减少 IPC 调用
import { defineStore } from 'pinia'

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [],
    lastFetch: null
  }),

  actions: {
    async fetchTasks(force = false) {
      // 缓存 5 分钟
      const cacheTime = 5 * 60 * 1000
      const now = Date.now()

      if (!force && this.lastFetch && (now - this.lastFetch) < cacheTime) {
        return this.tasks
      }

      this.tasks = await window.electronAPI.tasks.getAll()
      this.lastFetch = now
      return this.tasks
    }
  }
})
```

---

*这个 API 文档涵盖了 MoliTodo 的所有公开接口，为开发者提供了完整的参考。*