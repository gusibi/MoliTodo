# MoliTodo 全面修复计划（2026-11-05）

## Goal
修复整体 review 发现的全部问题，按 P0 → P1 → P2 → P3 顺序分阶段执行，每阶段跑全量测试验证。

## 成功标准
- 全量 `npm test` 通过（当前基线 263 项）
- `npm run build:renderer` 构建通过
- P0/P1 全部修复；P2 全部修复；P3 完成安全可机械化的部分
- 不破坏现有未提交的 garden 功能改动（工作区有未提交代码，所有修复叠加其上，不提交 git，除非用户要求）

## 范围决策
- ✅ 做：P0 崩溃、P1 数据/安全、P2 性能/生命周期、死代码删除、i18n 补齐、仓库卫生（git 索引层面）
- ⚠️ 择要做：结构性收敛只做低风险高价值项（状态常量统一、default-config 模块、toolsStore wrapper、taskStore 过滤/排序去重）
- ❌ 本轮不做（需要单独排期）：taskStore 拆 aiStore/dataStore、window-manager 三模块拆分、TaskEditVertical 组件拆分、列表虚拟化 —— 计入 findings.md 待办

## Execution

### Phase 0: P0 崩溃修复
**Status:** complete
- GardenThreeScene.vue GROUND_Y TDZ 已修（常量上移）；同文件重复 case 'tree' 已删

### Phase 1: P1 数据完整性
**Status:** complete
1. ✅ 新建 task-status-constants.js 单一来源；日志实体/服务/仓储/渲染层统一 'paused'，旧数据别名兼容
2. ✅ 'deleted' 墓碑从 findAll/findIncomplete/getIncompleteCount/findByListId/searchTasks 排除（保留 findOverrideInstances 可见性，墓碑机制不变）
3. ✅ completeTask/updateRecurringTask 传播循环/deleteRecurringSeries 包事务（TaskService._runInTransaction 降级兼容 stub 仓储）；v10 迁移：去重 + 唯一部分索引（坑：migration_003 已有同名非唯一索引，须先 DROP）；迁移运行器改按 version 字段
4. ✅ checkAndMigrate 返回连接句柄，恢复备份成功后不再中断启动，仓储采用新句柄
5. ✅ Task.updateStatus 接受 'paused'
- 新增 test/database-migration-v10.test.js；迁移断言版本 9→10

### Phase 2: P1 安全
**Status:** complete
1. ✅ openExternal 只放行 https?://（new URL 校验 + 重构 href）
2. ✅ 本地 API：per-install Bearer token（electron-store 持久化、设置页展示/复制、文档更新）+ host 强制 127.0.0.1 + body 1MB 上限（413）+ 公开只读端点白名单
3. ✅ 统一 _createBrowserWindow 助手（8 处全部改走），加 setWindowOpenHandler(deny) + will-navigate 白名单
4. ✅ macOS 更新：无 sha512 拒绝安装（报错引导手动下载）；hdiutil 去掉 -noverify

### Phase 3: P2 性能/生命周期
**Status:** complete
1. ✅ sqlite save() 改 INSERT ... ON CONFLICT DO UPDATE（原子 upsert，保留 created_at）
2. ✅ TaskService._pendingStatusLog 局部化到 updateTask 内
3. ✅ findOverrideInstancesBySeriesIds 批量查询消除 N+1（stub 仓储降级逐系列）
4. ✅ 状态日志/趋势 UTC 分桶 → 本地时区（SQL 用 DATE(created_at,'localtime')；活跃度 JS 聚合 localDateKey；渲染层趋势标签本地化）
5. ✅ 专注心跳按需启停（syncFocusHeartbeat 挂到全部专注状态变更点）
6. ✅ before-quit 清理无条件幂等（_performCleanup，三条退出路径统一）
7. ✅ preload 白名单 cleanup-old-logs → cleanup-old-task-logs
8. ✅ taskStore createTask/updateTask/updateTaskReminder 改为 IPC 返回实体后打补丁（带全量刷新兜底）
- 未做（记录在 findings）：托盘菜单缓存、睡眠唤醒后陈旧任务提醒的重排（涉及 notification-service 语义决策）

