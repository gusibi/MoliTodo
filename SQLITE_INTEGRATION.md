# SQLite 数据库集成

MoliTodo 现在支持使用 SQLite 数据库来存储任务数据，提供更好的性能和数据管理能力。

## 🚀 新功能

### 三状态任务系统
- **待办 (Todo)**: 新创建的任务默认状态
- **进行中 (Doing)**: 正在处理的任务
- **已完成 (Done)**: 完成的任务

### SQLite 数据库支持
- 高性能的本地数据库存储
- 支持复杂查询和统计
- 数据完整性保证
- 可自定义数据库存储位置

## 📦 安装 SQLite 依赖

### 自动安装
```bash
npm run install-sqlite
```

### 手动安装
```bash
npm install sqlite3@^5.1.6 sqlite@^5.1.1
```

如果遇到编译问题：
```bash
npm install sqlite3 --build-from-source
```

## 🔧 配置数据库

### 1. 通过设置界面配置
1. 打开应用设置
2. 在"通用"标签页中找到"数据存储"部分
3. 选择存储类型：
   - **SQLite 数据库（推荐）**: 使用 SQLite 数据库
   - **文件存储（兼容模式）**: 使用原有的文件存储
4. 可以自定义数据库文件位置

### 2. 默认配置
- 数据库类型：SQLite
- 默认位置：`用户数据目录/tasks.db`
- 自动创建数据库表结构

## 🔄 数据迁移

### 从文件存储迁移到 SQLite

#### 方法1：通过设置界面
1. 打开设置 → 通用 → 数据存储
2. 选择"SQLite 数据库"
3. 系统会自动提示迁移现有数据

#### 方法2：使用命令行工具
```bash
# 迁移数据到默认位置
npm run migrate-to-sqlite migrate

# 迁移到指定位置
npm run migrate-to-sqlite migrate ./my-tasks.db

# 创建数据备份
npm run migrate-to-sqlite backup ./backup.json
```

## 📊 数据库功能

### 任务状态管理
```javascript
// 创建任务（默认为 todo 状态）
const task = new Task('id', 'content', 'todo');

// 更新任务状态
task.updateStatus('doing');  // 设为进行中
task.updateStatus('done');   // 设为已完成

// 状态检查
task.isTodo();        // 是否为待办
task.isInProgress();  // 是否进行中
task.isCompleted();   // 是否已完成
```

### 数据库统计
- 总任务数量
- 各状态任务数量
- 有提醒的任务数量
- 数据库文件位置

### 高级查询
- 按状态筛选任务
- 按创建时间排序
- 按提醒时间查询
- 复杂条件组合查询

## 🛠️ 开发者信息

### 数据库表结构
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reminder_time TEXT,
  completed_at TEXT
);
```

### API 变更
- 新增 `updateTaskStatus(taskId, status)` 方法
- 新增 `getTasksByStatus(status)` 方法
- 新增 `getStatusCounts()` 方法
- 保持向后兼容的 `completed` 字段

### 配置选项
```javascript
{
  database: {
    type: 'sqlite',        // 'sqlite' 或 'file'
    path: '/path/to/db'    // null 表示使用默认路径
  }
}
```

## 🔍 故障排除

### 常见问题

#### SQLite 编译失败
```bash
# 尝试从源码编译
npm install sqlite3 --build-from-source

# 或者使用预编译版本
npm install sqlite3 --fallback-to-build
```

#### 数据库文件权限问题
- 确保应用有读写数据库文件的权限
- 检查数据库目录是否存在
- 尝试使用默认位置

#### 数据迁移失败
- 检查原有数据文件是否存在
- 确保目标数据库路径可写
- 查看控制台错误信息

### 数据恢复
如果遇到数据问题，可以：
1. 使用备份文件恢复
2. 从设置中导入之前导出的数据
3. 切换回文件存储模式

## 📈 性能优化

### SQLite 优势
- 更快的查询速度
- 支持索引优化
- 事务保证数据一致性
- 更好的并发处理

### 建议
- 定期备份数据库文件
- 避免在网络驱动器上存储数据库
- 大量数据时考虑定期清理已完成任务

## 🔮 未来计划

- [ ] 数据库加密支持
- [ ] 多用户数据隔离
- [ ] 云同步集成
- [ ] 数据分析和报表
- [ ] 自动备份策略

## 📞 技术支持

如果遇到问题，请：
1. 查看控制台错误信息
2. 检查数据库文件权限
3. 尝试重置为默认配置
4. 提交 Issue 并附上错误日志