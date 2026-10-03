<template>
  <ContextMenuRoot @update:open="$emit('update:open', $event)">
    <ContextMenuTrigger as-child :disabled="props.disabled" @keydown="handleTriggerKeydown">
      <slot name="trigger" />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="ui-context-menu-content z-[120] min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none"
        @escape-key-down="$emit('escape-key-down', $event)"
      >
        <slot />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup>
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

const props = defineProps({
  disabled: { type: Boolean, default: false }
})

defineEmits(['escape-key-down', 'update:open'])

function handleTriggerKeydown(event) {
  if (props.disabled || !((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return
  event.preventDefault()

  const trigger = event.currentTarget
  const target = event.target instanceof Element ? event.target : trigger
  const bounds = target.getBoundingClientRect()
  trigger.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + Math.min(24, bounds.width / 2),
    clientY: bounds.top + Math.min(16, bounds.height / 2)
  }))
}
</script>
