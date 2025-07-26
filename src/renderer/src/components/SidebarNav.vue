<template>
  <nav class="sidebar-nav">
    <!-- 任务分类项 -->
    <div class="nav-section">
       <div 
        class="nav-item" 
        :class="{ active: currentCategory === 'today' }" 
        @click="switchCategory('today')"
      >
        <i class="fas fa-calendar-day"></i>
        <span>今天</span>
        <span class="nav-count">{{ categoryCounts.today || 0 }}</span>
      </div>
      <div 
        class="nav-item" 
        :class="{ active: currentCategory === 'inbox' }" 
        @click="switchCategory('inbox')"
      >
        <i class="fas fa-inbox"></i>
        <span>收件箱</span>
        <span class="nav-count">{{ categoryCounts.inbox || 0 }}</span>
      </div>
     
      <div 
        class="nav-item" 
        :class="{ active: currentCategory === 'doing' }" 
        @click="switchCategory('doing')"
      >
        <i class="fas fa-play-circle"></i>
        <span>进行中</span>
        <span class="nav-count">{{ categoryCounts.doing || 0 }}</span>
      </div>
      <div 
        class="nav-item" 
        :class="{ active: currentCategory === 'paused' }" 
        @click="switchCategory('paused')"
      >
        <i class="fas fa-pause-circle"></i>
        <span>暂停中</span>
        <span class="nav-count">{{ categoryCounts.paused || 0 }}</span>
      </div>
      <div 
        class="nav-item" 
        :class="{ active: currentCategory === 'planned' }" 
        @click="switchCategory('planned')"
      >
        <i class="fas fa-calendar-week"></i>
        <span>计划中</span>
        <span class="nav-count">{{ categoryCounts.planned || 0 }}</span>
      </div>
      <div 
        class="nav-item" 
        :class="{ active: currentCategory === 'all' }" 
        @click="switchCategory('all')"
      >
        <i class="fas fa-list"></i>
        <span>所有任务</span>
        <span class="nav-count">{{ categoryCounts.all || 0 }}</span>
      </div>
      <div 
        class="nav-item" 
        :class="{ active: currentCategory === 'completed' }" 
        @click="switchCategory('completed')"
      >
        <i class="fas fa-check-circle"></i>
        <span>已完成</span>
        <span class="nav-count">{{ categoryCounts.completed || 0 }}</span>
      </div>
    </div>
    
    <!-- 设置项 -->
    <div class="nav-section-bottom">
      <div class="nav-item" @click="openSettings">
        <i class="fas fa-cog"></i>
        <span>设置</span>
      </div>
    </div>
  </nav>
</template>

<script>
export default {
  name: 'SidebarNav',
  props: {
    currentCategory: {
      type: String,
      required: true
    },
    categoryCounts: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['category-change', 'open-settings'],
  methods: {
    switchCategory(category) {
      this.$emit('category-change', category);
    },
    openSettings() {
      this.$emit('open-settings');
    }
  }
}
</script>

<style scoped>
@import '../assets/styles/components/sidebar-nav.css';
</style>