### Phase 4: 死代码清理
**Status:** complete
- ✅ git rm src/utils/task-edit-utils.js（309 行）
- ✅ git rm -r src/renderer/src/components/unused/（11 文件）
- ✅ sqlite-task-repository 删除 12 个死方法（findByCategory/findTodayTasks/findOverdueTasks/getTimeStatistics/getTaskCountsByListId/getIncompleteCountByListId/getTaskCountByListId/findByMultipleListIds/deleteRecurringSeries/moveTasksBetweenLists/findIncompleteByListId/findCompletedByListId）
- ✅ GardenThreeScene 重复 case 'tree'（Phase 0 顺带）
- ✅ TaskEditVertical 死 ref：fileInput/getMinDate/getMinTimeForDatePicker
- ✅ task-utils.js：getTaskStatusCounts/formatDueDate/getDueDateCssClass
- ✅ Task.getCategories
- ✅ window-manager createTrayIconWithBadge + 注释调用块
- 纠正 review 误报：searchTasks（use-cases/ipc 在用）、Task.isToday（task-statistics-service 在用）——保留

### Phase 5: i18n 补齐
**Status:** complete
- ✅ FlatTaskList.vue ~18 处 → tasks.flatList.* 键
- ✅ TaskEditVertical.vue 17 处 → tasks.editor.*（含 仅日期/加时间/移动到其他列表）；今天/明天/M月D日 → t('tasks.today'/'tasks.tomorrow') + Intl.DateTimeFormat(localeCode)
- ✅ ColorThemeSwitcher.vue 头部文案 + 主题名/描述 → settings.colorThemes.<id>.*
- ✅ ThemeSwitcher.vue（浅色/深色/跟随系统）→ settings.colorThemes.modes.*
- ✅ useColorTheme.js 的 name/description 保留为元数据（显示层已全部走 i18n，无消费方）
- 验证：npm test 265 通过；npm run build:renderer 通过

### Phase 6: 低风险结构收敛
**Status:** complete
- 状态常量单一来源：已在 Phase 1 完成（task-status-constants.js）
- ✅ default-config.js 新建：window-manager electron-store defaults 与 ipc-handlers reset-config 共用（修复 floatingIcon.size 60 vs 50 漂移，统一为 50；reset 不重置 isFirstLaunch/userGuideCompleted；DEFAULT_CONFIG 补齐 background: null）
- ✅ toolsStore：callTools() 封装（available 守卫 + error 记录 + withLoading/resetError/rethrow 选项），21 个方法全部收编，删除逐方法 try/catch 样板
- ✅ taskStore：matchesCategory 谓词统一 getTasksByFilter 与 filterTasksByCategory；compareCompletedTasks/compareActiveTasks 比较器统一 getSortedTasks 与 filteredTasks（今天视图与默认视图排序体完全相同，合一）
- 验证：npm test 265 通过

### Phase 7: 仓库卫生
**Status:** complete
- ❌ screenshots/ 不做 git rm --cached：readme-zh.md 8 处 <img> 直接引用（GitHub README 图片），移除索引会破坏线上 README；test-results/ 本就未被跟踪且已在 gitignore —— 两者均无需处理
- ✅ CHANGES_SUMMARY/MIGRATION_COMPLETE/STRUCTURE_OPTIMIZATION/PROJECT_SUMMARY → git mv docs/archive/（保留历史）；CONTEXT.md 被 doc/health-focus-garden-spec.md 引用，保留根目录；DOCS_INDEX.md 无引用需更新
- ✅ exapmle/ → example/（git mv，无代码引用）
- ❌ devDependencies 归位：跳过 —— 渲染层依赖经 Vite 打包进 dist，主进程依赖在 dependencies；build.files 显式含 node_modules/**/*，移动声明有打包风险，只记录
- ❌ .gitignore 追加规划文件：撤销 —— findings/progress/task_plan 在历史提交（549a41a）中已被跟踪，属有意保留

### Phase 8: 全量验证
**Status:** complete
- npm test：265 pass / 0 fail
- npm run build:renderer：通过（4.89s）
- 修复完成；工作区改动未提交（用户未要求提交）

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
