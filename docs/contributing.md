# 贡献指南

感谢您对 MoliTodo 项目的关注！我们欢迎所有形式的贡献，包括但不限于代码、文档、设计、测试和反馈。

## 贡献方式

### 🐛 报告问题

如果您发现了 bug 或有功能建议：

1. **搜索现有问题** - 在 [GitHub Issues](https://github.com/your-username/moli-todo/issues) 中搜索是否已有相关问题
2. **创建新问题** - 如果没有找到相关问题，请创建新的 Issue
3. **提供详细信息** - 包括复现步骤、预期行为、实际行为、系统环境等

#### Bug 报告模板

```markdown
**问题描述**
简洁清晰地描述问题

**复现步骤**
1. 打开应用
2. 点击 '...'
3. 看到错误

**预期行为**
描述您期望发生的情况

**实际行为**
描述实际发生的情况

**环境信息**
- 操作系统: [如 macOS 13.0]
- 应用版本: [如 v0.5.0]
- Node.js 版本: [如 v16.14.0]

**截图**
如果适用，请添加截图来帮助解释问题

**附加信息**
任何其他相关信息
```

### 💡 功能建议

我们欢迎新功能的建议：

1. **检查路线图** - 查看 [项目路线图](./introduction.md#未来规划) 确认功能是否已在计划中
2. **创建功能请求** - 使用 Feature Request 模板创建 Issue
3. **参与讨论** - 在 [GitHub Discussions](https://github.com/your-username/moli-todo/discussions) 中讨论想法

### 📝 改进文档

文档改进包括：

- 修正错别字和语法错误
- 改进现有文档的清晰度
- 添加缺失的文档
- 翻译文档到其他语言

### 🔧 贡献代码

#### 开发环境设置

1. **Fork 仓库**
   ```bash
   # 在 GitHub 上 Fork 仓库，然后克隆您的 Fork
   git clone https://github.com/your-username/moli-todo.git
   cd moli-todo
   ```

2. **设置上游仓库**
   ```bash
   git remote add upstream https://github.com/original-owner/moli-todo.git
   ```

3. **安装依赖**
   ```bash
   npm install
   ```

4. **启动开发环境**
   ```bash
   npm run dev
   ```

#### 开发流程

1. **创建分支**
   ```bash
   # 从最新的 main 分支创建新分支
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. **进行开发**
   - 遵循[代码规范](#代码规范)
   - 编写测试用例
   - 确保所有测试通过

3. **提交更改**
   ```bash
   # 添加更改
   git add .
   
   # 提交更改（遵循提交信息规范）
   git commit -m "feat: add new feature description"
   ```

4. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**
   - 在 GitHub 上创建 Pull Request
   - 填写 PR 模板
   - 等待代码审查

## 代码规范

### JavaScript/Vue 规范

我们使用 ESLint 和 Prettier 来保持代码风格一致：

```bash
# 检查代码规范
npm run lint

# 自动修复可修复的问题
npm run lint:fix

# 格式化代码
npm run format
```

#### 命名规范

- **变量和函数**: 使用 camelCase
- **常量**: 使用 UPPER_SNAKE_CASE
- **组件**: 使用 PascalCase
- **文件名**: 使用 kebab-case 或 PascalCase（组件文件）

```javascript
// ✅ 好的示例
const taskCount = 10
const MAX_RETRY_COUNT = 3
const TaskManager = defineComponent({...})

// ❌ 不好的示例
const task_count = 10
const maxRetryCount = 3
const taskmanager = defineComponent({...})
```

#### Vue 组件规范

```vue
<!-- ✅ 好的示例 -->
<template>
  <div class="task-item">
    <h3 class="task-title">{{ task.title }}</h3>
    <p class="task-description">{{ task.description }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Props 定义
const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

// 响应式数据
const isEditing = ref(false)

// 计算属性
const formattedDate = computed(() => {
  return new Date(props.task.createdAt).toLocaleDateString()
})

// 方法
const handleEdit = () => {
  isEditing.value = true
}
</script>

<style scoped>
.task-item {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}
</style>
```

### CSS 规范

- 使用 CSS 变量而不是硬编码值
- 遵循 BEM 命名规范（可选）
- 使用语义化的类名

```css
/* ✅ 好的示例 */
.task-item {
  background: var(--bg-primary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
}

.task-item__title {
  color: var(--text-primary);
  font-size: var(--font-size-lg);
}

.task-item--completed {
  opacity: 0.6;
}

/* ❌ 不好的示例 */
.task {
  background: #ffffff;
  padding: 16px;
  border-radius: 8px;
}
```

### 提交信息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### 类型 (type)

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更改
- `style`: 代码格式更改（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 添加或修改测试
- `chore`: 构建过程或辅助工具的变动

#### 示例

```bash
# 新功能
git commit -m "feat(task): add task priority feature"

# 修复 bug
git commit -m "fix(ui): resolve floating icon positioning issue"

# 文档更新
git commit -m "docs: update installation guide"

# 重构
git commit -m "refactor(store): simplify task state management"
```

## 测试指南

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行 E2E 测试
npm run test:e2e

# 生成测试覆盖率报告
npm run test:coverage
```

### 编写测试

#### 单元测试示例

```javascript
// tests/unit/task.test.js
import { describe, it, expect } from 'vitest'
import { Task } from '@/domain/entities/task'

describe('Task Entity', () => {
  it('should create task with default values', () => {
    const task = new Task({ content: 'Test task' })
    
    expect(task.content).toBe('Test task')
    expect(task.status).toBe('todo')
    expect(task.completed).toBe(false)
  })

  it('should start task correctly', () => {
    const task = new Task({ content: 'Test task' })
    task.start()
    
    expect(task.status).toBe('doing')
    expect(task.startedAt).toBeTruthy()
  })
})
```

#### Vue 组件测试示例

```javascript
// tests/unit/TaskItem.test.js
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TaskItem from '@/components/TaskItem.vue'

describe('TaskItem Component', () => {
  const mockTask = {
    id: '1',
    content: 'Test task',
    status: 'todo',
    completed: false
  }

  it('renders task content correctly', () => {
    const wrapper = mount(TaskItem, {
      props: { task: mockTask }
    })
    
    expect(wrapper.text()).toContain('Test task')
  })

  it('emits complete event when clicked', async () => {
    const wrapper = mount(TaskItem, {
      props: { task: mockTask }
    })
    
    await wrapper.find('.task-complete-btn').trigger('click')
    
    expect(wrapper.emitted('complete')).toBeTruthy()
    expect(wrapper.emitted('complete')[0]).toEqual([mockTask.id])
  })
})
```

## Pull Request 指南

### PR 模板

创建 Pull Request 时，请填写以下信息：

```markdown
## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档更新
- [ ] 性能优化
- [ ] 其他

## 变更描述
简洁地描述这个 PR 的变更内容

## 相关 Issue
关闭 #(issue 编号)

## 测试
- [ ] 添加了新的测试用例
- [ ] 所有测试都通过
- [ ] 手动测试通过

## 截图（如果适用）
添加截图来展示变更效果

## 检查清单
- [ ] 代码遵循项目的代码规范
- [ ] 进行了自我代码审查
- [ ] 代码有适当的注释
- [ ] 更新了相关文档
- [ ] 变更不会破坏现有功能
```

### 代码审查

所有 PR 都需要经过代码审查：

1. **自动检查** - CI/CD 会自动运行测试和代码检查
2. **人工审查** - 维护者会审查代码质量、设计和功能
3. **反馈处理** - 根据审查意见修改代码
4. **合并** - 审查通过后合并到主分支

### 审查标准

- **功能正确性** - 代码是否实现了预期功能
- **代码质量** - 代码是否清晰、可维护
- **性能影响** - 是否对性能有负面影响
- **安全性** - 是否引入安全风险
- **测试覆盖** - 是否有足够的测试覆盖
- **文档完整** - 是否更新了相关文档

## 社区行为准则

### 我们的承诺

为了营造一个开放和友好的环境，我们承诺：

- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性别化语言或图像，以及不受欢迎的性关注或性骚扰
- 恶意评论、人身攻击或政治攻击
- 公开或私下骚扰
- 未经明确许可发布他人的私人信息
- 在专业环境中可能被认为不合适的其他行为

### 执行

如果您遇到不当行为，请联系项目维护者：conduct@molitodo.com

## 发布流程

### 版本号规范

我们使用 [语义化版本](https://semver.org/) 规范：

- **主版本号** (MAJOR): 不兼容的 API 修改
- **次版本号** (MINOR): 向下兼容的功能性新增
- **修订号** (PATCH): 向下兼容的问题修正

### 发布步骤

1. **更新版本号**
   ```bash
   npm version patch  # 或 minor/major
   ```

2. **更新 CHANGELOG**
   - 记录所有重要变更
   - 按类型分组（新功能、修复、重构等）

3. **创建发布标签**
   ```bash
   git tag v0.5.1
   git push origin v0.5.1
   ```

4. **自动构建** - GitHub Actions 会自动构建和发布

## 获得帮助

如果您在贡献过程中遇到问题：

### 技术问题
- 查看[开发文档](./development/setup.md)
- 在 [GitHub Discussions](https://github.com/your-username/moli-todo/discussions) 提问
- 加入我们的开发者聊天群

### 流程问题
- 阅读本贡献指南
- 查看现有的 PR 作为参考
- 联系维护者：dev@molitodo.com

### 设计问题
- 查看[设计规范](./design-guidelines.md)
- 在 Issue 中讨论设计方案
- 提供设计稿或原型

## 致谢

感谢所有为 MoliTodo 做出贡献的开发者！

### 核心贡献者
- [@username1](https://github.com/username1) - 项目创始人
- [@username2](https://github.com/username2) - 前端开发
- [@username3](https://github.com/username3) - 文档维护

### 贡献者列表
查看完整的[贡献者列表](https://github.com/your-username/moli-todo/graphs/contributors)

## 许可证

通过贡献代码，您同意您的贡献将在 [MIT 许可证](../LICENSE) 下授权。

---

*再次感谢您对 MoliTodo 项目的贡献！每一个贡献都让这个项目变得更好。*