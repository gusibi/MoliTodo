<template>
  <div class="task-panel-view">
    <TaskPanel />
  </div>
</template>

<script setup>
import TaskPanel from '@/components/TaskPanel.vue'
</script>

<style scoped>
.task-panel-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}
</style>