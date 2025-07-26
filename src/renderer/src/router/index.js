import { createRouter, createWebHashHistory } from 'vue-router'

// 导入视图组件
import MainView from '../views/MainView.vue'
import SettingsView from '../views/SettingsView.vue'

// 导入组件作为页面级组件
import TaskManager from '../components/TaskManager.vue'
import TaskPanel from '../components/TaskPanel.vue'

const routes = [
  {
    path: '/',
    name: 'Main',
    component: MainView,
    meta: {
      title: '主页'
    }
  },
  {
    path: '/task-manager',
    name: 'TaskManager',
    component: TaskManager,
    meta: {
      title: '任务管理'
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: {
      title: '设置'
    }
  },
  {
    path: '/task-panel',
    name: 'TaskPanel',
    component: TaskPanel,
    meta: {
      title: '任务面板'
    }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - MoliTodo`
  }
  next()
})

export default router