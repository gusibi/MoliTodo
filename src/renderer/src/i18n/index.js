import { createI18n } from 'vue-i18n'
import zh from './locales/zh.json'
import en from './locales/en.json'

// 获取存储的语言设置，默认为中文
const getStoredLanguage = () => {
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.config) {
    // 这里会在应用启动后异步获取，先返回默认值
    return 'zh'
  }
  return 'zh'
}

const messages = {
  zh,
  en
}

const i18n = createI18n({
  legacy: false,
  locale: getStoredLanguage(),
  fallbackLocale: 'zh',
  messages
})

// 异步加载存储的语言设置
export const loadStoredLanguage = async () => {
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.config) {
    try {
      const storedLanguage = await window.electronAPI.config.get('language')
      if (storedLanguage && messages[storedLanguage]) {
        i18n.global.locale.value = storedLanguage
      }
    } catch (error) {
      console.warn('Failed to load stored language:', error)
    }
  }
}

// 切换语言并保存到配置
export const changeLanguage = async (locale) => {
  if (messages[locale]) {
    i18n.global.locale.value = locale
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.config) {
      try {
        await window.electronAPI.config.set('language', locale)
      } catch (error) {
        console.error('Failed to save language setting:', error)
      }
    }
  }
}

export default i18n