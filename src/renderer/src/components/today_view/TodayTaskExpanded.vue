<template>
  <div v-if="open" class="today-task-expanded-shell">
    <section :id="regionId" class="today-task-expanded" role="region" :aria-label="$t('today.taskDetails')" @click.stop>
      <TaskEditVertical
        :task="task"
        :is-editing="true"
        :inline="true"
        :region-id="regionId"
        @cancel-edit="handleEditorClose"
        @delete-task="$emit('delete-task', $event)"
      >
        <template #header-actions>
          <slot name="actions" />
        </template>
      </TaskEditVertical>
    </section>
  </div>
</template>

<script setup>
import TaskEditVertical from '../TaskEditVertical.vue'

defineProps({
  task: { type: Object, required: true },
  open: { type: Boolean, default: false },
  regionId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'delete-task'])

function handleEditorClose(options) {
  emit('close', options)
}
</script>
