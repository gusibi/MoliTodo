# MoliTodo

<div align="center">
  <img src="src/presentation/assets/icons/app-icon-512x512.png" alt="MoliTodo Logo" width="128" height="128">
  
  **一款常驻在桌面边缘的悬浮式待办事项应用**
  
  [![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](package.json)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)](#支持平台)
  [![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D.svg)](https://vuejs.org/)
  [![Electron](https://img.shields.io/badge/Electron-28.x-47848F.svg)](https://electronjs.org/)
</div>

## 简介

MoliTodo 旨在提供最快速的任务查看和添加体验。通过可自定义位置的悬浮图标，将核心信息与操作入口始终置于用户视线可及之处。用户无需切换应用，即可快速管理每日任务，并通过醒目的提醒动画，确保重要事项不会被遗漏。

**� *v0.5.0 重大更新**: 全面重构为 Vue 3 + electron-vite 架构，提供更好的开发体验和性能表现！

### 核心特性

- � ***无缝集成** - 不打断当前工作流，与桌面环境融为一体
- ⚡ **即时提醒** - 通过角标和动画提供直观、强烈的任务提醒
- 🚀 **快速操作** - 悬浮即可查看，输入即是添加，操作路径极短
- 💾 **本地存储** - 所有数据存储在本地，保护隐私安全
- 🎨 **自定义外观** - 支持透明度、大小调节和主题切换
- 🔧 **现代架构** - Vue 3 + Composition API，更好的开发体验

## 功能特性

### 悬浮图标
- ✅ 始终置顶显示，可拖拽移动
- ✅ 实时显示未完成任务数量角标
- ✅ 任务提醒时自动变色和动画提示
- ✅ 支持透明度和大小自定义
- ✅ 进行中任务指示器

### 任务管理
- ✅ 鼠标悬停即可查看任务列表
- ✅ 快速添加新任务（支持回车键）
- ✅ 一键完成或删除任务
- ✅ 任务状态切换（待办 → 进行中 → 已完成）
- ✅ 设置任务提醒时间
- ✅ 完整的任务管理页面，支持分类查看
- ✅ 时间追踪功能
- ✅ 任务统计和分析

### 智能提醒
- ✅ 自定义提醒时间
- ✅ 系统桌面通知
- ✅ 多种提醒声音选择
- ✅ 逾期任务特殊标识

### 数据管理
- ✅ 本地 SQLite 数据库存储
- ✅ 支持数据导入导出
- ✅ 自动数据备份和恢复
- ✅ 开机自启动设置

## 技术架构 (v0.5.0 新架构)

MoliTodo v0.5.0 采用现代化的 Vue 3 + electron-vite 架构：

### 技术栈

#### 主进程 (Node.js)
- **Electron 28.x**: 桌面应用框架
- **SQLite**: 数据持久化
- **node-schedule**: 任务提醒调度
- **领域驱动设计**: 清晰的业务逻辑分层

#### 渲染进程 (Web)
- **Vue 3**: 前端框架 (Composition API)
- **Vue Router**: 路由管理
- **Pinia**: 状态管理
- **Vite**: 现代化构建工具

### 项目结构
```
src/
├── main/                       # 主进程代码
│   ├── main.js                # 应用入口点
│   ├── window-manager.js      # 窗口管理器
│   ├── ipc-handlers.js        # IPC 通信处理器
│   └── preload.js             # 预加载脚本，安全暴露 IPC 接口
│
├── domain/                     # 领域层 - 核心业务逻辑
│   ├── entities/
│   │   └── task.js            # 任务实体
│   └── services/
│       └── task-service.js    # 任务业务服务
│
├── infrastructure/             # 基础设施层 - 技术实现
│   ├── persistence/
│   │   ├── sqlite-task-repository.js
│   │   └── file-task-repository.js
│   └── notification/
│       └── notification-service.js
│
└── renderer/                   # 表现层 - Vue 应用
    ├── src/
    │   ├── components/         # Vue 组件
    │   │   ├── FloatingIcon.vue
    │   │   ├── TaskManager.vue
    │   │   ├── TaskPanel.vue
    │   │   └── Settings.vue
    │   ├── views/              # 页面级组件
    │   │   ├── MainView.vue
    │   │   ├── TaskManagerView.vue
    │   │   ├── TaskPanelView.vue
    │   │   └── SettingsView.vue
    │   ├── store/              # Pinia 状态管理
    │   │   └── taskStore.js
    │   ├── App.vue             # 根组件
    │   └── main.js             # Vue 应用入口
    ├── package.json            # 渲染进程依赖
    └── vite.config.js          # Vite 配置
```

### 架构优势

1. **清晰的分层架构**
   - 主进程负责窗口管理、系统集成、业务逻辑
   - 渲染进程为纯 Vue 应用，负责用户界面
   - 安全的 IPC 通信机制

2. **现代化开发体验**
   - Vite 提供快速的热重载开发体验
   - Vue 3 Composition API 提供更好的代码组织
   - TypeScript 支持（可扩展）

3. **高可维护性**
   - 单一职责原则，每个模块职责明确
   - 依赖注入，便于测试和扩展
   - 事件驱动，松耦合的组件通信

## 快速开始

### 系统要求

- **macOS**: 10.15 (Catalina) 或更高版本
- **Windows**: Windows 10 或更高版本
- **开发环境**: Node.js 16+ 

### 安装方式

#### 方式一：下载预编译版本（推荐）

1. 访问 [Releases 页面](https://github.com/your-username/moli-todo/releases)
2. 下载适合您系统的安装包：
   - **macOS Intel**: `MoliTodo-{version}-x64.dmg`
   - **macOS Apple Silicon**: `MoliTodo-{version}-arm64.dmg`
   - **Windows**: `MoliTodo Setup {version}.exe`
3. 双击安装包完成安装

#### 方式二：从源码构建

```bash
# 克隆仓库
git clone https://github.com/your-username/moli-todo.git
cd moli-todo

# 安装主项目依赖
npm install

# 安装渲染进程依赖
cd src/renderer
npm install
cd ../..

# 运行开发版本
npm run dev

# 构建生产版本
npm run build
```

### 开发模式

```bash
npm run dev
```

这会同时启动：
1. Vite 开发服务器 (渲染进程，端口 5173)
2. Electron 主进程

### 首次使用

1. 启动应用后，您会在屏幕上看到一个悬浮图标
2. 将鼠标悬停在图标上即可查看任务面板
3. 在输入框中输入任务内容，按回车键添加任务
4. 点击系统托盘图标可以访问设置和任务管理页面

## 使用指南

### 基本操作

| 操作 | 方法 |
|------|------|
| 查看任务 | 鼠标悬停在悬浮图标上 |
| 添加任务 | 在任务面板输入框中输入内容并按回车 |
| 完成任务 | 点击任务前的圆圈图标 |
| 删除任务 | 点击任务右侧的删除按钮 |
| 设置提醒 | 点击任务右侧的时钟图标 |
| 移动图标 | 拖拽悬浮图标到任意位置 |

### 任务状态

- **待办** (○) - 新创建的任务
- **进行中** (●) - 正在处理的任务，支持时间追踪
- **已完成** (✓) - 已完成的任务

点击任务状态图标可以在这三种状态间循环切换。

### IPC 通信设计

新架构采用安全的 IPC 通信机制：

```javascript
// 在 Vue 组件中使用
const taskStore = useTaskStore()

// 创建任务
const createTask = async (taskData) => {
  const result = await window.electronAPI.tasks.create(taskData)
  if (result.success) {
    await taskStore.getIncompleteTasks()
  }
}

// 监听事件
window.electronAPI.events.on('tasks-updated', () => {
  // 刷新任务列表
})
```

## 开发指南

### 开发环境设置

```bash
# 安装依赖
npm install
cd src/renderer && npm install && cd ../..

# 启动开发模式
npm run dev

# 构建应用
npm run build
```

### 添加新功能

1. 在 `src/main/ipc-handlers.js` 中添加 IPC 处理器
2. 在 `src/main/preload.js` 中暴露 API
3. 在 Vue 组件中使用 API
4. 更新 Pinia store 管理状态

### 构建和发布

```bash
# 发布新版本
npm version patch  # 或 minor/major
git push origin main --tags

# 构建特定平台
npm run build:mac   # macOS
npm run build:win   # Windows
```

## 迁移指南

从原版迁移到 Vue 版本的详细指南请参考 [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)。

### 数据兼容性
- ✅ 完全兼容原版数据格式
- ✅ 支持从原版数据库无缝迁移
- ✅ 保持所有字段和结构不变

## 问题反馈

### 常见问题

#### Q: 应用无法启动怎么办？
A: 请检查系统版本是否符合要求，并尝试以管理员权限运行。

#### Q: 悬浮图标消失了怎么办？
A: 点击系统托盘中的 MoliTodo 图标，选择"显示悬浮图标"。

#### Q: 如何备份我的任务数据？
A: 在设置页面的"数据管理"部分，点击"导出数据"按钮。

### 报告问题

如果您遇到问题或有功能建议，请：

1. 查看 [Issues 页面](https://github.com/your-username/moli-todo/issues) 是否已有相关问题
2. 如果没有，请创建新的 Issue，并提供：
   - 操作系统版本
   - 应用版本
   - 详细的问题描述
   - 重现步骤
   - 错误截图（如有）

## 更新日志

### v0.5.0 (2024-07-25) - Vue 重构版
- 🎉 **重大更新**: 全面重构为 Vue 3 + electron-vite 架构
- ✨ 新增现代化的组件化开发体验
- ✨ 新增 Pinia 状态管理
- ✨ 新增 Vue Router 路由管理
- ✨ 改进 IPC 通信安全性
- ✨ 新增热重载开发模式
- 🔧 优化项目结构和代码组织
- 🔧 改进构建和部署流程
- ✅ 保持完全的数据兼容性

### v0.4.2 (2024-01-XX)
- 🐛 修复事件监听器重复绑定导致的性能问题
- 🐛 修复任务面板中删除操作的指数级调用问题
- ✨ 改进任务管理页面的用户体验
- 🔧 优化数据同步机制

查看完整的更新日志请访问 [CHANGELOG.md](CHANGELOG.md)。

## 路线图

### 近期计划 (v0.6.x)
- [ ] 完善任务提醒通知显示
- [ ] 全局快捷键支持
- [ ] 主题切换系统
- [ ] 性能优化

### 中期计划 (v0.8.x)
- [ ] 任务标签和分组功能
- [ ] 插件系统基础
- [ ] 更多自定义选项
- [ ] 移动端同步

### 长期计划 (v1.0.x)
- [ ] AI 智能助手
- [ ] 云同步支持（可选）
- [ ] 团队协作功能
- [ ] Web 版本

## 贡献指南

我们欢迎社区贡献！请参考以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 遵循现有的代码风格和架构
4. 添加必要的测试
5. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
6. 推送到分支 (`git push origin feature/AmazingFeature`)
7. 创建 Pull Request

### Vue 组件开发规范
- 使用 Composition API
- 遵循 Vue 3 最佳实践
- 保持组件的单一职责
- 使用 Pinia 进行状态管理

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

感谢所有为 MoliTodo 做出贡献的开发者和用户！

特别感谢：
- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [Pinia](https://pinia.vuejs.org/) - Vue 状态管理库
- [SQLite](https://sqlite.org/) - 轻量级数据库引擎
- [node-schedule](https://github.com/node-schedule/node-schedule) - 任务调度库

---

<div align="center">
  Made with ❤️ by MoliTodo Team
  
  [官网](https://molitodo.com) • [文档](https://docs.molitodo.com) • [反馈](https://github.com/your-username/moli-todo/issues)
</div>