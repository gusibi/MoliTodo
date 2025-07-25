# MoliTodo Vue 迁移指南

## 迁移进度

### ✅ 已完成的功能

#### 核心架构
- [x] electron-vite 项目结构
- [x] Vue 3 + Composition API
- [x] Pinia 状态管理
- [x] Vue Router 路由管理
- [x] 安全的 IPC 通信 (contextBridge)

#### 主进程功能
- [x] 窗口管理器 (WindowManager)
- [x] IPC 处理器 (IpcHandlers)
- [x] 预加载脚本 (preload.js)
- [x] 系统托盘集成
- [x] 应用配置管理

#### 业务逻辑层
- [x] 任务实体 (Task Entity)
- [x] 任务服务 (TaskService)
- [x] SQLite 数据仓储
- [x] 文件数据仓储
- [x] 通知服务

#### Vue 组件
- [x] 悬浮图标 (FloatingIcon)
- [x] 任务管理器 (TaskManager)
- [x] 设置页面 (Settings)
- [x] 任务面板 (TaskPanel)

#### 功能特性
- [x] 任务 CRUD 操作
- [x] 任务状态管理 (待办/进行中/已完成)
- [x] 时间追踪功能
- [x] 任务提醒设置
- [x] 数据导入导出
- [x] 数据库统计
- [x] 悬浮图标拖拽
- [x] 任务面板切换

### ⏳ 待完成的功能

#### 高级功能
- [ ] 任务提醒通知显示
- [ ] 键盘快捷键
- [ ] 主题切换系统
- [ ] 多语言支持
- [ ] 任务分类/标签
- [ ] 任务搜索功能

#### 优化项目
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 单元测试
- [ ] 文档完善
- [ ] 打包优化

## 使用指南

### 开发环境设置

1. **安装依赖**
```bash
# 安装主项目依赖
npm install

# 安装渲染进程依赖
cd src/renderer
npm install
cd ../..
```

2. **启动开发模式**
```bash
npm run dev
```

这会自动启动：
- Vite 开发服务器 (端口 5173)
- Electron 主进程

### 项目结构说明

```
moli-todo-vue/
├── src/
│   ├── main/                    # 主进程
│   │   ├── main.js             # 应用入口
│   │   ├── window-manager.js   # 窗口管理
│   │   ├── ipc-handlers.js     # IPC 处理
│   │   └── preload.js          # 预加载脚本
│   ├── domain/                 # 领域层
│   │   ├── entities/           # 实体
│   │   └── services/           # 领域服务
│   ├── infrastructure/         # 基础设施层
│   │   ├── persistence/        # 数据持久化
│   │   └── notification/       # 通知服务
│   └── renderer/               # 渲染进程 (Vue 应用)
│       ├── src/
│       │   ├── components/     # Vue 组件
│       │   ├── views/          # 页面视图
│       │   ├── store/          # Pinia 状态管理
│       │   ├── App.vue         # 根组件
│       │   └── main.js         # Vue 应用入口
│       ├── index.html          # HTML 模板
│       ├── package.json        # 渲染进程依赖
│       └── vite.config.js      # Vite 配置
├── package.json                # 主项目依赖
└── dev-start.js               # 开发启动脚本
```

### 关键技术决策

#### 1. 架构分层
- **主进程**: 负责窗口管理、系统集成、业务逻辑
- **渲染进程**: 纯 Vue 应用，负责用户界面
- **共享层**: 领域实体和服务，主进程和渲染进程都可使用

#### 2. IPC 通信设计
- 使用 `contextBridge` 安全暴露 API
- 按功能模块组织 API (tasks, config, windows, data)
- 统一的错误处理和响应格式

#### 3. 状态管理
- 使用 Pinia 管理客户端状态
- 通过 IPC 与主进程同步数据
- 响应式更新 UI

#### 4. 路由设计
- 使用 Vue Router 管理多个窗口/页面
- Hash 模式适配 Electron 环境
- 每个窗口对应一个路由

### API 使用示例

#### 任务操作
```javascript
// 创建任务
const result = await window.electronAPI.tasks.create({
  content: '新任务',
  reminderTime: '2024-01-01T10:00:00.000Z'
})

// 获取任务列表
const tasks = await window.electronAPI.tasks.getIncomplete()

// 更新任务状态
await window.electronAPI.tasks.start(taskId)
await window.electronAPI.tasks.pause(taskId)
await window.electronAPI.tasks.complete(taskId)
```

#### 配置管理
```javascript
// 获取配置
const config = await window.electronAPI.config.get()

// 更新配置
await window.electronAPI.config.update('floatingIcon.size', 80)
```

#### 窗口控制
```javascript
// 显示任务管理器
await window.electronAPI.windows.showTaskManager()

// 切换任务面板
await window.electronAPI.windows.toggleTaskPanel()
```

#### 事件监听
```javascript
// 监听任务更新
window.electronAPI.events.on('tasks-updated', () => {
  // 刷新任务列表
})

// 监听配置更新
window.electronAPI.events.on('config-updated', (config) => {
  // 应用新配置
})
```

### 与原版的兼容性

#### 数据格式
- 完全兼容原版的任务数据格式
- 支持从原版数据库无缝迁移
- 保持所有字段和结构不变

#### 功能对等
- 所有原版功能都已迁移或计划迁移
- 用户体验保持一致
- 性能有所提升

#### 配置兼容
- 使用相同的配置存储格式
- 支持原版配置文件导入
- 配置项保持向后兼容

### 开发建议

#### 添加新功能
1. 在 `src/main/ipc-handlers.js` 中添加 IPC 处理器
2. 在 `src/main/preload.js` 中暴露 API
3. 在 Vue 组件中使用 API
4. 更新 Pinia store 管理状态

#### 调试技巧
- 主进程日志在终端显示
- 渲染进程可使用浏览器开发工具
- 使用 `window.electronAPI.utils.log()` 发送日志到主进程

#### 性能优化
- 使用 Vue 的响应式系统避免不必要的更新
- 合理使用 `computed` 和 `watch`
- 避免在渲染进程中进行重计算

### 部署和构建

#### 开发构建
```bash
npm run build
```

#### 生产构建
```bash
# macOS
npm run build:mac

# Windows
npm run build:win
```

### 故障排除

#### 常见问题
1. **渲染进程无法访问 electronAPI**
   - 检查 preload 脚本是否正确加载
   - 确认 contextIsolation 设置正确

2. **IPC 通信失败**
   - 检查 IPC 处理器是否注册
   - 确认参数格式正确

3. **Vue 组件无法更新**
   - 检查 Pinia store 是否正确更新
   - 确认事件监听器是否正确设置

#### 调试步骤
1. 检查主进程日志
2. 打开渲染进程开发工具
3. 验证 IPC 通信
4. 检查数据流向

### 贡献指南

1. Fork 项目并创建功能分支
2. 遵循现有的代码风格和架构
3. 添加必要的测试
4. 更新相关文档
5. 提交 Pull Request

### 后续计划

1. **短期目标** (1-2周)
   - 完善任务提醒通知
   - 添加键盘快捷键
   - 优化性能

2. **中期目标** (1个月)
   - 添加主题系统
   - 实现任务分类
   - 完善错误处理

3. **长期目标** (3个月)
   - 添加插件系统
   - 支持多语言
   - 云同步功能