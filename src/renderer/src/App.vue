<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { useTheme } from './composables/useTheme'
import { useLanguage } from './composables/useLanguage'

// Initialize theme system
const { initializeTheme } = useTheme()
initializeTheme()

// Initialize language system
const { initializeLanguage } = useLanguage()
initializeLanguage()
</script>