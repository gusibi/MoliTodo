import { ref, readonly } from 'vue'
import { useColorTheme } from './useColorTheme'

// Theme state
const currentTheme = ref('system')
const isDark = ref(false)

// Available themes
const themes = {
  system: 'system',
  light: 'light',
  dark: 'dark'
}

// Cross-window communication
let broadcastChannel = null
let storageListener = null

// Initialize broadcast channel for cross-window communication
const initializeBroadcastChannel = () => {
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel('theme-sync')
      
      broadcastChannel.addEventListener('message', (event) => {
        if (event.data.type === 'theme-change') {
          const { theme } = event.data
          if (theme !== currentTheme.value) {
            currentTheme.value = theme
            applyThemeToDOM(theme)
          }
        }
      })
    } catch (error) {
      console.warn('BroadcastChannel not supported:', error)
    }
  }
}

// Broadcast theme change to other windows
const broadcastThemeChange = (theme) => {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'theme-change',
        theme: theme,
        timestamp: Date.now()
      })
    } catch (error) {
      console.warn('Failed to broadcast theme change:', error)
    }
  }
}

// Listen for localStorage changes (fallback for cross-window sync)
const initializeStorageListener = () => {
  if (typeof window !== 'undefined') {
    storageListener = (event) => {
      if (event.key === 'theme' && event.newValue) {
        const newTheme = event.newValue
        if (Object.values(themes).includes(newTheme) && newTheme !== currentTheme.value) {
          currentTheme.value = newTheme
          applyThemeToDOM(newTheme)
        }
      }
    }
    
    window.addEventListener('storage', storageListener)
  }
}

// Get system preference
const getSystemPreference = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Apply theme to DOM
const applyThemeToDOM = (theme) => {
  const root = document.documentElement
  
  // Remove existing theme classes
  root.classList.remove('dark', 'light')
  
  let actualTheme = theme
  if (theme === 'system') {
    actualTheme = getSystemPreference()
  }
  
  // Add appropriate class for Tailwind CSS
  if (actualTheme === 'dark') {
    root.classList.add('dark')
    isDark.value = true
  } else {
    root.classList.add('light')
    isDark.value = false
  }
  
  // Also set data-theme attribute for compatibility
  root.setAttribute('data-theme', actualTheme)
}

// Initialize theme from localStorage or system preference
const initializeTheme = async () => {
  const savedTheme = localStorage.getItem('theme')
  
  if (savedTheme && Object.values(themes).includes(savedTheme)) {
    setTheme(savedTheme, false) // Don't broadcast on initialization
  } else {
    setTheme(themes.system, false)
  }
  
  // 初始化颜色主题
  const { initializeColorTheme } = useColorTheme()
  await initializeColorTheme()
}

// Set theme
const setTheme = (theme, shouldBroadcast = true) => {
  if (!Object.values(themes).includes(theme)) {
    console.warn(`Invalid theme: ${theme}`)
    return
  }
  
  currentTheme.value = theme
  applyThemeToDOM(theme)
  
  // Save to localStorage
  localStorage.setItem('theme', theme)
  
  // Broadcast to other windows
  if (shouldBroadcast) {
    broadcastThemeChange(theme)
  }
  
  // Notify electron main process if available
  if (window.electronAPI?.theme?.setTheme) {
    window.electronAPI.theme.setTheme(theme)
  }
}

// Toggle between light and dark theme
const toggleTheme = () => {
  const newTheme = currentTheme.value === themes.light ? themes.dark : themes.light
  setTheme(newTheme)
}

// Watch for system theme changes
const watchSystemTheme = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  const handleChange = () => {
    // Only auto-switch if current theme is system
    if (currentTheme.value === themes.system) {
      applyThemeToDOM(themes.system)
      // Broadcast system theme change to other windows
      broadcastThemeChange(themes.system)
    }
  }
  
  mediaQuery.addEventListener('change', handleChange)
  
  // Return cleanup function
  return () => mediaQuery.removeEventListener('change', handleChange)
}

// Cleanup function
const cleanup = () => {
  if (broadcastChannel) {
    broadcastChannel.close()
    broadcastChannel = null
  }
  
  if (storageListener) {
    window.removeEventListener('storage', storageListener)
    storageListener = null
  }
}

// Composable hook
export const useTheme = () => {
  // Initialize theme on first use
  if (!document.documentElement.hasAttribute('data-theme')) {
    initializeTheme()
    watchSystemTheme()
    initializeBroadcastChannel()
    initializeStorageListener()
  }
  
  const { availableColorThemes, currentColorTheme, setColorTheme, getThemeInfo } = useColorTheme()
  
  return {
    currentTheme: readonly(currentTheme),
    isDark: readonly(isDark),
    themes,
    setTheme,
    toggleTheme,
    initializeTheme,
    getSystemPreference,
    cleanup,
    // 颜色主题相关
    availableColorThemes,
    currentColorTheme,
    setColorTheme,
    getThemeInfo
  }
}

// Auto-initialize theme when module loads
if (typeof window !== 'undefined') {
  initializeTheme()
  watchSystemTheme()
  initializeBroadcastChannel()
  initializeStorageListener()
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup)
}