<template>
  <Dialog :open="open" :title="$t('tasks.createTask')" @update:open="handleOpenChange">
    <div class="flex flex-col gap-4">
      <!-- 任务内容：首要视觉信息 -->
      <Input
        ref="contentInput"
        v-model="content"
        :placeholder="$t('tasks.composer.taskPlaceholder')"
        class="h-auto border-0 bg-transparent px-0 text-lg font-medium shadow-none focus-visible:ring-0"
        @keydown.enter.prevent="submit"
      />

      <!-- 备注：弱化 -->
      <Textarea
        v-model="note"
        :placeholder="$t('tasks.composer.notePlaceholder')"
        :rows="2"
        class="border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
      />

      <!-- 日期 -->
      <section class="rounded-lg border border-border/60 bg-muted/30 p-3">
        <div class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarDays class="h-icon-sm w-icon-sm text-primary" aria-hidden="true" />
          <span>{{ $t('tasks.composer.dateSection') }}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="option in dateOptions"
            :key="option.key"
            type="button"
            class="rounded-full border px-3 py-1 text-xs transition-colors"
            :class="date === option.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'"
            @click="selectDateOption(option)"
          >
            {{ option.label }}
          </button>
          <DatePicker
            v-model="date"
            class="h-auto rounded-full px-3 py-1 text-xs"
            :placeholder="$t('tasks.composer.pickDate')"
          />
        </div>

        <div v-if="date" class="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            v-for="mode in timeModes"
            :key="mode.key"
            type="button"
            class="rounded-full border px-3 py-1 text-xs transition-colors"
            :class="timeMode === mode.key
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'"
            @click="timeMode = mode.key"
          >
            {{ mode.label }}
          </button>

          <Input
            v-if="timeMode === 'specific'"
            v-model="time"
            type="time"
            class="h-control-sm w-auto rounded-full px-2 text-xs"
          />
        </div>

        <div v-if="date && timeMode === 'period'" class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="period in periodOptions"
            :key="period.key"
            type="button"
            class="rounded-full border px-3 py-1 text-xs transition-colors"
            :class="period.key === selectedPeriod
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'"
            @click="selectedPeriod = period.key"
          >
            {{ period.label }}
          </button>
        </div>
      </section>

      <!-- 列表 -->
      <section class="rounded-lg border border-border/60 bg-muted/30 p-3">
        <div class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <ListIcon name="list" class="h-icon-sm w-icon-sm text-primary" />
          <span>{{ $t('tasks.composer.listSection') }}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="list in lists"
            :key="list.id"
            type="button"
            class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
            :class="listId === list.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'"
            @click="listId = list.id"
          >
            <ListIcon :name="list.icon" :color="list.color" :size="13" />
            <span>{{ list.name }}</span>
          </button>
        </div>
      </section>

      <!-- AI -->
      <section v-if="taskStore.availableAIModels.length > 0" class="flex items-center gap-2">
        <AIModelPicker
          :models="taskStore.availableAIModels"
          :selected-model="taskStore.selectedAIModel"
          align="left"
          @select="taskStore.selectAIModel"
          v-slot="{ open: pickerOpen, active, label }"
        >
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5 text-muted-foreground"
            :class="active ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : ''"
            :title="$t('today.aiToggle')"
            aria-haspopup="menu"
            :aria-expanded="pickerOpen"

          >
            <WandSparkles class="h-icon-sm w-icon-sm" aria-hidden="true" />
            <span>{{ label }}</span>
          </Button>
        </AIModelPicker>

        <Button
          v-if="taskStore.selectedAIModel && taskStore.isAIEnabled"
          variant="outline"
          size="sm"
          class="gap-1.5"
          :class="split ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground'"
          @click="split = !split"
        >
          <ListTree class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>{{ $t('today.splitToggle') }}</span>
        </Button>
      </section>

      <!-- 提交 -->
      <Button
        variant="default"
        class="h-control-lg w-full"
        :loading="submitting"
        @click="submit"
      >
        <Check class="h-icon-md w-icon-md" aria-hidden="true" />
        <span>{{ $t('tasks.createTask') }}</span>
      </Button>
    </div>
  </Dialog>

  <TaskPreviewModal
    :visible="showPreview"
    :tasks="previewTasks"
    :original-input="originalTaskInput"
    :stream-content="streamContent"
    @close="closePreview"
    @created="handlePreviewCreated"
  />
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarDays, Check, ListTree, WandSparkles } from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import Dialog from './ui/dialog/Dialog.vue'
import Input from './ui/input/Input.vue'
import Textarea from './ui/textarea/Textarea.vue'
import DatePicker from './ui/date-picker/DatePicker.vue'
import Button from './ui/button/Button.vue'
import ListIcon from './ui/ListIcon.vue'
import AIModelPicker from './AIModelPicker.vue'
import TaskPreviewModal from './TaskPreviewModal.vue'

/**
 * 公共新建任务弹窗：标题（任务内容）、备注、清单、日期时间、AI 模型。
 * 自包含数据行为（直接调用 taskStore），其他页面引入即可复用。
 * 日期时间写入现有「安排」字段（scheduledStartAt）。
 */
const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  defaultListId: {
    type: [Number, String],
    default: null
  },
  defaultDate: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:open', 'created'])

const { t } = useI18n()
const taskStore = useTaskStore()

const PERIOD_TIMES = { morning: '09:00', afternoon: '14:00', evening: '19:00' }

