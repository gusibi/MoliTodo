<template>
  <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <div class="list-create-dialog" @click.stop>
      <div class="dialog-header">
        <h3>{{ isEditing ? '编辑清单' : '新建清单' }}</h3>
        <button class="close-btn" @click="close">
          <i class="icon-close"></i>
        </button>
      </div>
      
      <div class="dialog-body">
        <!-- 清单名称 -->
        <div class="form-group">
          <label class="form-label">清单名称</label>
          <input 
            ref="nameInput"
            v-model="form.name"
            type="text"
            class="form-input"
            :class="{ error: nameError }"
            placeholder="输入清单名称"
            maxlength="50"
            @input="validateName"
            @keyup.enter="confirm"
          />
          <div v-if="nameError" class="error-message">{{ nameError }}</div>
          <div class="char-count">{{ form.name.length }}/50</div>
        </div>
        
        <!-- 颜色选择 -->
        <div class="form-group">
          <label class="form-label">选择颜色</label>
          <div class="color-picker">
            <div 
              v-for="color in colorOptions" 
              :key="color"
              class="color-option"
              :class="{ active: form.color === color }"
              :style="{ backgroundColor: color }"
              @click="selectColor(color)"
              :title="getColorName(color)"
            >
              <i v-if="form.color === color" class="icon-check"></i>
            </div>
            
            <!-- 自定义颜色 -->
            <div class="color-option custom-color" :class="{ active: isCustomColor }">
              <input 
                type="color" 
                v-model="form.color"
                class="custom-color-input"
                @change="handleCustomColor"
                title="自定义颜色"
              />
              <i v-if="isCustomColor" class="icon-palette"></i>
            </div>
          </div>
        </div>
        
        <!-- 图标选择 -->
        <div class="form-group">
          <label class="form-label">选择图标</label>
          <div class="icon-picker">
            <div 
              v-for="icon in iconOptions" 
              :key="icon"
              class="icon-option"
              :class="{ active: form.icon === icon }"
              @click="selectIcon(icon)"
              :title="getIconName(icon)"
            >
              <i :class="`icon-${icon}`" :style="{ color: form.color }"></i>
            </div>
          </div>
        </div>
        
        <!-- 预览 -->
        <div class="form-group">
          <label class="form-label">预览</label>
          <div class="preview-container">
            <div class="preview-item">
              <div class="preview-icon" :style="{ color: form.color }">
                <i :class="`icon-${form.icon}`"></i>
              </div>
              <span class="preview-name">{{ form.name || '清单名称' }}</span>
              <span class="preview-count">0</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button class="btn-cancel" @click="close">取消</button>
        <button 
          class="btn-confirm" 
          @click="confirm"
          :disabled="!canConfirm"
        >
          {{ isEditing ? '保存' : '创建' }}
        </button>
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
    
    const handleCustomColor = () => {
      // 自定义颜色选择后的处理
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
      if (props.editingList) {
        form.value = {
          name: props.editingList.name,
          color: props.editingList.color,
          icon: props.editingList.icon
        }
      } else {
        resetForm()
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
    
    // 监听器
    watch(() => props.visible, (visible) => {
      if (visible) {
        loadEditingData()
        nextTick(() => {
          if (nameInput.value) {
            nameInput.value.focus()
            nameInput.value.select()
          }
        })
      }
    })
    
    watch(() => props.editingList, () => {
      if (props.visible) {
        loadEditingData()
      }
    })
    
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
/* 模态框覆盖层 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* 对话框主体 */
.list-create-dialog {
  background: white;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  width: 480px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 对话框头部 */
.dialog-header {
  padding: 24px 24px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #8E8E93;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

/* 对话框主体内容 */
.dialog-body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

/* 表单组 */
.form-group {
  margin-bottom: 24px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

/* 输入框 */
.form-input {
  width: 100%;
  height: 44px;
  padding: 0 16px;
  border: 2px solid #E5E5EA;
  border-radius: 12px;
  font-size: 16px;
  color: #333;
  background: white;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #007AFF;
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
}

.form-input.error {
  border-color: #FF3B30;
}

.form-input.error:focus {
  border-color: #FF3B30;
  box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.1);
}

.error-message {
  margin-top: 8px;
  font-size: 12px;
  color: #FF3B30;
}

.char-count {
  margin-top: 4px;
  font-size: 12px;
  color: #8E8E93;
  text-align: right;
}

/* 颜色选择器 */
.color-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

.color-option {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
  border: 3px solid transparent;
}

.color-option:hover {
  transform: scale(1.05);
}

.color-option.active {
  border-color: rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.color-option i {
  color: white;
  font-size: 16px;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.custom-color {
  background: linear-gradient(45deg, 
    #ff0000 0%, #ff8000 14%, #ffff00 28%, 
    #80ff00 42%, #00ff00 57%, #00ff80 71%, 
    #00ffff 85%, #0080ff 100%);
  position: relative;
  overflow: hidden;
}

.custom-color-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.custom-color i {
  color: white;
  font-size: 20px;
}

/* 图标选择器 */
.icon-picker {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}

.icon-option {
  width: 44px;
  height: 44px;
  border: 2px solid #E5E5EA;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  background: white;
}

.icon-option:hover {
  border-color: #C7C7CC;
  transform: scale(1.05);
}

.icon-option.active {
  border-color: #007AFF;
  background: rgba(0, 122, 255, 0.1);
}

.icon-option i {
  font-size: 18px;
  transition: color 0.2s ease;
}

/* 预览区域 */
.preview-container {
  padding: 16px;
  background: #F8F9FA;
  border-radius: 12px;
  border: 1px solid #E5E5EA;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid #E5E5EA;
}

.preview-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.preview-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.preview-count {
  background: rgba(0, 0, 0, 0.1);
  color: #666;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

/* 对话框底部 */
.dialog-footer {
  padding: 0 24px 24px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  height: 44px;
  padding: 0 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.btn-cancel {
  background: #F2F2F7;
  color: #333;
}

.btn-cancel:hover {
  background: #E5E5EA;
}

.btn-confirm {
  background: #007AFF;
  color: white;
}

.btn-confirm:hover {
  background: #0056CC;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-confirm:disabled:hover {
  background: #007AFF;
}

/* 滚动条样式 */
.dialog-body::-webkit-scrollbar {
  width: 6px;
}

.dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-body::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.dialog-body::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .list-create-dialog {
    width: 95vw;
    margin: 20px;
  }
  
  .color-picker {
    grid-template-columns: repeat(5, 1fr);
  }
  
  .icon-picker {
    grid-template-columns: repeat(6, 1fr);
  }
  
  .dialog-header,
  .dialog-body,
  .dialog-footer {
    padding-left: 16px;
    padding-right: 16px;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .list-create-dialog {
    background: #2C2C2E;
  }
  
  .dialog-header h3 {
    color: #FFFFFF;
  }
  
  .close-btn {
    color: #8E8E93;
  }
  
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #FFFFFF;
  }
  
  .form-label {
    color: #FFFFFF;
  }
  
  .form-input {
    background: #1C1C1E;
    border-color: #48484A;
    color: #FFFFFF;
  }
  
  .form-input:focus {
    border-color: #007AFF;
  }
  
  .char-count {
    color: #8E8E93;
  }
  
  .icon-option {
    background: #1C1C1E;
    border-color: #48484A;
  }
  
  .icon-option:hover {
    border-color: #5A5A5C;
  }
  
  .preview-container {
    background: #1C1C1E;
    border-color: #48484A;
  }
  
  .preview-item {
    background: #2C2C2E;
    border-color: #48484A;
  }
  
  .preview-name {
    color: #FFFFFF;
  }
  
  .preview-count {
    background: rgba(255, 255, 255, 0.1);
    color: #FFFFFF;
  }
  
  .btn-cancel {
    background: #48484A;
    color: #FFFFFF;
  }
  
  .btn-cancel:hover {
    background: #5A5A5C;
  }
}
</style>