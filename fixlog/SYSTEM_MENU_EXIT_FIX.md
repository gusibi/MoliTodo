# 系统菜单退出应用修复

## 问题描述
当前通过系统菜单（如 macOS 的 Cmd+Q 或 Windows 的 Alt+F4）无法正常退出应用。

## 问题原因
在 `src/main/main.js` 中的 `window-all-closed` 事件处理器阻止了应用的默认退出行为：

```javascript
app.on('window-all-closed', (event) => {
  if (!this.isQuitting) {
    event.preventDefault();
  }
});
```

这导致即使用户通过系统菜单尝试退出应用，应用也不会正常退出。

## 解决方案

### 1. 修改 window-all-closed 事件处理
更新了 `src/main/main.js` 中的事件处理逻辑：

- 在 macOS 上，只有在非主动退出时才阻止默认行为
- 在其他平台上，同样只在非主动退出时阻止默认行为
- 当 `isQuitting = true` 时，允许应用正常退出

### 2. 改进 before-quit 事件处理
- 正确设置 `isQuitting` 标志
- 清理通知服务
- 调用 WindowManager 的 cleanup 方法而不是 quit 方法，避免重复调用 app.quit()

### 3. 添加 WindowManager.cleanup() 方法
在 `src/main/window-manager.js` 中添加了新的 `cleanup()` 方法：

- 清理所有窗口
- 销毁系统托盘
- 不调用 app.quit()，避免重复退出

### 4. 增强单例模式处理
添加了 `second-instance` 事件处理，当用户尝试启动第二个实例时：

- 如果有任务管理窗口，则聚焦它
- 否则显示悬浮图标

## 修改的文件

1. `src/main/main.js`
   - 更新 `setupAppEvents()` 方法
   - 改进 `window-all-closed` 和 `before-quit` 事件处理
   - 添加 `second-instance` 事件处理

2. `src/main/window-manager.js`
   - 添加 `cleanup()` 方法
   - 保持原有的 `quit()` 方法用于托盘菜单退出

## 测试验证

修复后，应用应该能够：

1. ✅ 通过 macOS 的 Cmd+Q 正常退出
2. ✅ 通过 Windows 的 Alt+F4 正常退出
3. ✅ 通过系统菜单的"退出"选项正常退出
4. ✅ 通过托盘菜单的"退出 MoliTodo"正常退出
5. ✅ 在关闭所有窗口时保持应用运行（后台模式）
6. ✅ 防止启动多个应用实例

## 注意事项

- 修改保持了应用的后台运行特性
- 确保了跨平台兼容性
- 避免了重复调用 app.quit() 导致的潜在问题