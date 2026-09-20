<template>
  <AlertDialogRoot :open="open" @update:open="handleOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay class="ui-overlay fixed inset-0 z-[100] bg-black/50" />
      <AlertDialogContent
        class="ui-dialog-content fixed left-1/2 top-1/2 z-[100] w-[min(90vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-lg outline-none"
        @escape-key-down="handleEscape"
        @pointer-down-outside.prevent
        @focus-outside.prevent
        @open-auto-focus="handleOpenAutoFocus"
      >
        <AlertDialogTitle class="text-base font-semibold text-card-foreground">
          {{ title }}
        </AlertDialogTitle>

        <AlertDialogDescription
          v-if="description || $slots.description"
          class="mt-2 text-sm leading-relaxed text-muted-foreground"
        >
          <slot name="description">{{ description }}</slot>
        </AlertDialogDescription>

        <div v-if="$slots.default" class="mt-4">
          <slot />
        </div>

        <p v-if="error" class="mt-3 text-sm text-destructive" role="alert">
          {{ error }}
        </p>

        <div class="mt-5 flex justify-end gap-2">
          <Button
            ref="cancelRef"
            variant="secondary"
            :disabled="loading"
            @click="handleCancel"
          >
            {{ cancelLabel || $t('common.cancel') }}
          </Button>
          <Button
            :variant="confirmVariant"
            :loading="loading"
            @click="handleConfirm"
          >
            {{ confirmLabel || $t('common.confirm') }}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle
} from 'reka-ui'
import Button from '../button/Button.vue'

/**
 * 危险操作确认对话框：基于 Reka UI AlertDialog 原语。
 *
 * 契约：
 * - 初始焦点在取消；遮罩点击不关闭、不确认；背景不可交互。
 * - 等待确认或失败时 Escape 取消；提交中禁用取消与 Escape，避免制造已撤销的错觉。
 * - confirm 只发出业务意图，由调用方在成功后关闭并恢复焦点。
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
  confirmLabel: {
    type: String,
    default: ''
  },
  cancelLabel: {
    type: String,
    default: ''
  },
  confirmVariant: {
    type: String,
    default: 'destructive'
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:open', 'confirm', 'cancel'])

const cancelRef = ref(null)

function focusCancel() {
  const el = cancelRef.value?.$el || cancelRef.value
  el?.focus?.()
}

function handleOpenAutoFocus(event) {
  event.preventDefault()
  nextTick(focusCancel)
}

function closeAndEmitCancel() {
  emit('update:open', false)
  emit('cancel')
}

function handleCancel() {
  if (props.loading) return
  closeAndEmitCancel()
}

function handleConfirm() {
  if (props.loading) return
  emit('confirm')
}

function handleEscape(event) {
  // 始终接管 Escape：提交中不关闭，其余情况按取消处理
  event.preventDefault()
  if (props.loading) return
  closeAndEmitCancel()
}

function handleOpenChange(value) {
  if (props.loading) return
  emit('update:open', value)
}

watch(
  () => props.open,
  (value) => {
    if (value) nextTick(focusCancel)
  }
)
</script>
