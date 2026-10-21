import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useToolsStore = defineStore('tools', () => {
  const shellSnapshot = ref(null)
  const gardenView = ref(null)
  const reminderRules = ref([])
  const focusState = ref(null)
  const loading = ref(false)
  const error = ref('')

  const available = computed(() => Boolean(window.electronAPI?.tools))
  const pendingRewards = computed(() => shellSnapshot.value?.badges?.pendingRewards || 0)

  const loadShellSnapshot = async () => {
    if (!available.value) return null
    try {
      shellSnapshot.value = await window.electronAPI.tools.getShellSnapshot()
      return shellSnapshot.value
    } catch (err) {
      error.value = err.message
      return null
    }
  }

  const loadGardenView = async () => {
    if (!available.value) return null
    try {
      gardenView.value = await window.electronAPI.tools.getGardenView()
      return gardenView.value
    } catch (err) {
      error.value = err.message
      return null
    }
  }

  const loadReminderRules = async () => {
    if (!available.value) return []
    try {
      reminderRules.value = await window.electronAPI.tools.listReminderRules()
      return reminderRules.value
    } catch (err) {
      error.value = err.message
      return []
    }
  }

  const loadFocusState = async () => {
    if (!available.value) return null
    try {
      focusState.value = await window.electronAPI.tools.getFocusState()
      return focusState.value
    } catch (err) {
      error.value = err.message
      return null
    }
  }

  const startFocus = async (input) => {
    if (!available.value) return null
    loading.value = true
    error.value = ''
    try {
      focusState.value = await window.electronAPI.tools.startFocus(input)
      await loadShellSnapshot()
      return focusState.value
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const pauseFocus = async () => {
    if (!available.value) return null
    try {
      focusState.value = await window.electronAPI.tools.pauseFocus()
      await loadShellSnapshot()
      return focusState.value
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const resumeFocus = async () => {
    if (!available.value) return null
    try {
      focusState.value = await window.electronAPI.tools.resumeFocus()
      await loadShellSnapshot()
      return focusState.value
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const cancelFocus = async () => {
    if (!available.value) return null
    try {
      focusState.value = await window.electronAPI.tools.cancelFocus()
      await loadShellSnapshot()
      return focusState.value
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const createReminderRule = async (input) => {
    if (!available.value) return null
    loading.value = true
    error.value = ''
    try {
      const rule = await window.electronAPI.tools.createReminderRule(input)
      await loadReminderRules()
      await loadShellSnapshot()
      return rule
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateReminderRule = async (ruleId, updates) => {
    if (!available.value) return null
    error.value = ''
    try {
      const rule = await window.electronAPI.tools.updateReminderRule(ruleId, updates)
      await loadReminderRules()
      await loadShellSnapshot()
      return rule
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const deleteReminderRule = async (ruleId) => {
    if (!available.value) return null
    error.value = ''
    try {
      const result = await window.electronAPI.tools.deleteReminderRule(ruleId)
      await loadReminderRules()
      await loadShellSnapshot()
      return result
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const getClaimOptions = async (claimId) => {
    if (!available.value) return null
    return window.electronAPI.tools.getClaimOptions(claimId)
  }

  const placeItem = async (inventoryId, slotId) => {
    if (!available.value) return null
    error.value = ''
    try {
      const placement = await window.electronAPI.tools.placeItem(inventoryId, slotId)
      await loadGardenView()
      return placement
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const removePlacement = async (inventoryId) => {
    if (!available.value) return null
    error.value = ''
    try {
      const placement = await window.electronAPI.tools.removePlacement(inventoryId)
      await loadGardenView()
      return placement
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const claimReward = async (claimId, selectedItemId = null) => {
    if (!available.value) return null
    loading.value = true
    error.value = ''
    try {
      const result = await window.electronAPI.tools.claimReward(claimId, selectedItemId)
      await loadGardenView()
      await loadShellSnapshot()
      return result
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    shellSnapshot,
    gardenView,
    reminderRules,
    focusState,
    loading,
    error,
    available,
    pendingRewards,
    loadShellSnapshot,
    loadGardenView,
    loadReminderRules,
    loadFocusState,
    createReminderRule,
    updateReminderRule,
    deleteReminderRule,
    startFocus,
    pauseFocus,
    resumeFocus,
    cancelFocus,
    getClaimOptions,
    claimReward,
    placeItem,
    removePlacement
  }
})
