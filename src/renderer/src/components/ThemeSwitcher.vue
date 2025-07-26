<template>
  <div class="theme-switcher-container">
    <button
      v-for="theme in availableThemes"
      :key="theme.value"
      :class="['theme-switcher-option', { 'theme-switcher-active': currentTheme === theme.value }]"
      @click="setTheme(theme.value)"
      :title="theme.description"
    >
      <component :is="theme.icon" class="theme-switcher-icon" />
      <span class="theme-switcher-label">{{ theme.label }}</span>
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
    value: themes.system,
    label: '跟随系统',
    description: '跟随系统主题设置',
    icon: () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: 2, y: 3, width: 20, height: 14, rx: 2, ry: 2, stroke: 'currentColor', 'stroke-width': 2 }),
      h('line', { x1: 8, y1: 21, x2: 16, y2: 21, stroke: 'currentColor', 'stroke-width': 2 }),
      h('line', { x1: 12, y1: 17, x2: 12, y2: 21, stroke: 'currentColor', 'stroke-width': 2 })
    ])
  },
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
@import '../assets/styles/theme-switcher.css';
</style>