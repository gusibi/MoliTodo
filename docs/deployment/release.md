# 构建和发布指南

## 自动构建和发布

本项目配置了 GitHub Actions 自动构建工作流，当你推送一个新的版本标签时，会自动构建 macOS 和 Windows 版本的应用程序。

### 如何触发自动构建

1. **更新版本号**
   ```bash
   # 更新 package.json 中的版本号
   npm version patch  # 补丁版本 (1.0.0 -> 1.0.1)
   npm version minor  # 次要版本 (1.0.0 -> 1.1.0)
   npm version major  # 主要版本 (1.0.0 -> 2.0.0)
   ```

2. **创建并推送标签**
   ```bash
   # 创建标签
   git tag v1.0.1
   
   # 推送标签到 GitHub
   git push origin v1.0.1
   ```

3. **或者一步完成**
   ```bash
   # npm version 会自动创建 git 标签
   npm version patch
   git push origin main --tags
   ```

### 构建产物

自动构建会生成以下文件：

- **macOS Intel**: `MoliTodo-{version}-x64.dmg` (适用于 Intel 芯片的 Mac)
- **macOS Apple Silicon**: `MoliTodo-{version}-arm64.dmg` (适用于 M1/M2/M3 芯片的 Mac)
- **Windows**: `MoliTodo Setup {version}.exe` (NSIS 安装程序)

### 手动构建

如果需要手动构建应用程序：

```bash
# 安装依赖
npm install

# 构建 macOS 版本（同时构建 Intel 和 Apple Silicon）
npm run build:mac

# 只构建 macOS Intel 版本
npm run build:mac:intel

# 只构建 macOS Apple Silicon 版本
npm run build:mac:arm

# 构建 Windows 版本 (需要在 Windows 或使用 Wine)
npm run build:win

# 构建所有平台
npm run build:all
```

### 发布流程

1. GitHub Actions 会在标签推送时自动触发
2. 并行构建 macOS 和 Windows 版本
3. 自动创建 GitHub Release
4. 上传构建产物到 Release 页面
5. 生成发布说明

### 注意事项

- 确保 `package.json` 中的版本号与标签版本一致
- 标签必须以 `v` 开头 (如 `v1.0.0`)
- 构建过程大约需要 5-10 分钟
- 如果构建失败，检查 GitHub Actions 日志获取详细信息
- `GITHUB_TOKEN` 是 GitHub 自动提供的，无需手动配置

### 关于 GITHUB_TOKEN

GitHub Actions 会自动为每个工作流运行提供 `GITHUB_TOKEN`：
- ✅ **自动生成**：无需在仓库 Secrets 中添加
- ✅ **权限充足**：已配置 `contents: write` 权限用于创建 Release
- ✅ **安全可靠**：每次运行都会生成新的临时令牌

### 本地测试

在推送标签之前，建议先在本地测试构建：

```bash
# 测试 macOS 构建
npm run build:mac

# 检查生成的文件
ls -la dist/
```

### 故障排除

#### 缓存相关错误
如果遇到 "Dependencies lock file is not found" 错误：
- 本项目不使用 lock 文件，已移除 GitHub Actions 中的缓存配置
- 使用 `npm install` 而不是 `npm ci`

#### 构建失败
- 检查 package.json 中的构建脚本是否正确
- 确保所有依赖都已正确安装
- 查看 GitHub Actions 日志获取详细错误信息