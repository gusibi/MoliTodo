<template>
  <div class="task-manager-view-container">
    <!-- 绝对定位的透明标题栏，覆盖在 TaskManager 上方 -->
    <CustomTitleBar 
      title="MoliTodo - 任务管理" 
      window-type="taskManager"
      :show-maximize="true"
      class="absolute top-0 left-0 right-0 z-50 "
    />
    
    <!-- TaskManager 占据全屏，标题栏透明覆盖在上方 -->
    <div class="task-manager-view-content">
      <TaskManager />
    </div>
  </div>
</template>

<script setup>
import CustomTitleBar from '@/components/CustomTitleBar.vue'
import TaskManager from '@/components/TaskManager.vue'
</script>

<style scoped>
@import '@/assets/styles/views/task-manager-view.css';
</style>