/**
 * 行上日期标签共享工具（悬浮窗任务面板与 Today 行共用）
 *
 * 日期词（今天/明天/星期X/M月D日）与非零点时刻的拼装规则以悬浮窗定稿为准；
 * 调用方传入自身的 i18n t 函数与 locale，避免组件内重复实现。
 */

export function formatTimeHM(date) {
  return ` ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function dayLabel(date, t, locale) {
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  if (dayKey(date) === dayKey(now)) return t('categories.today')
  if (dayKey(date) === dayKey(tomorrow)) return t('floatView.chipTomorrow')

  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()) -
      new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000
  )
  const intlLocale = locale || 'zh-CN'
  if (diffDays >= 2 && diffDays <= 6) {
    return new Intl.DateTimeFormat(intlLocale, { weekday: 'long' }).format(date)
  }
  return new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric' }).format(date)
}
