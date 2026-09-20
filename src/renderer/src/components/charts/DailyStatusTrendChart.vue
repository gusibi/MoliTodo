<template>
  <div class="daily-status-trend-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ t('statistics.dailyStatusTrend') }}</h3>
      <div class="chart-controls">
        <select v-model.number="selectedDays" @change="updateChart" class="time-range-select">
          <option value="7">{{ t('statistics.last7Days') }}</option>
          <option value="30">{{ t('statistics.last30Days') }}</option>
          <option value="90">{{ t('statistics.last90Days') }}</option>
          <option value="365">{{ t('statistics.lastYear') }}</option>
        </select>
        <select v-model="selectedType" class="type-filter-select">
          <option value="all">{{ t('statistics.allTypes') }}</option>
          <option value="created">{{ t('statistics.created') }}</option>
          <option value="started">{{ t('statistics.started') }}</option>
          <option value="completed">{{ t('statistics.completed') }}</option>
        </select>
      </div>
    </div>
    <div class="chart-container">
      <canvas ref="chartCanvas" :width="chartWidth" :height="chartHeight"></canvas>
    </div>
    <div v-if="loading" class="chart-loading">
      {{ t('common.loading') }}
    </div>
    <div v-if="error" class="chart-error">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '../../store/taskStore'
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

// 注册Chart.js组件
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler
)

const { t } = useI18n()
const taskStore = useTaskStore()

// 响应式数据
const chartCanvas = ref(null)
const chart = ref(null)
const loading = ref(false)
const error = ref('')
const selectedDays = ref(30)
const selectedType = ref('all')
const chartData = ref({ labels: [], datasets: [] })

// 图表尺寸
const chartWidth = ref(800)
const chartHeight = ref(400)

// 过滤数据集的辅助函数
const getFilteredDatasets = (datasets) => {
  if (selectedType.value === 'all') {
    return datasets
  }
  
  const typeMap = {
    created: '创建',
    started: '开始', 
    completed: '完成'
  }
  
  return datasets.filter(dataset => 
    dataset.label === typeMap[selectedType.value]
  )
}

// 获取CSS变量颜色值的辅助函数
const getCSSVariableColor = (variable) => {
  if (typeof window !== 'undefined') {
    const style = getComputedStyle(document.documentElement)
    const hslValue = style.getPropertyValue(variable).trim()
    if (hslValue) return `hsl(${hslValue})`
    // 未定义时回退到主题主色，避免硬编码单一主题的蓝色
    const primary = style.getPropertyValue('--primary').trim()
    return primary ? `hsl(${primary})` : 'currentColor'
  }
  return 'currentColor'
}

// 图表字体沿用系统字体栈 token，跟随主题
const getFontFamily = () => {
  if (typeof window === 'undefined') return undefined
  return getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || undefined
}

// 更新数据集颜色以使用主题系统
const updateDatasetColors = (datasets) => {
  const themeColors = [
    getCSSVariableColor('--chart-1'), // 创建 - 蓝色
    getCSSVariableColor('--chart-2'), // 开始 - 深蓝色
    getCSSVariableColor('--chart-3')  // 完成 - 更深蓝色
  ]
  
  return datasets.map((dataset, index) => {
    const color = themeColors[index] || getCSSVariableColor('--chart-1')
    return {
      ...dataset,
      borderColor: color,
      backgroundColor: color.replace('hsl(', 'hsla(').replace(')', ', 0.1)')
    }
  })
}

// 图表配置 - 避免响应式循环依赖
const getChartOptions = () => {
  const fontFamily = getFontFamily()
  return {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: false
    },
    legend: {
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 20,
        color: getCSSVariableColor('--foreground'),
        font: { family: fontFamily }
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: getCSSVariableColor('--popover'),
      titleColor: getCSSVariableColor('--popover-foreground'),
      bodyColor: getCSSVariableColor('--popover-foreground'),
      borderColor: getCSSVariableColor('--border'),
      borderWidth: 1,
      titleFont: { family: fontFamily },
      bodyFont: { family: fontFamily },
      callbacks: {
        title: function(context) {
          const date = new Date(context[0].label)
          return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        },
        label: function(context) {
          return `${context.dataset.label}: ${context.parsed.y} 个任务`
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      grid: {
        color: getCSSVariableColor('--border')
      },
      title: {
        display: true,
        text: '日期',
        color: getCSSVariableColor('--muted-foreground'),
        font: { family: fontFamily }
      },
      ticks: {
        color: getCSSVariableColor('--muted-foreground'),
        font: { family: fontFamily },
        callback: function(value/* index */, index, ticks) {
          // 通过scale提供的API获取标签，避免直接访问this.chart，减少解析器递归
          const rawLabel = this.getLabelForValue(value)
          try {
            const date = new Date(rawLabel)
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric'
              })
            }
          } catch (e) {
            console.warn('日期解析失败:', rawLabel)
          }
          return ''
        },
        maxTicksLimit: selectedDays.value <= 7 ? selectedDays.value : Math.min(selectedDays.value / 3, 15)
      }
    },
    y: {
      display: true,
      grid: {
        color: getCSSVariableColor('--border')
      },
      title: {
        display: true,
        text: '任务数量',
        color: getCSSVariableColor('--muted-foreground'),
        font: { family: fontFamily }
      },
      beginAtZero: true,
      ticks: {
        maxTicksLimit: 10,
        color: getCSSVariableColor('--muted-foreground'),
        font: { family: fontFamily }
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  },
  events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove']
  }
}

