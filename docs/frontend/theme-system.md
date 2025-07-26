# 主题系统

MoliTodo 使用了模块化的 CSS 架构，支持主题切换功能。所有样式都集中管理，便于维护和扩展。

## 架构概览

### 文件结构

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

### 设计原则

1. **CSS 变量优先** - 所有样式值都使用 CSS 变量定义
2. **主题分离** - 主题变量与组件样式分离
3. **模块化组织** - 按组件组织样式文件
4. **响应式设计** - 支持不同屏幕尺寸
5. **无障碍支持** - 符合 WCAG 标准

## CSS 变量系统

### 变量分类

#### 颜色变量
```css
/* 主色调 */
--color-primary: #667eea;
--color-primary-hover: #5a67d8;
--color-primary-light: rgba(102, 126, 234, 0.1);

/* 状态颜色 */
--color-success: #28a745;
--color-warning: #ffc107;
--color-danger: #dc3545;
--color-info: #17a2b8;

/* 任务状态颜色 */
--status-todo: #94a3b8;
--status-doing: #f59e0b;
--status-done: #10b981;
```

#### 背景变量
```css
/* 背景层级 */
--bg-primary: rgba(255, 255, 255, 0.95);
--bg-secondary: rgba(255, 255, 255, 0.8);
--bg-tertiary: rgba(255, 255, 255, 0.9);

/* 交互状态 */
--bg-hover: rgba(102, 126, 234, 0.05);
--bg-active: rgba(102, 126, 234, 0.1);
--bg-overlay: rgba(0, 0, 0, 0.5);
```

#### 文本变量
```css
/* 文本层级 */
--text-primary: #1a1a1a;
--text-secondary: #666;
--text-muted: #999;
--text-white: white;
--text-disabled: #94a3b8;
```

#### 间距变量
```css
/* 间距系统 */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 20px;
--spacing-2xl: 24px;
```

#### 其他变量
```css
/* 边框圆角 */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
--radius-2xl: 16px;
--radius-full: 50%;

/* 阴影效果 */
--shadow-sm: 0 4px 8px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
--shadow-lg: 0 6px 20px rgba(0, 0, 0, 0.25);
--shadow-xl: 0 8px 25px rgba(0, 0, 0, 0.35);

/* 过渡动画 */
--transition-fast: 0.2s ease;
--transition-normal: 0.3s ease;
--transition-slow: 0.5s ease;
--transition-bounce: 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

## 主题定义

### 浅色主题（默认）

```css
:root {
  /* 浅色主题变量定义 */
  --color-primary: #667eea;
  --bg-primary: rgba(255, 255, 255, 0.95);
  --text-primary: #1a1a1a;
  /* ... 其他变量 */
}
```

### 深色主题

```css
[data-theme="dark"] {
  /* 深色主题变量覆盖 */
  --color-primary: #7c3aed;
  --bg-primary: rgba(30, 30, 30, 0.95);
  --text-primary: #ffffff;
  /* ... 其他变量 */
}
```

## 主题管理

### useTheme Composable

```javascript
// src/renderer/src/composables/useTheme.js
import { ref, readonly } from 'vue'

const currentTheme = ref('light')
const isDark = ref(false)

const themes = {
  light: 'light',
  dark: 'dark'
}

const setTheme = (theme) => {
  if (!Object.values(themes).includes(theme)) {
    console.warn(`Invalid theme: ${theme}`)
    return
  }
  
  currentTheme.value = theme
  isDark.value = theme === themes.dark
  
  // 应用主题到 DOM
  document.documentElement.setAttribute('data-theme', theme)
  
  // 保存到本地存储
  localStorage.setItem('theme', theme)
  
  // 通知主进程
  if (window.electronAPI?.theme?.setTheme) {
    window.electronAPI.theme.setTheme(theme)
  }
}

const toggleTheme = () => {
  const newTheme = currentTheme.value === themes.light ? themes.dark : themes.light
  setTheme(newTheme)
}

export const useTheme = () => {
  return {
    currentTheme: readonly(currentTheme),
    isDark: readonly(isDark),
    themes,
    setTheme,
    toggleTheme
  }
}
```

### 主题切换器组件

```vue
<!-- src/renderer/src/components/ThemeSwitcher.vue -->
<template>
  <div class="theme-switcher">
    <button
      v-for="theme in availableThemes"
      :key="theme.value"
      :class="['theme-option', { active: currentTheme === theme.value }]"
      @click="setTheme(theme.value)"
    >
      <component :is="theme.icon" />
      {{ theme.label }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { currentTheme, setTheme, themes } = useTheme()

const availableThemes = computed(() => [
  {
    value: themes.light,
    label: '浅色',
    icon: LightIcon
  },
  {
    value: themes.dark,
    label: '深色',
    icon: DarkIcon
  }
])
</script>
```

## 组件样式开发

### 使用 CSS 变量

```css
/* 推荐的样式写法 */
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  transition: all var(--transition-fast);
}

.my-component:hover {
  background: var(--bg-hover);
  border-color: var(--color-primary);
}
```

### 避免硬编码

```css
/* ❌ 不推荐 - 硬编码值 */
.bad-component {
  background: #ffffff;
  color: #333333;
  padding: 16px;
  border-radius: 8px;
}

