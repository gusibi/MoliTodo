import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * CSS 标识符转义，用于按 task id 查找焦点落点。
 */
export function cssEscape(value) {
  if (window.CSS && window.CSS.escape) return window.CSS.escape(value)
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

/**
 * 统一删除确认状态机：打开、提交中防重复、失败保留并显示错误、取消与焦点恢复。
 *
 * 各视图只需提供删除动作和焦点落点，避免逐页复制确认逻辑：
 * - performDelete(task)：返回 `{ success, error }` 或抛错，由调用方接入现有业务链。
 * - captureNeighbor(trigger)：删除前记录相邻对象 key（触发控件会随任务移除）。
 * - resolveNeighbor(key)：删除后把 key 解析为可聚焦元素。
 * - fallbackFocus()：没有相邻对象时的落点。
 * - onDeleted(task)：删除成功后的宿主附加行为（如切换编辑面板）。
 */
export function useDeleteConfirm({
  performDelete,
  captureNeighbor,
  resolveNeighbor,
  fallbackFocus,
  onDeleted
} = {}) {
  const { t } = useI18n()

  const open = ref(false)
  const target = ref(null)
  const loading = ref(false)
  const error = ref('')
  let trigger = null
  let neighborKey = null

  function requestDelete({ task, trigger: triggerEl }) {
    target.value = task
    trigger = triggerEl || null
    neighborKey = captureNeighbor ? captureNeighbor(trigger) : null
    error.value = ''
    loading.value = false
    open.value = true
  }

  async function confirmDelete() {
    if (!target.value || loading.value) return
    const task = target.value
    loading.value = true
    error.value = ''
    try {
      const result = await performDelete(task)
      if (result && result.success === false) {
        error.value = t('tasks.deleteFailed', { error: result.error || '' })
        return
      }

      open.value = false
      target.value = null
      if (onDeleted) onDeleted(task)

      nextTick(() => {
        const neighbor = neighborKey && resolveNeighbor ? resolveNeighbor(neighborKey) : null
        if (neighbor) {
          neighbor.focus()
        } else if (fallbackFocus) {
          fallbackFocus()
        }
      })
    } catch (err) {
      error.value = t('tasks.deleteFailed', { error: err?.message || '' })
    } finally {
      loading.value = false
    }
  }

  function cancelDelete() {
    target.value = null
    error.value = ''
    nextTick(() => {
      if (trigger && document.contains(trigger)) trigger.focus()
    })
  }

  function close() {
    open.value = false
  }

  return { open, target, loading, error, requestDelete, confirmDelete, cancelDelete, close }
}
