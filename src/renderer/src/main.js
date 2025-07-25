import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

// 导入视图组件
import MainView from './views/MainView.vue'
import TaskManagerView from './views/TaskManagerView.vue'
import SettingsView from './views/SettingsView.vue'
import TaskPanelView from './views/TaskPanelView.vue'

// 创建路由
const routes = [
  { path: '/', component: MainView },
  { path: '/task-manager', component: TaskManagerView },
  { path: '/settings', component: SettingsView },
  { path: '/task-panel', component: TaskPanelView }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

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