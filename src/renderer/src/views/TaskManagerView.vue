<template>
  <div class="w-full min-h-screen relative bg-transparent">
    <!-- 绝对定位的透明标题栏，覆盖在 TaskManager 上方 -->
    <CustomTitleBar 
      title="MoliTodo - 任务管理" 
      window-type="taskManager"
      :show-maximize="true"
      class="absolute top-0 left-0 right-0 z-50 "
    />
    
    <!-- TaskManager 占据全屏，标题栏透明覆盖在上方 -->
    <div class="w-full h-screen">
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