// 加载图表数据
const loadChartData = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 计算日期范围
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - selectedDays.value + 1)
    
    const dateRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
    
    // console.log('DailyStatusTrendChart - 加载图表数据:', dateRange)
    const data = await taskStore.getDailyStatusTrendData(dateRange)
    // 更新数据集颜色以使用主题系统
    data.datasets = updateDatasetColors(data.datasets)
    chartData.value = data
    // console.log('DailyStatusTrendChart - 加载图表数据成功:', data)
    
    if (chart.value) {
      // 使用纯数据，避免响应式代理
      chart.value.data = {
        labels: JSON.parse(JSON.stringify(data.labels)),
        datasets: JSON.parse(JSON.stringify(getFilteredDatasets(data.datasets)))
      }
      // 更新图表配置以反映新的时间范围
      chart.value.options = getChartOptions()
      chart.value.update()
    }
  } catch (err) {
    console.error('加载图表数据失败:', err)
    error.value = '加载数据失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 更新图表
const updateChart = async () => {
  // 切换时间范围时，直接重建图表更稳妥
  destroyChart()
  await loadChartData()
  await nextTick()
  initChart()
}

// 初始化图表
const initChart = () => {
  if (!chartCanvas.value) return
  
  // 确保数据集使用主题颜色
  const datasetsWithColors = updateDatasetColors(chartData.value.datasets || [])
  
  // 初始化时传入深拷贝的纯数据，避免把Vue的响应式对象交给Chart.js
  const initialData = {
    labels: JSON.parse(JSON.stringify(chartData.value.labels || [])),
    datasets: JSON.parse(JSON.stringify(getFilteredDatasets(datasetsWithColors)))
  }
  
  chart.value = new Chart(chartCanvas.value, {
    type: 'line',
    data: initialData,
    options: getChartOptions()
  })
}

// 销毁图表
const destroyChart = () => {
  if (chart.value) {
    chart.value.destroy()
    chart.value = null
  }
}

// 监听类型筛选变化
watch(selectedType, async () => {
  // 类型切换时直接重建图表，避免在部分更新datasets时触发解析器递归
  destroyChart()
  // 不需要重新加载数据，使用现有的 chartData 即可
  await nextTick()
  initChart()
})

// 主题切换后重新读取 CSS 变量，避免颜色停留在旧主题
let themeObserver = null

const applyThemeToChart = () => {
  if (!chart.value) return
  chart.value.data.datasets = updateDatasetColors(chart.value.data.datasets || [])
  chart.value.options = getChartOptions()
  chart.value.update()
}

// 生命周期
onMounted(async () => {
  await loadChartData()
  initChart()

  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(applyThemeToChart)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme']
    })
  }
})

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
  destroyChart()
})
</script>

<style scoped>
.daily-status-trend-chart {
  @apply bg-card text-card-foreground border border-border rounded-lg shadow-sm p-6;
}

.chart-header {
  @apply flex justify-between items-center mb-4;
}

.chart-title {
  @apply text-lg font-semibold text-foreground;
}

.chart-controls {
  @apply flex gap-3;
}

.time-range-select,
.type-filter-select {
  @apply px-3 py-1.5 border border-border rounded text-sm bg-background text-foreground;
  @apply focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent;
}

.chart-container {
  @apply relative;
  height: 280px;
}

.chart-loading {
  @apply flex items-center justify-center py-8 text-muted-foreground;
}

.chart-error {
  @apply flex items-center justify-center py-8 text-destructive;
}
</style>