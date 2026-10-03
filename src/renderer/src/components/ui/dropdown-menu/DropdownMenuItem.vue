<template>
  <DropdownMenuItemPrimitive :disabled="disabled"
    :class="cn('ui-dropdown-menu-item flex min-h-8 select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50', selected && 'bg-accent text-accent-foreground', variant === 'destructive' && 'text-destructive', props.class)"
    @select="$emit('select', $event)"><slot /></DropdownMenuItemPrimitive>
</template>
<script setup>
import { DropdownMenuItem as DropdownMenuItemPrimitive } from 'reka-ui'
import { cn } from '../utils'
const props = defineProps({
  disabled: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  variant: { type: String, default: 'default' },
  class: { type: [String, Array, Object], default: '' }
})
defineEmits(['select'])
</script>
