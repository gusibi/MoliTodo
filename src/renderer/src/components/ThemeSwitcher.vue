<template>
  <div class="theme-switcher">
    <button
      v-for="theme in availableThemes"
      :key="theme.value"
      :class="['theme-option', { active: currentTheme === theme.value }]"
      @click="setTheme(theme.value)"
      :title="theme.description"
    >
      <component :is="theme.icon" />
      {{ theme.label }}
    </button>
  </div>
</template>

<script setup>
import { computed, h } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { currentTheme, setTheme, themes } = useTheme()

// Theme configuration with icons
const availableThemes = computed(() => [
  {
    value: themes.light,
    label: '浅色',
    description: '浅色主题',
    icon: () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('circle', { cx: 12, cy: 12, r: 5, stroke: 'currentColor', 'stroke-width': 2 }),
      h('path', { d: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42', stroke: 'currentColor', 'stroke-width': 2 })
    ])
  },
  {
    value: themes.dark,
    label: '深色',
    description: '深色主题',
    icon: () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z', stroke: 'currentColor', 'stroke-width': 2 })
    ])
  }
])
</script>

<style scoped>
/* Styles are handled by the global CSS */
</style>