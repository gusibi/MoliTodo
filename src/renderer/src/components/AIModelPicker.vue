<template>
  <div class="ai-model-picker" ref="rootEl">
    <slot :open="open" :toggle="toggle" :active="active" :label="label" />

    <div
      v-if="open"
      class="ai-model-picker-menu"
      :class="align === 'right' ? 'right-0' : 'left-0'"
      role="menu"
    >
      <button
        type="button"
        role="menuitemradio"
        :aria-checked="!selectedModel"
        class="ai-model-picker-item no-ai"
        :class="{ selected: !selectedModel }"
        @click="choose(null)"
      >
        <span class="ai-model-picker-item-info">
          <span class="ai-model-picker-item-name">{{ $t('ai.noModel') }}</span>
          <span class="ai-model-picker-item-provider">{{ $t('ai.noModelHint') }}</span>
        </span>
        <span class="ai-model-picker-check">
          <X v-if="!selectedModel" class="h-icon-sm w-icon-sm" aria-hidden="true" />
        </span>
      </button>

      <button
        v-for="model in models"
        :key="model.id"
        type="button"
        role="menuitemradio"
        :aria-checked="selectedModel && selectedModel.id === model.id"
        class="ai-model-picker-item"
        :class="{ selected: selectedModel && selectedModel.id === model.id }"
        @click="choose(model)"
      >
        <span class="ai-model-picker-item-info">
          <span class="ai-model-picker-item-name">{{ model.name }}</span>
          <span class="ai-model-picker-item-provider">{{ model.provider }}</span>
        </span>
        <span class="ai-model-picker-check">
          <Check v-if="selectedModel && selectedModel.id === model.id" class="h-icon-sm w-icon-sm" aria-hidden="true" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, X } from '@lucide/vue'

/**
 * AI 模型选择器：触发按钮由调用方通过插槽提供，面板与选择逻辑在此统一。
 * 今日快速添加与列表快速添加共用同一交互，避免各页各写一套下拉。
 */
const props = defineProps({
  models: {
    type: Array,
    default: () => []
  },
  selectedModel: {
    type: Object,
    default: null
  },
  align: {
    type: String,
    default: 'left'
  }
})

const emit = defineEmits(['select'])

const rootEl = ref(null)
const open = ref(false)

const active = computed(() => !!props.selectedModel)
const label = computed(() => (props.selectedModel ? props.selectedModel.name : 'AI'))

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function choose(model) {
  emit('select', model)
  close()
}

function onDocumentPointerDown(event) {
  if (rootEl.value && !rootEl.value.contains(event.target)) close()
}

function onDocumentKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
  }
}

watch(open, (value) => {
  if (value) {
    document.addEventListener('mousedown', onDocumentPointerDown, true)
    document.addEventListener('keydown', onDocumentKeydown, true)
  } else {
    document.removeEventListener('mousedown', onDocumentPointerDown, true)
    document.removeEventListener('keydown', onDocumentKeydown, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})
</script>
