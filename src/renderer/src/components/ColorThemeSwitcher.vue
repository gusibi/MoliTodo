<template>
  <div class="color-theme-switcher">
    <div class="color-theme-switcher-header">
      <h3 class="color-theme-switcher-title">颜色主题</h3>
      <p class="color-theme-switcher-description">选择你喜欢的颜色主题</p>
    </div>
    
    <div class="color-theme-switcher-grid">
      <div
        v-for="theme in availableColorThemes"
        :key="theme.id"
        :class="[
          'color-theme-option',
          { 'color-theme-option-active': currentColorTheme === theme.id }
        ]"
        @click="handleThemeChange(theme.id)"
      >
        <div class="color-theme-preview">
          <div 
            class="color-theme-preview-color"
            :style="{ backgroundColor: theme.primaryColor }"
          ></div>
        </div>
        
        <div class="color-theme-info">
          <div class="color-theme-name">{{ theme.name }}</div>
          <div class="color-theme-desc">{{ theme.description }}</div>
        </div>
        
        <div v-if="currentColorTheme === theme.id" class="color-theme-check">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useTheme } from '@/composables/useTheme'

const { availableColorThemes, currentColorTheme, setColorTheme } = useTheme()

const handleThemeChange = async (themeId) => {
  await setColorTheme(themeId)
}
</script>

<style scoped>
.color-theme-switcher {
  @apply space-y-4;
}

.color-theme-switcher-header {
  @apply space-y-1;
}

.color-theme-switcher-title {
  @apply text-base font-semibold text-foreground;
}

.color-theme-switcher-description {
  @apply text-sm text-muted-foreground;
}

.color-theme-switcher-grid {
  @apply grid grid-cols-1 gap-3;
}

.color-theme-option {
  @apply flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer transition-all duration-200;
  @apply hover:border-primary/50 hover:bg-accent/50;
}

.color-theme-option-active {
  @apply border-primary bg-primary/5;
}

.color-theme-preview {
  @apply flex-shrink-0;
}

.color-theme-preview-color {
  @apply w-8 h-8 rounded-full border-2 border-white shadow-sm;
}

.color-theme-info {
  @apply flex-1 min-w-0;
}

.color-theme-name {
  @apply text-sm font-medium text-foreground;
}

.color-theme-desc {
  @apply text-xs text-muted-foreground mt-0.5;
}

.color-theme-check {
  @apply flex-shrink-0 text-primary;
}

/* 响应式调整 */
@media (min-width: 640px) {
  .color-theme-switcher-grid {
    @apply grid-cols-2;
  }
}
</style>