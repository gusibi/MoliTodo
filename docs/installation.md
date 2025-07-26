# 安装指南

本指南将帮助您快速安装和配置 MoliTodo。

## 系统要求

### 最低系统要求

**macOS**
- macOS 10.15 (Catalina) 或更高版本
- 至少 100MB 可用磁盘空间
- 4GB RAM（推荐 8GB）

**Windows**
- Windows 10 或更高版本
- 至少 100MB 可用磁盘空间
- 4GB RAM（推荐 8GB）

### 推荐系统配置

- **处理器**: Intel Core i5 或 AMD 同等级别处理器
- **内存**: 8GB RAM 或更多
- **存储**: SSD 硬盘（提升启动速度）
- **显示器**: 1920x1080 或更高分辨率

## 安装方式

### 方式一：下载预编译版本（推荐）

这是最简单的安装方式，适合大多数用户。

#### 1. 下载安装包

访问 [GitHub Releases 页面](https://github.com/your-username/moli-todo/releases)，下载适合您系统的最新版本：

**macOS 用户**
- Intel 芯片 Mac: `MoliTodo-{version}-x64.dmg`
- Apple Silicon Mac (M1/M2/M3): `MoliTodo-{version}-arm64.dmg`

**Windows 用户**
- `MoliTodo Setup {version}.exe`

#### 2. 安装应用

**macOS 安装步骤**
1. 双击下载的 `.dmg` 文件
2. 将 MoliTodo 拖拽到 Applications 文件夹
3. 首次运行时，可能需要在"系统偏好设置 > 安全性与隐私"中允许运行

**Windows 安装步骤**
1. 双击下载的 `.exe` 安装程序
2. 按照安装向导完成安装
3. 首次运行时，Windows Defender 可能会显示警告，选择"仍要运行"

#### 3. 首次启动

1. 启动 MoliTodo 应用
2. 应用会在桌面显示一个悬浮图标
3. 点击系统托盘中的 MoliTodo 图标可以访问设置

### 方式二：从源码构建

适合开发者或需要自定义构建的用户。

#### 1. 环境准备

确保您的系统已安装：
- **Node.js**: 16.0 或更高版本
- **npm**: 7.0 或更高版本
- **Git**: 用于克隆代码仓库

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version
```

#### 2. 克隆代码仓库

```bash
git clone https://github.com/your-username/moli-todo.git
cd moli-todo
```

#### 3. 安装依赖

```bash
# 安装所有依赖（已合并到根目录）
npm install
```

#### 4. 运行开发版本

```bash
# 启动开发模式
npm run dev
```

#### 5. 构建生产版本

```bash
# 构建当前平台版本
npm run build

# 构建 macOS 版本
npm run build:mac

# 构建 Windows 版本（需要在 Windows 系统或使用 Wine）
npm run build:win
```

## 首次配置

### 1. 基本设置

首次启动后，建议进行以下配置：

1. **悬浮图标位置**: 拖拽图标到您喜欢的位置
2. **开机自启动**: 在设置中启用开机自启动
3. **通知权限**: 允许应用发送系统通知

### 2. 权限设置

**macOS 权限配置**
- **辅助功能**: 系统偏好设置 > 安全性与隐私 > 辅助功能
- **通知权限**: 系统偏好设置 > 通知 > MoliTodo
- **全屏访问**: 系统偏好设置 > 安全性与隐私 > 隐私 > 屏幕录制

**Windows 权限配置**
- **通知权限**: 设置 > 系统 > 通知和操作
- **开机自启动**: 设置 > 应用 > 启动

### 3. 数据迁移（可选）

如果您之前使用过 MoliTodo 的其他版本：

1. 打开设置页面
2. 在"数据管理"部分点击"导入数据"
3. 选择之前导出的数据文件
4. 确认导入完成

## 验证安装

### 1. 功能测试

安装完成后，请验证以下功能：

- [ ] 悬浮图标正常显示
- [ ] 可以拖拽移动图标
- [ ] 悬停显示任务面板
- [ ] 可以添加新任务
- [ ] 系统托盘图标正常工作
- [ ] 设置页面可以正常打开

### 2. 性能检查

- 应用启动时间应在 3 秒内
- 内存占用应在 100MB 以下
- CPU 占用在空闲时应接近 0%

## 常见安装问题

### macOS 相关问题

**问题**: "无法打开 MoliTodo，因为它来自身份不明的开发者"
**解决方案**:
1. 右键点击应用，选择"打开"
2. 或在终端运行: `sudo xattr -rd com.apple.quarantine /Applications/MoliTodo.app`

**问题**: 悬浮图标不显示
**解决方案**:
1. 检查"系统偏好设置 > 安全性与隐私 > 辅助功能"权限
2. 重启应用

### Windows 相关问题

**问题**: Windows Defender 阻止安装
**解决方案**:
1. 点击"更多信息"
2. 选择"仍要运行"
3. 或将应用添加到 Windows Defender 白名单

**问题**: 应用无法启动
**解决方案**:
1. 确保已安装 Visual C++ Redistributable
2. 以管理员权限运行
3. 检查防火墙设置

### 通用问题

**问题**: 应用启动缓慢
**解决方案**:
1. 关闭不必要的后台应用
2. 确保有足够的可用内存
3. 考虑将应用安装到 SSD

**问题**: 数据丢失
**解决方案**:
1. 检查应用数据目录是否存在
2. 尝试从备份恢复数据
3. 联系技术支持

## 卸载指南

### macOS 卸载

1. 退出 MoliTodo 应用
2. 将 `/Applications/MoliTodo.app` 移到废纸篓
3. 删除用户数据（可选）:
   ```bash
   rm -rf ~/Library/Application\ Support/MoliTodo
   rm -rf ~/Library/Preferences/com.molitodo.app.plist
   ```

### Windows 卸载

1. 通过"控制面板 > 程序和功能"卸载
2. 或使用"设置 > 应用"卸载
3. 删除用户数据（可选）:
   - `%APPDATA%\MoliTodo`
   - `%LOCALAPPDATA%\MoliTodo`

## 获取帮助

如果在安装过程中遇到问题：

1. **查看文档**: 阅读[故障排除指南](./deployment/troubleshooting.md)
2. **搜索问题**: 在 [GitHub Issues](https://github.com/your-username/moli-todo/issues) 搜索相似问题
3. **提交问题**: 如果问题未解决，请创建新的 Issue
4. **联系支持**: 发送邮件到 support@molitodo.com

---

*安装完成后，建议阅读[用户手册](./user-guide.md)了解详细的使用方法。*