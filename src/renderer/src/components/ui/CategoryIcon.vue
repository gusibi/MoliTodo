<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="strokeWidth"
    :class="props.class"
    aria-hidden="true"
  />
</template>

<script setup>
import { computed } from 'vue'
import {
  CalendarCheck,
  CalendarRange,
  CircleCheck,
  CirclePause,
  CirclePlay,
  Folder,
  Inbox,
  List
} from '@lucide/vue'

/**
 * 智能分类图标：Sidebar 导航与页面标题共用同一映射，
 * 保证同一分类在不同位置图标一致。
 */
const CATEGORY_ICONS = {
  today: CalendarCheck,
  planned: CalendarRange,
  doing: CirclePlay,
  paused: CirclePause,
  all: List,
  inbox: Inbox,
  completed: CircleCheck
}

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
  class: {
    type: [String, Array, Object],
    default: ''
  }
})

const icon = computed(() => CATEGORY_ICONS[props.name] || Folder)
</script>
