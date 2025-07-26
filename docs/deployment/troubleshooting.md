# 故障排除指南

本指南帮助您解决 MoliTodo 使用过程中可能遇到的常见问题。

## 安装问题

### macOS 安装问题

#### 问题：无法打开应用，提示"来自身份不明的开发者"

**症状**：双击应用时显示安全警告，无法正常启动。

**解决方案**：
```bash
# 方法 1：右键打开
# 右键点击应用 → 选择"打开" → 点击"打开"

# 方法 2：命令行解除隔离
sudo xattr -rd com.apple.quarantine /Applications/MoliTodo.app

# 方法 3：系统偏好设置
# 系统偏好设置 → 安全性与隐私 → 通用 → 点击"仍要打开"
```

#### 问题：应用启动后立即崩溃

**症状**：应用启动几秒后自动退出，没有错误提示。

**解决方案**：
1. 检查系统版本是否符合要求（macOS 10.15+）
2. 查看控制台日志：
   ```bash
   # 打开控制台应用，搜索 "MoliTodo" 查看错误日志
   ```
3. 重新下载安装包
4. 清除应用数据后重试：
   ```bash
   rm -rf ~/Library/Application\ Support/MoliTodo
   rm -rf ~/Library/Preferences/com.molitodo.app.plist
   ```

#### 问题：悬浮图标不显示

**症状**：应用启动成功，但桌面上看不到悬浮图标。

**解决方案**：
1. 检查辅助功能权限：
   - 系统偏好设置 → 安全性与隐私 → 隐私 → 辅助功能
   - 确保 MoliTodo 已被添加并启用
2. 检查应用设置：
   - 点击系统托盘中的 MoliTodo 图标
   - 确保"显示悬浮图标"选项已启用
3. 重启应用

### Windows 安装问题

#### 问题：Windows Defender 阻止安装

**症状**：下载或运行安装程序时，Windows Defender 显示威胁警告。

**解决方案**：
1. 点击"更多信息"
2. 选择"仍要运行"
3. 或将应用添加到 Windows Defender 排除列表：
   - Windows 安全中心 → 病毒和威胁防护 → 排除项 → 添加排除项

#### 问题：安装程序无法运行

**症状**：双击安装程序没有反应，或显示错误对话框。

**解决方案**：
1. 以管理员身份运行安装程序
2. 检查系统要求（Windows 10+）
3. 安装 Visual C++ Redistributable：
   ```
   下载并安装最新的 Microsoft Visual C++ Redistributable
   ```
4. 临时禁用防病毒软件

#### 问题：应用无法启动

**症状**：安装成功但应用无法启动，或启动后立即退出。

**解决方案**：
1. 以管理员身份运行
2. 检查 Windows 事件查看器中的错误日志
3. 确保 .NET Framework 已安装
4. 清除应用数据：
   ```
   删除 %APPDATA%\MoliTodo 文件夹
   删除 %LOCALAPPDATA%\MoliTodo 文件夹
   ```

## 功能问题

### 悬浮图标问题

#### 问题：悬浮图标消失了

**解决方案**：
1. 检查系统托盘，点击 MoliTodo 图标
2. 选择"显示悬浮图标"
3. 如果托盘图标也不见了，重启应用
4. 检查应用是否被意外关闭

#### 问题：悬浮图标无法拖拽

**解决方案**：
1. 确保没有其他应用占用鼠标事件
2. 重启应用
3. 检查系统权限设置

#### 问题：悬浮图标显示位置不正确

**解决方案**：
1. 拖拽图标到合适位置
2. 如果拖拽无效，在设置中重置图标位置
3. 检查多显示器设置

### 任务管理问题

#### 问题：任务无法添加

**症状**：在输入框中输入内容后按回车，任务没有被添加。

**解决方案**：
1. 检查输入内容是否为空
2. 确保输入内容不超过字符限制（500字符）
3. 重启应用
4. 检查数据库文件是否损坏

#### 问题：任务状态无法切换

**症状**：点击任务状态图标，状态没有改变。

