<template>
  <div v-if="visible" class="list-create-modal-overlay" @click="handleOverlayClick">
    <div class="list-create-dialog" @click.stop>
      <div class="list-create-dialog-header">
        <button class="list-create-header-btn list-create-btn-cancel" @click="close">
          <i class="icon-close"></i>
        </button>
        <h3>{{ isEditing ? '编辑清单' : '新建清单' }}</h3>
        <button 
          class="list-create-header-btn list-create-btn-confirm" 
          @click="confirm"
          :disabled="!canConfirm"
        >
          <i class="icon-check"></i>
        </button>
      </div>
      
      <div class="list-create-dialog-body">
        <!-- 清单名称 -->
        <div class="list-create-form-group">
          <label class="list-create-form-label">清单名称</label>
          <input 
            ref="nameInput"
            v-model="form.name"
            type="text"
            class="list-create-form-input"
            :class="{ 'list-create-error': nameError }"
            placeholder="输入清单名称"
            maxlength="50"
            @input="validateName"
            @keyup.enter="confirm"
          />
          <div v-if="nameError" class="list-create-error-message">{{ nameError }}</div>
          <div class="list-create-char-count">{{ form.name.length }}/50</div>
        </div>
        
        <!-- 颜色选择 -->
        <div class="list-create-form-group">
          <label class="list-create-form-label">选择颜色</label>
          <div class="list-create-color-picker">
            <div 
              v-for="color in colorOptions" 
              :key="color"
              class="list-create-color-option"
              :class="{ 'list-create-active': form.color === color }"
              :style="{ backgroundColor: color }"
              @click="selectColor(color)"
              :title="getColorName(color)"
            >
              <i v-if="form.color === color" class="icon-check"></i>
            </div>
            
            <!-- 自定义颜色 -->
            <div class="list-create-color-option list-create-custom-color" :class="{ 'list-create-active': isCustomColor }">
              <input 
                type="color" 
                v-model="form.color"
                class="list-create-custom-color-input"
                @change="handleCustomColor"
                title="自定义颜色"
              />
              <i v-if="isCustomColor" class="icon-palette"></i>
            </div>
          </div>
        </div>
        
        <!-- 图标选择 -->
        <div class="list-create-form-group">
          <label class="list-create-form-label">选择图标</label>
          <div class="list-create-icon-picker">
            <div 
              v-for="icon in iconOptions" 
              :key="icon"
              class="list-create-icon-option"
              :class="{ 'list-create-active': form.icon === icon }"
              @click="selectIcon(icon)"
              :title="getIconName(icon)"
            >
              <span :class="`icon-${icon}`" :style="{ color: form.color }"></span>
            </div>
          </div>
        </div>
        
        <!-- 预览区域 -->
        <div class="list-create-form-group">
          <label class="list-create-form-label">预览</label>
          <div class="list-create-preview-container">
            <div class="list-create-preview-item">
              <div class="list-create-preview-icon" :style="{ color: form.color }">
                <span :class="`icon-${form.icon}`"></span>
              </div>
              <span class="list-create-preview-name">{{ form.name || '新列表' }}</span>
              <span class="list-create-preview-count">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'

