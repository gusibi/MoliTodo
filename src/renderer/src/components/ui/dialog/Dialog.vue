<template>
  <DialogRoot :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogPortal>
      <DialogOverlay class="ui-overlay fixed inset-0 z-[100] bg-black/50" />
      <DialogContent
        class="ui-dialog-content fixed left-1/2 top-1/2 z-[100] flex max-h-[88vh] w-[min(94vw,44rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-lg outline-none"
      >
        <div class="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div class="min-w-0">
            <DialogTitle class="text-base font-semibold text-card-foreground">
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-muted-foreground">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <IconButton size="icon-sm" :label="$t('common.close')">
              <X class="h-icon-md w-icon-md" />
            </IconButton>
          </DialogClose>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import { X } from '@lucide/vue'
import IconButton from '../button/IconButton.vue'

/**
 * 普通编辑弹窗（非危险确认）：基于 Reka Dialog 原语。
 * 危险操作使用 AlertDialog，不要复用本组件。
 */
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:open'])
</script>
