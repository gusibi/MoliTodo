import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { changeLanguage } from '@/i18n'

// 全局语言状态
const currentLanguage = ref('zh')
const isLanguageLoaded = ref(false)

// Cross-window communication for language
let languageBroadcastChannel = null
let languageStorageListener = null

// Initialize broadcast channel for language cross-window communication
const initializeLanguageBroadcastChannel = () => {
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    try {
      languageBroadcastChannel = new BroadcastChannel('language-sync')

      languageBroadcastChannel.addEventListener('message', (event) => {
        if (event.data.type === 'language-change') {
          const { language } = event.data
          if (language !== currentLanguage.value) {
            changeLanguage(language)
            currentLanguage.value = language
          }
        }
      })
    } catch (error) {
      console.warn('BroadcastChannel not supported for language:', error)
    }
  }
}

// Broadcast language change to other windows
const broadcastLanguageChange = (language) => {
  if (languageBroadcastChannel) {
    try {
      languageBroadcastChannel.postMessage({
        type: 'language-change',
        language: language,
        timestamp: Date.now()
      })
    } catch (error) {
      console.warn('Failed to broadcast language change:', error)
    }
  }
}

// Listen for localStorage changes for language (fallback for cross-window sync)
const initializeLanguageStorageListener = () => {
  if (typeof window !== 'undefined') {
    languageStorageListener = (event) => {
      if (event.key === 'language' && event.newValue) {
        const newLanguage = event.newValue
        if (['zh', 'en'].includes(newLanguage) && newLanguage !== currentLanguage.value) {
          changeLanguage(newLanguage)
          currentLanguage.value = newLanguage
        }
      }
    }

    window.addEventListener('storage', languageStorageListener)
  }
}

export function useLanguage() {
  const { locale } = useI18n()

  /**
   * 初始化语言配置
   * 从配置中加载语言设置并应用
   */
  const initializeLanguage = async () => {
    
    try {
      if (window.electronAPI && window.electronAPI.config) {
        const config = await window.electronAPI.config.get()
        const storedLanguage = config?.language
        if (storedLanguage && storedLanguage !== locale.value) {
          await changeLanguage(storedLanguage)
          currentLanguage.value = storedLanguage
        } else {
          currentLanguage.value = locale.value
        }
      } else {
        currentLanguage.value = locale.value
      }
      isLanguageLoaded.value = true
    } catch (error) {
      console.warn('❌ Failed to initialize language:', error)
      currentLanguage.value = locale.value
      isLanguageLoaded.value = true
    }
  }

  /**
   * 切换语言
   * @param {string} langCode - 语言代码
   */
  const switchLanguage = async (langCode) => {
    try {
      await changeLanguage(langCode)
      currentLanguage.value = langCode
      
      // 广播语言变化到其他窗口
      broadcastLanguageChange(langCode)
      
      // 保存到配置
      if (window.electronAPI && window.electronAPI.config) {
        await window.electronAPI.config.set('language', langCode)
      }
    } catch (error) {
      console.error('Failed to switch language:', error)
      throw error
    }
  }

  /**
   * 监听语言变化
   * @param {Function} callback - 回调函数
   */
  const watchLanguage = (callback) => {
    return watch(currentLanguage, callback, { immediate: true })
  }

  /**
   * 清理语言相关资源
   */
  const cleanupLanguage = () => {
    if (languageBroadcastChannel) {
      try {
        languageBroadcastChannel.close()
        languageBroadcastChannel = null
      } catch (error) {
        console.warn('Failed to close language broadcast channel:', error)
      }
    }

    if (languageStorageListener) {
      window.removeEventListener('storage', languageStorageListener)
      languageStorageListener = null
    }
  }

  return {
    currentLanguage,
    isLanguageLoaded,
    initializeLanguage,
    switchLanguage,
    watchLanguage,
    cleanupLanguage
  }
}

// 初始化跨窗口通信
if (typeof window !== 'undefined') {
  initializeLanguageBroadcastChannel()
  initializeLanguageStorageListener()
  
  // 页面卸载时清理资源
  window.addEventListener('beforeunload', () => {
    if (languageBroadcastChannel) {
      languageBroadcastChannel.close()
    }
    if (languageStorageListener) {
      window.removeEventListener('storage', languageStorageListener)
    }
  })
}