export default {
  name: 'ListCreateDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    editingList: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'confirm'],
  setup(props, { emit }) {
    const nameInput = ref(null)
    
    // 表单数据
    const form = ref({
      name: '',
      color: '#007AFF',
      icon: 'list'
    })
    
    const nameError = ref('')
    
    // 颜色选项
    const colorOptions = [
      '#007AFF', // 蓝色
      '#FF3B30', // 红色
      '#FF9500', // 橙色
      '#FFCC00', // 黄色
      '#34C759', // 绿色
      '#5856D6', // 紫色
      '#FF2D92', // 粉色
      '#8E8E93', // 灰色
      '#00C7BE', // 青色
      '#5AC8FA'  // 浅蓝色
    ]
    
    // 图标选项
    const iconOptions = [
      'list', 'inbox', 'star', 'heart', 'bookmark', 'flag',
      'folder', 'briefcase', 'home', 'user', 'calendar',
      'clock', 'target', 'trophy', 'book', 'music'
    ]
    
    // 计算属性
    const isEditing = computed(() => !!props.editingList)
    
    const isCustomColor = computed(() => {
      return !colorOptions.includes(form.value.color)
    })
    
    const canConfirm = computed(() => {
      return form.value.name.trim().length > 0 && !nameError.value
    })
    
    // 方法
    const validateName = () => {
      const name = form.value.name.trim()
      
      if (!name) {
        nameError.value = '清单名称不能为空'
        return false
      }
      
      if (name.length > 50) {
        nameError.value = '清单名称不能超过50个字符'
        return false
      }
      
      // 检查特殊字符
      if (name.includes('<') || name.includes('>') || name.includes('&')) {
        nameError.value = '清单名称包含非法字符'
        return false
      }
      
      nameError.value = ''
      return true
    }
    
    const selectColor = (color) => {
      form.value.color = color
    }
    
    const handleCustomColor = (event) => {
      form.value.color = event.target.value
    }
    
    const selectIcon = (icon) => {
      form.value.icon = icon
    }
    
    const getColorName = (color) => {
      const colorNames = {
        '#007AFF': '蓝色',
        '#FF3B30': '红色',
        '#FF9500': '橙色',
        '#FFCC00': '黄色',
        '#34C759': '绿色',
        '#5856D6': '紫色',
        '#FF2D92': '粉色',
        '#8E8E93': '灰色',
        '#00C7BE': '青色',
        '#5AC8FA': '浅蓝色'
      }
      return colorNames[color] || '自定义颜色'
    }
    
    const getIconName = (icon) => {
      const iconNames = {
        'list': '列表',
        'inbox': '收件箱',
        'star': '星标',
        'heart': '心形',
        'bookmark': '书签',
        'flag': '旗帜',
        'folder': '文件夹',
        'briefcase': '公文包',
        'home': '家',
        'user': '用户',
        'calendar': '日历',
        'clock': '时钟',
        'target': '目标',
        'trophy': '奖杯',
        'book': '书籍',
        'music': '音乐'
      }
      return iconNames[icon] || icon
    }
    
    const resetForm = () => {
      form.value = {
        name: '',
        color: '#007AFF',
        icon: 'list'
      }
      nameError.value = ''
    }
    
    const loadEditingData = () => {
      console.log('loadEditingData called, editingList:', props.editingList)
      if (props.editingList) {
        form.value = {
          name: props.editingList.name || '',
          color: props.editingList.color || '#007AFF',
          icon: props.editingList.icon || 'list'
        }
        console.log('Form loaded with editing data:', form.value)
      } else {
        resetForm()
        console.log('Form reset to default values')
      }
    }
    
    const close = () => {
      emit('close')
    }
    
    const handleOverlayClick = () => {
      close()
    }
    
    const confirm = () => {
      if (!validateName()) return
      
      const listData = {
        name: form.value.name.trim(),
        color: form.value.color,
        icon: form.value.icon
      }
      
      emit('confirm', listData)
    }
    
    // 监听器 - 立即执行一次以处理初始状态
    watch(() => props.visible, (visible) => {
      // console.log('Dialog visibility changed:', visible, 'editingList:', props.editingList)
      if (visible) {
        // 使用 nextTick 确保在 DOM 更新后再加载数据
        nextTick(() => {
          loadEditingData()
          if (nameInput.value) {
            nameInput.value.focus()
            nameInput.value.select()
          }
        })
      }
    }, { immediate: true })
    
    watch(() => props.editingList, (newEditingList, oldEditingList) => {
      console.log('EditingList changed:', { old: oldEditingList, new: newEditingList })
      if (props.visible) {
        nextTick(() => {
          loadEditingData()
        })
      }
    }, { deep: true, immediate: true })
    
    return {
      nameInput,
      form,
      nameError,
      colorOptions,
      iconOptions,
      isEditing,
      isCustomColor,
      canConfirm,
      validateName,
      selectColor,
      handleCustomColor,
      selectIcon,
      getColorName,
      getIconName,
      close,
      handleOverlayClick,
      confirm
    }
  }
}
</script>

<style scoped>
@import '../assets/styles/components/list-create-dialog.css';
</style>