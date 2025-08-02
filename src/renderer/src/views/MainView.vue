<template>
  <div class="main-view">
    <FloatingIcon />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import FloatingIcon from '@/components/FloatingIcon.vue'

// 只在悬浮图标页面设置body的pointer-events
onMounted(() => {
  document.body.style.pointerEvents = 'none'
})

onUnmounted(() => {
  document.body.style.pointerEvents = 'auto'
})
</script>

<style scoped>
.main-view {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  background-color: transparent !important;
  overflow: hidden !important;
  position: fixed;
  top: 0;
  left: 0;
}

.main-view::-webkit-scrollbar {
  display: none !important;
}

.main-view {
  -ms-overflow-style: none !important;
  scrollbar-width: none !important;
}
</style>