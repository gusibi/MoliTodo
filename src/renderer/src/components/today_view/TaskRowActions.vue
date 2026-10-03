<template>
  <div class="today-task-actions">
    <IconButton
      v-if="status === 'todo' || status === 'paused'"
      size="icon-sm"
      class="today-task-action-btn"
      :label="status === 'paused' ? $t('tasks.resume') : $t('tasks.start')"
      @click.stop="$emit('start')"
    >
      <Play class="h-icon-sm w-icon-sm" />
    </IconButton>
    <IconButton
      v-if="status === 'doing'"
      size="icon-sm"
      class="today-task-action-btn"
      :label="$t('tasks.pause')"
      @click.stop="$emit('pause')"
    >
      <Pause class="h-icon-sm w-icon-sm" />
    </IconButton>
    <IconButton
      v-if="status !== 'done'"
      size="icon-sm"
      class="today-task-action-btn"
      :label="$t('floatView.completeTask')"
      @click.stop="$emit('complete')"
    >
      <CircleCheck class="h-icon-sm w-icon-sm" />
    </IconButton>
    <IconButton
      v-if="status === 'done'"
      size="icon-sm"
      class="today-task-action-btn"
      :label="$t('tasks.restart')"
      @click.stop="$emit('redo')"
    >
      <RotateCcw class="h-icon-sm w-icon-sm" />
    </IconButton>
  </div>
</template>

<script setup>
import { CircleCheck, Pause, Play, RotateCcw } from '@lucide/vue'
import IconButton from '../ui/button/IconButton.vue'

/**
 * Today 任务行的状态动作区（图标即动作）。
 * 收起态渲染在主行右侧，展开态渲染在编辑器标题行右侧，保证标题始终位于同一行。
 */
defineProps({
  status: {
    type: String,
    default: 'todo'
  }
})

defineEmits(['start', 'pause', 'complete', 'redo'])
</script>
