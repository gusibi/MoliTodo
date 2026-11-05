# Findings — 全面修复（2026-11-05）

## Review 来源
三路并行深度审查（任务核心 / 主进程 / 渲染层）+ 仓库卫生检查。完整报告见会话记录；关键事实沉淀如下。

## 本轮不做（待单独排期）
- taskStore 拆分 aiStore/dataStore（AI 配置、报表、导入导出、i18n 工具散落其中）
- window-manager.js（1491 行）拆 ConfigService/AppIconService/TrayController/窗口工厂
- TaskEditVertical.vue 拆 useFieldSave + StepsEditor + DatePickerPopover
- 列表虚拟化（FlatTaskList/TaskPanel 无界 v-for）
- three.js 按需重绘（静止时省 GPU）
- ItemArt SVG 重复 id 改全局 sprite
- migration runner 按 version 字段查表（现按数组下标，有隐患）
- 双实现契约测试（renderer task-time-rules vs domain task-time）

## 关键事实
- 全量测试基线：263 项全过（2026-11-05，node --test）
- 工作区有未提交的 garden/placement/reminder 改动 + 修复的提醒锚点 bug；GROUND_Y TDZ 是这批未提交改动引入的回归
- with-transaction.js 已存在且 tools/reminder/focus 域在用，task 域从未用过
- 状态日志 `'pause'` vs 实体 `'paused'`：task-status-log.js:36-48、task-status-log-service.js:30/234/237/383
- 'deleted' 墓碑：task-service.js:1129-1143 创建，无任何查询过滤
- restoreFromBackup 只换自己 this.db（database-migration.js:651-669），仓储 db 句柄悬空
- 本地 API 无鉴权（CORS 挡不住 simple request/Beacon），host 可配 0.0.0.0
- preload 白名单 `cleanup-old-logs` 实际 handler 叫 `cleanup-old-task-logs`（ipc-handlers.js:1542）
- 'unused/' 组件目录已被构建 tree-shake，删除仅是卫生
- screenshots/test-results 65 个文件被 git 跟踪；pack 91 MiB；167 张图片
- electron-builder 打包只依赖 dependencies；渲染层依赖在 devDeps 由 Vite 打包，归位前需确认 files 配置
- 旧 progress/findings/task_plan 内容是已完成工作的历史记录，已沉淀于 doc/*.md

## Phase 7 补充发现（2026-11-05）
- screenshots/ 被 readme-zh.md 8 处 <img> 引用，必须保持 git 跟踪（review 的 git rm --cached 建议不可行）
- test-results/ 未被跟踪且已在 .gitignore，无需处理
- 渲染层依赖在 devDependencies 是正确形态（Vite 打包进 src/renderer/dist；electron build.files 显式含 node_modules/**/*，改 dependencies 有打包面变化风险）——不做，后续若要瘦身包体应改 build.files 精确列举主进程依赖
- 规划文件（task_plan/findings/progress）在 549a41a 已被有意提交跟踪，不加入 .gitignore