**解决方案**：
1. 等待几秒钟，可能是网络延迟
2. 刷新任务列表
3. 重启应用
4. 检查数据库连接

#### 问题：任务时间追踪不准确

**症状**：任务进行时间显示不正确，或停止后时间仍在增长。

**解决方案**：
1. 手动暂停并重新开始任务
2. 重启应用以重置计时器
3. 检查系统时间是否正确
4. 在设置中重置任务数据（注意备份）

### 提醒功能问题

#### 问题：任务提醒不工作

**症状**：设置了提醒时间，但到时间后没有收到通知。

**解决方案**：
1. 检查系统通知权限：
   - **macOS**: 系统偏好设置 → 通知 → MoliTodo
   - **Windows**: 设置 → 系统 → 通知和操作
2. 确保应用正在运行
3. 检查提醒时间设置是否正确
4. 重新设置提醒

#### 问题：通知显示异常

**症状**：收到通知但内容显示不正确，或通知样式异常。

**解决方案**：
1. 重启应用
2. 检查系统通知设置
3. 更新到最新版本

### 数据同步问题

#### 问题：多窗口数据不同步

**症状**：在任务管理器中的操作没有反映到悬浮面板中。

**解决方案**：
1. 刷新页面或重启应用
2. 检查是否有多个应用实例在运行
3. 清除缓存数据

#### 问题：数据丢失

**症状**：之前创建的任务突然消失。

**解决方案**：
1. 检查任务筛选设置（可能被筛选隐藏）
2. 查看已完成任务列表
3. 尝试从备份恢复：
   ```bash
   # macOS
   ls ~/Library/Application\ Support/MoliTodo/backups/
   
   # Windows
   dir %APPDATA%\MoliTodo\backups\
   ```
4. 使用数据导入功能恢复

## 性能问题

### 应用运行缓慢

#### 问题：应用响应速度慢

**解决方案**：
1. 关闭不必要的后台应用
2. 重启应用
3. 清理已完成的旧任务
4. 检查系统资源使用情况：
   ```bash
   # macOS
   Activity Monitor → 查看 MoliTodo 进程
   
   # Windows
   任务管理器 → 详细信息 → 查找 MoliTodo.exe
   ```

#### 问题：内存占用过高

**症状**：应用内存使用超过 200MB。

**解决方案**：
1. 重启应用
2. 减少同时打开的窗口数量
3. 清理任务数据
4. 更新到最新版本

#### 问题：CPU 占用率高

**症状**：应用持续占用较高的 CPU 资源。

**解决方案**：
1. 检查是否有死循环或无限递归
2. 重启应用
3. 禁用不必要的功能（如实时时间更新）
4. 联系技术支持

## 主题和界面问题

### 主题切换问题

#### 问题：主题切换不生效

**症状**：在设置中切换主题，但界面没有变化。

**解决方案**：
1. 刷新页面
2. 重启应用
3. 清除浏览器缓存（如果使用 Web 版本）
4. 检查 CSS 文件是否损坏

#### 问题：界面显示异常

**症状**：文字重叠、布局错乱、颜色异常等。

**解决方案**：
1. 重置主题到默认设置
2. 检查系统缩放设置
3. 更新显卡驱动
4. 重新安装应用

### 响应式布局问题

#### 问题：在高分辨率屏幕上显示过小

**解决方案**：
1. 调整系统缩放设置
2. 在应用设置中调整界面大小
3. 使用浏览器缩放功能（Ctrl/Cmd + +）

## 数据备份和恢复

### 手动备份数据

```bash
# macOS
cp -r ~/Library/Application\ Support/MoliTodo ~/Desktop/MoliTodo-backup-$(date +%Y%m%d)

# Windows
xcopy "%APPDATA%\MoliTodo" "%USERPROFILE%\Desktop\MoliTodo-backup-%date%" /E /I
```

### 恢复数据

1. **从应用内导入**：
   - 打开设置页面
   - 点击"导入数据"
   - 选择备份文件

