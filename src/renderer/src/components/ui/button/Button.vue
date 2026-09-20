<template>
  <button
    ref="buttonEl"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <LoaderCircle
      v-if="loading"
      class="h-icon-sm w-icon-sm shrink-0 animate-spin"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>

<script setup>
import { LoaderCircle } from '@lucide/vue'
import { ref } from 'vue'
import { cn } from '../utils'
import { buttonVariants } from './button-variants'

const buttonEl = ref(null)

// 允许调用方（如弹窗、菜单）在关闭后把焦点还给按钮
defineExpose({
  focus: (options) => buttonEl.value?.focus(options),
  el: buttonEl
})

const props = defineProps({
  variant: {
    type: String,
    default: 'default'
  },
  size: {
    type: String,
    default: 'default'
  },
  type: {
    type: String,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  class: {
    type: [String, Array, Object],
    default: ''
  }
})
</script>
