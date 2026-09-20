<template>
  <div class="future-calendar" role="group" :aria-label="$t('today.calendar.title')">
    <div class="future-calendar-toolbar">
      <button class="future-calendar-back-btn" type="button" @click="$emit('expand-months', -1)"
        :title="$t('today.calendar.earlierMonths')">
        <i class="fas fa-chevron-up"></i>
        <span>{{ $t('today.calendar.earlierMonths') }}</span>
      </button>
      <button class="future-calendar-back-btn today" type="button" @click="$emit('back-today')"
        :title="$t('today.calendar.backToday')">
        <i class="fas fa-calendar-day"></i>
        <span>{{ $t('today.calendar.backToday') }}</span>
      </button>
      <button class="future-calendar-back-btn" type="button" @click="$emit('expand-months', 1)"
        :title="$t('today.calendar.laterMonths')">
        <span>{{ $t('today.calendar.laterMonths') }}</span>
        <i class="fas fa-chevron-down"></i>
      </button>
    </div>

    <div class="future-calendar-months" ref="monthsContainer">
      <section v-for="month in months" :key="month.key" class="future-calendar-month"
        :aria-label="month.label">
        <h4 class="future-calendar-month-title">{{ month.label }}</h4>
        <div class="future-calendar-grid" role="row">
          <div v-for="weekday in weekdayLabels" :key="weekday" class="future-calendar-weekday"
            role="columnheader">{{ weekday }}</div>
        </div>
        <div class="future-calendar-grid future-calendar-days">
          <div v-for="(cell, index) in month.cells" :key="`${month.key}-${index}`" class="future-calendar-cell"
            role="gridcell">
            <button v-if="cell.key" type="button" class="future-calendar-day"
              :class="{
                'is-today': cell.key === todayKey,
                'is-selected': cell.key === selectedKey,
                'is-past': cell.key < todayKey,
                'is-other-month': cell.otherMonth
              }" :data-date-key="cell.key" :aria-label="dayAriaLabel(cell)" :aria-current="cell.key === selectedKey ? 'date' : null"
              @click="$emit('select-date', cell.key)">
              <span class="future-calendar-day-num">{{ cell.day }}</span>
              <span v-if="cell.dots && cell.dots.length" class="future-calendar-dots"
                :aria-hidden="true">
                <span v-for="(dot, dotIndex) in cell.dots" :key="dotIndex" class="future-calendar-dot"
                  :class="{ 'is-completed': dot.completed }" :style="{ backgroundColor: dot.color }"></span>
                <span v-if="cell.moreCount > 0" class="future-calendar-more">+{{ cell.moreCount }}</span>
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'

/**
 * Future Calendar：当前月起连续月份窗口的任务分布。
 * 每格最多 3 个清单颜色点，更多显示 +N；今天 / 选中 / 键盘焦点为不同状态。
 */
const props = defineProps({
  monthWindow: { type: Object, required: true },
  dots: { type: Object, default: () => new Map() },
  todayKey: { type: String, required: true },
  selectedKey: { type: String, default: '' }
})

defineEmits(['select-date', 'expand-months', 'back-today'])

const { t, locale } = useI18n()
const taskStore = useTaskStore()

const MAX_DOTS = 3

const weekdayLabels = computed(() => {
  const base = new Date(2026, 8, 7) // 2026-09-07 是周一
  const labels = []
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(base)
    date.setDate(base.getDate() + i)
    labels.push(date.toLocaleDateString(locale.value === 'en' ? 'en-US' : 'zh-CN', { weekday: 'narrow' }))
  }
  return labels
})

function pad2(value) {
  return String(value).padStart(2, '0')
}

function keyOf(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function listColor(listId) {
  const list = taskStore.getListById(listId)
  return list && list.color ? list.color : 'var(--primary)'
}

const months = computed(() => {
  const start = new Date(`${props.monthWindow.startKey}T00:00:00`)
  const end = new Date(`${props.monthWindow.endKey}T00:00:00`)
  const result = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const monthKey = `${year}-${pad2(month + 1)}`
    const label = cursor.toLocaleDateString(locale.value === 'en' ? 'en-US' : 'zh-CN', {
      year: 'numeric',
      month: 'long'
    })

    // 周一开头的网格：补足前置空格
    const firstDay = new Date(year, month, 1)
    const leading = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < leading; i += 1) cells.push({ key: null })

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${monthKey}-${pad2(day)}`
      const dot = props.dots instanceof Map ? props.dots.get(key) : props.dots?.[key]
      let dots = []
      let moreCount = 0
      if (dot) {
        const entries = [...dot.byList.entries()]
          .map(([listId, count]) => ({ listId, count, color: listColor(listId) }))
          .sort((a, b) => b.count - a.count || String(a.listId).localeCompare(String(b.listId)))
        const visible = entries.slice(0, MAX_DOTS)
        const visibleCount = visible.reduce((sum, item) => sum + item.count, 0)
        // 某清单当天全部为已完成时，其日期点使用弱化状态
        const completedByList = dot.completedByList || new Map()
        dots = visible.map((item) => ({
          color: item.color,
          completed: (completedByList.get(item.listId) || 0) === item.count
        }))
        moreCount = dot.count - visibleCount
      }
      cells.push({ key, day, dots, moreCount, count: dot ? dot.count : 0 })
    }
    result.push({ key: monthKey, label, cells })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return result
})

function dayAriaLabel(cell) {
  const date = new Date(`${cell.key}T00:00:00`)
  const dateText = date.toLocaleDateString(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
  if (!cell.count) return dateText
  return t('today.calendar.dayTaskCount', { date: dateText, count: cell.count })
}
</script>
