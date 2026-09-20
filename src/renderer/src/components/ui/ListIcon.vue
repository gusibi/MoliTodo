<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="strokeWidth"
    :color="color"
    :class="props.class"
    aria-hidden="true"
  />
</template>

<script setup>
import { computed } from 'vue'
import { resolveListIcon } from './list-icons'

/**
 * 清单图标展示：把持久化的图标名称映射到明确打包的 Lucide 组件。
 * 未识别名称回退到默认清单图标，不崩溃、不改写原值。
 */
const props = defineProps({
  name: {
    type: String,
    default: ''
  },
  size: {
    type: [Number, String],
    default: 16
  },
  strokeWidth: {
    type: [Number, String],
    default: 1.75
  },
  color: {
    type: String,
    default: 'currentColor'
  },
  class: {
    type: [String, Array, Object],
    default: ''
  }
})

const icon = computed(() => resolveListIcon(props.name))
</script>
