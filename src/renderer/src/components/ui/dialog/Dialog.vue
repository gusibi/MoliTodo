<template>
  <DialogRoot :open="open" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay class="ui-overlay fixed inset-0 z-[100] bg-black/50" />
      <DialogContent
        :class="cn(
          'ui-dialog-content fixed left-1/2 top-1/2 z-[100] flex max-h-[88vh] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-lg outline-none',
          contentClass
        )"
        @pointer-down-outside="onPointerDownOutside"
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
          <div class="flex flex-shrink-0 items-center gap-1">
            <slot name="header-actions" />
            <DialogClose as-child>
              <IconButton size="icon-sm" :label="$t('common.close')">
                <X class="h-icon-md w-icon-md" />
              </IconButton>
            </DialogClose>
          </div>
        </div>

        <div :class="cn('min-h-0 flex-1 overflow-y-auto px-5', bodyClass)">
          <slot />
        </div>

        <div v-if="$slots.footer" class="flex justify-end gap-2 px-5 pb-5 pt-3">
          <slot name="footer" />
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
import { cn } from '../utils'

/**
 * 普通编辑弹窗（非危险确认）：基于 Reka Dialog 原语。
 * 危险操作使用 AlertDialog，不要复用本组件。
 *
 * 契约：遮罩点击与 Escape 默认关闭（可分别关闭）；焦点约束在弹窗内，
 * 关闭后由 Reka 恢复到触发控件。
 */
const props = defineProps({
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
  },
  contentClass: {
    type: [String, Array, Object],
    default: 'w-[min(94vw,44rem)]'
  },
  bodyClass: {
    type: [String, Array, Object],
    default: 'pb-5'
  },
  closeOnOverlay: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:open'])

function handleOpenChange(value) {
  emit('update:open', value)
}

function onPointerDownOutside(event) {
  if (!props.closeOnOverlay) event.preventDefault()
}
</script>
