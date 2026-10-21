import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useToolsStore = defineStore('tools', () => {
  const shellSnapshot = ref(null)
  const gardenView = ref(null)
  const reminderRules = ref([])
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

  const getClaimOptions = async (claimId) => {
    if (!available.value) return null
    return window.electronAPI.tools.getClaimOptions(claimId)
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
    loading,
    error,
    available,
    pendingRewards,
    loadShellSnapshot,
    loadGardenView,
    loadReminderRules,
    createReminderRule,
    updateReminderRule,
    getClaimOptions,
    claimReward
  }
})
