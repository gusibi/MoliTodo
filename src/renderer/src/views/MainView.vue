<template>
  <div class="main-view">
    <FloatingIcon />
  </div>
</template>

<script setup>
import FloatingIcon from '@/components/FloatingIcon.vue'
</script>

<style scoped>
.main-view {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  overflow: hidden !important; /* 强制防止滚动条 */
  position: fixed; /* 固定定位 */
  top: 0;
  left: 0;
}

/* 隐藏主视图的滚动条 */
.main-view::-webkit-scrollbar {
  display: none !important;
}

.main-view {
  -ms-overflow-style: none !important;
  scrollbar-width: none !important;
}
</style>