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
