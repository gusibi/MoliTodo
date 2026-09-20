<template>
  <PopoverRoot :open="open" @update:open="(value) => emit('update:open', value)">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :align="align"
        :side="side"
        :side-offset="6"
        :class="cn(
          'ui-popover-content z-[110] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none',
          contentClass
        )"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup>
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { cn } from '../utils'

/**
 * 交互式浮层容器：承载可点击内容（日期选择、菜单等）。
 * 非交互说明请使用 title 或 Tooltip，不要用 Popover。
 */
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  align: {
    type: String,
    default: 'start'
  },
  side: {
    type: String,
    default: 'bottom'
  },
  contentClass: {
    type: [String, Array, Object],
    default: ''
  }
})

const emit = defineEmits(['update:open'])
</script>
