import { ref, readonly } from 'vue'

// 可用的颜色主题
const availableColorThemes = [
  {
    id: 'default',
    name: '默认蓝色',
    description: '经典的蓝色主题',
    primaryColor: '#3b82f6'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    description: 'Twitter 风格主题',
    primaryColor: '#1e9df1'
  },
  // {
  //   id: 'vercel',
  //   name: 'Vercel',
  //   description: 'Vercel 极简黑白主题',
  //   primaryColor: '#000000'
  // },
  {
    id: 'morandi',
    name: 'Morandi Mist',
    description: '莫兰迪雾霾蓝主题，柔和优雅',
    primaryColor: '#7a9cc6'
  },
  {
    id: 'mint-green',
    name: '薄荷绿',
    description: '清新薄荷绿主题，自然舒缓',
    primaryColor: '#8bc5a0'
  }
]

// 当前选中的颜色主题
const currentColorTheme = ref('default')

// 动态加载的样式元素
let currentThemeStyleElement = null

// Cross-window communication for color theme
let colorThemeBroadcastChannel = null
let colorThemeStorageListener = null

// 主题文件映射
const themeModules = {
  default: () => import('@/assets/styles/themes/default.css?raw'),
  twitter: () => import('@/assets/styles/themes/twitter.css?raw'),
  vercel: () => import('@/assets/styles/themes/vercel.css?raw'),
  morandi: () => import('@/assets/styles/themes/morandi.css?raw'),
  'mint-green': () => import('@/assets/styles/themes/mint-green.css?raw')
}

// Initialize broadcast channel for color theme cross-window communication
const initializeColorThemeBroadcastChannel = () => {
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    try {
      colorThemeBroadcastChannel = new BroadcastChannel('color-theme-sync')

      colorThemeBroadcastChannel.addEventListener('message', (event) => {
        if (event.data.type === 'color-theme-change') {
          const { colorTheme } = event.data
          if (colorTheme !== currentColorTheme.value) {
            currentColorTheme.value = colorTheme
            loadThemeStyles(colorTheme)
          }
        }
      })
    } catch (error) {
      console.warn('BroadcastChannel not supported for color theme:', error)
    }
  }
}

// Broadcast color theme change to other windows
const broadcastColorThemeChange = (colorTheme) => {
  if (colorThemeBroadcastChannel) {
    try {
      colorThemeBroadcastChannel.postMessage({
        type: 'color-theme-change',
        colorTheme: colorTheme,
        timestamp: Date.now()
      })
    } catch (error) {
      console.warn('Failed to broadcast color theme change:', error)
    }
  }
}

// Listen for localStorage changes for color theme (fallback for cross-window sync)
const initializeColorThemeStorageListener = () => {
  if (typeof window !== 'undefined') {
    colorThemeStorageListener = (event) => {
      if (event.key === 'colorTheme' && event.newValue) {
        const newColorTheme = event.newValue
        if (availableColorThemes.find(theme => theme.id === newColorTheme) && newColorTheme !== currentColorTheme.value) {
          currentColorTheme.value = newColorTheme
          loadThemeStyles(newColorTheme)
        }
      }
    }

    window.addEventListener('storage', colorThemeStorageListener)
  }
}

// 加载主题样式
const loadThemeStyles = async (themeId) => {
  try {
    // 移除之前的主题样式
    if (currentThemeStyleElement) {
      currentThemeStyleElement.remove()
      currentThemeStyleElement = null
    }

    // 检查主题是否存在
    if (!themeModules[themeId]) {
      throw new Error(`主题 ${themeId} 不存在`)
    }

    // 动态导入主题文件
    const themeModule = await themeModules[themeId]()
    const cssText = themeModule.default

    // 创建新的样式元素
    currentThemeStyleElement = document.createElement('style')
    currentThemeStyleElement.setAttribute('data-theme', themeId)
    currentThemeStyleElement.textContent = cssText

    // 添加到 head
    document.head.appendChild(currentThemeStyleElement)

    console.log(`主题 ${themeId} 加载成功`)
  } catch (error) {
    console.error(`加载主题 ${themeId} 失败:`, error)

    // 如果加载失败且不是默认主题，回退到默认主题
    if (themeId !== 'default') {
      console.log('回退到默认主题')
      await loadThemeStyles('default')
      currentColorTheme.value = 'default'
    }
  }
}

// 设置颜色主题
const setColorTheme = async (themeId, shouldBroadcast = true) => {
  if (!availableColorThemes.find(theme => theme.id === themeId)) {
    console.warn(`未知的主题 ID: ${themeId}`)
    return
  }

  currentColorTheme.value = themeId
  await loadThemeStyles(themeId)

  // 保存到 localStorage
  localStorage.setItem('colorTheme', themeId)

  // Broadcast to other windows
  if (shouldBroadcast) {
    broadcastColorThemeChange(themeId)
  }

  // 通知其他窗口
  if (window.electronAPI?.theme?.setColorTheme) {
    window.electronAPI.theme.setColorTheme(themeId)
  }
}

// 获取主题信息
const getThemeInfo = (themeId) => {
  return availableColorThemes.find(theme => theme.id === themeId)
}

// 初始化颜色主题
const initializeColorTheme = async () => {
  // 从 localStorage 读取保存的主题
  const savedTheme = localStorage.getItem('colorTheme')

  if (savedTheme && availableColorThemes.find(theme => theme.id === savedTheme)) {
    await setColorTheme(savedTheme, false) // Don't broadcast on initialization
  } else {
    await setColorTheme('default', false)
  }
}

// Cleanup function for color theme
const cleanupColorTheme = () => {
  if (colorThemeBroadcastChannel) {
    colorThemeBroadcastChannel.close()
    colorThemeBroadcastChannel = null
  }

  if (colorThemeStorageListener) {
    window.removeEventListener('storage', colorThemeStorageListener)
    colorThemeStorageListener = null
  }
}

// 导出 composable
export const useColorTheme = () => {
  // Initialize color theme broadcast and storage listeners on first use
  if (!colorThemeBroadcastChannel && typeof window !== 'undefined') {
    initializeColorThemeBroadcastChannel()
    initializeColorThemeStorageListener()
  }

  return {
    availableColorThemes: readonly(ref(availableColorThemes)),
    currentColorTheme: readonly(currentColorTheme),
    setColorTheme,
    getThemeInfo,
    initializeColorTheme,
    cleanupColorTheme
  }
}

// Auto-initialize color theme broadcast when module loads
if (typeof window !== 'undefined') {
  initializeColorThemeBroadcastChannel()
  initializeColorThemeStorageListener()

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanupColorTheme)
}