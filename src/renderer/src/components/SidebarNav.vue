<template>
  <nav class="sidebar-nav" :aria-label="$t('app.title')">
    <!-- 智能分类 -->
    <div class="nav-main-content">
      <div class="nav-section">
        <button
          v-for="item in categoryItems"
          :key="item.key"
          type="button"
          class="nav-item"
          :class="{ active: currentCategory === item.key }"
          :aria-current="currentCategory === item.key ? 'page' : undefined"
          @click="switchCategory(item.key)"
        >
          <CategoryIcon :name="item.key" class="h-icon-md w-icon-md" />
          <span>{{ $t(item.label) }}</span>
          <span class="nav-count">{{ getCategoryCount(item.key) }}</span>
        </button>
      </div>

      <div class="nav-section">
        <!-- 清单项直接放在这里 -->
        <ListSidebar ref="listSidebar" />
      </div>
    </div>

    <!-- 底部按钮区 -->
    <div class="nav-section-bottom nav-icon-buttons">
      <IconButton class="nav-icon-btn h-10 w-10" :label="$t('settings.title')" @click="openSettings">
        <Settings class="h-icon-lg w-icon-lg" />
      </IconButton>
      <IconButton class="nav-icon-btn h-10 w-10" :label="$t('lists.newList')" @click="createNewList">
        <Plus class="h-icon-lg w-icon-lg" />
      </IconButton>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Settings } from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import ListSidebar from './ListSidebar.vue'
import CategoryIcon from './ui/CategoryIcon.vue'
import IconButton from './ui/button/IconButton.vue'

// Props
const props = defineProps({
  currentCategory: {
    type: String,
    required: true
  },
  // Today 页面协调层提供的去重执行计数；与页面 Header 同源
  todayCountOverride: {
    type: Number,
    default: null
  }
})

// Emits
const emit = defineEmits(['category-change', 'open-settings', 'create-list'])

// I18n and Store
const { t } = useI18n()
const taskStore = useTaskStore()

// Refs
const listSidebar = ref(null)

// 分类导航项：图标由 CategoryIcon 统一映射
const categoryItems = [
  { key: 'today', label: 'categories.today' },
  { key: 'planned', label: 'categories.planned' },
  { key: 'doing', label: 'categories.doing' },
  { key: 'paused', label: 'categories.paused' },
  { key: 'all', label: 'categories.all' },
  { key: 'inbox', label: 'categories.inbox' },
  { key: 'completed', label: 'categories.completed' }
]

// Methods
const switchCategory = (category) => {
  emit('category-change', category)
}

const openSettings = () => {
  emit('open-settings')
}

const createNewList = () => {
  if (listSidebar.value) {
    listSidebar.value.openCreateDialog()
  } else {
    console.error('ListSidebar component instance is not available.')
  }
}

// 使用 taskStore 的统一计数方法；Today 使用页面协调层提供的去重计数
const getCategoryCount = (category) => {
  if (category === 'today' && props.todayCountOverride !== null && props.todayCountOverride !== undefined) {
    return props.todayCountOverride
  }
  return taskStore.getCategoryCount(category)
}
</script>

<style scoped>
@import '@/assets/styles/components/sidebar-nav.css';
</style>
