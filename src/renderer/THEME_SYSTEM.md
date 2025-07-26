# MoliTodo 主题系统

## 概述

MoliTodo 现在使用了模块化的 CSS 架构，支持主题切换功能。所有样式都集中管理，便于维护和扩展。

## 文件结构

```
src/renderer/src/assets/styles/
├── index.css              # 主入口文件
├── variables.css          # CSS 变量和主题定义
├── base.css              # 基础样式和通用组件
└── components/           # 组件特定样式
    ├── floating-icon.css
    ├── task-panel.css
    ├── task-manager.css
    └── settings.css
```

## 主题系统

### 使用 CSS 变量

所有颜色、间距、字体等都定义为 CSS 变量，支持主题切换：

```css
/* 使用主题变量 */
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
}
```

### 主要变量类别

- **颜色**: `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`
- **背景**: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
- **文本**: `--text-primary`, `--text-secondary`, `--text-muted`
- **边框**: `--border-light`, `--border-medium`, `--border-strong`
- **间距**: `--spacing-xs` 到 `--spacing-2xl`
- **圆角**: `--radius-sm` 到 `--radius-2xl`
- **阴影**: `--shadow-sm` 到 `--shadow-xl`

### 主题切换

使用 `useTheme` composable 来管理主题：

```javascript
import { useTheme } from '@/composables/useTheme'

const { currentTheme, isDark, setTheme, toggleTheme } = useTheme()

// 切换到深色主题
setTheme('dark')

// 切换主题
toggleTheme()
```

## 添加新组件样式

1. 在 `src/assets/styles/components/` 下创建新的 CSS 文件
2. 使用 CSS 变量而不是硬编码的值
3. 在 `index.css` 中导入新的样式文件
4. 在组件中只保留组件特定的样式覆盖

### 示例

```css
/* components/my-component.css */
.my-component {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.my-component:hover {
  background: var(--bg-hover);
  border-color: var(--color-primary);
}
```

## 添加新主题

1. 在 `variables.css` 中添加新的主题变量：

```css
[data-theme="new-theme"] {
  --color-primary: #your-color;
  --bg-primary: #your-bg;
  /* ... 其他变量 */
}
```

2. 在 `useTheme.js` 中添加新主题：

```javascript
const themes = {
  light: 'light',
  dark: 'dark',
  newTheme: 'new-theme'
}
```

3. 更新 `ThemeSwitcher.vue` 组件以包含新主题选项

## 最佳实践

1. **始终使用 CSS 变量**：避免硬编码颜色和尺寸
2. **保持一致性**：使用预定义的间距和圆角值
3. **响应式设计**：使用媒体查询适配不同屏幕尺寸
4. **无障碍支持**：确保颜色对比度符合标准
5. **性能优化**：避免过度嵌套和复杂选择器

## 迁移现有组件

1. 移除组件中的内联样式
2. 将硬编码的值替换为 CSS 变量
3. 将通用样式移到 `base.css`
4. 只在组件中保留特定的样式覆盖

这个新的主题系统让 MoliTodo 更容易维护和扩展，同时为用户提供了更好的个性化体验。