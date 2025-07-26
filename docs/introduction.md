# MoliTodo 项目介绍

<div align="center">
  <img src="../src/presentation/assets/icons/app-icon-512x512.png" alt="MoliTodo Logo" width="128" height="128">
  
  **一款常驻在桌面边缘的悬浮式待办事项应用**
  
  [![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](../package.json)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](../LICENSE)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)](#支持平台)
  [![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D.svg)](https://vuejs.org/)
  [![Electron](https://img.shields.io/badge/Electron-28.x-47848F.svg)](https://electronjs.org/)
</div>

## 项目愿景

MoliTodo 旨在提供最快速的任务查看和添加体验。通过可自定义位置的悬浮图标，将核心信息与操作入口始终置于用户视线可及之处。用户无需切换应用，即可快速管理每日任务，并通过醒目的提醒动画，确保重要事项不会被遗漏。

## 核心特性

### 🎯 无缝集成
- 不打断当前工作流，与桌面环境融为一体
- 始终置顶显示，可拖拽移动到任意位置
- 支持透明度和大小自定义，适配不同使用场景

### ⚡ 即时提醒
- 通过角标和动画提供直观、强烈的任务提醒
- 自定义提醒时间，支持多种提醒方式
- 逾期任务特殊标识，确保重要事项不被遗漏

### 🚀 快速操作
- 悬浮即可查看，输入即是添加，操作路径极短
- 支持键盘快捷键，提升操作效率
- 一键完成或删除任务，简化工作流程

### 💾 本地存储
- 所有数据存储在本地，保护隐私安全
- 支持数据导入导出，便于备份和迁移
- 自动数据备份，防止数据丢失

### 🎨 现代化设计
- Vue 3 + Composition API，提供流畅的用户体验
- 毛玻璃效果和现代化 UI 设计
- 支持主题切换，适配不同用户偏好

## 技术亮点

### 架构设计
- **领域驱动设计**: 清晰的分层架构，易于维护和扩展
- **现代化技术栈**: Vue 3 + Electron + Vite，提供最佳开发体验
- **安全的 IPC 通信**: 使用 contextBridge 确保渲染进程安全
- **模块化 CSS**: 支持主题切换的 CSS 架构

### 用户体验
- **实时数据同步**: 多窗口数据一致性保证
- **响应式设计**: 适配不同屏幕尺寸和分辨率
- **无障碍支持**: 符合 WCAG 标准的可访问性设计
- **性能优化**: 内存占用小，响应速度快

## 应用场景

### 个人任务管理
- 日常待办事项管理
- 工作任务跟踪
- 学习计划安排
- 生活提醒设置

### 专业工作流
- 项目任务管理
- 时间追踪和统计
- 工作效率分析
- 团队协作支持（规划中）

### 学习和研究
- 学习计划制定
- 研究任务跟踪
- 论文写作进度管理
- 实验记录和提醒

## 版本历程

### v0.5.0 - Vue 重构版 (当前版本)
- 🎉 全面重构为 Vue 3 + electron-vite 架构
- ✨ 新增现代化的组件化开发体验
- ✨ 新增主题切换系统
- 🔧 优化项目结构和代码组织
- ✅ 保持完全的数据兼容性

### v0.4.x - 原生版本
- 基于原生 HTML/CSS/JavaScript 开发
- 实现核心任务管理功能
- 建立基础架构和设计理念

## 未来规划

### 短期目标 (v0.6.x)
- [ ] 完善任务提醒通知显示
- [ ] 全局快捷键支持
- [ ] 性能优化和错误处理完善
- [ ] 多语言支持

### 中期目标 (v0.8.x)
- [ ] 任务标签和分组功能
- [ ] 插件系统基础
- [ ] 更多自定义选项
- [ ] 数据分析和统计功能

### 长期目标 (v1.0.x)
- [ ] AI 智能助手
- [ ] 云同步支持（可选）
- [ ] 团队协作功能
- [ ] Web 版本和移动端支持

## 开源理念

MoliTodo 是一个开源项目，我们相信：

- **透明性**: 所有代码和决策过程都是公开的
- **社区驱动**: 欢迎社区贡献和反馈
- **用户隐私**: 数据本地存储，保护用户隐私
- **持续改进**: 基于用户反馈不断优化产品

## 支持平台

- **macOS**: 10.15 (Catalina) 或更高版本
  - Intel 芯片 Mac
  - Apple Silicon (M1/M2/M3) Mac
- **Windows**: Windows 10 或更高版本
  - x64 架构

## 获取支持

- **文档**: 查看完整的[用户手册](./user-guide.md)和[开发文档](./development/guide.md)
- **问题反馈**: 在 [GitHub Issues](https://github.com/your-username/moli-todo/issues) 提交问题
- **功能建议**: 在 [GitHub Discussions](https://github.com/your-username/moli-todo/discussions) 参与讨论
- **邮件联系**: support@molitodo.com

---

*让任务管理变得简单而高效，这就是 MoliTodo 的使命。*