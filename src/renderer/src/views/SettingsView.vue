<template>
  <div class="settings-view">
    <CustomTitleBar 
      title="MoliTodo - 设置" 
      window-type="settings"
      :show-maximize="false"
    />
    <div class="settings-content">
      <Settings />
    </div>
  </div>
</template>

<script setup>
import CustomTitleBar from '@/components/CustomTitleBar.vue'
import Settings from '@/components/Settings.vue'
</script>

<style scoped>
.settings-view {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.settings-content {
  flex: 1;
  overflow: hidden;
}
</style>