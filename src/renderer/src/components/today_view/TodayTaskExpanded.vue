<template>
  <Transition name="today-task-expand">
    <div v-if="open" class="today-task-expanded-shell">
      <section class="today-task-expanded" role="region" :aria-label="$t('today.taskDetails')" @click.stop>
        <TaskEditVertical
          :task="task"
          :is-editing="true"
          :inline="true"
          @cancel-edit="handleEditorClose"
          @delete-task="$emit('delete-task', $event)"
        />
      </section>
    </div>
  </Transition>
</template>

<script setup>
import TaskEditVertical from '../TaskEditVertical.vue'

defineProps({
  task: { type: Object, required: true },
  open: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'delete-task'])

function handleEditorClose(options) {
  emit('close', options)
}
</script>
