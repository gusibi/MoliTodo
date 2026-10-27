<template>
  <div>
    <h1 class="setting-page-title">{{ $t('settings.aboutName') }}</h1>
    <p class="setting-page-description">{{ $t('settings.aboutDescription') }}</p>

    <!-- 应用信息 -->
    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.about.appInfo') }}</h3>
      
      <!-- 应用图标和基本信息 -->
      <div class="about-app-info">
        <div class="about-app-details">
          <h3 class="about-app-name">MoliTodo</h3>
          <p class="about-app-description">{{ $t('settings.about.appDescription') }}</p>
          <div class="about-version-info">
            <span class="about-version-label">{{ $t('settings.about.version') }}:</span>
            <span class="about-version-number">v{{ currentVersion }}</span>
            <span v-if="hasNewVersion" class="about-update-badge">
              {{ $t('settings.about.updateAvailable') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 更新检查 -->
    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.about.updateCheck') }}</h3>

      <div class="about-update-card">
        <div class="about-update-head">
          <div class="about-update-heading">
            <span class="setting-item-label">{{ statusTitle }}</span>
            <span v-if="showVersionTag" class="about-update-version-tag">v{{ updateState.newVersion }}</span>
          </div>
          <span class="about-update-current">{{ $t('settings.about.currentVersion') }} v{{ currentVersion }}</span>
        </div>

        <p class="about-update-description">{{ statusDescription }}</p>

        <div v-if="isDownloading" class="about-update-progress">
          <div class="about-update-progress-track">
            <div class="about-update-progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div class="about-update-progress-meta">
            <span>{{ progressPercent }}%</span>
            <span v-if="totalBytes > 0">{{ downloadedText }} / {{ totalText }}</span>
          </div>
        </div>

        <div v-if="isTranslocated" class="about-update-warning">
          <TriangleAlert class="h-icon-sm w-icon-sm" aria-hidden="true" />
          <span>{{ $t('settings.about.translocationWarning') }}</span>
        </div>

        <div v-if="showReleaseNotes" class="about-update-notes">
          <div class="about-update-notes-title">{{ $t('settings.about.releaseNotes') }}</div>
          <pre class="about-update-notes-body">{{ updateState.releaseNotes }}</pre>
        </div>

        <p v-if="isReady" class="about-update-hint">{{ $t('settings.about.restartHint') }}</p>

        <div class="about-update-actions">
          <Button
            v-if="isAvailable"
            variant="default"
            class="setting-btn setting-btn-primary"
            :disabled="busy"
            @click="downloadUpdate"
          >
            <Download class="h-icon-sm w-icon-sm" aria-hidden="true" />
            {{ $t('settings.about.downloadAndInstall') }}
          </Button>

          <Button
            v-if="isReady"
            variant="default"
            class="setting-btn setting-btn-primary"
            :disabled="busy"
            @click="installUpdate"
          >
            <RotateCw class="h-icon-sm w-icon-sm" aria-hidden="true" />
            {{ $t('settings.about.restartToUpdate') }}
          </Button>

          <Button
            v-if="!isReady && !isDownloading && !isInstalling"
            variant="secondary"
            class="setting-btn setting-btn-secondary"
            :loading="isChecking"
            :disabled="isChecking"
            @click="checkForUpdates"
          >
            <RefreshCw v-if="!isChecking" class="h-icon-sm w-icon-sm" aria-hidden="true" />
            {{ isChecking ? $t('settings.about.checking') : $t('settings.about.checkNow') }}
          </Button>

          <Button
            variant="outline"
            class="setting-btn about-update-link"
            @click="openReleasePage"
          >
            <ExternalLink class="h-icon-sm w-icon-sm" aria-hidden="true" />
            {{ $t('settings.about.openReleasePage') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- 变更日志 -->
    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.about.changelog') }}</h3>
      
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.about.viewChangelog') }}</div>
          <div class="setting-item-description">{{ $t('settings.about.changelogDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <Button 
            variant="secondary"
            class="setting-btn setting-btn-secondary"
            @click="openChangelog"
          >
            <ExternalLink class="h-icon-sm w-icon-sm" aria-hidden="true" />
            {{ $t('settings.about.viewOnGitHub') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- 项目信息 -->
    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.about.projectInfo') }}</h3>
      
      <div class="about-project-links">
        <Button variant="outline" class="about-project-link" @click="openLink('https://github.com/gusibi/MoliTodo')">
          <Code2 class="h-icon-sm w-icon-sm" aria-hidden="true" />
          {{ $t('settings.about.githubRepo') }}
        </Button>
        <Button variant="outline" class="about-project-link"
          @click="openLink('https://github.com/gusibi/MoliTodo/issues')">
          <Bug class="h-icon-sm w-icon-sm" aria-hidden="true" />
          {{ $t('settings.about.reportIssue') }}
        </Button>
        <Button variant="outline" class="about-project-link"
          @click="openLink('https://github.com/gusibi/MoliTodo/releases')">
          <Tag class="h-icon-sm w-icon-sm" aria-hidden="true" />
          {{ $t('settings.about.releases') }}
        </Button>
      </div>
      
      <div class="about-project-info">
        <div class="about-info-item">
          <span class="about-info-label">{{ $t('settings.about.license') }}:</span>
          <span class="about-info-value">MIT</span>
        </div>
        <div class="about-info-item">
          <span class="about-info-label">{{ $t('settings.about.author') }}:</span>
          <span class="about-info-value">MoliTodo Team</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Bug,
  Code2,
  Download,
  ExternalLink,
  RefreshCw,
  RotateCw,
  Tag,
  TriangleAlert
} from '@lucide/vue'
import Button from '../ui/button/Button.vue'

const { t } = useI18n()

const emit = defineEmits(['show-message'])

const appVersion = ref('')
const updateState = ref({
  status: 'idle',
  currentVersion: '',
  newVersion: null,
  releaseNotes: '',
  releaseDate: '',
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  error: null,
  isTranslocated: false,
  releaseUrl: 'https://github.com/gusibi/MoliTodo/releases'
})

let unsubscribeUpdateState = null

const currentVersion = computed(() => updateState.value.currentVersion || appVersion.value || '-')
const status = computed(() => updateState.value.status || 'idle')
const isChecking = computed(() => status.value === 'checking')
const isDownloading = computed(() => status.value === 'downloading')
const isInstalling = computed(() => status.value === 'installing')
const isReady = computed(() => status.value === 'ready')
const isAvailable = computed(() => status.value === 'available')
const isTranslocated = computed(() => Boolean(updateState.value.isTranslocated))
const busy = computed(() => isChecking.value || isDownloading.value || isInstalling.value)
const hasNewVersion = computed(() =>
  Boolean(updateState.value.newVersion) &&
  ['available', 'downloading', 'ready', 'installing'].includes(status.value)
)
// 标题已包含版本号，下载/就绪状态再单列一个版本标签
const showVersionTag = computed(() =>
  Boolean(updateState.value.newVersion) && ['downloading', 'ready'].includes(status.value)
)

const progressPercent = computed(() => Math.min(100, Math.max(0, Math.round(updateState.value.progress || 0))))
const totalBytes = computed(() => updateState.value.totalBytes || 0)

const showReleaseNotes = computed(() =>
  Boolean(updateState.value.releaseNotes) &&
  ['available', 'ready'].includes(status.value)
)

const statusTitle = computed(() => {
  switch (status.value) {
    case 'checking':
      return t('settings.about.checkingUpdates')
    case 'up-to-date':
      return t('settings.about.upToDate')
    case 'available':
      return t('settings.about.updateFound', { version: updateState.value.newVersion })
    case 'downloading':
      return t('settings.about.downloadingUpdate')
    case 'ready':
      return t('settings.about.updateReady')
    case 'installing':
      return t('settings.about.installingUpdate')
    case 'error':
      return t('settings.about.updateCheckError')
    default:
      return t('settings.about.checkForUpdates')
  }
})

const statusDescription = computed(() => {
  switch (status.value) {
    case 'checking':
      return t('settings.about.checkingUpdates')
    case 'up-to-date':
      return t('settings.about.upToDateMessage')
    case 'available':
      return t('settings.about.updateAvailableDescription')
    case 'downloading':
      return t('settings.about.downloadingUpdateDescription')
    case 'ready':
      return t('settings.about.updateReadyDescription')
    case 'installing':
      return t('settings.about.installingUpdateDescription')
    case 'error':
      return updateState.value.error || t('settings.about.updateCheckFailed')
    default:
      return t('settings.clickToCheck')
  }
})

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 MB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const downloadedText = computed(() => formatBytes(updateState.value.downloadedBytes))
const totalText = computed(() => formatBytes(totalBytes.value))

const applyState = (state) => {
  if (!state) return
  updateState.value = { ...updateState.value, ...state }
}

const refreshState = async () => {
  if (!window.electronAPI || !window.electronAPI.updates) return
  try {
    const state = await window.electronAPI.updates.getState()
    applyState(state)
  } catch (error) {
    console.error('Failed to load update state:', error)
  }
}

const loadAppVersion = async () => {
  try {
    if (window.electronAPI && window.electronAPI.app) {
      appVersion.value = await window.electronAPI.app.getVersion()
    }
  } catch (error) {
    console.error('Failed to load app version:', error)
  }
}

const checkForUpdates = async () => {
  if (!window.electronAPI || !window.electronAPI.updates) {
    emit('show-message', t('settings.about.updateCheckFailed'), 'error')
    return
  }

  try {
    const state = await window.electronAPI.updates.check()
    applyState(state)

    if (!state) return
    if (state.status === 'available') {
      emit('show-message', t('settings.about.updateFound', { version: state.newVersion }), 'info')
    } else if (state.status === 'up-to-date') {
      emit('show-message', t('settings.about.upToDateMessage'), 'success')
    } else if (state.status === 'error') {
      emit('show-message', state.error || t('settings.about.updateCheckFailed'), 'error')
    }
  } catch (error) {
    console.error('Update check failed:', error)
    emit('show-message', t('settings.about.updateCheckFailed'), 'error')
  }
}

const downloadUpdate = async () => {
  if (!window.electronAPI || !window.electronAPI.updates) return
  try {
    const state = await window.electronAPI.updates.download()
    applyState(state)
    if (state && state.status === 'error') {
      emit('show-message', state.error || t('settings.about.updateDownloadFailed'), 'error')
    }
  } catch (error) {
    console.error('Update download failed:', error)
    emit('show-message', t('settings.about.updateDownloadFailed'), 'error')
  }
}

const installUpdate = async () => {
  if (!window.electronAPI || !window.electronAPI.updates) return
  try {
    const state = await window.electronAPI.updates.install()
    applyState(state)
    if (state && state.status === 'error') {
      emit('show-message', state.error || t('settings.about.updateInstallFailed'), 'error')
    }
  } catch (error) {
    console.error('Update install failed:', error)
    emit('show-message', t('settings.about.updateInstallFailed'), 'error')
  }
}

const openReleasePage = async () => {
  await openLink(updateState.value.releaseUrl || 'https://github.com/gusibi/MoliTodo/releases')
}

const openChangelog = async () => {
  await openLink('https://github.com/gusibi/MoliTodo/blob/main/CHANGELOG.md')
}

const openLink = async (url) => {
  try {
    if (window.electronAPI && window.electronAPI.app && window.electronAPI.app.openExternal) {
      const result = await window.electronAPI.app.openExternal(url)
      if (!result.success) {
        console.error('Failed to open external URL:', result.error)
        // 降级到window.open
        window.open(url, '_blank')
      }
    } else {
      // 降级到window.open
      window.open(url, '_blank')
    }
  } catch (error) {
    console.error('Error opening external URL:', error)
    // 降级到window.open
    window.open(url, '_blank')
  }
}

// 生命周期
onMounted(async () => {
  await loadAppVersion()
  await refreshState()

  if (window.electronAPI && window.electronAPI.updates) {
    unsubscribeUpdateState = window.electronAPI.updates.onStateChange(applyState)
  }
})

onUnmounted(() => {
  if (unsubscribeUpdateState) {
    unsubscribeUpdateState()
    unsubscribeUpdateState = null
  }
})
</script>

<style scoped>
/* 应用信息样式 */
.about-app-info {
  @apply flex items-start gap-4 p-4 bg-muted rounded-lg border border-border;
}

.about-app-icon {
  @apply flex-shrink-0;
}

.about-icon-image {
  @apply w-16 h-16 rounded-lg object-cover;
}

.about-app-details {
  @apply flex-1;
}

.about-app-name {
  @apply text-lg font-bold text-foreground mb-1;
}

.about-app-description {
  @apply text-xs text-muted-foreground mb-3;
}

.about-version-info {
  @apply flex items-center gap-2 text-sm;
}

.about-version-label {
  @apply text-xs font-medium text-foreground;
}

.about-version-number {
  @apply text-2xs font-mono bg-secondary text-secondary-foreground px-2 py-1 rounded;
}

.about-update-badge {
  @apply text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full;
}

/* 更新卡片 */
.about-update-card {
  @apply flex flex-col gap-3 p-4 bg-muted rounded-lg border border-border;
}

.about-update-head {
  @apply flex items-center justify-between gap-2 flex-wrap;
}

.about-update-heading {
  @apply flex items-center gap-2 min-w-0;
}

.about-update-version-tag {
  @apply text-2xs font-mono bg-primary/15 text-primary px-2 py-1 rounded;
}

.about-update-current {
  @apply text-2xs text-muted-foreground font-mono;
}

.about-update-description {
  @apply text-xs text-muted-foreground m-0;
  white-space: pre-wrap;
  word-break: break-word;
}

.about-update-progress {
  @apply flex flex-col gap-1;
}

.about-update-progress-track {
  @apply w-full h-2 bg-secondary rounded-full overflow-hidden;
}

.about-update-progress-fill {
  @apply h-full bg-primary rounded-full transition-all duration-200;
}

.about-update-progress-meta {
  @apply flex items-center justify-between text-2xs text-muted-foreground;
  font-variant-numeric: tabular-nums;
}

.about-update-warning {
  @apply flex items-start gap-2 p-2 rounded-md border border-border bg-background text-xs text-muted-foreground;
}

.about-update-warning :deep(svg) {
  @apply flex-shrink-0 text-amber-500 mt-0.5;
}

.about-update-notes {
  @apply flex flex-col gap-1;
}

.about-update-notes-title {
  @apply text-2xs font-medium text-muted-foreground;
}

.about-update-notes-body {
  @apply m-0 max-h-40 overflow-y-auto p-2 rounded-md border border-border bg-background text-2xs text-foreground;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.about-update-hint {
  @apply text-2xs text-muted-foreground m-0;
}

.about-update-actions {
  @apply flex flex-wrap items-center gap-2;
}

.about-update-link {
  @apply bg-transparent text-muted-foreground hover:text-foreground;
}

/* 项目链接样式 */
.about-project-links {
  @apply flex flex-wrap gap-3 mb-4;
}

.about-project-link {
  @apply inline-flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-primary/80;
  @apply border border-border rounded-md hover:bg-muted transition-colors duration-200;
  @apply bg-transparent cursor-pointer;
  text-decoration: none;
}

.about-project-info {
  @apply space-y-2;
}

.about-info-item {
  @apply flex items-center gap-2;
}

.about-info-label {
  @apply text-sm font-medium text-muted-foreground min-w-16;
}

.about-info-value {
  @apply text-sm text-foreground;
}
</style>
