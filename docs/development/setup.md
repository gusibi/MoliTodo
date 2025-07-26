# 开发环境搭建

本指南将帮助您搭建 MoliTodo 的开发环境。

## 环境要求

### 必需软件

**Node.js**
- 版本：16.0 或更高
- 推荐：使用 LTS 版本
- 下载：[nodejs.org](https://nodejs.org/)

**Git**
- 用于版本控制和代码管理
- 下载：[git-scm.com](https://git-scm.com/)

**代码编辑器**
- 推荐：Visual Studio Code
- 其他：WebStorm、Sublime Text 等

### 可选工具

**包管理器**
- npm（Node.js 自带）
- 或 yarn、pnpm

**调试工具**
- Chrome DevTools（用于渲染进程调试）
- Electron DevTools

## 项目克隆

### 1. 克隆仓库

```bash
# 使用 HTTPS
git clone https://github.com/your-username/moli-todo.git

# 或使用 SSH
git clone git@github.com:your-username/moli-todo.git

# 进入项目目录
cd moli-todo
```

### 2. 检查项目结构

```bash
# 查看项目结构
tree -I node_modules
```

预期的目录结构：
```
moli-todo/
├── src/
│   ├── main/                    # 主进程
│   ├── domain/                  # 领域层
│   ├── infrastructure/          # 基础设施层
│   └── renderer/                # 渲染进程 (Vue 应用)
├── docs/                        # 文档
├── package.json                 # 项目配置
└── README.md                    # 项目说明
```

## 依赖安装

### 1. 安装主项目依赖

```bash
# 在项目根目录执行
npm install
```

### 2. 验证安装

```bash
# 检查依赖是否正确安装
npm list --depth=0
```

### 3. 常见依赖问题

**权限问题（macOS/Linux）**
```bash
# 如果遇到权限问题
sudo npm install -g npm
```

**网络问题**
```bash
# 使用国内镜像
npm config set registry https://registry.npmmirror.com/
```

**依赖冲突**
```bash
# 清理缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

## 开发工具配置

### Visual Studio Code

#### 推荐扩展

安装以下 VS Code 扩展以获得最佳开发体验：

```json
{
  "recommendations": [
    "vue.volar",                    // Vue 3 支持
    "vue.vscode-typescript-vue-plugin", // Vue TypeScript 支持
    "bradlc.vscode-tailwindcss",    // Tailwind CSS 支持
    "esbenp.prettier-vscode",       // 代码格式化
    "dbaeumer.vscode-eslint",       // ESLint 支持
    "ms-vscode.vscode-json",        // JSON 支持
    "ms-vscode.vscode-typescript"   // TypeScript 支持
  ]
}
```

#### 工作区配置

创建 `.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.vue": "vue"
  },
  "emmet.includeLanguages": {
    "vue": "html"
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

#### 调试配置

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main/main.js",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src/renderer/src"
    }
  ]
}
```

### Git 配置

#### 设置用户信息

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### 配置 Git Hooks

```bash
# 安装 husky（如果项目使用）
npm install --save-dev husky
npx husky install
```

## 启动开发环境

### 1. 开发模式启动

```bash
# 启动开发服务器
npm run dev
```

这个命令会：
1. 启动 Vite 开发服务器（端口 5173）
2. 启动 Electron 主进程
3. 启用热重载功能

### 2. 验证启动

启动成功后，您应该看到：
- 终端显示 Vite 服务器启动信息
- Electron 应用窗口打开
- 桌面上出现悬浮图标

### 3. 开发服务器配置

Vite 开发服务器配置位于 `src/renderer/vite.config.js`：

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
```

## 调试配置

### 主进程调试

**方法一：使用 VS Code**
1. 在 VS Code 中打开项目
2. 设置断点
3. 按 F5 或选择"Debug Main Process"配置

**方法二：使用 Node.js 调试器**
```bash
# 启动调试模式
node --inspect src/main/main.js
```

### 渲染进程调试

**方法一：使用 Chrome DevTools**
1. 在 Electron 应用中按 `Ctrl+Shift+I`（Windows）或 `Cmd+Option+I`（macOS）
2. 使用浏览器开发工具调试

**方法二：使用 Vue DevTools**
```bash
# 安装 Vue DevTools
npm install -g @vue/devtools
```

### 日志调试

在代码中添加日志：

```javascript
// 主进程日志
console.log('Main process log')

// 渲染进程日志
console.log('Renderer process log')

// 使用 electronAPI 发送日志到主进程
window.electronAPI?.utils?.log('Debug message')
```

## 代码规范

### ESLint 配置

项目使用 ESLint 进行代码检查，配置文件 `.eslintrc.js`：

```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    '@vue/eslint-config-typescript'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // 自定义规则
  }
}
```

### Prettier 配置

代码格式化配置 `.prettierrc`：

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 100
}
```

### 运行代码检查

```bash
# 检查代码规范
npm run lint

# 自动修复可修复的问题
npm run lint:fix

# 格式化代码
npm run format
```

## 测试环境

### 单元测试

```bash
# 运行单元测试
npm run test

# 运行测试并监听文件变化
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage
```

### E2E 测试

```bash
# 运行端到端测试
npm run test:e2e
```

## 构建测试

### 开发构建

```bash
# 构建应用（不打包）
npm run build
```

### 生产构建

```bash
# 构建并打包应用
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:all    # 所有平台
```

## 常见问题

### 端口冲突

如果端口 5173 被占用：

```bash
# 查找占用端口的进程
lsof -i :5173

# 杀死进程
kill -9 <PID>

# 或修改 vite.config.js 中的端口配置
```

### 权限问题

**macOS 开发者权限**
```bash
# 允许应用访问辅助功能
sudo tccutil reset Accessibility com.molitodo.app
```

**Windows 开发者模式**
- 在设置中启用开发者模式
- 允许应用通过防火墙

### 依赖版本冲突

```bash
# 检查依赖版本
npm outdated

# 更新依赖
npm update

# 强制重新安装
rm -rf node_modules package-lock.json
npm install
```

## 下一步

环境搭建完成后，建议：

1. 阅读[架构设计文档](./architecture.md)了解项目结构
2. 查看[开发指南](./guide.md)学习开发流程
3. 浏览[API 文档](./api.md)了解接口设计
4. 参考[代码规范](./coding-standards.md)保持代码质量

## 获取帮助

如果在环境搭建过程中遇到问题：

1. 检查 [FAQ](../deployment/troubleshooting.md)
2. 搜索 [GitHub Issues](https://github.com/your-username/moli-todo/issues)
3. 在 [Discussions](https://github.com/your-username/moli-todo/discussions) 提问
4. 联系维护者：dev@molitodo.com

---

*开发环境搭建完成后，您就可以开始为 MoliTodo 贡献代码了！*