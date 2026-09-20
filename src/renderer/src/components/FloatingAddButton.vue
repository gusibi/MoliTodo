<template>
  <Button
    ref="buttonRef"
    variant="default"
    class="h-control-lg gap-1.5 rounded-full px-4 shadow-lg"
    @click="emit('click')"
  >
    <Plus class="h-icon-md w-icon-md" aria-hidden="true" />
    <span>{{ label || $t('tasks.composer.newItem') }}</span>
  </Button>
</template>

<script setup>
import { ref } from 'vue'
import { Plus } from '@lucide/vue'
import Button from './ui/button/Button.vue'

/**
 * 悬浮新建入口：各页面放在底部居中，点击打开公共 TaskComposer。
 */
defineProps({
  label: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['click'])
const buttonRef = ref(null)

defineExpose({
  focus: (options) => buttonRef.value?.focus(options)
})
</script>
