<template>
  <div class="h-full overflow-auto px-7 py-6">
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.reminder.create') }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.reminder.description') }}</p>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField :label="$t('tools.reminder.type')" html-for="reminder-type">
            <select id="reminder-type" v-model="form.type" class="tool-select">
              <option value="water">{{ $t('tools.reminder.water') }}</option>
              <option value="stand">{{ $t('tools.reminder.stand') }}</option>
              <option value="eyes">{{ $t('tools.reminder.eyes') }}</option>
            </select>
          </FormField>

          <FormField :label="$t('tools.reminder.interval')" html-for="reminder-interval">
            <select id="reminder-interval" v-model.number="form.intervalMinutes" class="tool-select">
              <option v-for="minutes in intervals" :key="minutes" :value="minutes">
                {{ $t('tools.reminder.minutes', { count: minutes }) }}
              </option>
            </select>
          </FormField>

          <FormField :label="$t('tools.reminder.windowStart')" html-for="reminder-start">
            <Input id="reminder-start" v-model="form.windowStart" type="time" />
          </FormField>

          <FormField :label="$t('tools.reminder.windowEnd')" html-for="reminder-end">
            <Input id="reminder-end" v-model="form.windowEnd" type="time" />
          </FormField>
        </div>

        <div class="mt-4 flex items-center gap-3">
          <Button :loading="toolsStore.loading" @click="createRule">
            {{ $t('tools.reminder.create') }}
          </Button>
          <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
        </div>
      </section>

      <section class="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">{{ $t('tools.reminder.rules') }}</h2>
          <span class="text-sm text-muted-foreground">{{ rules.length }}</span>
        </div>

        <p v-if="rules.length === 0" class="mt-4 text-sm text-muted-foreground">
          {{ $t('tools.reminder.empty') }}
        </p>

        <ul v-else class="mt-4 flex flex-col gap-3">
          <li
            v-for="rule in rules"
            :key="rule.id"
            class="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <p class="font-medium text-foreground">
                {{ $t(`tools.reminder.${rule.type}`) }}
                <span class="ml-2 text-sm font-normal text-muted-foreground">
                  {{ $t('tools.reminder.minutes', { count: rule.intervalMinutes }) }}
                </span>
              </p>
              <p class="mt-1 text-sm text-muted-foreground">
                {{ rule.windowStart }}–{{ rule.windowEnd }}
                · {{ $t('tools.reminder.nextRun', { time: formatNextRun(rule.nextRunAt) }) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">{{ $t('tools.reminder.enabled') }}</span>
              <Switch
                :model-value="rule.enabled === 1"
                :label="$t('tools.reminder.enabled')"
                @update:model-value="toggleRule(rule, $event)"
              />
              <IconButton
                size="icon-sm"
                :label="$t('tools.reminder.delete')"
                @click="requestDelete(rule)"
              >
                <Trash2 class="h-icon-sm w-icon-sm" />
              </IconButton>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <AlertDialog
      :open="deleteOpen"
      :title="$t('tools.reminder.deleteTitle')"
      :description="$t('tools.reminder.deleteConfirm', { type: deletingRule ? $t(`tools.reminder.${deletingRule.type}`) : '' })"
      :cancel-label="$t('common.cancel')"
      :confirm-label="$t('common.delete')"
      confirm-variant="destructive"
      :loading="deleteLoading"
      :error="deleteError"
      @update:open="(value) => { if (!value) closeDelete() }"
      @confirm="confirmDelete"
      @cancel="closeDelete"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from '@lucide/vue'
import { useToolsStore } from '@/store/toolsStore'
import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Input from '@/components/ui/input/Input.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import FormField from '@/components/ui/form-field/FormField.vue'
import AlertDialog from '@/components/ui/alert-dialog/AlertDialog.vue'

const { locale } = useI18n()
const toolsStore = useToolsStore()
const intervals = [10, 20, 30, 45, 60, 90]
const form = reactive({
  type: 'water',
  intervalMinutes: 60,
  windowStart: '09:00',
  windowEnd: '18:00'
})
const error = ref('')
const rules = computed(() => toolsStore.reminderRules)
const deletingRule = ref(null)
const deleteOpen = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')

function formatNextRun(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function createRule() {
  error.value = ''
  try {
    await toolsStore.createReminderRule({
      type: form.type,
      intervalMinutes: form.intervalMinutes,
      anchorMode: 'created',
      windowStart: form.windowStart,
      windowEnd: form.windowEnd,
      weekdays: []
    })
  } catch (err) {
    error.value = err.message
  }
}

async function toggleRule(rule, enabled) {
  error.value = ''
  try {
    await toolsStore.updateReminderRule(rule.id, { enabled })
  } catch (err) {
    error.value = err.message
  }
}

function requestDelete(rule) {
  deletingRule.value = rule
  deleteError.value = ''
  deleteLoading.value = false
  deleteOpen.value = true
}

function closeDelete() {
  deleteOpen.value = false
  deletingRule.value = null
}

async function confirmDelete() {
  if (!deletingRule.value) return
  deleteLoading.value = true
  deleteError.value = ''
  try {
    await toolsStore.deleteReminderRule(deletingRule.value.id)
    closeDelete()
  } catch (err) {
    deleteError.value = err.message
  } finally {
    deleteLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    toolsStore.loadReminderRules(),
    toolsStore.loadShellSnapshot()
  ])
})
</script>

<style scoped>
.tool-select {
  @apply flex h-control-lg w-full rounded-md border border-input bg-background px-3 text-sm text-foreground;
  @apply outline-none transition-colors duration-150;
  @apply focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30;
}
</style>
