<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
// 根组件，主要用于路由视图容器
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: transparent;
  user-select: none;
  overflow: hidden !important; /* 强制防止滚动条 */
  width: 100%;
  height: 100%;
  position: fixed; /* 固定定位防止滚动 */
  top: 0;
  left: 0;
}

/* 确保所有可能的滚动容器都被禁用 */
html::-webkit-scrollbar,
body::-webkit-scrollbar {
  display: none !important;
}

html {
  -ms-overflow-style: none !important;
  scrollbar-width: none !important;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden !important; /* 强制防止滚动条 */
  position: fixed; /* 固定定位 */
  top: 0;
  left: 0;
}

/* 隐藏所有可能的滚动条 */
#app::-webkit-scrollbar {
  display: none !important;
}

#app {
  -ms-overflow-style: none !important;
  scrollbar-width: none !important;
}
</style>