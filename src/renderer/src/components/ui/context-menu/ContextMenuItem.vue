<template>
  <ContextMenuItemPrimitive
    :disabled="disabled"
    :class="cn(
      'ui-context-menu-item relative flex min-h-8 w-full select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      props.variant === 'destructive' && 'text-destructive data-[highlighted]:bg-destructive/10',
      props.class
    )"
    @select="$emit('select', $event)"
  >
    <slot />
  </ContextMenuItemPrimitive>
</template>

<script setup>
import { ContextMenuItem as ContextMenuItemPrimitive } from 'reka-ui'
import { cn } from '../utils'

const props = defineProps({
  variant: { type: String, default: 'default' },
  disabled: { type: Boolean, default: false },
  class: { type: [String, Array, Object], default: '' }
})

defineEmits(['select'])
</script>
