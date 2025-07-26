import { ref, readonly } from 'vue'

// Theme state
const currentTheme = ref('light')
const isDark = ref(false)

// Available themes
const themes = {
  light: 'light',
  dark: 'dark'
}

// Initialize theme from localStorage or system preference
const initializeTheme = () => {
  const savedTheme = localStorage.getItem('theme')
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  
  if (savedTheme && Object.values(themes).includes(savedTheme)) {
    setTheme(savedTheme)
  } else if (systemPrefersDark) {
    setTheme(themes.dark)
  } else {
    setTheme(themes.light)
  }
}

// Set theme
const setTheme = (theme) => {
  if (!Object.values(themes).includes(theme)) {
    console.warn(`Invalid theme: ${theme}`)
    return
  }
  
  currentTheme.value = theme
  isDark.value = theme === themes.dark
  
  // Apply theme to document
  document.documentElement.setAttribute('data-theme', theme)
  
  // Save to localStorage
  localStorage.setItem('theme', theme)
  
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
  
  const handleChange = (e) => {
    // Only auto-switch if user hasn't manually set a theme
    const savedTheme = localStorage.getItem('theme')
    if (!savedTheme) {
      setTheme(e.matches ? themes.dark : themes.light)
    }
  }
  
  mediaQuery.addEventListener('change', handleChange)
  
  // Return cleanup function
  return () => mediaQuery.removeEventListener('change', handleChange)
}

// Composable hook
export const useTheme = () => {
  // Initialize theme on first use
  if (!document.documentElement.hasAttribute('data-theme')) {
    initializeTheme()
    watchSystemTheme()
  }
  
  return {
    currentTheme: readonly(currentTheme),
    isDark: readonly(isDark),
    themes,
    setTheme,
    toggleTheme,
    initializeTheme
  }
}

// Auto-initialize theme when module loads
if (typeof window !== 'undefined') {
  initializeTheme()
  watchSystemTheme()
}