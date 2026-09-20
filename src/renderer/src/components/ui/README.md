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
