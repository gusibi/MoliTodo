import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n, { loadStoredLanguage } from './i18n'
import VCalendar from 'v-calendar'

// Import global styles
import './assets/styles/index.css'
import './assets/global.css'

// Import global notification listener
import { setupGlobalNotificationListener } from './utils/globalNotificationListener.js'

// 标记平台：只有 macOS 的窗口是 transparent + vibrancy，
// 其它平台需要给根容器铺不透明背景，否则会透出桌面（issue #8）
const platform = window.electronAPI?.app?.platform
document.documentElement.classList.add(
  platform === 'darwin' ? 'platform-mac' : 'platform-opaque'
)

// 创建应用
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

// Use the calendar plugin
app.use(VCalendar, {
  componentPrefix: 'v', // Use 'v' as component prefix (v-calendar, v-date-picker, etc.)
})

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