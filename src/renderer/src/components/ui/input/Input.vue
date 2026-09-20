<template>
  <input
    ref="inputEl"
    :id="id"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :class="cn(
      'flex h-control-lg w-full rounded-md border border-input bg-background px-3 text-sm text-foreground',
      'placeholder:text-muted-foreground outline-none transition-colors duration-150',
      'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
      'disabled:cursor-not-allowed disabled:opacity-50',
      props.class
    )"
    @input="emit('update:modelValue', $event.target.value)"
  />
</template>

<script setup>
import { ref } from 'vue'
import { cn } from '../utils'

const inputEl = ref(null)

defineExpose({
  focus: (options) => inputEl.value?.focus(options)
})

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  id: {
    type: String,
    default: undefined
  },
  type: {
    type: String,
    default: 'text'
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  },
  class: {
    type: [String, Array, Object],
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])
</script>
