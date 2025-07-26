import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Import global styles
import './assets/styles/index.css'

// 创建应用
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

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

app.mount('#app')