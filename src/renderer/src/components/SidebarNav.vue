<template>
  <nav class="sidebar-nav">
    <!-- 智能分类 -->
    <div class="nav-main-content">
      <div class="nav-section">
        <div class="nav-item" :class="{ active: currentCategory === 'today' }" @click="switchCategory('today')">
          <i class="fas fa-calendar-day"></i>
          <span>今天</span>
          <span class="nav-count">{{ categoryCounts.today || 0 }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'inbox' }" @click="switchCategory('inbox')">
          <i class="fas fa-inbox"></i>
          <span>收件箱</span>
          <span class="nav-count">{{ categoryCounts.inbox || 0 }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'doing' }" @click="switchCategory('doing')">
          <i class="fas fa-play-circle"></i>
          <span>进行中</span>
          <span class="nav-count">{{ categoryCounts.doing || 0 }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'paused' }" @click="switchCategory('paused')">
          <i class="fas fa-pause-circle"></i>
          <span>暂停中</span>
          <span class="nav-count">{{ categoryCounts.paused || 0 }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'planned' }" @click="switchCategory('planned')">
          <i class="fas fa-calendar-week"></i>
          <span>计划中</span>
          <span class="nav-count">{{ categoryCounts.planned || 0 }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'all' }" @click="switchCategory('all')">
          <i class="fas fa-list"></i>
          <span>所有任务</span>
          <span class="nav-count">{{ categoryCounts.all || 0 }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentCategory === 'completed' }" @click="switchCategory('completed')">
          <i class="fas fa-check-circle"></i>
          <span>已完成</span>
          <span class="nav-count">{{ categoryCounts.completed || 0 }}</span>
        </div>
      </div>

      <div class="nav-section">
        <!-- 清单项直接放在这里 -->
        <ListSidebar ref="listSidebar" />
      </div>
    </div>

    <!-- 底部按钮区 -->
    <div class="nav-section-bottom nav-icon-buttons">
      <div class="nav-icon-btn" @click="openSettings" title="设置">
        <i class="fas fa-cog"></i>
      </div>
      <div class="nav-icon-btn" @click="createNewList" title="新建清单">
        <i class="fas fa-plus"></i>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import ListSidebar from './ListSidebar.vue'

// Props
const props = defineProps({
  currentCategory: {
    type: String,
    required: true
  },
  categoryCounts: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['category-change', 'open-settings', 'create-list'])

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
</script>

<style scoped>
@import '../assets/styles/components/sidebar-nav.css';
</style>