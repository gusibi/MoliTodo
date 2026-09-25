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
    <span :class="['ui-checkbox-indicator', indicatorClass]" aria-hidden="true">
      <Check v-if="modelValue" class="ui-checkbox-mark" />
    </span>
  </label>
</template>

<script setup>
import { Check } from '@lucide/vue'

defineProps({
  id: { type: String, required: true },
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  indicatorClass: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<style>
.ui-checkbox-control {
  @apply relative inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center cursor-pointer;
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
  @apply relative flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input bg-background transition-colors;
}

.ui-checkbox-indicator-flat {
  @apply rounded-full border-2 border-border/40 border-primary/30;
}

.ui-checkbox-control:hover .ui-checkbox-indicator-flat {
  @apply border-primary;
}

.ui-checkbox-mark {
  @apply h-3 w-3 text-primary-foreground;
}

.ui-checkbox-input:checked + .ui-checkbox-indicator {
  @apply border-primary bg-primary;
}

@media (prefers-reduced-motion: reduce) {
  .ui-checkbox-indicator {
    @apply transition-none;
  }
}
</style>
