<template>
  <div ref="containerRef" class="menubar-panel-container">
    <!-- 日历视图：默认选中今天，标题行自带上月/下月切换；拉伸填满面板宽度，窗口高度随后按内容收缩 -->
    <Calendar v-model="selectedDate" :locale="calendarLocale" :calendar-label="$t('calendar.title')" stretch />

    <div class="menubar-panel-divider"></div>

    <nav class="menubar-panel-menu" aria-label="MoliTodo">
      <button type="button" class="menubar-panel-menu-item" @click="openGarden">
        <Sprout class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <span>{{ $t('tools.garden') }}</span>
        <span v-if="pendingRewards > 0" class="menubar-panel-menu-badge">
          {{ pendingRewards > 99 ? '99+' : pendingRewards }}
        </span>
      </button>

      <button type="button" class="menubar-panel-menu-item" @click="toggleFocusWidget">
        <Timer class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <span>{{ focusWidgetVisible ? $t('menuBar.hideFocusWidget') : $t('menuBar.showFocusWidget') }}</span>
      </button>

      <button type="button" class="menubar-panel-menu-item" @click="toggleFloatingIcon">
        <EyeOff v-if="floatingIconVisible" class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <Eye v-else class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <span>{{ floatingIconVisible ? $t('menuBar.hideFloatingIcon') : $t('menuBar.showFloatingIcon') }}</span>
      </button>

      <button type="button" class="menubar-panel-menu-item" @click="openTaskManager">
        <ListTodo class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <span>{{ $t('menuBar.taskManager') }}</span>
        <span v-if="todayTaskCount > 0" class="menubar-panel-menu-badge">
          {{ todayTaskCount > 99 ? '99+' : todayTaskCount }}
        </span>
      </button>

      <button type="button" class="menubar-panel-menu-item" @click="openSettings">
        <Settings class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <span>{{ $t('menuBar.settings') }}</span>
      </button>

      <div class="menubar-panel-divider"></div>

      <button type="button" class="menubar-panel-menu-item" @click="quitApp">
        <LogOut class="h-icon-sm w-icon-sm" aria-hidden="true" />
        <span>{{ $t('menuBar.quit') }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff, ListTodo, LogOut, Settings, Sprout, Timer } from '@lucide/vue'
import Calendar from '@/components/ui/calendar/Calendar.vue'
import { localeCode } from '@/utils/locale-format.js'
import { isTaskToday } from '@/utils/task-time-rules.js'

/**
 * 菜单栏下拉面板：托盘点击弹出的小窗，日历 + 常用菜单入口。
 * 窗口由主进程定位在托盘下方，失焦自动隐藏。
 */
const { locale } = useI18n()
const calendarLocale = computed(() => localeCode(locale.value))

const containerRef = ref(null)
const selectedDate = ref(todayString())
const floatingIconVisible = ref(true)
const focusWidgetVisible = ref(false)
const todayTaskCount = ref(0)
const pendingRewards = ref(0)
let resizeObserver = null

function todayString() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

async function refreshState() {
  try {
    const config = await window.electronAPI.config.get()
    floatingIconVisible.value = config?.floatingIcon?.visible !== false
    focusWidgetVisible.value = config?.focusWidget?.visible === true
  } catch (error) {
    console.warn('读取悬浮图标配置失败:', error)
  }

  try {
    const tasks = await window.electronAPI.tasks.getAll()
    // 与托盘菜单口径一致：今日任务中未完成的数量
    todayTaskCount.value = (tasks || []).filter(task => isTaskToday(task) && task.status !== 'done').length
  } catch (error) {
    console.warn('读取今日任务数量失败:', error)
  }

  try {
    if (window.electronAPI.tools) {
      const snapshot = await window.electronAPI.tools.getShellSnapshot()
      pendingRewards.value = snapshot?.badges?.pendingRewards || 0
    }
  } catch (error) {
    console.warn('读取小院待领取数量失败:', error)
  }
}

function toggleFloatingIcon() {
  floatingIconVisible.value = !floatingIconVisible.value
  window.electronAPI.config.set('floatingIcon.visible', floatingIconVisible.value)
}

function toggleFocusWidget() {
  focusWidgetVisible.value = !focusWidgetVisible.value
  window.electronAPI.config.set('focusWidget.visible', focusWidgetVisible.value)
}

async function openTaskManager() {
  await window.electronAPI.windows.hideMenuBarPanel()
  window.electronAPI.windows.showTaskManager()
}

async function openGarden() {
  await window.electronAPI.windows.hideMenuBarPanel()
  if (window.electronAPI.tools) {
    await window.electronAPI.tools.openGarden()
  } else {
    window.electronAPI.windows.showTaskManager()
  }
}

async function openSettings() {
  await window.electronAPI.windows.hideMenuBarPanel()
  window.electronAPI.windows.showSettings()
}

function quitApp() {
  window.electronAPI.app.quit()
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    window.electronAPI.windows.hideMenuBarPanel()
  }
}

function handleFocusWidgetVisibility(event, visible) {
  focusWidgetVisible.value = Boolean(visible)
}

function handlePanelShown() {
  refreshState()
  // 窗口高度已按上次内容固定，重新展开时再确认一次（月份行数可能已变化）
  reportContentHeight()
}

// 把容器实际高度回传主进程，让面板窗口贴合内容、不残留底部留白
function reportContentHeight() {
  if (!containerRef.value) return
  window.electronAPI.windows.resizeMenuBarPanel(containerRef.value.offsetHeight)
}

onMounted(() => {
  refreshState()
  window.addEventListener('keydown', handleKeydown)
  window.electronAPI.events.on('menubar-panel-shown', handlePanelShown)
  window.electronAPI.events.on('tasks-updated', handlePanelShown)
  window.electronAPI.events.on('tools-updated', refreshState)
  window.electronAPI.events.on('focus-widget-visibility', handleFocusWidgetVisibility)

  resizeObserver = new ResizeObserver(reportContentHeight)
  resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.electronAPI.events.off('menubar-panel-shown', handlePanelShown)
  window.electronAPI.events.off('tasks-updated', handlePanelShown)
  window.electronAPI.events.off('tools-updated', refreshState)
  window.electronAPI.events.off('focus-widget-visibility', handleFocusWidgetVisibility)

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
@import '@/assets/styles/components/menubar-panel.css';
</style>
