<template>
  <SwitchRoot
    :id="id"
    :model-value="modelValue"
    :disabled="disabled"
    :aria-label="label || undefined"
    :class="cn(
      'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'outline-none transition-colors duration-150',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      modelValue ? 'bg-primary' : 'bg-muted-foreground/40',
      props.class
    )"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SwitchThumb
      :class="cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform duration-150',
        modelValue ? 'translate-x-4' : 'translate-x-0'
      )"
    />
  </SwitchRoot>
</template>

<script setup>
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { cn } from '../utils'

/**
 * 设置开关：基于 Reka UI Switch 原语，用于「立即生效的配置项」。
 * 完成任务保持任务语义（复选框），不要用本组件表达完成状态。
 */
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: undefined
  },
  disabled: {
    type: Boolean,
    default: false
  },
  // 无可见标签时提供可访问名称
  label: {
    type: String,
    default: ''
  },
  class: {
    type: [String, Array, Object],
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])
</script>
