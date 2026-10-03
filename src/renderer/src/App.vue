<template>
  <div id="app">
    <router-view />
    <Dialog :open="!!taskStore.actionError" :title="$t('common.error')" :description="taskStore.actionError"
      content-class="w-[min(94vw,24rem)]" @update:open="(open) => { if (!open) taskStore.actionError = '' }">
      <template #footer><Button @click="taskStore.actionError = ''">{{ $t('common.close') }}</Button></template>
    </Dialog>
  </div>
</template>

<script setup>
import { useTaskStore } from './store/taskStore'
import Dialog from './components/ui/dialog/Dialog.vue'
import Button from './components/ui/button/Button.vue'
import { useTheme } from './composables/useTheme'
import { useBackground } from './composables/useBackground'
import { useLanguage } from './composables/useLanguage'

const taskStore = useTaskStore()
useBackground().initializeBackground()

// Initialize theme system
const { initializeTheme } = useTheme()
initializeTheme()

// Initialize language system
const { initializeLanguage } = useLanguage()
initializeLanguage()
</script>