<template>
  <DropdownMenu v-model:open="open" :align="align === 'right' ? 'end' : 'start'">
    <template #trigger><slot :open="open" :active="active" :label="label" /></template>
    <DropdownMenuItem role="menuitemradio" :aria-checked="!selectedModel" :selected="!selectedModel" @select="choose(null)">
      <span class="flex min-w-0 flex-col"><span>{{ $t('ai.noModel') }}</span><span class="text-xs text-muted-foreground">{{ $t('ai.noModelHint') }}</span></span>
      <X v-if="!selectedModel" class="ml-auto h-icon-sm w-icon-sm" aria-hidden="true" />
    </DropdownMenuItem>
    <DropdownMenuItem v-for="model in models" :key="model.id" role="menuitemradio"
      :aria-checked="selectedModel?.id === model.id" :selected="selectedModel?.id === model.id" @select="choose(model)">
      <span class="flex min-w-0 flex-col"><span>{{ model.name }}</span><span class="text-xs text-muted-foreground">{{ model.provider }}</span></span>
      <Check v-if="selectedModel?.id === model.id" class="ml-auto h-icon-sm w-icon-sm" aria-hidden="true" />
    </DropdownMenuItem>
  </DropdownMenu>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Check, X } from '@lucide/vue'
import DropdownMenu from './ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuItem from './ui/dropdown-menu/DropdownMenuItem.vue'

const props = defineProps({
  models: { type: Array, default: () => [] },
  selectedModel: { type: Object, default: null },
  align: { type: String, default: 'left' }
})
const emit = defineEmits(['select'])
const open = ref(false)
const active = computed(() => !!props.selectedModel)
const label = computed(() => props.selectedModel ? props.selectedModel.name : 'AI')
function choose(model) {
  emit('select', model)
  open.value = false
}
</script>
