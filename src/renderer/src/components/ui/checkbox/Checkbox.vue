<template>
  <label class="ui-checkbox-control">
    <input
      :id="id"
      type="checkbox"
      class="ui-checkbox-input"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="label"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span :class="indicatorClass" aria-hidden="true"><slot /></span>
  </label>
</template>

<script setup>
defineProps({
  id: { type: String, required: true },
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  indicatorClass: { type: String, default: 'ui-checkbox-indicator' },
  disabled: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<style>
.ui-checkbox-control {
  @apply inline-flex shrink-0 items-center justify-center cursor-pointer;
}

.ui-checkbox-input {
  @apply absolute h-0 w-0 opacity-0;
}

.ui-checkbox-input:focus-visible + span {
  @apply ring-2 ring-ring ring-offset-1 ring-offset-background;
}

.ui-checkbox-input:disabled + span {
  @apply cursor-not-allowed opacity-50;
}

.ui-checkbox-indicator {
  @apply block h-4 w-4 rounded border border-input bg-background transition-colors;
}

.ui-checkbox-input:checked + .ui-checkbox-indicator {
  @apply border-primary bg-primary;
}

.ui-checkbox-input:checked + .ui-checkbox-indicator::after {
  content: '✓';
  @apply flex h-full items-center justify-center text-[10px] font-bold text-primary-foreground;
}

@media (prefers-reduced-motion: reduce) {
  .ui-checkbox-indicator {
    @apply transition-none;
  }
}
</style>
