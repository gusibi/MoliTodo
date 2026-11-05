import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useToolsStore = defineStore('tools', () => {
  const shellSnapshot = ref(null)
  const gardenView = ref(null)
  const reminderRules = ref([])
  const healthView = ref(null)
  const focusState = ref(null)
  const loading = ref(false)
  const error = ref('')

  const available = computed(() => Boolean(window.electronAPI?.tools))
  const pendingRewards = computed(() => shellSnapshot.value?.badges?.pendingRewards || 0)

  // 统一封装 tools IPC 调用：可用性守卫 + 错误记录
  // - fallback：工具不可用或失败时返回的默认值
  // - rethrow：失败时把错误抛给调用方（默认仅记录到 error）
  // - withLoading：调用期间置 loading，并预先清空 error
  // - resetError：调用前清空 error（不翻转 loading）
  const callTools = async (action, { fallback = null, rethrow = false, withLoading = false, resetError = false } = {}) => {
    if (!available.value) return fallback
    if (resetError || withLoading) error.value = ''
    if (withLoading) loading.value = true
    try {
      return await action()
    } catch (err) {
      error.value = err.message
      if (rethrow) throw err
      return fallback
    } finally {
      if (withLoading) loading.value = false
    }
  }

  const loadShellSnapshot = () => callTools(async () => {
    shellSnapshot.value = await window.electronAPI.tools.getShellSnapshot()
    return shellSnapshot.value
  })

  const loadGardenView = () => callTools(async () => {
    gardenView.value = await window.electronAPI.tools.getGardenView()
    return gardenView.value
  })

  const loadHealthView = () => callTools(async () => {
    healthView.value = await window.electronAPI.tools.getHealthView()
    return healthView.value
  })

  const loadReminderRules = () => callTools(async () => {
    reminderRules.value = await window.electronAPI.tools.listReminderRules()
    return reminderRules.value
  }, { fallback: [] })

  const loadFocusState = () => callTools(async () => {
    focusState.value = await window.electronAPI.tools.getFocusState()
    return focusState.value
  })

  const startFocus = (input) => callTools(async () => {
    focusState.value = await window.electronAPI.tools.startFocus(input)
    await loadShellSnapshot()
    return focusState.value
  }, { rethrow: true, withLoading: true })

  const pauseFocus = () => callTools(async () => {
    focusState.value = await window.electronAPI.tools.pauseFocus()
    await loadShellSnapshot()
    return focusState.value
  }, { rethrow: true })

  const resumeFocus = () => callTools(async () => {
    focusState.value = await window.electronAPI.tools.resumeFocus()
    await loadShellSnapshot()
    return focusState.value
  }, { rethrow: true })

  const cancelFocus = () => callTools(async () => {
    focusState.value = await window.electronAPI.tools.cancelFocus()
    await loadShellSnapshot()
    return focusState.value
  }, { rethrow: true })

  const skipFocusBreak = () => callTools(async () => {
    focusState.value = await window.electronAPI.tools.skipFocusBreak()
    await loadShellSnapshot()
    return focusState.value
  }, { rethrow: true })

  const dismissFocusNotice = () => callTools(async () => {
    focusState.value = await window.electronAPI.tools.dismissFocusNotice()
    return focusState.value
  }, { rethrow: true })

  const createReminderRule = (input) => callTools(async () => {
    const rule = await window.electronAPI.tools.createReminderRule(input)
    await Promise.all([loadReminderRules(), loadHealthView(), loadShellSnapshot()])
    return rule
  }, { rethrow: true, withLoading: true })

  const updateReminderRule = (ruleId, updates) => callTools(async () => {
    const rule = await window.electronAPI.tools.updateReminderRule(ruleId, updates)
    await Promise.all([loadReminderRules(), loadHealthView(), loadShellSnapshot()])
    return rule
  }, { rethrow: true, resetError: true })

  const deleteReminderRule = (ruleId) => callTools(async () => {
    const result = await window.electronAPI.tools.deleteReminderRule(ruleId)
    await Promise.all([loadReminderRules(), loadHealthView(), loadShellSnapshot()])
    return result
  }, { rethrow: true, resetError: true })

  const getClaimOptions = async (claimId) => {
    if (!available.value) return null
    return window.electronAPI.tools.getClaimOptions(claimId)
  }

  const plantSeed = (speciesId) => callTools(async () => {
    const result = await window.electronAPI.tools.plantSeed(speciesId)
    await loadGardenView()
    await loadShellSnapshot()
    return result
  }, { rethrow: true, resetError: true })

  const claimBasicSeed = () => callTools(async () => {
    const result = await window.electronAPI.tools.claimBasicSeed()
    await loadGardenView()
    await loadShellSnapshot()
    return result
  }, { rethrow: true, resetError: true })

  const mergeTrees = (speciesId, fromTier) => callTools(async () => {
    const result = await window.electronAPI.tools.mergeTrees(speciesId, fromTier)
    await loadGardenView()
    await loadShellSnapshot()
    return result
  }, { rethrow: true, resetError: true })

  const placeItem = (inventoryId, position = null) => callTools(async () => {
    const placement = await window.electronAPI.tools.placeItem(inventoryId, position)
    await loadGardenView()
    return placement
  }, { rethrow: true, resetError: true })

  const setAutoPlace = (enabled) => callTools(async () => {
    const result = await window.electronAPI.tools.setAutoPlace(enabled)
    await loadGardenView()
    return result
  }, { rethrow: true, resetError: true })

  const moveItem = (inventoryId, position) => callTools(async () => {
    const placement = await window.electronAPI.tools.moveItem(inventoryId, position)
    await loadGardenView()
    await loadShellSnapshot()
    return placement
  }, { rethrow: true })

  const removePlacement = (inventoryId) => callTools(async () => {
    const placement = await window.electronAPI.tools.removePlacement(inventoryId)
    await loadGardenView()
    return placement
  }, { rethrow: true, resetError: true })

  const claimReward = (claimId, selectedItemId = null) => callTools(async () => {
    const result = await window.electronAPI.tools.claimReward(claimId, selectedItemId)
    await loadGardenView()
    await loadShellSnapshot()
    return result
  }, { rethrow: true, withLoading: true })

  return {
    shellSnapshot,
    gardenView,
    reminderRules,
    healthView,
    focusState,
    loading,
    error,
    available,
    pendingRewards,
    loadShellSnapshot,
    loadGardenView,
    loadHealthView,
    loadReminderRules,
    loadFocusState,
    createReminderRule,
    updateReminderRule,
    deleteReminderRule,
    startFocus,
    pauseFocus,
    resumeFocus,
    cancelFocus,
    skipFocusBreak,
    dismissFocusNotice,
    getClaimOptions,
    claimReward,
    plantSeed,
    claimBasicSeed,
    mergeTrees,
    placeItem,
    moveItem,
    removePlacement,
    setAutoPlace
  }
})
