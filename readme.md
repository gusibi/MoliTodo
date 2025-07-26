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

## 🚀 快速开始

MoliTodo 是一款现代化的桌面待办事项应用，通过悬浮图标提供最快速的任务管理体验。

### 核心特性

- 🎯 **无缝集成** - 悬浮图标常驻桌面，不打断工作流
- ⚡ **即时操作** - 悬停查看，快速添加，一键完成
- 🎨 **现代设计** - Vue 3 + 主题切换，流畅的用户体验
- 💾 **本地存储** - 数据完全本地化，保护隐私安全
- 🔧 **时间追踪** - 完整的任务时间管理和统计

### 安装使用

#### 下载安装包（推荐）

访问 [Releases 页面](https://github.com/your-username/moli-todo/releases) 下载最新版本：

- **macOS**: `MoliTodo-{version}-x64.dmg` (Intel) / `MoliTodo-{version}-arm64.dmg` (Apple Silicon)
- **Windows**: `MoliTodo Setup {version}.exe`

#### 从源码运行

```bash
# 克隆仓库
git clone https://github.com/your-username/moli-todo.git
cd moli-todo

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

## 📚 文档

完整的文档请访问 [docs/](./docs/) 目录：

- **[项目介绍](./docs/introduction.md)** - 了解 MoliTodo 的设计理念和核心特性
- **[安装指南](./docs/installation.md)** - 详细的安装和配置说明
- **[用户手册](./docs/user-guide.md)** - 完整的使用指南和操作技巧
- **[开发文档](./docs/development/)** - 开发环境搭建和架构说明
- **[贡献指南](./docs/contributing.md)** - 如何参与项目开发

## 🛠️ 技术架构

### v0.5.0 现代化架构

- **前端**: Vue 3 + Composition API + Pinia + Vue Router
- **构建**: Vite + electron-vite
- **主进程**: Electron 28.x + SQLite + 领域驱动设计
- **样式**: 模块化 CSS + 主题系统

### 项目结构

```
src/
├── main/                    # 主进程
├── domain/                  # 领域层 - 业务逻辑
├── infrastructure/          # 基础设施层 - 数据持久化
└── renderer/                # 渲染进程 - Vue 3 应用
    ├── src/
    │   ├── components/      # Vue 组件
    │   ├── views/           # 页面视图
    │   ├── store/           # Pinia 状态管理
    │   ├── assets/styles/   # 模块化样式
    │   └── composables/     # 组合式函数
    └── vite.config.js
```

## ✨ 主要功能

### 悬浮图标
- ✅ 始终置顶，可拖拽移动
- ✅ 实时显示任务数量角标
- ✅ 任务提醒时自动变色动画
- ✅ 进行中任务指示器

### 任务管理
- ✅ 三种状态：待办 → 进行中 → 已完成
- ✅ 时间追踪和统计
- ✅ 任务提醒设置
- ✅ 快速添加和编辑

### 现代化界面
- ✅ 主题切换（浅色/深色）
- ✅ 响应式设计
- ✅ 毛玻璃效果
- ✅ 流畅动画

### 数据管理
- ✅ SQLite 本地存储
- ✅ 数据导入导出
- ✅ 自动备份
- ✅ 完全兼容原版数据

## 🔄 版本迁移

### 从 v0.4.x 升级到 v0.5.x

v0.5.0 是重大架构升级版本，从原生 JavaScript 重构为 Vue 3：

- **✅ 数据完全兼容** - 无需手动迁移数据
- **✅ 功能对等** - 所有原版功能都已迁移
- **✅ 性能提升** - 启动速度提升 30%+，内存占用减少 20%+
- **✅ 开发体验** - 热重载、组件化、现代化工具链

详细迁移指南请查看 [迁移文档](./docs/project/migration.md)。

## 🤝 参与贡献

我们欢迎所有形式的贡献！

### 快速参与

1. **报告问题** - 在 [Issues](https://github.com/your-username/moli-todo/issues) 中报告 bug 或提出建议
2. **改进文档** - 帮助完善文档和翻译
3. **贡献代码** - 提交 Pull Request 修复问题或添加功能

### 开发环境

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/your-username/moli-todo.git

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev

# 4. 运行测试
npm test
```

详细的贡献指南请查看 [CONTRIBUTING.md](./docs/contributing.md)。

## 📊 项目状态

### 开发进度

- **✅ 核心功能** - 任务管理、时间追踪、数据持久化
- **✅ 用户界面** - Vue 3 重构、主题系统、响应式设计
- **🚧 高级功能** - 全局快捷键、任务分类、插件系统
- **📋 未来计划** - AI 助手、云同步、团队协作

### 性能指标

| 指标 | v0.4.x | v0.5.x | 改进 |
|------|--------|--------|------|
| 启动时间 | 2.5s | 1.8s | ⬆️ 28% |
| 内存占用 | 120MB | 95MB | ⬆️ 21% |
| 包体积 | 85MB | 78MB | ⬆️ 8% |

## 📞 获取帮助

### 社区支持

- **GitHub Issues** - [报告问题和功能请求](https://github.com/your-username/moli-todo/issues)
- **GitHub Discussions** - [社区讨论和问答](https://github.com/your-username/moli-todo/discussions)
- **文档中心** - [完整的使用和开发文档](./docs/)

### 联系方式

- **邮件支持** - support@molitodo.com
- **开发者邮箱** - dev@molitodo.com
- **官方网站** - [molitodo.com](https://molitodo.com)

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🙏 致谢

感谢所有为 MoliTodo 做出贡献的开发者和用户！

特别感谢：
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- 所有提供反馈和建议的用户

---

<div align="center">
  <strong>让任务管理变得简单而高效</strong>
  
  [下载使用](https://github.com/your-username/moli-todo/releases) • [查看文档](./docs/) • [参与贡献](./docs/contributing.md)
</div>