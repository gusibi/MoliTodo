<template>
  <div class="task-manager-view">
    <CustomTitleBar 
      title="MoliTodo - 任务管理" 
      window-type="taskManager"
      :show-maximize="true"
    />
    <div class="task-manager-content">
      <TaskManager />
    </div>
  </div>
</template>

<script setup>
import CustomTitleBar from '@/components/CustomTitleBar.vue'
import TaskManager from '@/components/TaskManager.vue'
</script>

<style scoped>
.task-manager-view {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

[data-theme="dark"] .task-manager-view {
  background: #1f2937;
}

.task-manager-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}
</style>