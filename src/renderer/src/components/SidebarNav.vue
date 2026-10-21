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
          :class="{ active: currentTool === 'tasks' && currentCategory === item.key }"
          :aria-current="currentTool === 'tasks' && currentCategory === item.key ? 'page' : undefined"
          @click="switchCategory(item.key)"
        >
          <CategoryIcon :name="item.key" class="h-icon-md w-icon-md" />
          <span>{{ $t(item.label) }}</span>
          <span class="nav-count">{{ getCategoryCount(item.key) }}</span>
        </button>
      </div>

      <div class="nav-section-title">{{ $t('tools.title') }}</div>
      <div class="nav-section">
        <button
          type="button"
          class="nav-item"
          :class="{ active: currentTool === 'health' }"
          :aria-current="currentTool === 'health' ? 'page' : undefined"
          @click="switchTool('health')"
        >
          <HeartPulse class="h-icon-md w-icon-md" />
          <span>{{ $t('tools.health') }}</span>
        </button>
        <button
          type="button"
          class="nav-item opacity-50 cursor-not-allowed"
          disabled
          :title="$t('tools.comingSoon')"
        >
          <Timer class="h-icon-md w-icon-md" />
          <span>{{ $t('tools.focus') }}</span>
        </button>
        <button
          type="button"
          class="nav-item"
          :class="{ active: currentTool === 'garden' }"
          :aria-current="currentTool === 'garden' ? 'page' : undefined"
          @click="switchTool('garden')"
        >
          <Sprout class="h-icon-md w-icon-md" />
          <span>{{ $t('tools.garden') }}</span>
          <span v-if="pendingRewards > 0" class="nav-count">{{ pendingRewards }}</span>
        </button>
      </div>

      <div class="nav-section">
        <!-- 清单项直接放在这里 -->
        <ListSidebar ref="listSidebar" :tools-active="currentTool !== 'tasks'" />
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
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { HeartPulse, Plus, Settings, Sprout, Timer } from '@lucide/vue'
import { useTaskStore } from '@/store/taskStore'
import { useToolsStore } from '@/store/toolsStore'
import ListSidebar from './ListSidebar.vue'
import CategoryIcon from './ui/CategoryIcon.vue'
import IconButton from './ui/button/IconButton.vue'

// Props
const props = defineProps({
  currentCategory: {
    type: String,
    required: true
  },
  currentTool: {
    type: String,
    default: 'tasks'
  },
  // Today 页面协调层提供的去重执行计数；与页面 Header 同源
  todayCountOverride: {
    type: Number,
    default: null
  }
})

// Emits
const emit = defineEmits(['category-change', 'open-settings', 'create-list', 'tool-change'])

// I18n and Store
const { t } = useI18n()
const taskStore = useTaskStore()
const toolsStore = useToolsStore()
const pendingRewards = computed(() => toolsStore.pendingRewards)

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

const switchTool = (tool) => {
  emit('tool-change', tool)
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
