<template>
  <Popover v-model:open="open" align="start">
    <template #trigger>
      <Button
        variant="outline"
        :disabled="disabled"
        :class="cn('justify-start gap-2 font-normal', props.class)"
      >
        <CalendarDays class="h-icon-sm w-icon-sm shrink-0" aria-hidden="true" />
        <span :class="{ 'text-muted-foreground': !display }">
          {{ display || placeholder || $t('tasks.pickDate') }}
        </span>
      </Button>
    </template>
    <Calendar :model-value="modelValue" @update:model-value="handleSelect" />
  </Popover>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarDays } from '@lucide/vue'
import Button from '../button/Button.vue'
import Popover from '../popover/Popover.vue'
import Calendar from '../calendar/Calendar.vue'
import { cn } from '../utils'
import { localeCode } from '@/utils/locale-format.js'

/**
 * 日期选择器：Popover + Calendar 组合，值为本地日期字符串（YYYY-MM-DD）。
 */
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  class: {
    type: [String, Array, Object],
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const { locale } = useI18n()
const open = ref(false)

const display = computed(() => {
  if (!props.modelValue) return ''
  const date = new Date(`${props.modelValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(localeCode(locale.value), {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
})

function handleSelect(value) {
  emit('update:modelValue', value)
  open.value = false
}
</script>
