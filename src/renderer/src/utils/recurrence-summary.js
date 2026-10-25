/**
 * 生成重复规则的可读摘要。
 * Inspector 的重复设置与任务列表行共用，保证「每周（二）」等展示一致。
 */
export function formatRecurrenceSummary(rule, t, locale = 'zh') {
  const units = ['daily', 'weekly', 'monthly', 'yearly']
  if (!rule?.type || !units.includes(rule.type)) return t('today.recurrenceLabel')

  const interval = Math.max(1, Number(rule.interval) || 1)
  let summary = interval === 1
    ? t(`today.recurrenceEvery.${rule.type}`)
    : t('today.recurrenceInterval', {
        interval,
        unit: t(`today.recurrenceUnit.${rule.type}`)
      })

  const join = String(locale).startsWith('zh') ? '、' : ', '
  const weekdayName = (day) => t(`today.recurrenceWeekday.${day}`)
  const values = (value) => (Array.isArray(value) ? value : value == null ? [] : [value])
  const weekDescription = (week) => (Number(week) === -1
    ? t('today.recurrenceLastWeek')
    : t('today.recurrenceWeekNumber', { week }))

  if (rule.type === 'weekly' && rule.daysOfWeek?.length) {
    const days = [...rule.daysOfWeek].sort((a, b) => a - b).map(weekdayName).join(join)
    summary += t('today.recurrenceOnDays', { days })
  }

  if (rule.type === 'monthly') {
    const monthDays = values(rule.byMonthDay).filter(Boolean).sort((a, b) => a - b)
    if (monthDays.length) {
      summary += t('today.recurrenceOnMonthDays', { days: monthDays.join(join) })
    } else if (rule.byWeekDay?.weekday !== undefined) {
      summary += t('today.recurrenceOnWeekday', {
        week: weekDescription(rule.byWeekDay.week),
        weekday: weekdayName(rule.byWeekDay.weekday)
      })
    }
  }

  if (rule.type === 'yearly') {
    const months = values(rule.byMonth).filter(Boolean).sort((a, b) => a - b)
    if (months.length) {
      summary += t('today.recurrenceInMonths', {
        months: months.map((month) => t('today.recurrenceMonth', { month })).join(join)
      })
    }
    const monthDays = values(rule.byMonthDay).filter(Boolean).sort((a, b) => a - b)
    if (monthDays.length) {
      summary += t('today.recurrenceOnMonthDays', { days: monthDays.join(join) })
    } else if (rule.byWeekDay?.weekday !== undefined) {
      summary += t('today.recurrenceOnWeekday', {
        week: weekDescription(rule.byWeekDay.week),
        weekday: weekdayName(rule.byWeekDay.weekday)
      })
    }
  }

  if (rule.endCondition?.type === 'date' && rule.endCondition.endDate) {
    const endDate = new Date(`${String(rule.endCondition.endDate).slice(0, 10)}T12:00:00`)
    const date = Number.isNaN(endDate.getTime())
      ? rule.endCondition.endDate
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(endDate)
    summary += t('today.recurrenceUntilDate', { date })
  } else if ((rule.endCondition?.type === 'count' && rule.endCondition.count) || rule.count) {
    summary += t('today.recurrenceCount', { count: rule.endCondition?.count || rule.count })
  }

  return summary
}
