<template>
  <span class="task-status-circle" :class="`status-${status}`" aria-hidden="true">
    <svg v-if="status === 'done'" width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round"
        stroke-linejoin="round" />
    </svg>
    <Pause v-else-if="status === 'paused'" class="h-2 w-2" aria-hidden="true" />
  </span>
</template>

<script setup>
import { Pause } from '@lucide/vue'

/**
 * 任务状态圆圈（悬浮窗与 Today 行共用的纯展示组件）。
 * 只表达当前状态，不可点击；动作一律由行上的 hover 动作按钮承担。
 */
defineProps({
  status: {
    type: String,
    default: 'todo'
  }
})
</script>

<style scoped>
.task-status-circle {
  @apply w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center;
}

.task-status-circle.status-todo {
  @apply border-muted-foreground/40;
}

/* doing：空心圆 + 中心小圆点脉冲（进行中状态，非播放按钮） */
.task-status-circle.status-doing {
  @apply border-status-doing;
}

.task-status-circle.status-doing::after {
  content: '';
  @apply w-1.5 h-1.5 rounded-full bg-status-doing animate-pulse;
}

.task-status-circle.status-done {
  @apply bg-status-done border-status-done text-white;
}

.task-status-circle.status-paused {
  @apply border-status-paused text-status-paused;
}

@media (prefers-reduced-motion: reduce) {
  .task-status-circle.status-doing::after {
    animation: none;
  }
}
</style>
