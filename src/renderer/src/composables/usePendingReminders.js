import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTaskStore } from '@/store/taskStore'

// 开始、完成、删除、清除或推迟提醒后，不再视为待处理提醒。
export function usePendingReminders() {
  const taskStore = useTaskStore()
  const now = ref(Date.now())
  let timer
  const pendingReminders = computed(() => taskStore.tasks.filter(task =>
    (task.status === 'todo' || task.status === 'paused') &&
    task.reminderTime && new Date(task.reminderTime).getTime() <= now.value
  ))
  onMounted(() => {
    timer = setInterval(() => { now.value = Date.now() }, 1000)
  })
  onUnmounted(() => clearInterval(timer))
  return { pendingReminders }
}
