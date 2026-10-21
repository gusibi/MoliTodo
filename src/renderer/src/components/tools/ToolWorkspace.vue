<template>
  <div class="task-manager-main-content">
    <header class="task-manager-category-header">
      <div class="task-manager-category-title">
        <HeartPulse v-if="tool === 'health'" class="h-5 w-5 text-primary" aria-hidden="true" />
        <Sprout v-else class="h-5 w-5 text-primary" aria-hidden="true" />
        <h1 class="task-manager-category-name">{{ title }}</h1>
      </div>
      <span v-if="tool === 'garden' && pendingRewards > 0" class="text-sm font-medium text-muted-foreground">
        {{ $t('tools.pendingRewards') }} {{ pendingRewards }}
      </span>
    </header>

    <div class="min-h-0 flex-1">
      <HealthReminderView v-if="tool === 'health'" />
      <GardenView v-else-if="tool === 'garden'" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HeartPulse, Sprout } from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import HealthReminderView from './HealthReminderView.vue'
import GardenView from './GardenView.vue'

const props = defineProps({
  tool: {
    type: String,
    required: true
  }
})

const { t } = useI18n()
const toolsStore = useToolsStore()
const title = computed(() => (
  props.tool === 'health' ? t('tools.health') : t('tools.garden')
))
const pendingRewards = computed(() => toolsStore.pendingRewards)

function handleToolsUpdated() {
  toolsStore.loadShellSnapshot()
}

onMounted(() => {
  toolsStore.loadShellSnapshot()
  window.electronAPI?.events?.on('tools-updated', handleToolsUpdated)
})

onUnmounted(() => {
  window.electronAPI?.events?.off('tools-updated', handleToolsUpdated)
})
</script>
