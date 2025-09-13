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
            <span class="about-version-number">v{{ appVersion }}</span>
            <span v-if="updateStatus === 'available'" class="about-update-badge">
              {{ $t('settings.about.updateAvailable') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 更新检查 -->
    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.about.updateCheck') }}</h3>
      
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.about.checkForUpdates') }}</div>
          <div class="setting-item-description">
            <span v-if="updateStatus === 'checking'">{{ $t('settings.about.checkingUpdates') }}</span>
            <span v-else-if="updateStatus === 'latest'">{{ $t('settings.about.upToDate') }}</span>
            <span v-else-if="updateStatus === 'available'">
              {{ $t('settings.newVersionAvailable', { version: latestVersion }) }}
            </span>
            <span v-else-if="updateStatus === 'error'">{{ $t('settings.about.updateCheckError') }}</span>
            <span v-else>{{ $t('settings.clickToCheck') }}</span>
          </div>
        </div>
        <div class="setting-item-control">
          <button 
            class="setting-btn setting-btn-primary"
            :disabled="updateStatus === 'checking'"
            @click="checkForUpdates"
          >
            <i v-if="updateStatus === 'checking'" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-sync-alt"></i>
            {{ updateStatus === 'checking' ? $t('settings.about.checking') : $t('settings.about.checkNow') }}
          </button>
        </div>
      </div>

      <!-- 下载更新按钮 -->
      <div v-if="updateStatus === 'available'" class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">{{ $t('settings.about.downloadUpdate') }}</div>
          <div class="setting-item-description">{{ $t('settings.about.downloadUpdateDescription') }}</div>
        </div>
        <div class="setting-item-control">
          <button 
            class="setting-btn setting-btn-primary"
            @click="downloadUpdate"
          >
            <i class="fas fa-download"></i>
            {{ $t('settings.about.download') }}
          </button>
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
          <button 
            class="setting-btn setting-btn-secondary"
            @click="openChangelog"
          >
            <i class="fas fa-external-link-alt"></i>
            {{ $t('settings.about.viewOnGitHub') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 项目信息 -->
    <div class="setting-group">
      <h3 class="setting-group-title">{{ $t('settings.about.projectInfo') }}</h3>
      
      <div class="about-project-links">
        <button class="about-project-link" @click="openLink('https://github.com/gusibi/MoliTodo')">
          <i class="fab fa-github"></i>
          {{ $t('settings.about.githubRepo') }}
        </button>
        <button class="about-project-link" @click="openLink('https://github.com/gusibi/MoliTodo/issues')">
          <i class="fas fa-bug"></i>
          {{ $t('settings.about.reportIssue') }}
        </button>
        <button class="about-project-link" @click="openLink('https://github.com/gusibi/MoliTodo/releases')">
          <i class="fas fa-tag"></i>
          {{ $t('settings.about.releases') }}
        </button>
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
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 响应式数据
const appVersion = ref('1.1.2')
const updateStatus = ref('idle') // idle, checking, latest, available, error
const latestVersion = ref('')
const downloadUrl = ref('')

// 移除不再需要的变更日志相关状态

// 发射事件
const emit = defineEmits(['show-message'])

// 移除不再需要的计算属性

// 方法
const loadAppVersion = async () => {
  try {
    if (window.electronAPI && window.electronAPI.app) {
      const version = await window.electronAPI.app.getVersion()
      appVersion.value = version
    }
  } catch (error) {
    console.error('Failed to load app version:', error)
  }
}

const checkForUpdates = async () => {
  updateStatus.value = 'checking'
  
  try {
    // 检查 GitHub API 获取最新版本
    const response = await fetch('https://api.github.com/repos/gusibi/MoliTodo/releases/latest')
    
    if (!response.ok) {
      throw new Error('Failed to fetch release info')
    }
    
    const releaseData = await response.json()
    const latest = releaseData.tag_name.replace(/^v/, '')
    latestVersion.value = latest
    downloadUrl.value = releaseData.html_url
    
    // 比较版本
    if (compareVersions(latest, appVersion.value) > 0) {
      updateStatus.value = 'available'
      emit('show-message', t('settings.about.updateFound', { version: latest }), 'info')
    } else {
      updateStatus.value = 'latest'
      emit('show-message', t('settings.about.upToDateMessage'), 'success')
    }
  } catch (error) {
    console.error('Update check failed:', error)
    updateStatus.value = 'error'
    emit('show-message', t('settings.about.updateCheckFailed'), 'error')
  }
}

const downloadUpdate = async () => {
  if (downloadUrl.value) {
    await openLink(downloadUrl.value)
  }
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

const compareVersions = (a, b) => {
  const aParts = a.split('.').map(Number)
  const bParts = b.split('.').map(Number)
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0
    const bPart = bParts[i] || 0
    
    if (aPart > bPart) return 1
    if (aPart < bPart) return -1
  }
  
  return 0
}

// 生命周期
onMounted(async () => {
  await loadAppVersion()
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

/* 移除不再需要的变更日志样式 */

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