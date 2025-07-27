<template>
  <div class="settings-view-container">
    <CustomTitleBar 
      title="MoliTodo - 设置" 
      window-type="settings"
      :show-maximize="false"
      class="absolute top-0 left-0 right-0 z-50 "
    />
    <div class="settings-view-content">
      <Settings />
    </div>
  </div>
</template>

<script setup>
import CustomTitleBar from '@/components/CustomTitleBar.vue'
import Settings from '@/components/Settings.vue'
import '@/assets/styles/settings.css'
</script>

<style scoped>
@import '../assets/styles/settings.css';

.settings-view-container {
  @apply w-full h-full flex flex-col bg-transparent;
}

.settings-view-content {
  @apply flex-1 flex overflow-hidden;
}
</style>