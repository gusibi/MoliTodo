# MoliTodo Renderer

这是 MoliTodo 应用的渲染进程部分，使用 Vue 3 + Vite 构建。

## 目录结构

```
src/renderer/
├── src/
│   ├── components/          # 可复用的 UI 组件
│   │   ├── FloatingIcon.vue # 悬浮图标组件
│   │   ├── Settings.vue     # 设置组件
│   │   ├── TaskManager.vue  # 任务管理器组件
│   │   └── TaskPanel.vue    # 任务面板组件
│   ├── views/              # 页面级组件
│   │   ├── MainView.vue    # 主页面（包含悬浮图标）
│   │   └── SettingsView.vue # 设置页面
│   ├── router/             # 路由配置
│   │   └── index.js        # 路由定义和配置
│   ├── store/              # 状态管理
│   │   └── taskStore.js    # 任务相关的状态管理
│   ├── App.vue             # 根组件
│   └── main.js             # 应用入口
├── index.html              # HTML 模板
├── vite.config.js          # Vite 配置
└── README.md               # 本文件
```

## 组件职责划分

### Components（组件）
- **可复用性**: 这些组件可以在多个页面中使用
- **独立性**: 每个组件都有明确的功能边界
- **TaskManager.vue**: 完整的任务管理界面，包含任务列表、分类、搜索等功能
- **TaskPanel.vue**: 悬浮任务面板，用于快速查看和操作任务
- **FloatingIcon.vue**: 桌面悬浮图标
- **Settings.vue**: 设置界面组件

### Views（视图）
- **页面级**: 这些是与路由绑定的页面级组件
- **组合性**: 主要用于组合多个 components 来构建完整页面
- **MainView.vue**: 主页面，包含悬浮图标
- **SettingsView.vue**: 设置页面，包含设置组件

## 路由设计

应用使用 Vue Router 进行页面导航：

- `/` - 主页面（悬浮图标）
- `/task-manager` - 任务管理页面
- `/task-panel` - 任务面板页面
- `/settings` - 设置页面

## 开发指南

### 添加新组件
1. 在 `src/components/` 下创建新的 `.vue` 文件
2. 确保组件具有良好的可复用性
3. 添加适当的 props 和 events

### 添加新页面
1. 在 `src/views/` 下创建新的 `.vue` 文件
2. 在 `src/router/index.js` 中添加路由配置
3. 页面组件主要用于组合现有的 components

### 状态管理
使用 Pinia 进行状态管理，store 文件放在 `src/store/` 目录下。

## 构建和开发

由于依赖已经合并到根目录，所有的构建和开发命令都在项目根目录执行：

```bash
# 开发模式
npm run dev

# 构建渲染进程
npm run build:renderer

# 构建整个应用
npm run build
```