/* ✅ 推荐 - 使用变量 */
.good-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
}
```

### 组件特定样式

```css
/* components/my-component.css */
.my-component {
  /* 使用全局变量 */
  background: var(--bg-primary);
  padding: var(--spacing-lg);
  
  /* 组件特定的样式 */
  position: relative;
  overflow: hidden;
}

.my-component__header {
  border-bottom: 1px solid var(--border-light);
  padding-bottom: var(--spacing-md);
}

.my-component__content {
  padding-top: var(--spacing-md);
}
```

## 响应式设计

### 断点系统

```css
/* 响应式断点 */
@media (max-width: 768px) {
  .component {
    padding: var(--spacing-md);
    font-size: var(--font-size-sm);
  }
}

@media (max-width: 480px) {
  .component {
    padding: var(--spacing-sm);
  }
}
```

### 移动端适配

```css
/* 移动端特定样式 */
@media (max-width: 768px) {
  .floating-icon {
    width: 45px;
    height: 45px;
  }
  
  .task-panel {
    width: 90vw;
    max-width: none;
  }
}
```

## 无障碍支持

### 高对比度模式

```css
@media (prefers-contrast: high) {
  .component {
    border: 2px solid var(--text-primary);
    background: var(--bg-primary);
  }
}
```

### 减少动画模式

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 焦点样式

```css
.interactive-element:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

## 添加新主题

### 1. 定义主题变量

在 `variables.css` 中添加新主题：

```css
[data-theme="custom"] {
  --color-primary: #your-primary-color;
  --bg-primary: #your-background-color;
  --text-primary: #your-text-color;
  /* ... 定义所有必要的变量 */
}
```

### 2. 更新主题配置

在 `useTheme.js` 中添加新主题：

```javascript
const themes = {
  light: 'light',
  dark: 'dark',
  custom: 'custom'  // 新增主题
}
```

### 3. 更新主题切换器

在 `ThemeSwitcher.vue` 中添加新选项：

```javascript
const availableThemes = computed(() => [
  // ... 现有主题
  {
    value: themes.custom,
    label: '自定义',
    icon: CustomIcon
  }
])
```

## 最佳实践

### 1. 变量命名规范

```css
/* 语义化命名 */
--color-primary          /* 主色 */
--color-primary-hover    /* 主色悬停态 */
--color-primary-light    /* 主色浅色版 */

/* 功能性命名 */
--bg-primary            /* 主背景 */
--bg-secondary          /* 次背景 */
--bg-hover              /* 悬停背景 */

/* 组件特定命名 */
--button-padding        /* 按钮内边距 */
--modal-border-radius   /* 模态框圆角 */
```

### 2. 样式组织

```css
/* 按逻辑分组 */
.component {
  /* 布局属性 */
  display: flex;
  position: relative;
  
  /* 尺寸属性 */
  width: 100%;
  height: auto;
  padding: var(--spacing-lg);
  
  /* 外观属性 */
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  
  /* 文本属性 */
  color: var(--text-primary);
  font-size: var(--font-size-base);
  
  /* 动画属性 */
  transition: all var(--transition-fast);
}
```

### 3. 性能优化

```css
/* 使用 transform 而不是改变位置属性 */
.animated-element {
  transform: translateX(0);
  transition: transform var(--transition-fast);
}

.animated-element:hover {
  transform: translateX(10px);
}

/* 避免复杂的选择器 */
/* ❌ 不推荐 */
.parent .child .grandchild .element {
  color: var(--text-primary);
}

/* ✅ 推荐 */
.specific-element {
  color: var(--text-primary);
}
```

## 调试和测试

### 主题切换测试

```javascript
// 在浏览器控制台测试主题切换
document.documentElement.setAttribute('data-theme', 'dark')
document.documentElement.setAttribute('data-theme', 'light')
```

### CSS 变量检查

```javascript
// 检查 CSS 变量值
getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
```

### 样式调试

```css
/* 临时调试样式 */
.debug {
  border: 1px solid red !important;
  background: rgba(255, 0, 0, 0.1) !important;
}
```

## 常见问题

### Q: 如何确保主题变量的完整性？

A: 在添加新主题时，确保定义所有必要的变量：

```css
[data-theme="new-theme"] {
  /* 复制所有 :root 中的变量并修改值 */
  --color-primary: #new-color;
  --bg-primary: #new-bg;
  /* ... 确保没有遗漏 */
}
```

### Q: 如何处理主题切换时的闪烁？

A: 在应用初始化时立即设置主题：

```javascript
// 在 main.js 中尽早执行
const savedTheme = localStorage.getItem('theme') || 'light'
document.documentElement.setAttribute('data-theme', savedTheme)
```

### Q: 如何在组件中响应主题变化？

A: 使用 useTheme composable：

```javascript
import { useTheme } from '@/composables/useTheme'

const { currentTheme, isDark } = useTheme()

// 监听主题变化
watch(currentTheme, (newTheme) => {
  console.log('Theme changed to:', newTheme)
})
```

## 扩展阅读

- [CSS 自定义属性 (MDN)](https://developer.mozilla.org/zh-CN/docs/Web/CSS/--*)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [WCAG 无障碍指南](https://www.w3.org/WAI/WCAG21/quickref/)
- [现代 CSS 架构](https://www.smashingmagazine.com/2018/06/bem-for-beginners/)

---

*主题系统让 MoliTodo 更容易维护和扩展，同时为用户提供了更好的个性化体验。*