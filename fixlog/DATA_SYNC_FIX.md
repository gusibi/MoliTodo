# 数据同步问题修复

## 问题描述
在 task-panel 中添加的任务不会立即在 task-manager 中显示，但反之则会。

## 问题原因
1. **主进程只向 task-panel 发送更新** - 主进程的 IPC 处理器只调用 `sendTasksToPanel()`，没有向 task-manager 发送更新
2. **缺少窗口焦点刷新机制** - task-manager 没有监听窗口焦点事件来主动刷新数据

## 解决方案

### 1. 主进程广播任务更新到所有窗口
在主进程中添加了 `broadcastTaskUpdates` 方法来向所有窗口发送任务更新：

```javascript
/**
 * 向所有窗口发送任务更新
 */
async broadcastTaskUpdates() {
  try {
    const tasks = await this.taskService.getIncompleteTasks();
    const completedTasks = await this.taskService.getCompletedTasks();

    // 向任务面板发送更新
    if (this.taskPanelWindow && !this.taskPanelWindow.isDestroyed()) {
      this.taskPanelWindow.webContents.send('update-tasks', tasks);
    }

    // 向任务管理器发送更新
    if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
      this.taskManagerWindow.webContents.send('update-tasks', tasks);
      this.taskManagerWindow.webContents.send('update-completed-tasks', completedTasks);
    }

    console.log('主进程: 已向所有窗口广播任务更新');
  } catch (error) {
    console.error('广播任务更新失败:', error);
  }
}
```

### 2. 替换所有 IPC 处理器中的 sendTasksToPanel 调用
将所有任务操作的 IPC 处理器中的 `sendTasksToPanel()` 调用替换为 `broadcastTaskUpdates()`：
- 创建任务
- 完成任务
- 删除任务
- 更新任务内容
- 更新任务状态
- 导入数据
- 清除数据
- 数据库迁移

### 3. 为 task-manager 添加窗口焦点事件监听
在 `src/presentation/task-manager/task-manager.js` 中添加了以下事件监听器：

```javascript
// 窗口焦点事件 - 当窗口获得焦点时刷新数据
window.addEventListener('focus', () => {
    this.refreshData();
});

// 页面可见性变化事件 - 当页面变为可见时刷新数据
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        this.refreshData();
    }
});
```

### 2. 添加 refreshData 方法
新增了 `refreshData` 方法来重新加载任务数据并更新界面：

```javascript
/**
 * 刷新数据 - 当窗口获得焦点或变为可见时调用
 */
async refreshData() {
    try {
        // 重新加载任务数据
        this.tasks = taskApplicationService.getTasks();
        this.completedTasks = taskApplicationService.getCompletedTasks();
        
        // 更新当前视图
        this.renderCurrentView();
        this.updateCounts();
        this.updateStats();
        
        console.log('Task Manager: 数据已刷新');
    } catch (error) {
        console.error('刷新数据失败:', error);
    }
}
```

### 3. 添加手动刷新快捷键
在键盘快捷键处理中添加了 F5 和 Ctrl+R 的支持：

```javascript
// F5 或 Ctrl/Cmd + R: 刷新数据
if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
    e.preventDefault();
    this.refreshData();
}
```

### 4. 为 task-panel 添加类似的事件监听（预防性措施）
虽然 task-panel 主要通过 taskApplicationService 的事件监听来更新数据，但为了保险起见，也添加了窗口焦点事件监听：

```javascript
// 窗口焦点事件 - 当窗口获得焦点时刷新数据
window.addEventListener('focus', () => {
    this.refresh();
});

// 页面可见性变化事件 - 当页面变为可见时刷新数据
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        this.refresh();
    }
});
```

## 修改的文件
1. `src/main/main.js` - 添加广播机制，替换所有 IPC 处理器中的更新调用
2. `src/presentation/task-manager/task-manager.js` - 添加窗口焦点事件监听和手动刷新
3. `src/presentation/task-panel/task-panel.js` - 添加窗口焦点事件监听（预防性措施）

## 数据同步机制
1. **主动推送** - 主进程在任务操作后立即向所有窗口广播更新
2. **被动拉取** - 窗口获得焦点时主动刷新数据
3. **事件监听** - task-application-service 监听 IPC 事件自动更新本地缓存

## 预期效果
- 当从 task-panel 添加任务后，task-manager 会立即显示新任务（无需切换窗口）
- 当切换到 task-manager 窗口时会自动刷新显示最新数据
- 用户可以使用 F5 或 Ctrl+R 手动刷新 task-manager 中的数据
- 两个组件之间的数据同步更加可靠和实时

## 测试建议
1. 在 task-panel 中添加一个新任务
2. 切换到 task-manager 窗口
3. 验证新任务是否立即显示
4. 测试 F5 和 Ctrl+R 快捷键是否能正常刷新数据