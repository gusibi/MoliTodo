import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTaskStore } from '@/store/taskStore'

const DISMISSED_STORAGE_KEY = 'moli.dismissedReminders'
const REMINDER_SYNC_CHANNEL = 'pending-reminders-sync'

// 提醒的已知晓标识：任务 id + 当时提醒时刻。重新设置提醒会生成新标识。
export function reminderKey(task) {
  return `${task.id}:${task.reminderTime}`
}

// ---- 已知晓集合：模块级共享，跨窗口经 BroadcastChannel + storage 事件同步 ----
// （与 useColorTheme 的跨窗口同步模式一致；悬浮球窗口与任务面板窗口各有独立进程）
function loadDismissedKeys() {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY))
    return Array.isArray(raw) ? new Set(raw.filter((key) => typeof key === 'string')) : new Set()
  } catch (error) {
    return new Set()
  }
}

let dismissedKeys = loadDismissedKeys()
// 版本号触发依赖该集合的 computed 重新计算
const dismissedVersion = ref(0)
let reminderSyncChannel = null
let reminderStorageListener = null

function persistDismissedKeys() {
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...dismissedKeys]))
  } catch (error) {
    console.warn('持久化已知晓提醒失败:', error)
  }
}

function broadcastDismissedChanged() {
  try {
    reminderSyncChannel?.postMessage({ type: 'dismissed-reminders-changed' })
  } catch (error) {
    console.warn('广播已知晓提醒变更失败:', error)
  }
}

function reloadDismissedKeys() {
  dismissedKeys = loadDismissedKeys()
  dismissedVersion.value++
}

function initReminderSync() {
  if (typeof window === 'undefined') return
  if (window.BroadcastChannel && !reminderSyncChannel) {
    try {
      reminderSyncChannel = new BroadcastChannel(REMINDER_SYNC_CHANNEL)
      reminderSyncChannel.addEventListener('message', (event) => {
        if (event.data?.type === 'dismissed-reminders-changed') reloadDismissedKeys()
      })
    } catch (error) {
      console.warn('BroadcastChannel 不可用，提醒已读状态仅本窗口生效:', error)
    }
  }
  if (!reminderStorageListener) {
    // 其他窗口直接改 localStorage 时的兜底同步
    reminderStorageListener = (event) => {
      if (event.key === DISMISSED_STORAGE_KEY) reloadDismissedKeys()
    }
    window.addEventListener('storage', reminderStorageListener)
  }
}

// 开始、完成、删除、清除或推迟提醒后，不再视为待处理提醒；
// 悬浮球上悬停片刻也可以把当前提醒标记为已知晓（清除闹钟角标）。
export function usePendingReminders() {
  const taskStore = useTaskStore()
  const now = ref(Date.now())
  let timer

  const pendingReminders = computed(() => {
    void dismissedVersion.value
    return taskStore.tasks.filter(task =>
      (task.status === 'todo' || task.status === 'paused') &&
      task.reminderTime && new Date(task.reminderTime).getTime() <= now.value &&
      !dismissedKeys.has(reminderKey(task))
    )
  })

  // 把一批提醒标记为已知晓；同时清理已失效的标识，避免存储无限增长
  const dismissReminders = (tasks) => {
    const list = Array.isArray(tasks) ? tasks : [tasks]
    let changed = false
    for (const task of list) {
      const key = reminderKey(task)
      if (task?.reminderTime && !dismissedKeys.has(key)) {
        dismissedKeys.add(key)
        changed = true
      }
    }
    const liveKeys = new Set(taskStore.tasks.filter((task) => task.reminderTime).map(reminderKey))
    for (const key of [...dismissedKeys]) {
      if (!liveKeys.has(key)) {
        dismissedKeys.delete(key)
        changed = true
      }
    }
    if (!changed) return
    persistDismissedKeys()
    dismissedVersion.value++
    broadcastDismissedChanged()
  }

  onMounted(() => {
    timer = setInterval(() => { now.value = Date.now() }, 1000)
    initReminderSync()
  })
  onUnmounted(() => clearInterval(timer))
  return { pendingReminders, dismissReminders }
}
