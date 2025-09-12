<template>
  <div class="activity-heatmap">
    <div class="activity-heatmap-header">
      <h3 class="activity-heatmap-title">{{ title }}</h3>
      <div class="activity-heatmap-legend">
        <span class="activity-legend-text">Less</span>
        <div class="activity-legend-colors">
          <div class="activity-legend-square" :class="`activity-level-0`"></div>
          <div class="activity-legend-square" :class="`activity-level-1`"></div>
          <div class="activity-legend-square" :class="`activity-level-2`"></div>
          <div class="activity-legend-square" :class="`activity-level-3`"></div>
          <div class="activity-legend-square" :class="`activity-level-4`"></div>
        </div>
        <span class="activity-legend-text">More</span>
      </div>
    </div>
    
    <div class="activity-heatmap-container">
      <div class="activity-heatmap-months">
        <div 
          v-for="month in monthLabels" 
          :key="month.key"
          class="activity-month-label"
          :style="{ left: month.position + '%' }"
        >
          {{ month.label }}
        </div>
      </div>
      
      <div class="activity-heatmap-content">
        <div class="activity-heatmap-weekdays">
          <div class="activity-weekday-label">Mon</div>
          <div class="activity-weekday-label"></div>
          <div class="activity-weekday-label">Wed</div>
          <div class="activity-weekday-label"></div>
          <div class="activity-weekday-label">Fri</div>
          <div class="activity-weekday-label"></div>
          <div class="activity-weekday-label">Sun</div>
        </div>
        
        <div class="activity-heatmap-grid">
          <div 
            v-for="week in weeks" 
            :key="week.weekIndex"
            class="activity-week-column"
          >
            <div 
              v-for="day in week.days" 
              :key="day ? day.date : 'empty'"
              class="activity-day-square"
              :class="day ? `activity-level-${day.level}` : 'activity-level-0'"
              :title="day ? formatTooltip(day) : ''"
              @mouseenter="day ? showTooltip($event, day) : null"
              @mouseleave="hideTooltip"
            >
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Tooltip -->
    <div 
      v-if="tooltip.visible" 
      class="activity-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      {{ tooltip.content }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '任务活跃度'
  },
  data: {
    type: Array,
    default: () => []
  }
})

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  content: ''
})



// 生成最近一年的日期数据
const generateYearData = () => {
  console.log('ActivityHeatmap - 生成年度数据，props.data:', props.data)
  
  const today = new Date()
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(today.getFullYear() - 1)
  oneYearAgo.setDate(oneYearAgo.getDate() + 1) // 从一年前的第二天开始
  
  // 将数据转换为日期索引的对象
  const dataMap = {}
  if (props.data && Array.isArray(props.data) && props.data.length > 0) {
    props.data.forEach(item => {
      if (item && item.date && typeof item.count === 'number') {
        dataMap[item.date] = item.count
      }
    })
  }
  
  console.log('ActivityHeatmap - dataMap:', dataMap)
  
  const weeks = []
  let currentWeek = []
  let weekIndex = 0
  
  // 找到结束日期是周六（这样最新的一周在左侧）
  const endDate = new Date(today)
  while (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + 1)
  }
  
  // 从最新日期开始向过去生成数据
  const startDate = new Date(oneYearAgo)
  while (startDate.getDay() !== 0) {
    startDate.setDate(startDate.getDate() - 1)
  }
  
  // 先生成所有日期数据
  const allDays = []
  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const dayData = {
      date: dateStr,
      count: dataMap[dateStr] || 0,
      level: getActivityLevel(dataMap[dateStr] || 0)
    }
    
    allDays.push(dayData)
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // 按周分组，但是从最新的周开始排列
  const totalWeeks = Math.ceil(allDays.length / 7)
  
  for (let weekIdx = totalWeeks - 1; weekIdx >= 0; weekIdx--) {
    const weekDays = []
    const startIdx = weekIdx * 7
    
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayIndex = startIdx + dayIdx
      if (dayIndex < allDays.length) {
        weekDays.push(allDays[dayIndex])
      } else {
        weekDays.push(null)
      }
    }
    
    weeks.push({
      weekIndex: totalWeeks - 1 - weekIdx,
      days: weekDays
    })
  }
  
  return weeks
}

