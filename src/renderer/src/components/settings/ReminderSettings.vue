<template>
  <div>
    <h1 class="setting-page-title">提醒设置</h1>
    <p class="setting-page-description">自定义任务提醒的快捷选项</p>

    <div class="setting-group">
      <h3 class="setting-group-title">自定义提醒选项</h3>
      <p class="setting-group-description">配置在添加任务时可以快速选择的提醒时间</p>

      <div class="custom-reminders-list">
        <div v-for="(reminder, index) in config.customReminders" :key="reminder.id"
          class="custom-reminder-item">
          <div class="custom-reminder-info">
            <input v-model="reminder.label" class="custom-reminder-label-input" placeholder="提醒标签"
              @input="updateCustomReminder(index)" />
            <div class="custom-reminder-config">
              <select v-model="reminder.type" class="custom-reminder-type-select"
                @change="updateCustomReminder(index)">
                <option value="relative">相对时间</option>
                <option value="absolute">绝对时间</option>
              </select>

              <!-- 相对时间配置 -->
              <template v-if="reminder.type === 'relative'">
                <input v-model="reminder.value" type="number" min="1" class="custom-reminder-value-input"
                  @input="updateCustomReminder(index)" />
                <select v-model="reminder.unit" class="custom-reminder-unit-select"
                  @change="updateCustomReminder(index)">
                  <option value="minutes">分钟后</option>
                  <option value="hours">小时后</option>
                  <option value="days">天后</option>
                </select>
              </template>

              <!-- 绝对时间配置 -->
              <template v-if="reminder.type === 'absolute'">
                <input v-model="reminder.time" type="time" class="custom-reminder-time-input"
                  @input="updateCustomReminder(index)" />
                <input v-model="reminder.dayOffset" type="number" min="0" max="365"
                  class="custom-reminder-value-input" placeholder="天数" @input="updateCustomReminder(index)" />
                <span class="custom-reminder-unit-label">天后</span>
              </template>
            </div>
          </div>
          <div class="custom-reminder-actions">
            <button class="custom-reminder-delete-btn" @click="deleteCustomReminder(index)" title="删除">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>

      <button class="setting-btn setting-btn-primary add-reminder-btn" @click="addCustomReminder">
        <i class="fas fa-plus"></i>
        添加新的提醒选项
      </button>
    </div>
  </div>
</template>

<script setup>
import { useTaskStore } from '@/store/taskStore'

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:config', 'show-message'])

// 使用 taskStore
const taskStore = useTaskStore()

// 方法
const addCustomReminder = async () => {
  const newId = Math.max(0, ...props.config.customReminders.map(r => r.id)) + 1
  props.config.customReminders.push({
    id: newId,
    label: '新提醒',
    type: 'relative',
    value: 30,
    unit: 'minutes',
    time: '09:00',
    dayOffset: 0
  })
  // 创建一个干净的副本，移除Vue的响应式属性
  const cleanReminders = props.config.customReminders.map(reminder => ({
    id: reminder.id,
    label: reminder.label,
    type: reminder.type,
    value: reminder.value,
    unit: reminder.unit,
    time: reminder.time,
    dayOffset: reminder.dayOffset
  }))
  await updateConfig('customReminders', cleanReminders)
  // 通知 taskStore 更新自定义提醒选项
  await taskStore.refreshCustomReminderOptions()
  emit('show-message', '已添加新的提醒选项', 'success')
}

const deleteCustomReminder = async (index) => {
  if (props.config.customReminders.length > 1) {
    props.config.customReminders.splice(index, 1)
    // 创建一个干净的副本，移除Vue的响应式属性
    const cleanReminders = props.config.customReminders.map(reminder => ({
      id: reminder.id,
      label: reminder.label,
      type: reminder.type,
      value: reminder.value,
      unit: reminder.unit,
      time: reminder.time,
      dayOffset: reminder.dayOffset
    }))
    await updateConfig('customReminders', cleanReminders)
    // 通知 taskStore 更新自定义提醒选项
    await taskStore.refreshCustomReminderOptions()
    emit('show-message', '提醒选项已删除', 'success')
  } else {
    emit('show-message', '至少需要保留一个提醒选项', 'error')
  }
}

const updateCustomReminder = (index) => {
  // 延迟更新，避免频繁保存
  setTimeout(async () => {
    // 创建一个干净的副本，移除Vue的响应式属性
    const cleanReminders = props.config.customReminders.map(reminder => ({
      id: reminder.id,
      label: reminder.label,
      type: reminder.type,
      value: reminder.value,
      unit: reminder.unit,
      time: reminder.time,
      dayOffset: reminder.dayOffset
    }))
    await updateConfig('customReminders', cleanReminders)
    // 通知 taskStore 更新自定义提醒选项
    await taskStore.refreshCustomReminderOptions()
  }, 500)
}

const updateConfig = async (key, value) => {
  try {
    if (window.electronAPI && window.electronAPI.config) {
      await window.electronAPI.config.set(key, value)
    }
    emit('update:config', key, value)
  } catch (error) {
    console.error('更新配置失败:', error)
    throw error
  }
}
</script>

<style scoped>
@import '@/assets/styles/components/settings.css';
</style>