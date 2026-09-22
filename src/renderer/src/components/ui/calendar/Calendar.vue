<template>
  <CalendarRoot
    v-slot="{ weekDays, grid }"
    :model-value="dateValue"
    :locale="locale"
    :calendar-label="calendarLabel"
    :weekday-format="'short'"
    :fixed-weeks="fixedWeeks"
    class="p-1"
    @update:model-value="handleUpdate"
  >
    <CalendarHeader class="mb-2 flex items-center justify-between gap-2">
      <CalendarPrev as-child>
        <IconButton size="icon-sm" :label="$t('calendar.previous')">
          <ChevronLeft class="h-icon-md w-icon-md" />
        </IconButton>
      </CalendarPrev>
      <CalendarHeading class="text-sm font-medium text-foreground" />
      <CalendarNext as-child>
        <IconButton size="icon-sm" :label="$t('calendar.next')">
          <ChevronRight class="h-icon-md w-icon-md" />
        </IconButton>
      </CalendarNext>
    </CalendarHeader>

    <CalendarGrid v-for="month in grid" :key="month.value.toString()" class="w-full border-collapse">
      <CalendarGridHead>
        <CalendarGridRow class="mb-1 flex">
          <CalendarHeadCell
            v-for="day in weekDays"
            :key="day"
            :class="stretch ? 'flex-1' : 'w-8'"
            class="text-center text-2xs font-normal text-muted-foreground"
          >
            {{ day }}
          </CalendarHeadCell>
        </CalendarGridRow>
      </CalendarGridHead>
      <CalendarGridBody>
        <CalendarGridRow
          v-for="(weekDates, weekIndex) in month.rows"
          :key="weekIndex"
          class="mt-1 flex w-full"
        >
          <CalendarCell v-for="date in weekDates" :key="date.toString()" :date="date" :class="stretch ? 'flex-1' : ''">
            <CalendarCellTrigger
              :day="date"
              :month="month.value"
              :class="cn('inline-flex h-8 items-center justify-center rounded-md text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 data-[outside-view]:text-muted-foreground/40 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:font-semibold data-[today]:text-primary data-[today]:data-[selected]:text-primary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[unavailable]:pointer-events-none data-[unavailable]:opacity-40', stretch ? 'w-full' : 'w-8')"
            />
          </CalendarCell>
        </CalendarGridRow>
      </CalendarGridBody>
    </CalendarGrid>
  </CalendarRoot>
</template>

<script setup>
import { computed } from 'vue'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot
} from 'reka-ui'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { parseDate } from '@internationalized/date'
import IconButton from '../button/IconButton.vue'
import { cn } from '../utils'

/**
 * 日历基础组件：基于 Reka UI Calendar 原语。
 * 对外使用本地日期字符串（YYYY-MM-DD），不暴露库内部 DateValue。
 */
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  // BCP-47 语言标记（如 zh-CN），控制月份标题与星期行的本地化；缺省用 Reka UI 默认 locale
  locale: {
    type: String,
    default: undefined
  },
  // 日历的可访问名称，缺省时 Reka UI 用英文默认值
  calendarLabel: {
    type: String,
    default: undefined
  },
  // 固定渲染 6 周，避免跨月切换时日历高度跳动（配合固定高度容器）
  fixedWeeks: {
    type: Boolean,
    default: false
  },
  // 日期格子拉伸填满可用宽度（默认固定 32px 宽，适合弹层内使用）
  stretch: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const dateValue = computed(() => {
  if (!props.modelValue) return undefined
  try {
    return parseDate(props.modelValue)
  } catch (error) {
    return undefined
  }
})

function handleUpdate(value) {
  emit('update:modelValue', value ? value.toString() : '')
}
</script>
