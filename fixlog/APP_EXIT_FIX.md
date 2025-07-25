# 应用退出问题修复

## 问题描述
托盘菜单中的"退出 MoliTodo"选项点击后应用无法正常退出。

## 问题原因
1. **悬浮窗口缺少关闭事件处理** - 悬浮窗口没有 `close` 事件监听器
2. **窗口关闭逻辑不完整** - 在退出时没有确保所有窗口都能正常关闭
3. **退出流程不够健壮** - 缺少足够的日志和错误处理

## 解决方案

### 1. 为悬浮窗口添加关闭事件处理
```javascript
// 处理悬浮窗口关闭事件
this.floatingWindow.on('close', (event) => {
  if (!this.isQuitting) {
    // 如果不是应用退出，阻止关闭（悬浮窗口应该始终存在）
    event.preventDefault();
  }
});

// 悬浮窗口关闭时清理引用
this.floatingWindow.on('closed', () => {
  this.floatingWindow = null;
});
```

### 2. 改进托盘菜单的退出逻辑
```javascript
{
  label: '退出 MoliTodo',
  click: () => {
    console.log('用户点击退出菜单');
    this.isQuitting = true;
    
    // 立即关闭所有窗口
    if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
      this.floatingWindow.close();
    }
    if (this.taskPanelWindow && !this.taskPanelWindow.isDestroyed()) {
      this.taskPanelWindow.close();
    }
    if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
      this.taskManagerWindow.close();
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close();
    }
    
    // 延迟一点时间确保窗口关闭完成，然后退出应用
    setTimeout(() => {
      app.quit();
    }, 100);
  }
}
```

### 3. 强化 before-quit 事件处理
```javascript
app.on('before-quit', () => {
  console.log('应用准备退出...');
  this.isQuitting = true;
  this.notificationService.clearAllSchedules();
  
  // 确保所有窗口都能正常关闭
  if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
    this.floatingWindow.destroy();
  }
  if (this.taskPanelWindow && !this.taskPanelWindow.isDestroyed()) {
    this.taskPanelWindow.destroy();
  }
  if (this.taskManagerWindow && !this.taskManagerWindow.isDestroyed()) {
    this.taskManagerWindow.destroy();
  }
  if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
    this.settingsWindow.destroy();
  }
});
```

### 4. 添加 will-quit 事件处理
```javascript
app.on('will-quit', (event) => {
  console.log('应用即将退出...');
  if (!this.isQuitting) {
    console.log('意外的退出尝试，阻止退出');
    event.preventDefault();
  }
});
```

### 5. 改进 window-all-closed 事件处理
```javascript
app.on('window-all-closed', (event) => {
  console.log('所有窗口已关闭，isQuitting:', this.isQuitting);
  if (!this.isQuitting) {
    event.preventDefault();
    console.log('阻止应用退出');
  } else {
    console.log('允许应用退出');
  }
});
```

## 修改的文件
- `src/main/main.js`

## 退出流程
1. 用户点击托盘菜单的"退出 MoliTodo"
2. 设置 `isQuitting = true`
3. 逐个关闭所有窗口
4. 延迟 100ms 后调用 `app.quit()`
5. 触发 `before-quit` 事件，强制销毁所有窗口
6. 触发 `will-quit` 事件，确认退出
7. 触发 `window-all-closed` 事件，允许退出
8. 应用正常退出

## 调试信息
添加了详细的控制台日志来帮助诊断退出过程中的问题：
- 用户点击退出菜单的日志
- 应用准备退出的日志
- 窗口关闭状态的日志
- 退出流程各阶段的日志

## 测试建议
1. 右键点击系统托盘中的 MoliTodo 图标
2. 点击"退出 MoliTodo"选项
3. 验证应用是否正常退出
4. 检查控制台日志确认退出流程正常
5. 测试在有多个窗口打开时的退出行为