// 根据活跃度数量计算等级 (0-4)
const getActivityLevel = (count) => {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

// 生成月份标签（从最新月份开始）
const monthLabels = computed(() => {
  const labels = []
  const today = new Date()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(today)
    date.setMonth(date.getMonth() - i) // 从当前月份开始向前
    
    labels.push({
      key: i,
      label: months[date.getMonth()],
      position: (i / 11) * 100
    })
  }
  
  return labels
})

const weeks = computed(() => generateYearData())

// 格式化提示信息
const formatTooltip = (day) => {
  const date = new Date(day.date)
  const dateStr = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  if (day.count === 0) {
    return `${dateStr}: 无任务活动`
  } else if (day.count === 1) {
    return `${dateStr}: 1 个任务活动`
  } else {
    return `${dateStr}: ${day.count} 个任务活动`
  }
}

// 显示提示
const showTooltip = (event, day) => {
  tooltip.value = {
    visible: true,
    x: event.pageX + 10,
    y: event.pageY - 10,
    content: formatTooltip(day)
  }
}

// 隐藏提示
const hideTooltip = () => {
  tooltip.value.visible = false
}
</script>

<style scoped>
.activity-heatmap {
  @apply w-full bg-card border border-border rounded-lg p-4;
}

.activity-heatmap-header {
  @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4;
}

.activity-heatmap-title {
  @apply text-lg font-semibold text-foreground;
}

.activity-heatmap-legend {
  @apply flex items-center gap-2 justify-center sm:justify-end;
}

.activity-legend-text {
  @apply text-xs text-muted-foreground;
}

.activity-legend-colors {
  @apply flex gap-1;
}

.activity-legend-square {
  @apply w-3 h-3 rounded-sm;
}

.activity-heatmap-container {
  @apply relative;
}

.activity-heatmap-months {
  @apply relative h-4 mb-2;
}

.activity-month-label {
  @apply absolute text-xs text-muted-foreground;
  transform: translateX(-50%);
}

.activity-heatmap-content {
  @apply flex gap-2;
}

.activity-heatmap-weekdays {
  @apply flex flex-col gap-1 mr-2 flex-shrink-0;
}

.activity-weekday-label {
  @apply w-6 h-3 text-xs text-muted-foreground flex items-center;
}

.activity-heatmap-grid {
  @apply flex gap-1;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(203 213 225) transparent;
}

.activity-heatmap-grid::-webkit-scrollbar {
  height: 6px;
}

.activity-heatmap-grid::-webkit-scrollbar-track {
  background: transparent;
}

.activity-heatmap-grid::-webkit-scrollbar-thumb {
  background-color: rgb(203 213 225);
  border-radius: 3px;
}

.activity-heatmap-grid::-webkit-scrollbar-thumb:hover {
  background-color: rgb(148 163 184);
}

/* 暗色模式滚动条 */
@media (prefers-color-scheme: dark) {
  .activity-heatmap-grid {
    scrollbar-color: rgb(71 85 105) transparent;
  }
  
  .activity-heatmap-grid::-webkit-scrollbar-thumb {
    background-color: rgb(71 85 105);
  }
  
  .activity-heatmap-grid::-webkit-scrollbar-thumb:hover {
    background-color: rgb(100 116 139);
  }
}

.activity-week-column {
  @apply flex flex-col gap-1;
}

.activity-day-square {
  @apply w-3 h-3 rounded-sm cursor-pointer transition-all duration-200;
  @apply hover:ring-1 hover:ring-ring hover:ring-offset-1;
}

/* 响应式调整 */
@media (max-width: 640px) {
  .activity-heatmap {
    @apply p-3;
  }
  
  .activity-heatmap-title {
    @apply text-base;
  }
  
  .activity-day-square {
    @apply w-2.5 h-2.5;
  }
  
  .activity-legend-square {
    @apply w-2.5 h-2.5;
  }
  
  .activity-weekday-label {
    @apply w-5 text-xs;
  }
}

/* Activity levels */
.activity-level-0 {
  @apply bg-muted;
}

.activity-level-1 {
  @apply bg-green-200 dark:bg-green-900/40;
}

.activity-level-2 {
  @apply bg-green-300 dark:bg-green-800/60;
}

.activity-level-3 {
  @apply bg-green-400 dark:bg-green-700/80;
}

.activity-level-4 {
  @apply bg-green-500 dark:bg-green-600;
}

.activity-tooltip {
  @apply absolute z-50 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-md;
  @apply pointer-events-none;
}
</style>