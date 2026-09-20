<template>
  <div :class="cn('flex flex-col gap-1.5', props.class)">
    <label v-if="label" :for="htmlFor" class="text-sm font-medium text-foreground">
      {{ label }}
      <span v-if="required" class="text-destructive" aria-hidden="true">*</span>
    </label>
    <p v-if="description" class="text-xs leading-relaxed text-muted-foreground">
      {{ description }}
    </p>
    <slot />
    <p v-if="error" class="text-xs text-destructive" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<script setup>
import { cn } from '../utils'

/**
 * 表单字段包装：统一标签、帮助文字与错误信息的位置与语义。
 * 只负责呈现与关联（label[for] / role=alert），不持有值或校验逻辑。
 */
const props = defineProps({
  label: {
    type: String,
    default: ''
  },
  htmlFor: {
    type: String,
    default: undefined
  },
  description: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  required: {
    type: Boolean,
    default: false
  },
  class: {
    type: [String, Array, Object],
    default: ''
  }
})
</script>
