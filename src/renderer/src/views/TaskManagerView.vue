<template>
  <div class="w-full min-h-screen flex flex-col bg-white dark:bg-gray-800">
    <CustomTitleBar 
      title="MoliTodo - 任务管理" 
      window-type="taskManager"
      :show-maximize="true"
    />
    <div class="flex-1 flex min-h-0">
      <TaskManager />
    </div>
  </div>
</template>

<script setup>
import CustomTitleBar from '@/components/CustomTitleBar.vue'
import TaskManager from '@/components/TaskManager.vue'
</script>

<style scoped>
/* 使用 Tailwind CSS，不再需要自定义样式 */
</style>