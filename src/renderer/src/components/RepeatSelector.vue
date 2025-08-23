<template>
  <div class="repeat-selector">
    <div v-if="isEnabled" class="repeat-selector-content">
      <!-- 重复类型选择 -->
      <div class="section">
        <label class="section-label">重复频率</label>
        <select 
          v-model="recurrence.type" 
          @change="setRepeatType(recurrence.type)"
          class="repeat-type-select"
        >
          <option 
            v-for="type in repeatTypes" 
            :key="type.value" 
            :value="type.value"
          >
            {{ type.label }}
          </option>
        </select>
      </div>

      <!-- 间隔设置 -->
      <div class="section">
        <label class="section-label">间隔</label>
        <div class="interval-input-group">
          <span>每</span>
          <input
            v-model.number="recurrence.interval"
            type="number"
            min="1"
            max="999"
            class="interval-input"
          />
          <span>{{ getIntervalUnit() }}</span>
        </div>
      </div>

      <!-- 周重复的星期几选择 -->
      <div v-if="recurrence.type === 'weekly'" class="section">
        <label class="section-label">重复日期</label>
        <div class="weekdays-grid">
          <button
            v-for="(day, index) in weekdays"
            :key="index"
            class="weekday-button"
            :class="{ 'active': recurrence.daysOfWeek?.includes(index) }"
            @click="toggleWeekday(index)"
          >
            {{ day }}
          </button>
        </div>
      </div>

      <!-- 月重复的方式选择 -->
      <div v-if="recurrence.type === 'monthly'" class="section">
        <label class="section-label">重复方式</label>
        <div class="monthly-options">
          <label class="monthly-option">
            <input
              type="radio"
              :value="'byMonthDay'"
              v-model="monthlyType"
              @change="updateMonthlyType"
              class="monthly-radio"
            />
            <span class="monthly-option-text">按日期</span>
          </label>
          <label class="monthly-option">
            <input
              type="radio"
              :value="'byWeekDay'"
              v-model="monthlyType"
              @change="updateMonthlyType"
              class="monthly-radio"
            />
            <span class="monthly-option-text">按星期</span>
          </label>
        </div>
        
        <!-- 按日期选择 -->
        <div v-if="monthlyType === 'byMonthDay'" class="monthly-day-selector">
          <label class="section-label">选择日期（可多选）</label>
          <div class="day-grid">
            <button
              v-for="day in 31"
              :key="day"
              class="day-button"
              :class="{ 'active': recurrence.byMonthDay.includes(day) }"
              @click="toggleMonthDay(day)"
            >
              {{ day }}
            </button>
          </div>
        </div>
        
        <!-- 按星期选择 -->
        <div v-if="monthlyType === 'byWeekDay'" class="monthly-week-selector">
          <div class="mb-3">
            <label class="section-label">选择第几周</label>
            <div class="week-options">
              <button
                v-for="week in weekOptions"
                :key="week.value"
                class="week-button"
                :class="{ 'active': recurrence.byWeekDay?.week === week.value }"
                @click="setWeekOfMonth(week.value)"
              >
                {{ week.label }}
              </button>
            </div>
          </div>
          <div>
            <label class="section-label">选择星期几</label>
            <div class="weekdays-grid">
              <button
                v-for="(day, index) in weekdays"
                :key="index"
                class="weekday-button"
                :class="{ 'active': recurrence.byWeekDay?.weekday === index }"
                @click="setWeekday(index)"
              >
                {{ day }}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 年重复的方式选择 -->
      <div v-if="recurrence.type === 'yearly'" class="section">
        <label class="section-label">重复方式</label>
        <div class="yearly-options">
          <div class="yearly-month-selector">
            <label class="section-label">选择月份（可多选）</label>
            <div class="month-grid">
              <button
                v-for="month in 12"
                :key="month"
                class="month-button"
                :class="{ 'active': recurrence.byMonth.includes(month) }"
                @click="toggleMonth(month)"
              >
                {{ month }}月
              </button>
            </div>
          </div>
        </div>
        
        <div class="yearly-date-options">
          <label class="section-label">选择日期</label>
          <div class="yearly-type-options">
            <label class="yearly-type-option">
              <input
                type="radio"
                :value="'byMonthDay'"
                v-model="yearlyType"
                @change="updateYearlyType"
                class="yearly-type-radio"
              />
              <span class="yearly-type-text">按日期</span>
            </label>
            <label class="yearly-type-option">
              <input
                type="radio"
                :value="'byWeekDay'"
                v-model="yearlyType"
                @change="updateYearlyType"
                class="yearly-type-radio"
              />
              <span class="yearly-type-text">按星期</span>
            </label>
          </div>
          
          <!-- 年重复按日期选择 -->
          <div v-if="yearlyType === 'byMonthDay'" class="yearly-day-selector">
            <label class="section-label">选择日期（可多选）</label>
            <div class="day-grid">
              <button
                v-for="day in getDaysInSelectedMonth()"
                :key="day"
                class="day-button"
                :class="{ 'active': recurrence.byMonthDay.includes(day) }"
                @click="toggleYearlyMonthDay(day)"
              >
                {{ day }}
              </button>
            </div>
          </div>
          
          <!-- 年重复按星期选择 -->
          <div v-if="yearlyType === 'byWeekDay'" class="yearly-week-selector">
            <div class="mb-3">
              <label class="section-label">选择第几周</label>
              <div class="week-options">
                <button
                  v-for="week in weekOptions"
                  :key="week.value"
                  class="week-button"
                  :class="{ 'active': recurrence.byWeekDay?.week === week.value }"
                  @click="setYearlyWeekOfMonth(week.value)"
                >
                  {{ week.label }}
                </button>
              </div>
            </div>
            <div>
              <label class="section-label">选择星期几</label>
              <div class="weekdays-grid">
                <button
                  v-for="(day, index) in weekdays"
                  :key="index"
                  class="weekday-button"
                  :class="{ 'active': recurrence.byWeekDay?.weekday === index }"
                  @click="setYearlyWeekday(index)"
                >
                  {{ day }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 提醒时间设置 -->
      <div class="section">
        <label class="section-label">提醒时间</label>
        <div class="reminder-time-input">
          <VueDatePicker
            v-model="reminderTimeValue"
            :time-picker="true"
            :format="'HH:mm'"
            :preview-format="'HH:mm'"
            :text-input="false"
            :auto-apply="true"
            :close-on-scroll="true"
            :close-on-click-outside="true"
            placeholder="选择提醒时间"
            class="vue-datepicker repeat-time-picker"
            @update:model-value="updateReminderTime"
          />
          <span class="reminder-hint">为每个重复实例设置提醒时间</span>
        </div>
      </div>

      <!-- 结束条件 -->
      <div class="section">
        <label class="section-label">结束条件</label>
        <div class="end-condition-container">
          <select 
            v-model="endConditionType" 
            @change="updateEndCondition"
            class="end-condition-select"
          >
            <option value="never">永不结束</option>
            <option value="date">结束日期</option>
            <option value="count">重复次数</option>
          </select>
          
          <div v-if="endConditionType === 'date'" class="end-condition-input">
            <VueDatePicker
              v-model="endDateValue"
              :enable-time-picker="false"
              :format="'yyyy-MM-dd'"
              :preview-format="'yyyy-MM-dd'"
              :text-input="false"
              :auto-apply="true"
              :close-on-scroll="true"
              :close-on-click-outside="true"
              placeholder="选择结束日期"
              class="vue-datepicker repeate-date-picker"
              @update:model-value="updateEndDate"
            />
          </div>
          
          <div v-if="endConditionType === 'count'" class="end-condition-input">
            <div class="end-count-group">
              <input
                type="number"
                v-model.number="endCount"
                min="1"
                max="999"
                class="interval-input"
                @change="updateEndCondition"
              />
              <span class="end-count-unit">次</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 重复规则描述 -->
      <div class="repeat-description">
        <div class="description-label">重复规则预览：</div>
        <div class="description-text">{{ getDescription() }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import VueDatePicker from '@vuepic/vue-datepicker'

const props = defineProps({
  modelValue: {
    type: Object,
    default: null
  },
  baseDate: {
    type: [Date, String],
    default: () => new Date()
  }
})

// 确保baseDate始终是Date对象
const normalizedBaseDate = computed(() => {
  if (!props.baseDate) {
    return new Date()
  }
  if (props.baseDate instanceof Date) {
    return props.baseDate
  }
  // 如果是字符串，转换为Date对象
  return new Date(props.baseDate)
})

const emit = defineEmits(['update:modelValue'])

// 响应式数据
const isEnabled = ref(!!props.modelValue)
const recurrence = ref({
  type: 'daily',
  interval: 1,
  daysOfWeek: [],
  byMonthDay: [], // 改为数组支持多选
  byWeekDay: null,
  byMonth: [], // 改为数组支持多选
  endCondition: null
})

const endConditionType = ref('never')
const endDate = ref('')
const endCount = ref(1)
const monthlyType = ref('byMonthDay')
const yearlyType = ref('byMonthDay')
const reminderTime = ref('')
const reminderTimeValue = ref(null)
const endDateValue = ref(null)

// 常量数据
const repeatTypes = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' }
]

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const weekOptions = [
  { value: 1, label: '第1周' },
  { value: 2, label: '第2周' },
  { value: 3, label: '第3周' },
  { value: 4, label: '第4周' },
  { value: 5, label: '第5周' },
  { value: -1, label: '最后一周' }
]

// 计算属性
const currentDay = computed(() => {
  return normalizedBaseDate.value.getDate()
})

const getCurrentWeekdayName = computed(() => {
  const day = normalizedBaseDate.value.getDay()
  return weekdays[day]
})

// 方法
const toggleRepeat = () => {
  isEnabled.value = !isEnabled.value
  if (isEnabled.value) {
    emit('update:modelValue', { ...recurrence.value })
  } else {
    emit('update:modelValue', null)
  }
}

const setRepeatType = (type) => {
  recurrence.value.type = type
  
  // 重置相关设置
  if (type !== 'weekly') {
    recurrence.value.daysOfWeek = []
  } else {
    // 默认选择当前星期几
    recurrence.value.daysOfWeek = [normalizedBaseDate.value.getDay()]
  }
  
  if (type !== 'monthly' && type !== 'yearly') {
    recurrence.value.byMonthDay = []
    recurrence.value.byWeekDay = null
  }
  
  if (type !== 'yearly') {
    recurrence.value.byMonth = []
  }
  
  if (type === 'monthly') {
    updateMonthlyType()
  } else if (type === 'yearly') {
    updateYearlyType()
  }
  
  emitUpdate()
}

const toggleWeekday = (dayIndex) => {
  if (!recurrence.value.daysOfWeek) {
    recurrence.value.daysOfWeek = []
  }
  
  const index = recurrence.value.daysOfWeek.indexOf(dayIndex)
  if (index > -1) {
    recurrence.value.daysOfWeek.splice(index, 1)
  } else {
    recurrence.value.daysOfWeek.push(dayIndex)
  }
  
  // 至少选择一天
  if (recurrence.value.daysOfWeek.length === 0) {
    recurrence.value.daysOfWeek = [normalizedBaseDate.value.getDay()]
  }
  
  emitUpdate()
}

const updateMonthlyType = () => {
  if (monthlyType.value === 'byMonthDay') {
    recurrence.value.byMonthDay = [currentDay.value]
    recurrence.value.byWeekDay = null
  } else {
    recurrence.value.byMonthDay = []
    recurrence.value.byWeekDay = {
      weekday: normalizedBaseDate.value.getDay(),
      week: getWeekOfMonth()
    }
  }
  emitUpdate()
}

const updateReminderTime = (value) => {
  if (value) {
    let hours, minutes
    
    if (typeof value === 'string') {
      // 如果是字符串格式 "HH:mm"
      const timeParts = value.split(':')
      hours = timeParts[0]
      minutes = timeParts[1]
    } else if (value instanceof Date) {
      // 如果是 Date 对象
      hours = value.getHours().toString().padStart(2, '0')
      minutes = value.getMinutes().toString().padStart(2, '0')
    } else if (value.hours !== undefined && value.minutes !== undefined) {
      // 如果是对象格式 {hours: x, minutes: y}
      hours = value.hours.toString().padStart(2, '0')
      minutes = value.minutes.toString().padStart(2, '0')
    } else {
      console.warn('未知的时间格式:', value)
      return
    }
    
    reminderTime.value = `${hours}:${minutes}`
    recurrence.value.reminderTime = reminderTime.value
  } else {
    reminderTime.value = ''
    delete recurrence.value.reminderTime
  }
  emitUpdate()
}

const updateEndDate = (value) => {
  if (value) {
    const year = value.getFullYear()
    const month = (value.getMonth() + 1).toString().padStart(2, '0')
    const day = value.getDate().toString().padStart(2, '0')
    endDate.value = `${year}-${month}-${day}`
  } else {
    endDate.value = ''
  }
  updateEndCondition()
}

const updateEndCondition = () => {
  switch (endConditionType.value) {
    case 'never':
      recurrence.value.endCondition = null
      break
    case 'date':
      if (endDate.value) {
        recurrence.value.endCondition = {
          type: 'date',
          endDate: endDate.value
        }
      }
      break
    case 'count':
      if (endCount.value > 0) {
        recurrence.value.endCondition = {
          type: 'count',
          count: endCount.value
        }
      }
      break
  }
  emitUpdate()
}

// 月重复相关方法
const toggleMonthDay = (day) => {
  if (!Array.isArray(recurrence.value.byMonthDay)) {
    recurrence.value.byMonthDay = []
  }
  
  const index = recurrence.value.byMonthDay.indexOf(day)
  if (index > -1) {
    recurrence.value.byMonthDay.splice(index, 1)
  } else {
    recurrence.value.byMonthDay.push(day)
  }
  
  // 至少选择一天
  if (recurrence.value.byMonthDay.length === 0) {
    recurrence.value.byMonthDay = [currentDay.value]
  }
  
  recurrence.value.byWeekDay = null
  emitUpdate()
}

const setWeekOfMonth = (week) => {
  if (!recurrence.value.byWeekDay) {
    recurrence.value.byWeekDay = {
      weekday: normalizedBaseDate.value.getDay(),
      week: week
    }
  } else {
    recurrence.value.byWeekDay.week = week
  }
  recurrence.value.byMonthDay = []
  emitUpdate()
}

const setWeekday = (weekday) => {
  if (!recurrence.value.byWeekDay) {
    recurrence.value.byWeekDay = {
      weekday: weekday,
      week: getWeekOfMonth()
    }
  } else {
    recurrence.value.byWeekDay.weekday = weekday
  }
  recurrence.value.byMonthDay = []
  emitUpdate()
}

// 年重复相关方法
const updateYearlyType = () => {
  // 确保 byMonth 是数组格式
  if (!Array.isArray(recurrence.value.byMonth)) {
    recurrence.value.byMonth = []
  }
  
  // 如果没有选择任何月份，默认选择当前月份
  if (recurrence.value.byMonth.length === 0) {
    const currentMonth = normalizedBaseDate.value.getMonth() + 1
    recurrence.value.byMonth = [currentMonth]
  }
  
  if (yearlyType.value === 'byMonthDay') {
    recurrence.value.byMonthDay = [currentDay.value]
    recurrence.value.byWeekDay = null
  } else {
    recurrence.value.byMonthDay = []
    recurrence.value.byWeekDay = {
      weekday: normalizedBaseDate.value.getDay(),
      week: getWeekOfMonth()
    }
  }
  emitUpdate()
}

const toggleMonth = (month) => {
  if (!Array.isArray(recurrence.value.byMonth)) {
    recurrence.value.byMonth = []
  }
  
  const index = recurrence.value.byMonth.indexOf(month)
  if (index > -1) {
    recurrence.value.byMonth.splice(index, 1)
  } else {
    recurrence.value.byMonth.push(month)
  }
  
  // 至少选择一个月
  if (recurrence.value.byMonth.length === 0) {
    const currentMonth = normalizedBaseDate.value.getMonth() + 1
    recurrence.value.byMonth = [currentMonth]
  }
  
  emitUpdate()
}

const toggleYearlyMonthDay = (day) => {
  if (!Array.isArray(recurrence.value.byMonthDay)) {
    recurrence.value.byMonthDay = []
  }
  
  const index = recurrence.value.byMonthDay.indexOf(day)
  if (index > -1) {
    recurrence.value.byMonthDay.splice(index, 1)
  } else {
    recurrence.value.byMonthDay.push(day)
  }
  
  // 至少选择一天
  if (recurrence.value.byMonthDay.length === 0) {
    recurrence.value.byMonthDay = [currentDay.value]
  }
  
  recurrence.value.byWeekDay = null
  emitUpdate()
}

const setYearlyWeekOfMonth = (week) => {
  if (!recurrence.value.byWeekDay) {
    recurrence.value.byWeekDay = {
      weekday: normalizedBaseDate.value.getDay(),
      week: week
    }
  } else {
    recurrence.value.byWeekDay.week = week
  }
  recurrence.value.byMonthDay = []
  emitUpdate()
}

const setYearlyWeekday = (weekday) => {
  if (!recurrence.value.byWeekDay) {
    recurrence.value.byWeekDay = {
      weekday: weekday,
      week: getWeekOfMonth()
    }
  } else {
    recurrence.value.byWeekDay.weekday = weekday
  }
  recurrence.value.byMonthDay = []
  emitUpdate()
}

// 获取选中月份的天数
const getDaysInSelectedMonth = () => {
  if (!recurrence.value.byMonth || recurrence.value.byMonth.length === 0) {
    return 31
  }
  const year = new Date().getFullYear()
  // 取选中月份中天数最多的月份
  const maxDays = Math.max(...recurrence.value.byMonth.map(month => 
    new Date(year, month, 0).getDate()
  ))
  return maxDays
}

const getIntervalUnit = () => {
  const units = {
    daily: '天',
    weekly: '周',
    monthly: '个月',
    yearly: '年'
  }
  return units[recurrence.value.type] || ''
}

const getWeekOfMonth = () => {
  const date = normalizedBaseDate.value.getDate()
  return Math.ceil(date / 7)
}

const getDescription = () => {
  if (!isEnabled.value) {
    return '无重复'
  }
  
  const interval = recurrence.value.interval || 1
  let description = ''
  
  switch (recurrence.value.type) {
    case 'daily':
      description = interval === 1 ? '每天' : `每${interval}天`
      break
    case 'weekly':
      if (recurrence.value.daysOfWeek && recurrence.value.daysOfWeek.length > 0) {
        const days = recurrence.value.daysOfWeek.map(day => weekdays[day]).join('、')
        description = interval === 1 ? `每周${days}` : `每${interval}周${days}`
      } else {
        description = interval === 1 ? '每周' : `每${interval}周`
      }
      break
    case 'monthly':
      if (monthlyType.value === 'byMonthDay') {
        if (recurrence.value.byMonthDay && recurrence.value.byMonthDay.length > 0) {
          const days = recurrence.value.byMonthDay.sort((a, b) => a - b).join('、')
          description = interval === 1 ? `每月${days}日` : `每${interval}个月${days}日`
        } else {
          description = interval === 1 ? `每月${currentDay.value}日` : `每${interval}个月${currentDay.value}日`
        }
      } else {
        const week = getWeekOfMonth()
        const weekday = getCurrentWeekdayName.value
        description = interval === 1 ? `每月第${week}个${weekday}` : `每${interval}个月第${week}个${weekday}`
      }
      break
    case 'yearly':
      if (recurrence.value.byMonth && recurrence.value.byMonth.length > 0) {
        const monthNames = recurrence.value.byMonth.sort((a, b) => a - b).map(m => `${m}月`).join('、')
        if (yearlyType.value === 'byMonthDay' && recurrence.value.byMonthDay && recurrence.value.byMonthDay.length > 0) {
          const days = recurrence.value.byMonthDay.sort((a, b) => a - b).join('、')
          description = interval === 1 ? `每年${monthNames}${days}日` : `每${interval}年${monthNames}${days}日`
        } else if (yearlyType.value === 'byWeekDay' && recurrence.value.byWeekDay) {
          const week = recurrence.value.byWeekDay.week === -1 ? '最后' : `第${recurrence.value.byWeekDay.week}`
          const weekday = weekdays[recurrence.value.byWeekDay.weekday]
          description = interval === 1 ? `每年${monthNames}${week}个${weekday}` : `每${interval}年${monthNames}${week}个${weekday}`
        } else {
          description = interval === 1 ? `每年${monthNames}` : `每${interval}年${monthNames}`
        }
      } else {
        description = interval === 1 ? '每年' : `每${interval}年`
      }
      break
  }
  
  // 添加结束条件描述
  if (recurrence.value.endCondition) {
    const { type, endDate: end, count } = recurrence.value.endCondition
    if (type === 'date' && end) {
      const date = new Date(end)
      description += `，直到${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
    } else if (type === 'count' && count) {
      description += `，共${count}次`
    }
  }
  
  return description
}

const emitUpdate = () => {
  if (isEnabled.value) {
    emit('update:modelValue', { ...recurrence.value })
  }
}

// 初始化
onMounted(() => {
  if (props.modelValue) {
    isEnabled.value = true
    recurrence.value = { ...recurrence.value, ...props.modelValue }
    
    // 初始化提醒时间
    if (recurrence.value.reminderTime) {
      reminderTime.value = recurrence.value.reminderTime
      const [hours, minutes] = recurrence.value.reminderTime.split(':')
      reminderTimeValue.value = new Date()
      reminderTimeValue.value.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    }
    
    // 初始化结束条件
    if (recurrence.value.endCondition) {
      const { type, endDate: end, count } = recurrence.value.endCondition
      endConditionType.value = type
      if (type === 'date' && end) {
        endDate.value = end
        endDateValue.value = new Date(end)
      } else if (type === 'count' && count) {
        endCount.value = count
      }
    }
    
    // 初始化月重复类型
    if (recurrence.value.type === 'monthly') {
      monthlyType.value = (recurrence.value.byMonthDay && recurrence.value.byMonthDay.length > 0) ? 'byMonthDay' : 'byWeekDay'
    }
    
    // 初始化年重复类型
    if (recurrence.value.type === 'yearly') {
      yearlyType.value = (recurrence.value.byMonthDay && recurrence.value.byMonthDay.length > 0) ? 'byMonthDay' : 'byWeekDay'
      if (!recurrence.value.byMonth || recurrence.value.byMonth.length === 0) {
        recurrence.value.byMonth = [normalizedBaseDate.value.getMonth() + 1]
      }
    }
    
    // 确保数组格式兼容性
    if (recurrence.value.byMonthDay && !Array.isArray(recurrence.value.byMonthDay)) {
      recurrence.value.byMonthDay = [recurrence.value.byMonthDay]
    }
    if (recurrence.value.byMonth && !Array.isArray(recurrence.value.byMonth)) {
      recurrence.value.byMonth = [recurrence.value.byMonth]
    }
  }
})

// 监听外部变化
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    isEnabled.value = true
    recurrence.value = { ...recurrence.value, ...newValue }
  } else {
    isEnabled.value = false
  }
}, { deep: true })
</script>

<style scoped>
@import '../assets/styles/components/RepeatSelector.css';
</style>