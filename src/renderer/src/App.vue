<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { useTheme } from './composables/useTheme'

// Initialize theme system
const { initializeTheme } = useTheme()
initializeTheme()
</script>