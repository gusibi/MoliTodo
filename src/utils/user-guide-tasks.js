/**
 * 用户引导任务数据
 * 这些任务将在应用首次启动时自动创建，帮助用户了解应用功能
 */

const USER_GUIDE_TASKS = [
  {
    content: "在输入框创建任务",
    metadata: {},
    priority: 1
  },
  {
    content: "点击左侧下方的 + 创建清单",
    metadata: {
      steps: [
        { id: "step_1", content: "可以配置清单颜色", status: "todo" },
        { id: "step_2", content: "配置清单图标", status: "todo" },
        { id: "step_3", content: "删除清单时会自动删除清单中的任务", status: "todo" }
      ]
    },
    priority: 2
  },
  {
    content: "点击task 编辑",
    metadata: {
      steps: [
        { id: "step_1", content: "添加步骤", status: "todo" },
        { id: "step_2", content: "添加提醒时间", status: "todo" },
        { id: "step_3", content: "删除步骤", status: "todo" },
        { id: "step_4", content: "设置重复项", status: "todo" }
      ],
      note: "在这里添加备注"
    },
    priority: 3
  },
  {
    content: "使用 AI 自动生成&拆分任务",
    metadata: {
      steps: [
        { id: "step_1", content: "在设置中配置 AI", status: "todo" },
        { id: "step_2", content: "可以使用 openai 兼容的 API", status: "todo" },
        { id: "step_3", content: "创建任务时选中 AI 模型，输入任务自动创建", status: "todo" },
        { id: "step_4", content: "创建任务时选中拆分，会将任务的步骤都拆分成任务", status: "todo" }
      ]
    },
    priority: 4
  },
  {
    content: "将鼠标放到悬浮按钮上",
    metadata: {},
    priority: 5
  },
  {
    content: "鼠标放到悬浮按钮后展开悬浮窗口，在悬浮窗口创建任务",
    metadata: {},
    priority: 6
  },
  {
    content: "在悬浮窗口的任务上右键，创建悬浮任务",
    metadata: {},
    priority: 7
  },
  {
    content: "开始任务：点击任务列表右侧的开始按钮",
    metadata: {},
    priority: 8
  },
  {
    content: "暂停任务：点击已经开始的任务右侧的暂停按钮",
    metadata: {},
    priority: 9
  },
  {
    content: "完成任务：点击任务列表左侧的圆形 checkbox",
    metadata: {},
    priority: 10
  },
  {
    content: "日历视图：点击上方日历按钮",
    metadata: {},
    priority: 11
  },
  {
    content: "kanban 视图：点击上方 kanban 按钮",
    metadata: {},
    priority: 12
  },
  {
    content: "查看已经完成任务：点击上方最右侧的完成按钮查看已经完成的任务",
    metadata: {},
    priority: 13
  }
];

module.exports = {
  USER_GUIDE_TASKS
};