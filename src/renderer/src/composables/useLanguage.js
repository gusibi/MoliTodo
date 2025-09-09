import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { changeLanguage } from '@/i18n'

// 全局语言状态
const currentLanguage = ref('zh')
const isLanguageLoaded = ref(false)

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

  return {
    currentLanguage,
    isLanguageLoaded,
    initializeLanguage,
    switchLanguage,
    watchLanguage
  }
}