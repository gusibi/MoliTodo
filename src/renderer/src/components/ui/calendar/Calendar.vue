<template>
  <CalendarRoot
    v-slot="{ weekDays, grid }"
    :model-value="dateValue"
    :weekday-format="'short'"
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
            class="w-8 text-center text-2xs font-normal text-muted-foreground"
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
          <CalendarCell v-for="date in weekDates" :key="date.toString()" :date="date">
            <CalendarCellTrigger
              :day="date.day"
              :month="date"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 data-[outside-view]:text-muted-foreground/40 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:font-semibold data-[today]:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[unavailable]:pointer-events-none data-[unavailable]:opacity-40"
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

/**
 * 日历基础组件：基于 Reka UI Calendar 原语。
 * 对外使用本地日期字符串（YYYY-MM-DD），不暴露库内部 DateValue。
 */
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
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
