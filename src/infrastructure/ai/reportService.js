/**
 * 报告生成服务
 * 负责处理任务数据格式化、报告类型判断和模板处理
 */
class ReportService {
  /**
   * 生成 AI 报告
   * @param {Array} tasks - 当前筛选的任务列表
   * @param {String} filterType - 当前筛选器类型
   * @param {Object} userTemplates - 用户自定义模板
   * @returns {Promise<Object>} 生成的报告数据
   */
  static async generateReport(tasks, filterType, userTemplates = {}) {
    try {
      // 1. 确定报告类型
      const reportType = this.determineReportType(filterType)
      
      // 2. 格式化任务数据
      const formattedTasks = this.formatTasksForAI(tasks)
      
      // 3. 获取模板
      const template = this.getTemplate(reportType, userTemplates)
      
      // 4. 生成报告周期
      const reportPeriod = this.generateReportPeriod(reportType)
      
      // 5. 构建 AI 提示
      const prompt = this.buildAIPrompt({
        tasks: formattedTasks,
        template,
        reportType,
        reportPeriod,
        currentTime: new Date().toISOString(),
        projectName: '任务管理项目' // 可以后续从配置中获取
      })
      
      return {
        success: true,
        prompt,
        reportType,
        reportPeriod,
        taskCount: tasks.length
      }
    } catch (error) {
      console.error('生成报告失败:', error)
      throw new Error(`报告生成失败: ${error.message}`)
    }
  }

  /**
   * 根据筛选器类型确定报告类型
   * @param {String} filterType - 筛选器类型
   * @returns {String} 'daily' 或 'weekly'
   */
  static determineReportType(filterType) {
    switch (filterType) {
      case 'onlyToday':
      case 'overdue':
        return 'daily'
      case 'thisWeek':
      case 'all':
      default:
        return 'weekly'
    }
  }

  /**
   * 格式化任务数据为 AI 可处理的格式
   * @param {Array} tasks - 原始任务数据
   * @returns {String} JSON 字符串格式的任务数据
   */
  static formatTasksForAI(tasks) {
    const formattedTasks = tasks.map(task => {
      // 基础任务信息
      const formattedTask = {
        content: task.content || '',
        status: this.normalizeTaskStatus(task),
        scheduledStartAt: task.scheduledStartAt || null,
        scheduledEndAt: task.scheduledEndAt || null,
        dueDate: task.dueDate || null,
        dueTime: task.dueTime || null,
        completedAt: task.completedAt || null,
        metadata: {
          note: task.metadata?.note || '',
          steps: task.metadata?.steps || []
        }
      }

      return formattedTask
    })

    return formattedTasks
  }

  /**
   * 标准化任务状态
   * @param {Object} task - 任务对象
   * @returns {String} 标准化的状态
   */
  static normalizeTaskStatus(task) {
    // 优先使用 status 字段
    if (task.status) {
      return task.status
    }

    // 回退逻辑：根据 completedAt 判断
    if (task.completedAt) {
      return 'done'
    }

    // 检查子任务状态
    if (task.metadata?.steps && task.metadata.steps.length > 0) {
      const completedSteps = task.metadata.steps.filter(step => step.status === 'done')
      if (completedSteps.length > 0 && completedSteps.length < task.metadata.steps.length) {
        return 'doing'
      }
    }

    // 检查截止是否已逾期
    if (task.dueDate) {
      const taskTime = require('../../domain/services/task-time')
      if (taskTime.isOverdue(task)) {
        return 'overdue'
      }
    }

    return 'todo'
  }

  /**
   * 获取报告模板
   * @param {String} reportType - 报告类型
   * @param {Object} userTemplates - 用户自定义模板
   * @returns {String} 模板内容
   */
  static getTemplate(reportType, userTemplates) {
    // 优先使用用户自定义模板
    if (userTemplates[reportType] && userTemplates[reportType].trim()) {
      return userTemplates[reportType]
    }

    // 使用默认模板
    return this.getDefaultTemplate(reportType)
  }

