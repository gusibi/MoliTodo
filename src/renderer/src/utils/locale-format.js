/**
 * 渲染层 locale 工具：将 vue-i18n 的 locale 值映射为 Intl 使用的 BCP-47 语言标记。
 * 供日期/时间格式化统一使用，避免各组件重复三目判断。
 */
export function localeCode(localeValue) {
  return localeValue === 'en' ? 'en-US' : 'zh-CN'
}
