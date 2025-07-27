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
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Vercel 极简黑白主题',
    primaryColor: '#000000'
  }
]

// 当前选中的颜色主题
const currentColorTheme = ref('default')

// 动态加载的样式元素
let currentThemeStyleElement = null

// 主题文件映射
const themeModules = {
  default: () => import('../assets/styles/themes/default.css?raw'),
  twitter: () => import('../assets/styles/themes/twitter.css?raw'),
  vercel: () => import('../assets/styles/themes/vercel.css?raw')
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
const setColorTheme = async (themeId) => {
  if (!availableColorThemes.find(theme => theme.id === themeId)) {
    console.warn(`未知的主题 ID: ${themeId}`)
    return
  }

  currentColorTheme.value = themeId
  await loadThemeStyles(themeId)

  // 保存到 localStorage
  localStorage.setItem('colorTheme', themeId)

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
    await setColorTheme(savedTheme)
  } else {
    await setColorTheme('default')
  }
}

// 导出 composable
export const useColorTheme = () => {
  return {
    availableColorThemes: readonly(ref(availableColorThemes)),
    currentColorTheme: readonly(currentColorTheme),
    setColorTheme,
    getThemeInfo,
    initializeColorTheme
  }
}