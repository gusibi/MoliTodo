<template>
  <div>
    <h1 class="setting-page-title">{{ t('settings.api.title') }}</h1>
    <p class="setting-page-description">{{ t('settings.api.description') }}</p>

    <div class="setting-group">
      <h3 class="setting-group-title">{{ t('settings.api.serviceSection') }}</h3>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ t('settings.api.enableService') }}</div>
          <div class="setting-item-description">{{ t('settings.api.enableServiceDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <button
            class="setting-toggle"
            :class="{ 'setting-toggle-active': apiConfig.enabled }"
            @click="toggleService"
          >
            <span class="setting-toggle-button"></span>
          </button>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ t('settings.api.port') }}</div>
          <div class="setting-item-description">{{ t('settings.api.portDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <div class="setting-api-port-group">
            <input
              v-model="portInput"
              type="number"
              min="1"
              max="65535"
              class="setting-select setting-api-port-input"
              @change="savePort"
            />
            <button class="setting-btn setting-btn-small" @click="refreshState">
              {{ t('settings.api.refreshStatus') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="setting-group">
      <h3 class="setting-group-title">{{ t('settings.api.statusSection') }}</h3>
      <div class="setting-api-status-card">
        <div class="setting-api-status-row">
          <span class="setting-api-status-label">{{ t('settings.api.currentStatus') }}</span>
          <span
            class="setting-api-status-badge"
            :class="{
              'setting-api-status-badge-active': serverState.running,
              'setting-api-status-badge-idle': !serverState.running
            }"
          >
            {{ serverState.running ? t('settings.api.running') : t('settings.api.stopped') }}
          </span>
        </div>

        <div class="setting-api-link-block">
          <div class="setting-api-link-label">{{ t('settings.api.baseUrl') }}</div>
          <code class="setting-api-link-value">{{ serverState.baseUrl }}</code>
        </div>

        <div class="setting-api-link-block">
          <div class="setting-api-link-label">{{ t('settings.api.docsUrl') }}</div>
          <code class="setting-api-link-value">{{ serverState.docsUrl }}</code>
        </div>

        <div class="setting-api-link-block">
          <div class="setting-api-link-label">{{ t('settings.api.openApiUrl') }}</div>
          <code class="setting-api-link-value">{{ serverState.openApiUrl }}</code>
        </div>

        <div v-if="serverState.lastError" class="setting-api-error">
          {{ serverState.lastError }}
        </div>
      </div>
    </div>

    <div class="setting-group">
      <h3 class="setting-group-title">{{ t('settings.api.skillSection') }}</h3>
      <p class="setting-group-description">{{ t('settings.api.skillDescription') }}</p>
      <div class="setting-api-tip-list">
        <div class="setting-api-tip-item">{{ t('settings.api.skillTipHealth') }}</div>
        <div class="setting-api-tip-item">{{ t('settings.api.skillTipDocs') }}</div>
        <div class="setting-api-tip-item">{{ t('settings.api.skillTipTasks') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:config', 'show-message'])

const serverState = reactive({
  enabled: false,
  running: false,
  host: '127.0.0.1',
  port: 1234,
  baseUrl: 'http://127.0.0.1:1234',
  docsUrl: 'http://127.0.0.1:1234/api/docs',
  openApiUrl: 'http://127.0.0.1:1234/api/openapi.json',
  lastError: null
})

const apiConfig = computed(() => {
  if (!props.config.apiServer) {
    props.config.apiServer = {
      enabled: false,
      host: '127.0.0.1',
      port: 1234
    }
  }

  return props.config.apiServer
})

const portInput = ref(String(apiConfig.value.port || 1234))

watch(
  () => apiConfig.value.port,
  (value) => {
    portInput.value = String(value || 1234)
  }
)

const updateConfig = async (key, value) => {
  emit('update:config', key, value)
}

const refreshState = async () => {
  try {
    const state = await window.electronAPI?.localApi?.getState()
    Object.assign(serverState, state || {})
  } catch (error) {
    console.error('Failed to refresh local api state:', error)
    serverState.lastError = error.message
  }
}

const syncServer = async () => {
  try {
    const state = await window.electronAPI?.localApi?.sync()
    Object.assign(serverState, state || {})
  } catch (error) {
    console.error('Failed to sync local api server:', error)
    emit('show-message', error.message || t('settings.api.updateFailed'), 'error')
    await refreshState()
  }
}

const toggleService = async () => {
  try {
    const nextValue = !apiConfig.value.enabled
    apiConfig.value.enabled = nextValue
    await updateConfig('apiServer.enabled', nextValue)
    await syncServer()
    emit('show-message', nextValue ? t('settings.api.started') : t('settings.api.stoppedMessage'), 'success')
  } catch (error) {
    console.error('Failed to toggle local api:', error)
    emit('show-message', t('settings.api.updateFailed'), 'error')
  }
}

const savePort = async () => {
  const nextPort = Number.parseInt(portInput.value, 10)

  if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) {
    emit('show-message', t('settings.api.invalidPort'), 'error')
    portInput.value = String(apiConfig.value.port || 1234)
    return
  }

  try {
    apiConfig.value.port = nextPort
    await updateConfig('apiServer.port', nextPort)
    await syncServer()
    emit('show-message', t('settings.api.portSaved'), 'success')
  } catch (error) {
    console.error('Failed to update local api port:', error)
    emit('show-message', t('settings.api.updateFailed'), 'error')
  }
}

onMounted(async () => {
  await refreshState()
})
</script>

<style scoped>
@import '@/assets/styles/components/settings.css';
</style>
