# MoliTodo UI 基础组件

`components/ui` 是本项目的基础组件层，提供外观、语义、键盘与焦点行为。业务组件只组合这些组件、
传递数据和绑定业务动作，不重新实现 Button、Dialog、Dropdown、Checkbox、Switch、Tooltip。

技术路线：兼容版本的 shadcn-vue 类源码 + [Reka UI](https://reka-ui.com) 交互原语 +
本地打包的 [Lucide](https://lucide.dev) 图标 + Tailwind 3 语义 token。接入时已核对的版本记录在
`package.json`（reka-ui、@lucide/vue、class-variance-authority、clsx、tailwind-merge）。

组件按活跃页面实际需要建设：Checkbox、Switch、Select、Popover 等在有真实调用方时再新增，
不为组件目录完整而预建。

## 组件

### Button / IconButton

```vue
<Button variant="default" size="default" :loading="saving" @click="save">保存</Button>
<IconButton label="设置" @click="openSettings"><Settings class="h-icon-md w-icon-md" /></IconButton>
```

- 变体：`default | secondary | outline | ghost | destructive`
- 尺寸：`sm | default | lg | icon | icon-sm`
- `loading` 显示旋转图标并禁用；`disabled` 禁用。
- `IconButton` 强制要求 `label`，同时作为 `aria-label` 与 `title`。
- 关闭弹层后如需恢复焦点，调用按钮实例的 `focus()`（组件已 `defineExpose`）。

### Checkbox

任务完成与步骤状态使用 `Checkbox`。图形本身为 16×16，标签点击区域至少 28×28；必须提供稳定 `id` 和可访问 `label`。

```vue
<Checkbox id="task-done" :model-value="done" label="任务完成状态"
  @update:model-value="done = $event" />
<Checkbox id="step-done" :model-value="stepDone" label="完成第 1 个步骤" disabled />
```

- 支持未选中、选中、键盘聚焦和禁用状态；勾选图标使用本地 Lucide `Check`。
- `indicator-class` 仅用于图形外观变体，不要缩小根标签的点击区域。

### AlertDialog

危险操作确认。职责：标题、说明、取消、危险确认、异步状态与焦点恢复。

```vue
<AlertDialog
  v-model:open="open"
  :title="$t('tasks.deleteTask')"
  :description="$t('tasks.confirmDelete')"
  :confirm-label="$t('common.delete')"
  confirm-variant="destructive"
  :loading="loading"
  :error="error"
  @confirm="confirm"
  @cancel="onCancel"
/>
```

契约：初始焦点在取消；遮罩点击不关闭、不确认；等待或失败时 Escape 取消；提交中禁用取消与 Escape；
`confirm` 只发出业务意图，由调用方在成功后关闭并恢复焦点。普通编辑使用 Dialog，不要复用本组件。

### Dialog / Input / Textarea

普通编辑弹窗与表单控件。Dialog 基于 Reka Dialog（标题、关闭、焦点约束、滚动），危险操作不要用它。

```vue
<Dialog v-model:open="open" :title="$t('tasks.createTask')">
  <Input v-model="content" placeholder="任务" />
  <Textarea v-model="note" placeholder="备注" />
</Dialog>
```

### Popover / Calendar / DatePicker

交互式浮层与日期选择。Calendar 基于 Reka Calendar，DatePicker 组合 Popover + Calendar，
对外只使用本地日期字符串（`YYYY-MM-DD`），不暴露库内部 DateValue。

```vue
<DatePicker v-model="date" />
```

### ContextMenu / ContextMenuItem

```vue
<ContextMenu>
  <template #trigger>
    <Button variant="ghost" aria-keyshortcuts="Shift+F10">任务内容</Button>
  </template>
  <ContextMenuItem variant="destructive" @select="deleteTask">删除任务</ContextMenuItem>
</ContextMenu>
```

- `ContextMenu` 用于右键或触控板次要点击触发的任务操作菜单；菜单项由 `ContextMenuItem` 提供。
- 可见触发器必须可聚焦；组件支持 Shift+F10 和 Context Menu 键打开菜单。危险操作仍由业务调用方接入统一确认流程。

### Switch / FormField

设置开关与表单字段包装。

```vue
<Switch :model-value="config.autoStart" :label="$t('settings.autoStart')"
  @update:model-value="toggleAutoStart" />

<FormField label="API Key" html-for="openai-key" description="..." :error="keyError">
  <Input id="openai-key" v-model="key" type="password" />
</FormField>
```

- `Switch` 基于 Reka UI，用于「立即生效的配置项」；完成任务仍用任务语义的复选框。无可见标签时必须传 `label`。
- `FormField` 只负责标签、帮助文字与错误的呈现与关联（`label[for]` / `role=alert`），不持有值或校验逻辑。

### ListIcon / CategoryIcon

```vue
<ListIcon :name="list.icon" :color="list.color" />
<CategoryIcon name="today" />
```

- `ListIcon` 把持久化的清单图标名称映射到明确打包的 Lucide 组件；未识别名称回退默认图标，
  不崩溃、不改写用户数据。图标选择器与展示必须共用 `list-icons.js` 的映射。
- `CategoryIcon` 统一智能分类在 Sidebar 与页面标题中的图标。

## Design tokens

在 `assets/styles/theme-variables.css` 定义、由 `tailwind.config.js` 映射：

| token | 用途 |
| --- | --- |
| `--radius-sm/md/lg/xl` | 圆角档位（`rounded-sm/md/lg/xl`） |
| `--control-h-sm/md/lg` | 控件高度（`h-control-*` / `min-h-control-*`） |
| `--icon-sm/md/lg` | 图标尺寸（`h-icon-* w-icon-*`） |
| `--font-sans` | 系统字体栈（含中文回退，不依赖未打包字体） |

语义颜色（`background/foreground/primary/...`、`status-*`）沿用现有主题变量；五套主题只覆盖
palette 等外观 token，不通过页面选择器重设组件外观。

## 动效

`components/ui` 的浮层动效定义在 `assets/styles/components/ui.css`。全局 `prefers-reduced-motion`
规则会将其降级，无需逐组件处理。

## 共享业务组件：新建任务入口

`components/TaskComposer.vue` 是公共「新建任务」弹窗（标题/任务内容、备注、清单、日期时间、AI 模型），
自包含数据行为，其他页面直接引入即可复用。`components/FloatingAddButton.vue` 是配套的底部悬浮入口：

```vue
<FloatingAddButton @click="composerOpen = true" />
<TaskComposer v-model:open="composerOpen" @created="onCreated" />
```

日期时间写入现有「安排」字段（`scheduledStartAt`）；日期用 `DatePicker`，不在业务层自写日历。

## 阶段 2 迁移记录（任务展示 / Inspector / 清单管理）

- `FlatTaskItem` 的 Today 试点变体（`variant="today"`、`.flat-task-item--today`）已移除；正文层级、
  ≥28×28 点击区域、hover/focus 显示操作等规则现在是所有视图共享的默认呈现。
- 任务删除不再使用原生 `confirm`：`FlatTaskItem` 统一发出 `delete-request`，由宿主
  （TodayOverview、FlatTaskList、MonthlyView）用 `AlertDialog` 确认并恢复焦点；看板卡片删除由
  `KanbanBoard` 统一确认；列表/看板编辑器删除由 `TaskManager` 统一确认；步骤删除由
  `TaskEditVertical` 自行确认。确认状态机（提交中防重复、失败保留可重试、取消与焦点恢复）由
  `composables/useDeleteConfirm.js` 共享，各视图只提供删除动作与焦点落点。
- E2E 覆盖：`e2e/task-views.spec.js` 验证列表批量删除、列表任务行删除、看板卡片删除、编辑器任务删除
  与步骤删除的确认契约。
- 已迁移到本地 Lucide / `ListIcon` 的活跃区域：普通列表、看板（列头、卡片、添加任务、错误态）、
  日历（重复实例开关、日期任务弹层）、Inspector（选项图标、步骤、列表选择器）、清单创建弹窗
  （图标选择器与预览）。
- 清单图标选择器与展示共用 `list-icons.js` 映射；未知名称回退默认图标，不改写持久化数据。

### 尚未迁移（后续阶段）

- 设置页（Settings、DataSettings）仍使用原生 `confirm`，属于阶段 3。
- 悬浮界面（`float_view/TaskPanel`）仍使用 Font Awesome 与 `getListIconClass`，属于阶段 4。
- 日历事件表面（事件胶囊、日期弹层）与 `TaskPanel` 的完整视觉适配尚未完成。
- 列表/看板/Inspector 中仍有历史自建文本按钮沿用原有 CSS；基础 Button 的全面替换留待后续阶段。

## 阶段 3 迁移记录（业务弹层 / 日期 / 设置 / 统计）

- 新增基础组件 `Switch`（Reka UI）与 `FormField`（标签 / 帮助 / 错误包装）。
- 原生业务确认全部迁移到 `AlertDialog`：设置页「恢复默认设置」「清除所有数据」、清单删除自建弹窗
  （保留「移动到默认清单 / 同时删除任务」单选）。活跃业务代码不再使用原生 `confirm`。
- 业务弹层统一到共享 `Dialog`（Reka）：TaskPreviewModal、TaskDetailsModal、TaskSelectionModal、
  ReportModal、ListCreateDialog、UnifiedCalendar 日期任务弹层获得焦点约束、Escape 关闭与遮罩关闭；
  `Dialog` 扩展了 `contentClass` / `bodyClass` / `#header-actions` / `#footer` 与 `closeOnOverlay`。
  编辑型弹层（TaskPreviewModal、TaskDetailsModal、ListCreateDialog）显式 `closeOnOverlay=false`，
  避免遮罩点击丢弃未保存内容。
- 设置页统一：`Switch` 替换历史 `.setting-toggle` 开关；AI 表单使用 `FormField` + `Input`（标签关联、
  错误语义）；图标迁移到本地 Lucide；主要动作使用 `Button` / `IconButton`；AI 模板预览从 `alert`
  改为 `Dialog`；统计页操作按钮使用 `Button`。
- 图表：DailyStatusTrendChart 接入系统字体 token 并在主题切换后刷新颜色；ActivityHeatmap 色阶与
  滚动条改用语义 token，移除对 `prefers-color-scheme` 的依赖。
- 日期：Vue Datepicker 弹层通过 `vue-datepicker.css` 映射到语义 token 并传入 `:dark`；
  v-calendar 与 `ui/DatePicker` 保持既有 token 适配。

### 阶段 3 尚未完成 / 后续

- 设置页原生 `<select>` 选择器保留为平台控件（已统一外观），未引入独立 Select 组件。
- TaskSelectionModal 内的 AI 模型下拉仍为历史自建实现，未迁移到共享 DropdownMenu。
- 迁移后部分历史弹层容器 CSS 已失去消费者，清理与全量 CDN 移除一并留待阶段 5。
- 悬浮界面（阶段 4）与主窗口 Surface 定稿（阶段 5）未涉及。

## 阶段 4 迁移记录（悬浮界面 / 跨窗口）

- 悬浮界面图标迁移到本地 Lucide：FloatingIcon（Check / AlarmClock）、FloatingTask（状态与操作）、
  TaskPanel 清单选择器改用 `ListIcon`（未选择清单时回退 `Layers`）。悬浮图标按钮补充可访问名称。
- TaskPanel 提醒弹窗改用共享 `Dialog`；原生 `alert` 改为弹窗内联错误；移除已失去消费者的
  `@vuepic/vue-datepicker` 样式导入。
- 打开输入、提醒弹窗或右键菜单时，悬浮面板不再因鼠标移出而自动隐藏（关闭后恢复原策略）。
- E2E `e2e/float-view.spec.js` 验证真实 Electron 行为：悬浮窗口存在且置顶、任务面板显示/隐藏、
  面板新增任务跨窗口同步到主窗口、颜色主题跨窗口同步。

### 阶段 4 尚未完成 / 后续

- TaskPanel 的分类 / 清单下拉与右键菜单仍为历史自建实现，未迁移到共享 DropdownMenu。
- TaskPanel 仍有内联本地 SVG 图标（分类、固定、状态勾选、右键菜单等）；它们已离线可用，但尚未统一为
  Lucide 组件，留待阶段 5 收口。
- 悬浮图标本身是带拖拽交互的透明窗口按钮，保留原生 `<button>` 而非 `IconButton`（自定义拖动/穿透
  语义与基础按钮样式冲突），作为明确例外记录。
- 悬浮面板的历史弹层容器 CSS 失去消费者，与阶段 5 一并清理。
- 鼠标穿透、置顶、拖动依赖既有主进程窗口逻辑，本阶段仅做窄范围验证，未引入新的窗口生命周期模型。
- 主窗口 Surface 定稿与 Font Awesome CDN 移除属于阶段 5。

## 阶段 5 迁移记录（Surface 定稿 / 主题收敛 / CDN 清理）

- 移除 `index.html` 的 Font Awesome CDN；`TimeFilter` 等最后一批活跃 FA 图标迁移到本地 Lucide。
- 清理迁移后失去消费者的样式：各业务弹层的历史 overlay / container / header / close 规则与关键帧
  （list-create、report、task-selection、task-details、task-panel、unified-calendar），以及
  KanbanCard、TaskEditVertical 中不再渲染的 FA 注释块与随之失效的方法。
- 主内容区由大卡片阴影改为轻量 `shadow-sm`，以背景层次与分隔线组织（阴影保留给真正覆盖内容的浮层）。
- 重新启用 Vercel 主题，恢复 Spec 要求的五套颜色主题；主题只覆盖 palette 等外观 token，
  基础组件布局与交互由 token 继承。
- 离线冷启动与五套主题回归由 `e2e/foundation.spec.js` 覆盖。

### 全量覆盖对照（最终）

- 活跃界面：Today、普通列表、看板、日历、Inspector、清单管理、业务弹层、设置、统计、悬浮界面
  均已迁移或验证；未使用目录 `components/unused/` 与仅被它引用的 `utils/icon-utils.js` 保留不动。
- 原生业务确认：活跃代码不再使用原生 `confirm`（系统文件/权限对话框按用途保留）。
- 图标：核心 UI 图标本地可离线显示；清单图标旧名称兼容；Font Awesome CDN 已移除。
- 主题：五套颜色主题 × 明暗模式继承同一基础组件规则，跨窗口同步。
- 测试：renderer 构建、单元测试、完整 Electron E2E 通过。

### 已知未验证项 / 后续

- Windows 平台的窗口材质、标题栏与悬浮行为未在本环境验证（当前仅有 macOS）。
- 设置页原生 `<select>`、TaskSelectionModal 的 AI 下拉、TaskPanel 的内联 SVG 图标未进一步统一；
  它们功能与离线可用性正常，属于后续可选收敛。
- 主窗体边距与圆角的最终视觉定稿需要真实应用截图确认；本轮仅将重阴影降级，未改动宽高计算。
