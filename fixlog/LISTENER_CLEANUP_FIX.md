# 事件监听器重复调用问题修复

## 问题描述

在 task-panel 和 task-manager 页面中，每次删除或更新任务时，`broadcastTaskUpdates` 会被多次调用，并且调用次数呈指数级增长：
- 第一次修改：调用 2 次
- 第二次修改：调用 4 次
- 第三次修改：调用 8 次
- ...

## 根本原因

### 1. **核心问题：DOM 事件监听器重复绑定**
在 `task-panel.js` 中，`bindTaskEvents()` 方法在每次 `renderTasks()` 时都会被调用：
```javascript
renderTasks() {
    // ... 渲染任务列表
    this.bindTaskEvents(); // 每次都重新绑定事件！
}

bindTaskEvents() {
    this.taskList.addEventListener('click', ...); // 重复添加监听器
}
```

这导致了恶性循环：
1. 第一次删除，taskList 有 1 个监听器
2. 操作成功，列表重新渲染，bindTaskEvents 被调用，现在有 2 个监听器
3. 第二次删除，2 个监听器同时触发，导致删除操作被调用 2 次
4. 操作成功，列表重新渲染 2 次，bindTaskEvents 被调用 2 次，现在有 4 个监听器
5. 第三次删除，4 个监听器触发，导致 8 个监听器...

### 2. 应用层事件监听器累积
当页面重新加载或窗口重新创建时：
- 旧的 `TaskPanel`/`TaskManager` 实例可能没有被正确销毁
- 新的实例会重新注册监听器到 `TaskApplicationService`
- `TaskApplicationService` 的监听器数组会累积越来越多的回调函数

### 3. 生命周期管理不当
- 页面卸载时没有清理事件监听器
- `destroy()` 方法没有被正确调用
- 监听器引用没有被正确清理

## 解决方案

### 1. **核心修复：使用事件委托替代重复绑定**

**task-panel.js 修复前：**
```javascript
renderTasks() {
    // ... 渲染任务列表
    this.bindTaskEvents(); // ❌ 每次渲染都重新绑定
}

bindTaskEvents() {
    this.taskList.addEventListener('click', ...); // ❌ 重复添加监听器
}
```

**task-panel.js 修复后：**
```javascript
setupEventListeners() {
    // ... 其他事件监听器
    this.setupTaskListEventDelegation(); // ✅ 只在初始化时设置一次
}

setupTaskListEventDelegation() {
    // ✅ 使用事件委托，只绑定一次
    this.taskList.addEventListener('click', (e) => {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        // ... 处理事件
    });
}

renderTasks() {
    // ... 渲染任务列表
    // ✅ 不再调用 bindTaskEvents()
}
```

### 2. 改进应用层监听器设置和清理

**task-panel.js 和 task-manager.js:**
```javascript
setupTaskApplicationServiceListeners() {
    // 确保先清理旧的监听器
    this.cleanupTaskApplicationServiceListeners();
    
    // 创建新的监听器函数并保存引用
    this.tasksUpdatedListener = (tasks) => {
        console.log('接收到任务更新', tasks.length, '个任务');
        // ... 处理逻辑
    };
    
    // 添加监听器
    taskApplicationService.addEventListener('tasksUpdated', this.tasksUpdatedListener);
}

cleanupTaskApplicationServiceListeners() {
    // 移除旧的监听器
    if (this.tasksUpdatedListener) {
        taskApplicationService.removeEventListener('tasksUpdated', this.tasksUpdatedListener);
        this.tasksUpdatedListener = null;
    }
    // ... 清理其他监听器
}
```

### 3. 添加页面卸载时的资源清理

```javascript
// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.taskPanel) {
        console.log('页面卸载，清理资源');
        window.taskPanel.destroy();
        window.taskPanel = null;
    }
});
```

### 4. 改进 TaskApplicationService 的监听器管理

```javascript
addEventListener(event, callback) {
    if (this.listeners[event]) {
        // 检查是否已经存在相同的回调函数，避免重复添加
        if (!this.listeners[event].includes(callback)) {
            this.listeners[event].push(callback);
            console.log(`添加 ${event} 监听器，当前数量: ${this.listeners[event].length}`);
        } else {
            console.warn(`${event} 监听器已存在，跳过重复添加`);
        }
    }
}
```

### 5. 增强 destroy 方法

```javascript
destroy() {
    console.log('开始清理资源');
    
    // 清理事件监听器
    this.cleanupTaskApplicationServiceListeners();
    
    // 清理其他资源
    this.tasks = [];
    this.currentEditingTask = null;
    
    console.log('资源清理完成');
}
```

## 修复效果

修复后的效果：
1. **彻底解决 DOM 事件重复绑定**：使用事件委托，每个任务列表只绑定一次事件监听器
2. **防止应用层监听器累积**：每次创建新实例时，会先清理旧的监听器
3. **正确的生命周期管理**：页面卸载时会自动清理资源
4. **重复检测**：TaskApplicationService 会检测并防止重复添加相同的监听器
5. **调试信息**：添加了详细的日志，便于调试和监控

### 关键差异：task-panel vs task-manager
- **task-manager** 使用了正确的事件委托模式，在 `handleTaskListClick()` 中处理所有任务相关事件
- **task-panel** 之前使用了错误的重复绑定模式，每次渲染都会添加新的事件监听器
- 修复后，两者都使用相同的事件委托模式，确保事件监听器只绑定一次

## 验证方法

1. 打开开发者工具的控制台
2. 在 task-panel 中进行多次任务操作（添加、删除、更新）
3. 观察控制台日志：
   - 应该看到 TaskApplicationService 监听器数量保持稳定（通常为 1）
   - 不应该出现指数级增长的调用次数
   - 每次操作只应该触发一次 `broadcastTaskUpdates`
   - 主进程日志应该显示："已向 X 个窗口广播任务更新"，X 应该是固定的数字

### 测试步骤
1. 打开 task-panel
2. 添加一个任务 → 观察日志，应该只有 1 次广播
3. 删除这个任务 → 观察日志，应该只有 1 次广播
4. 重复步骤 2-3 多次 → 每次都应该只有 1 次广播，不会出现 2、4、8 次的指数增长

## 相关文件

- `src/presentation/task-panel/task-panel.js`
- `src/presentation/task-manager/task-manager.js`
- `src/application/services/task-application-service.js`