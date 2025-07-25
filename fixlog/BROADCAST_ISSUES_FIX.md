# 广播问题修复

## 问题描述
1. **设置提醒时间报错** - "提醒时间不能是过去的时间"
2. **递增的广播问题** - 每次操作触发的广播数量在递增（第一次4条，第二次8条等）

## 问题分析

### 问题1：时间验证过于严格
`Task.setReminder()` 方法中的时间验证过于严格，没有考虑网络延迟和处理时间：
```javascript
if (reminderTime && reminderTime <= new Date()) {
  throw new Error('提醒时间不能是过去的时间');
}
```

### 问题2：IPC 事件监听器重复添加
`taskApplicationService.init()` 被多个组件调用：
- `task-panel.js` 调用一次
- `task-manager.js` 调用一次

每次调用 `setupIpcListeners()` 都会添加新的事件监听器，但没有移除旧的监听器，导致：
- 第一次初始化：1个监听器
- 第二次初始化：2个监听器
- 每次广播都会触发所有监听器，导致递增的广播效果

## 解决方案

### 1. 修复时间验证
在 `src/domain/entities/task.js` 中添加30秒的时间容差：

```javascript
setReminder(reminderTime) {
  if (reminderTime) {
    const now = new Date();
    // 允许30秒的时间容差，避免因为网络延迟或处理时间导致的问题
    const minAllowedTime = new Date(now.getTime() - 30 * 1000);
    
    if (reminderTime <= minAllowedTime) {
      throw new Error('提醒时间不能是过去的时间');
    }
  }
  this.reminderTime = reminderTime;
  this.updatedAt = new Date();
}
```

### 2. 修复重复监听器问题
在 `src/application/services/task-application-service.js` 中：

#### 改进 setupIpcListeners 方法
```javascript
setupIpcListeners() {
  // 先移除可能存在的旧监听器，避免重复添加
  ipcRenderer.removeAllListeners('update-tasks');
  ipcRenderer.removeAllListeners('update-completed-tasks');
  
  // 监听任务更新事件
  ipcRenderer.on('update-tasks', async (event, tasks) => {
    console.log('TaskApplicationService: 接收到任务更新事件', tasks?.length || 0, '个任务');
    this.tasks = tasks || [];
    this.notifyListeners('tasksUpdated', this.tasks);
  });

  // 监听已完成任务更新事件
  ipcRenderer.on('update-completed-tasks', async (event, completedTasks) => {
    console.log('TaskApplicationService: 接收到已完成任务更新事件', completedTasks?.length || 0, '个任务');
    this.completedTasks = completedTasks || [];
    this.notifyListeners('completedTasksUpdated', this.completedTasks);
  });
}
```

#### 改进 init 方法
```javascript
async init() {
  if (this.isInitialized) {
    console.log('TaskApplicationService: 已经初始化，跳过重复初始化');
    return;
  }

  console.log('TaskApplicationService: 开始初始化');
  await this.loadAllData();
  this.setupIpcListeners();
  this.isInitialized = true;
  console.log('TaskApplicationService: 初始化完成');
}
```

#### 改进 destroy 方法
```javascript
destroy() {
  console.log('TaskApplicationService: 开始清理资源');
  
  // 清理 IPC 监听器
  ipcRenderer.removeAllListeners('update-tasks');
  ipcRenderer.removeAllListeners('update-completed-tasks');
  
  // 清理事件监听器
  this.listeners = {
    tasksUpdated: [],
    completedTasksUpdated: []
  };
  
  // 重置初始化状态
  this.isInitialized = false;
  
  console.log('TaskApplicationService: 资源清理完成');
}
```

### 3. 改进主进程广播日志
在 `src/main/main.js` 中改进 `broadcastTaskUpdates` 方法的日志：

```javascript
console.log(`主进程: 已向 ${sentCount} 个窗口广播任务更新 (${tasks.length} 个未完成任务, ${completedTasks.length} 个已完成任务)`);
```

## 修改的文件
1. `src/domain/entities/task.js` - 修复时间验证
2. `src/application/services/task-application-service.js` - 修复重复监听器问题
3. `src/main/main.js` - 改进广播日志

## 预期效果
1. **时间验证问题解决** - 设置提醒时间不再因为微小的时间差而报错
2. **广播数量正常** - 每次操作只触发一次广播，不再递增
3. **更好的调试信息** - 控制台日志更清晰，便于调试

## 测试建议
1. 设置任务提醒时间，确认不再报错
2. 连续进行多次任务操作，观察广播日志数量保持一致
3. 打开/关闭不同窗口，确认初始化日志正常
4. 检查控制台日志，确认事件监听器正常工作