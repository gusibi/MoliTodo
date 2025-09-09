import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n, { loadStoredLanguage } from './i18n'

// Import global styles
import './assets/styles/index.css'
import './assets/global.css'

// Import global notification listener
import { setupGlobalNotificationListener } from './utils/globalNotificationListener.js'

// 创建应用
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err)
  console.error('Component:', instance)
  console.error('Info:', info)
  
  if (window.electronAPI) {
    window.electronAPI.utils.log(`[Vue Error] ${err.message}`, err.stack)
  }
}

// 捕获未处理的 Promise 错误
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason)
  
  if (window.electronAPI) {
    window.electronAPI.utils.log(`[Unhandled Promise] ${event.reason}`)
  }
})

// 设置全局通知音效监听器
setupGlobalNotificationListener()

// 异步加载存储的语言设置，然后挂载应用
loadStoredLanguage().then(() => {
  app.mount('#app')
}).catch((error) => {
  console.warn('Failed to load stored language, using default:', error)
  app.mount('#app')
})