2. **手动恢复**：
   ```bash
   # macOS
   rm -rf ~/Library/Application\ Support/MoliTodo
   cp -r ~/Desktop/MoliTodo-backup-20240726 ~/Library/Application\ Support/MoliTodo
   
   # Windows
   rmdir /s "%APPDATA%\MoliTodo"
   xcopy "%USERPROFILE%\Desktop\MoliTodo-backup-20240726" "%APPDATA%\MoliTodo" /E /I
   ```

## 日志和调试

### 查看应用日志

#### macOS
```bash
# 查看应用日志
log show --predicate 'process == "MoliTodo"' --last 1h

# 查看崩溃日志
ls ~/Library/Logs/DiagnosticReports/ | grep MoliTodo
```

#### Windows
```bash
# 查看事件日志
eventvwr.msc
# 导航到 Windows 日志 → 应用程序，搜索 MoliTodo
```

### 开启调试模式

```bash
# 启动时添加调试参数
# macOS
/Applications/MoliTodo.app/Contents/MacOS/MoliTodo --debug

# Windows
"C:\Program Files\MoliTodo\MoliTodo.exe" --debug
```

### 收集诊断信息

在报告问题时，请提供以下信息：

1. **系统信息**：
   - 操作系统版本
   - 应用版本
   - 硬件配置

2. **问题描述**：
   - 具体症状
   - 复现步骤
   - 预期行为

3. **日志文件**：
   - 应用日志
   - 系统日志
   - 崩溃报告

4. **截图或录屏**：
   - 问题界面截图
   - 操作过程录屏

## 重置和重新安装

### 重置应用设置

```bash
# macOS
rm ~/Library/Preferences/com.molitodo.app.plist

# Windows
# 删除注册表项（谨慎操作）
# HKEY_CURRENT_USER\Software\MoliTodo
```

### 完全重新安装

1. **卸载应用**：
   - macOS: 将应用拖到废纸篓
   - Windows: 控制面板 → 程序和功能 → 卸载

2. **清除数据**：
   ```bash
   # macOS
   rm -rf ~/Library/Application\ Support/MoliTodo
   rm -rf ~/Library/Preferences/com.molitodo.app.plist
   rm -rf ~/Library/Caches/com.molitodo.app
   
   # Windows
   rmdir /s "%APPDATA%\MoliTodo"
   rmdir /s "%LOCALAPPDATA%\MoliTodo"
   ```

3. **重新安装**：
   - 下载最新版本安装包
   - 按照正常流程安装

## 获取帮助

### 自助资源

1. **文档中心**：查看完整的[用户手册](../user-guide.md)
2. **FAQ**：查看[常见问题](../faq.md)
3. **社区论坛**：在 [GitHub Discussions](https://github.com/your-username/moli-todo/discussions) 搜索相似问题

### 联系支持

如果问题仍未解决：

1. **GitHub Issues**：
   - 搜索现有问题：https://github.com/your-username/moli-todo/issues
   - 创建新问题，使用问题模板

2. **邮件支持**：
   - 技术支持：support@molitodo.com
   - 包含详细的问题描述和系统信息

3. **社区支持**：
   - GitHub Discussions：https://github.com/your-username/moli-todo/discussions
   - 参与社区讨论，获得其他用户的帮助

### 问题报告模板

```markdown
**问题描述**
[简洁描述问题]

**系统环境**
- 操作系统: [如 macOS 13.0 / Windows 11]
- 应用版本: [如 v0.5.0]
- 硬件信息: [如 MacBook Pro M2 / Intel i7]

**复现步骤**
1. [第一步]
2. [第二步]
3. [第三步]

**预期行为**
[描述期望的正确行为]

**实际行为**
[描述实际发生的情况]

**截图/日志**
[附加相关截图或日志文件]

**尝试过的解决方案**
[列出已经尝试过的解决方法]
```

---

*如果您的问题没有在本指南中找到解决方案，请不要犹豫联系我们的技术支持团队。我们致力于为每位用户提供最佳的使用体验。*