const contentInput = ref(null)
const content = ref('')
const note = ref('')
const date = ref('')
const timeMode = ref('anytime')
const time = ref('09:00')
const selectedPeriod = ref('morning')
const listId = ref(null)
const split = ref(false)
const submitting = ref(false)

const showPreview = ref(false)
const previewTasks = ref([])
const originalTaskInput = ref('')
const streamContent = ref('')

const lists = computed(() => taskStore.sortedLists)

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toKey(value) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
}

function addDaysKey(baseKey, days) {
  const value = new Date(`${baseKey}T00:00:00`)
  value.setDate(value.getDate() + days)
  return toKey(value)
}

function nextWeekdayKey(baseKey, weekday) {
  const value = new Date(`${baseKey}T00:00:00`)
  const delta = (weekday - value.getDay() + 7) % 7 || 7
  value.setDate(value.getDate() + delta)
  return toKey(value)
}

const todayKey = computed(() => toKey(new Date()))

const dateOptions = computed(() => [
  { key: 'none', label: t('tasks.composer.dateNone'), value: '' },
  { key: 'today', label: t('tasks.composer.dateToday'), value: todayKey.value },
  { key: 'tomorrow', label: t('tasks.composer.dateTomorrow'), value: addDaysKey(todayKey.value, 1) },
  { key: 'weekend', label: t('tasks.composer.dateWeekend'), value: nextWeekdayKey(todayKey.value, 6) },
  { key: 'nextWeek', label: t('tasks.composer.dateNextWeek'), value: nextWeekdayKey(todayKey.value, 1) }
])

const timeModes = computed(() => [
  { key: 'anytime', label: t('tasks.composer.timeAnytime') },
  { key: 'period', label: t('tasks.composer.timePeriod') },
  { key: 'specific', label: t('tasks.composer.timeSpecific') }
])

const periodOptions = computed(() => [
  { key: 'morning', label: t('tasks.composer.periodMorning') },
  { key: 'afternoon', label: t('tasks.composer.periodAfternoon') },
  { key: 'evening', label: t('tasks.composer.periodEvening') }
])

function selectDateOption(option) {
  date.value = option.value
}

function resolveScheduledStart() {
  if (!date.value) return null
  let timeText = '00:00'
  if (timeMode.value === 'specific' && time.value) timeText = time.value
  else if (timeMode.value === 'period') timeText = PERIOD_TIMES[selectedPeriod.value]
  const value = new Date(`${date.value}T${timeText}:00`)
  return Number.isNaN(value.getTime()) ? null : value
}

function buildTaskData() {
  const data = { content: content.value.trim() }
  const trimmedNote = note.value.trim()
  if (trimmedNote) data.metadata = { note: trimmedNote }
  if (listId.value !== null && listId.value !== undefined) data.listId = listId.value
  const start = resolveScheduledStart()
  if (start) data.scheduledStartAt = start.toISOString()
  return data
}

function resetForm() {
  content.value = ''
  note.value = ''
  date.value = props.defaultDate || ''
  timeMode.value = 'anytime'
  time.value = '09:00'
  selectedPeriod.value = 'morning'
  listId.value = props.defaultListId ?? taskStore.currentListId ?? 0
  split.value = false
  submitting.value = false
  closePreview()
  nextTick(() => contentInput.value?.focus?.())
}

function close() {
  emit('update:open', false)
}

function handleOpenChange(value) {
  emit('update:open', value)
}

function closePreview() {
  showPreview.value = false
  previewTasks.value = []
  originalTaskInput.value = ''
  streamContent.value = ''
}

async function createNormalTask() {
  const result = await taskStore.createTask(buildTaskData())
  if (result && result.success) {
    emit('created', result.task || null)
    close()
  }
}

async function generateWithAI() {
  const text = content.value.trim()
  originalTaskInput.value = text
  previewTasks.value = []
  streamContent.value = ''
  showPreview.value = true
  close()

  const fallback = async () => {
    showPreview.value = false
    await createNormalTask()
  }

  try {
    await taskStore.streamGenerateTaskList(
      text,
      (chunk) => { streamContent.value = chunk },
      (finalResult) => {
        if (finalResult.success && finalResult.tasks) {
          previewTasks.value = finalResult.tasks.map((task) => ({
            ...task,
            listId: task.listId ?? listId.value,
            dueDate: task.dueDate || null,
            dueTime: task.dueTime || null,
            scheduledStartAt: task.scheduledStartAt || null,
            scheduledEndAt: task.scheduledEndAt || null,
            reminderPolicy: task.reminderPolicy || null,
            reminderTime: task.reminderTime || null,
            metadata: task.metadata || { note: note.value.trim() }
          }))
        } else {
          fallback()
        }
      },
      () => fallback(),
      split.value
    )
  } catch (error) {
    fallback()
  }
}

async function submit() {
  if (submitting.value) return
  if (!content.value.trim()) {
    contentInput.value?.focus?.()
    return
  }
  if (taskStore.selectedAIModel && taskStore.isAIEnabled) {
    await generateWithAI()
    return
  }
  submitting.value = true
  try {
    await createNormalTask()
  } finally {
    submitting.value = false
  }
}

function handlePreviewCreated(result) {
  if (result && result.success) {
    taskStore.getAllTasks()
    emit('created', null)
  }
  closePreview()
}

watch(
  () => props.open,
  (value) => {
    if (value) resetForm()
  }
)
</script>
