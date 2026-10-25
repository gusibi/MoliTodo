<template>
  <header class="tool-page-header tool-reveal">
    <div class="min-w-0 flex-1">
      <p class="tool-eyebrow">
        <span class="tool-eyebrow-mark" :class="toneTextClass" aria-hidden="true" />
        {{ eyebrow }}
      </p>
      <div class="mt-3 flex items-center gap-3">
        <component
          :is="icon"
          v-if="icon"
          class="h-5 w-5 shrink-0"
          :class="toneTextClass"
          aria-hidden="true"
        />
        <h1 class="tool-display">{{ title }}</h1>
      </div>
      <p v-if="description" class="tool-lede">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  tone: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'info', 'success', 'warning'].includes(value)
  }
})

const toneTextClass = computed(() => ({
  primary: 'text-primary',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning'
})[props.tone])
</script>
