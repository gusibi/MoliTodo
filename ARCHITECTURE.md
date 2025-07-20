// MoliTodo 项目架构说明
// 
// 采用领域驱动设计 (DDD) 的分层架构：
//
// src/
// ├── main/                    # 主进程 (Electron Main Process)
// │   ├── main.js             # 应用入口点
// │   ├── window-manager.js   # 窗口管理器
// │   └── ipc-handlers.js     # IPC 通信处理器
// │
// ├── domain/                  # 领域层 - 核心业务逻辑
// │   ├── entities/           # 实体
// │   │   ├── task.js        # 任务实体
// │   │   └── reminder.js    # 提醒实体
// │   ├── services/          # 领域服务
// │   │   ├── task-service.js      # 任务管理服务
// │   │   ├── reminder-service.js  # 提醒服务
// │   │   └── notification-service.js # 通知服务
// │   └── repositories/      # 仓储接口
// │       └── task-repository.js
// │
// ├── infrastructure/         # 基础设施层
// │   ├── persistence/       # 数据持久化
// │   │   └── file-task-repository.js
// │   ├── notification/      # 系统通知
// │   │   └── system-notification.js
// │   └── storage/          # 存储配置
// │       └── storage-config.js
// │
// ├── application/           # 应用层 - 用例协调
// │   ├── use-cases/        # 用例
// │   │   ├── create-task.js
// │   │   ├── complete-task.js
// │   │   ├── delete-task.js
// │   │   └── set-reminder.js
// │   └── dto/              # 数据传输对象
// │       └── task-dto.js
// │
// └── presentation/          # 表现层 - UI 界面
//     ├── floating-icon/    # 悬浮图标组件
//     │   ├── floating-icon.html
//     │   ├── floating-icon.css
//     │   └── floating-icon.js
//     ├── task-panel/       # 任务面板组件
//     │   ├── task-panel.html
//     │   ├── task-panel.css
//     │   └── task-panel.js
//     ├── shared/           # 共享组件
//     │   ├── styles/       # 全局样式
//     │   └── utils/        # 工具函数
//     └── assets/           # 静态资源
//         ├── icons/
//         └── sounds/