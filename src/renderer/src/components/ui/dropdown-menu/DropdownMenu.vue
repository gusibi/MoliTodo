<template>
  <DropdownMenuRoot :open="open" :modal="false" @update:open="$emit('update:open', $event)">
    <DropdownMenuTrigger as-child><slot name="trigger" /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent :align="align" :side-offset="6"
        :class="cn('ui-dropdown-menu-content z-[120] min-w-40 max-h-[var(--reka-dropdown-menu-content-available-height)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none', contentClass)">
        <DropdownMenuGroup><slot /></DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup>
import { DropdownMenuContent, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { cn } from '../utils'

defineProps({
  open: { type: Boolean, default: undefined },
  align: { type: String, default: 'start' },
  contentClass: { type: [String, Array, Object], default: '' }
})
defineEmits(['update:open'])
</script>