  /**
   * 获取默认模板
   * @param {String} reportType - 报告类型
   * @returns {String} 默认模板内容
   */
  static getDefaultTemplate(reportType) {
    const templates = {
      daily: `# {{project_name}} 日报

**日期:** {{report_period}}

## 📝 今日小结
{{summary}}

## ✅ 已完成工作
{{completed_tasks}}

## ⏳ 进行中工作
{{inprogress_tasks}}

## 📅 明日计划
{{planned_tasks}}

## ⚠️ 风险与问题
{{risks_issues}}`,

      weekly: `# {{project_name}} 周报

**周期:** {{report_period}}

## 📝 本周小结
{{summary}}

## ✅ 本周完成工作
{{completed_tasks}}

## ⏳ 进行中工作
{{inprogress_tasks}}

## 📅 下周工作计划
{{planned_tasks}}

## ⚠️ 风险与问题
{{risks_issues}}`
    }

    return templates[reportType] || templates.weekly
  }

  /**
   * 生成报告周期
   * @param {String} reportType - 报告类型
   * @returns {String} 报告周期字符串
   */
  static generateReportPeriod(reportType) {
    const now = new Date()
    
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    if (reportType === 'daily') {
      return formatDate(now)
    } else {
      // 周报：计算本周一到本周日的日期
      const currentDay = now.getDay() // 0=周日, 1=周一, ..., 6=周六
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay // 计算到周一的偏移
      
      const monday = new Date(now)
      monday.setDate(now.getDate() + mondayOffset)
      
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      
      return `${formatDate(monday)}~${formatDate(sunday)}`
    }
  }

