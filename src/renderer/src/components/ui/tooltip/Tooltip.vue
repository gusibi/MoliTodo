<template>
  <TooltipProvider :delay-duration="delayDuration">
    <TooltipRoot :open="open" @update:open="(value) => emit('update:open', value)">
      <TooltipTrigger as-child>
        <slot name="trigger" />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent :side="side" :side-offset="6" :class="cn(
          'ui-tooltip-content z-[120] rounded-md bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md outline-none',
          contentClass
        )">
          <slot />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup>
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { cn } from '../utils'

/**
 * 非交互说明悬浮提示：悬浮/聚焦后显示的短文案，不承载点击交互。
 * 交互入口请使用 Popover；业务组件只传文案与触发元素。
 */
defineProps({
  open: {
    type: Boolean,
    default: undefined
  },
  side: {
    type: String,
    default: 'top'
  },
  delayDuration: {
    type: Number,
    default: 300
  },
  contentClass: {
    type: [String, Array, Object],
    default: ''
  }
})

const emit = defineEmits(['update:open'])
</script>
