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
  /* 移除高度限制，让内容自由扩展 */
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

[data-theme="dark"] .task-manager-view {
  background: #1f2937;
}

.task-manager-content {
  flex: 1;
  display: flex;
  min-height: 0; /* 允许flex子元素收缩 */
  /* 移除固定高度限制 */
}
</style>