  /**
   * 构建 AI 提示
   * @param {Object} params - 参数对象
   * @returns {String} 完整的 AI 提示
   */
  static buildAIPrompt({ tasks, template, reportType, reportPeriod, currentTime, projectName }) {
    const promptTemplate ={
  "persona": {
    "role": "你是一个高度精确的智能报告生成引擎，精通 Markdown 语法和模板处理。",
    "description": "你的核心能力是解析结构化的任务数据并将其填充到自定义模板中。你特别擅长解析包含子任务（steps）的复杂任务结构，并能以清晰的层级关系在报告中展示详细进展。"
  },
  "instructions": {
    "goal": "根据用户提供的任务列表（user_task_list）和自定义 Markdown 模板（user_defined_template），生成一份完全符合用户模板格式、并能清晰展示子任务进度的周报或日报。",
    "processing_rules": {
      "primary_source_of_truth": "任务对象根目录下的 `status` 字段是判断任务当前状态的最优先、最权威的依据。",
      "task_status_logic": [
        { "category": "Completed", "condition": "任务的 `status` 字段为 'done'。如果 `status` 字段不存在，则回退判断：任务对象中存在 'completedAt' 字段。" },
        { "category": "In Progress", "condition": "任务的 `status` 字段为 'doing' 或 'in-progress'。如果 `status` 字段不存在，则回退判断：任务没有 'completedAt' 字段，但其子任务 'steps' 中部分任务已完成。" },
        { "category": "Planned for Next Period", "condition": "任务的 `status` 字段为 'todo' 或 'planned'。如果 `status` 字段不存在，则回退判断：任务没有 'completedAt' 字段，且其 'scheduledStartAt' 或 'dueDate' 在下一个报告周期内。" },
        { "category": "Risks & Issues", "condition": "任务的 `status` 字段为 'blocked' 或 'at-risk'。或者，当任务的 `status` 不是 'done'，但其 'dueDate' 已经显著早于 `currentTime`，或 'scheduledStartAt' 已过去仍未完成。" }
      ]
    },
    "content_formatting_rules": {
      "description": "在准备填充内容时，必须遵循以下格式化规则。",
      "general_rule": "对于没有 `steps` 数组的任务，或在 `{{completed_tasks}}` 和 `{{planned_tasks}}` 中的任务，将其 `content` 格式化为简单的 Markdown 无序列表项（例如 `- 任务内容`）。",
      "detailed_view_for_inprogress": {
        "trigger_condition": "当一个任务被分类到 'In Progress'，并且它包含一个非空的 `steps` 数组时...",
        "formatting_instruction": "必须将该任务渲染为一个包含嵌套子任务列表的结构。使用 Markdown 任务列表语法（GFM Task Lists）来清晰地展示每个子任务的状态：\n1. 父任务作为主列表项。\n2. `steps` 数组中的每个子任务作为嵌套的列表项。\n3. 如果子任务的 `status` 是 'done'，使用 `- [x]` (已勾选)。\n4. 如果子任务的 `status` 是 'todo' 或其他状态，使用 `- [ ]` (未勾选)。"
      }
    },
    "report_generation_steps": [
      "1. **分析和分类任务**: 遍历 `user_task_list`，根据 `processing_rules` 将每个任务归类到内部数据桶中。",
      "2. **生成摘要**: 基于分类结果，生成报告摘要。",
      "3. **准备填充内容**: 为所有占位符准备替换内容。在处理每个任务时，严格遵循 `content_formatting_rules`。特别是对于进行中的任务，要应用详细的子任务视图格式。",
      "4. **执行模板填充**: 读取 `user_defined_template`，将所有 `{{placeholder_name}}` 替换为准备好的内容。",
      "5. **处理空内容**: 如果某个任务列表占位符没有对应任务，用'无'或'暂无'替换。",
      "6. **输出最终结果**: 输出被完全填充和渲染后的 Markdown 纯文本，不包含任何解释或代码块标记。"
    ]
  },
  "context_input": {
    "description": "动态填充的上下文信息对象。",
    "schema": {
      "currentTime": currentTime,
      "reportPeriod": reportPeriod,
      "reportType": reportType,
      "projectName": projectName,
      "user_task_list": tasks,
      "user_defined_template": template
    }
  },
  "template_engine_specification": {
    "description": "你必须严格遵循以下模板引擎规则，识别并填充占位符。",
    "placeholder_syntax": "`{{placeholder_name}}`",
    "available_placeholders": [
      { "name": "{{project_name}}", "description": "项目名称" },
      { "name": "{{report_period}}", "description": "报告的日期周期" },
      { "name": "{{report_type}}", "description": "报告类型" },
      { "name": "{{summary}}", "description": "报告摘要" },
      { "name": "{{completed_tasks}}", "description": "已完成任务的 Markdown 列表。" },
      { "name": "{{inprogress_tasks}}", "description": "进行中任务的 Markdown 列表，包含详细的子任务进度。" },
      { "name": "{{planned_tasks}}", "description": "计划中任务的 Markdown 列表。" },
      { "name": "{{risks_issues}}", "description": "风险或延期任务的 Markdown 列表。" }
    ],
    "example_of_execution": {
      "input_user_template": "# {{project_name}} {{report_type}}\n\n**周期:** {{report_period}}\n\n### 综述\n{{summary}}\n\n### ✅ 已完成\n{{completed_tasks}}\n\n### ⏳ 进行中\n{{inprogress_tasks}}\n\n### 📅 下周计划\n{{planned_tasks}}",
      "expected_output_based_on_new_data": "# 智能助手 周报\n\n**周期:** 2025-09-01 ~ 2025-09-07\n\n### 综述\n本周主要推进了AI生成任务功能，目前已完成前后端开发，进入最后的联调测试阶段。同时，完成了另一项后端接口的设计，整体进展符合预期。\n\n### ✅ 已完成\n- 后端：设计并实现 AI 模型调用接口\n- 联调前后端接口并完成测试\n\n### ⏳ 进行中\n- 今天下午完成 AI 生成任务功能\n  - [x] 后端：设计并实现 AI 模型调用接口\n  - [x] 前端：开发任务生成按钮和交互逻辑\n  - [ ] 联调前后端接口并完成测试\n\n### 📅 下周计划\n- 无"
    }
  }
}

    return JSON.stringify(promptTemplate, null, 2)
  }

  /**
   * 替换模板占位符（用于预览等场景）
   * @param {String} template - 模板内容
   * @param {Object} data - 替换数据
   * @returns {String} 替换后的内容
   */
  static replacePlaceholders(template, data) {
    let result = template
    
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(placeholder, value || '暂无')
    })
    
    return result
  }
}

export default ReportService