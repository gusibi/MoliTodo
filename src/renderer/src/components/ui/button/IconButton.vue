<template>
  <Button
    ref="buttonRef"
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :loading="loading"
    :aria-label="label"
    :title="label"
    :class="props.class"
  >
    <slot />
  </Button>
</template>

<script setup>
import { ref } from 'vue'
import Button from './Button.vue'

/**
 * 图标按钮：复用 Button 的尺寸、禁用与焦点规则，强制提供可访问名称。
 * 必须传入 label，避免出现无可访问名称的纯图标控件。
 */
const props = defineProps({
  label: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: 'ghost'
  },
  size: {
    type: String,
    default: 'icon'
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

const buttonRef = ref(null)

// 透传焦点控制，便于关闭弹层后恢复焦点
defineExpose({
  focus: (options) => buttonRef.value?.focus(options),
  el: buttonRef
})
</script>
