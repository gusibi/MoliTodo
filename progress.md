# Progress — 全面修复（2026-11-05）

## 会话日志
- [2026-11-05] 三路 review 完成（任务核心/主进程/渲染层）+ 仓库卫生检查，输出分级报告
- [2026-11-05] 计划文件创建，Phase 0 开始
- [2026-11-05] Phase 0 + Phase 1 完成：GROUND_Y TDZ、pause/paused 统一、墓碑过滤、循环任务事务 + v10 唯一索引迁移、迁移恢复句柄、updateStatus 支持暂停
- [2026-11-05] Phase 2 完成：openExternal 协议白名单、API Bearer token + host 127.0.0.1 + 1MB body、统一 _createBrowserWindow、macOS 更新 sha512 校验
- [2026-11-05] Phase 3 完成：save() 原子 upsert、_pendingStatusLog 局部化、override 批量查询、UTC→本地时区分桶、专注心跳按需、before-quit 幂等清理、preload 白名单、taskStore 补丁式更新
- [2026-11-05] Phase 4 完成：死代码删除（task-edit-utils、unused/ 11 文件、仓储 12 方法、Task.getCategories、task-utils 3 函数、createTrayIconWithBadge）；纠正 2 个 review 误报（searchTasks、isToday 保留）
- [2026-11-05] Phase 5 完成：FlatTaskList（tasks.flatList.*）、TaskEditVertical（tasks.editor.* + Intl.DateTimeFormat 日期）、ColorThemeSwitcher/ThemeSwitcher（settings.colorThemes.*）；npm test 265 通过 + build:renderer 通过
- [2026-11-05] Phase 6 完成：default-config.js 共用默认配置（修复 size 60/50 漂移）、toolsStore callTools 封装 21 方法、taskStore matchesCategory 谓词 + 排序比较器合一
- [2026-11-05] Phase 7 完成（含两项计划修正）：4 份过程文档移入 docs/archive/、exapmle→example；screenshots 保持跟踪（README 引用）、devDeps 归位跳过（打包风险）；.gitignore 追加撤销（规划文件已被有意跟踪）
- [2026-11-05] Phase 8 完成：npm test 265 pass / 0 fail；build:renderer 通过。全部修复结束，未提交 git

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| withTransaction is not a function（测试 stub 仓储） | 1 | TaskService._runInTransaction 检测降级 |
| 迁移测试断言版本 9 | 1 | 断言更新为 10 |
| 唯一索引未生效 | 2 | migration_003 已有同名非唯一索引，IF NOT EXISTS 跳过；v10 先 DROP 再建 |
| v10 测试插入重复数据被索引拦截 / 降级后仍被拦截 | 2 | 测试先降级再插数据；downgrade 时 DROP 索引 |

## 测试记录
| 时间 | 命令 | 结果 |
|------|------|------|
| 2026-11-05 | npm test（基线） | 263 pass / 0 fail |
| 2026-11-05 | npm test（Phase 0+1 后） | 265 pass / 0 fail |
| 2026-11-05 | npm test（Phase 5 后） | 265 pass / 0 fail |
| 2026-11-05 | npm run build:renderer（Phase 5 后） | 通过（4.99s） |
| 2026-11-05 | npm test（Phase 6/7 后） | 265 pass / 0 fail |
| 2026-11-05 | npm test + build:renderer（Phase 8 终验） | 265 pass / 0 fail；构建通过 |
