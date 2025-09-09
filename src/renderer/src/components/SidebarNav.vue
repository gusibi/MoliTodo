<template>
  <nav class="sidebar-nav">
    <!-- 智能分类 -->
    <div class="nav-main-content">
      <div class="nav-section">
        <div class="nav-item" :class="{ active: currentCategory === 'today' }" @click="switchCategory('today')">
          <i class="fas fa-calendar-day"></i>
          <span>{{ $t('categories.today') }}</span>
          <span class="nav-count">{{ getCategoryCount('today') }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'planned' }" @click="switchCategory('planned')">
          <i class="fas fa-calendar-week"></i>
          <span>{{ $t('categories.planned') }}</span>
          <span class="nav-count">{{ getCategoryCount('planned') }}</span>
        </div>

        <div class="nav-item" :class="{ active: currentCategory === 'doing' }" @click="switchCategory('doing')">
          <i class="fas fa-play-circle"></i>
          <span>{{ $t('categories.doing') }}</span>
          <span class="nav-count">{{ getCategoryCount('doing') }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'paused' }" @click="switchCategory('paused')">
          <i class="fas fa-pause-circle"></i>
          <span>{{ $t('categories.paused') }}</span>
          <span class="nav-count">{{ getCategoryCount('paused') }}</span>
        </div>

        <div class="nav-item" :class="{ active: currentCategory === 'all' }" @click="switchCategory('all')">
          <i class="fas fa-list"></i>
          <span>{{ $t('categories.all') }}</span>
          <span class="nav-count">{{ getCategoryCount('all') }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'inbox' }" @click="switchCategory('inbox')">
          <i class="fas fa-inbox"></i>
          <span>{{ $t('categories.inbox') }}</span>
          <span class="nav-count">{{ getCategoryCount('inbox') }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'completed' }" @click="switchCategory('completed')">
          <i class="fas fa-check-circle"></i>
          <span>{{ $t('categories.completed') }}</span>
          <span class="nav-count">{{ getCategoryCount('completed') }}</span>
        </div>
      </div>

      <div class="nav-section">
        <!-- 清单项直接放在这里 -->
        <ListSidebar ref="listSidebar" />
      </div>
    </div>

    <!-- 底部按钮区 -->
    <div class="nav-section-bottom nav-icon-buttons">
      <div class="nav-icon-btn" @click="openSettings" :title="$t('settings.title')">
        <i class="fas fa-cog"></i>
      </div>
      <div class="nav-icon-btn" @click="createNewList" :title="$t('lists.newList')">
        <i class="fas fa-plus"></i>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'
import ListSidebar from './ListSidebar.vue'

// Props
const props = defineProps({
  currentCategory: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits(['category-change', 'open-settings', 'create-list'])

// I18n and Store
const { t } = useI18n()
const taskStore = useTaskStore()

// Refs
const listSidebar = ref(null)

// Methods
const switchCategory = (category) => {
  emit('category-change', category)
}

const openSettings = () => {
  emit('open-settings')
}

const createNewList = () => {
  console.log("createNewList in SidebarNav clicked")
  if (listSidebar.value) {
    listSidebar.value.openCreateDialog()
  } else {
    console.error("ListSidebar component instance is not available.")
  }
}

// 使用 taskStore 的统一计数方法
const getCategoryCount = (category) => {
  return taskStore.getCategoryCount(category)
}
</script>

<style scoped>
@import '@/assets/styles/components/sidebar-nav.css';
</style>