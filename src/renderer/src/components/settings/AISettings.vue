<template>
  <div class="ai-settings-container">
    <h1 class="setting-page-title">AI 配置</h1>
    <p class="setting-page-description">配置 AI 助手功能，支持多种 AI 提供商</p>

    <!-- AI 提供商选择 -->
    <div class="setting-group">
      <h3 class="setting-group-title">AI 提供商</h3>
      <div class="ai-provider-grid">
        <div 
          v-for="provider in aiProviders" 
          :key="provider.id"
          class="ai-provider-card"
          :class="{ 'ai-provider-active': aiConfig.selectedProvider === provider.id }"
          @click="selectProvider(provider.id)"
        >
          <div class="ai-provider-icon">
            <component :is="provider.icon" />
          </div>
          <div class="ai-provider-info">
            <div class="ai-provider-name">{{ provider.name }}</div>
            <div class="ai-provider-description">{{ provider.description }}</div>
          </div>
          <div class="ai-provider-status">
            <div 
              class="ai-provider-status-dot"
              :class="{
                'status-connected': isProviderConfigured(provider.id),
                'status-disconnected': !isProviderConfigured(provider.id)
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 提供商配置 -->
    <div v-if="aiConfig.selectedProvider" class="setting-group">
      <h3 class="setting-group-title">{{ getSelectedProviderName() }} 配置</h3>
      
      <!-- OpenAI 配置 -->
      <div v-if="aiConfig.selectedProvider === 'openai'" class="ai-config-form">
        <div class="setting-form-item">
          <label class="setting-form-label">API Key</label>
          <input 
            v-model="aiConfig.providers.openai.apiKey"
            type="password"
            class="setting-form-input"
            placeholder="sk-..."
            @input="updateProviderConfig"
          />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">Base URL (可选)</label>
          <input 
            v-model="aiConfig.providers.openai.baseURL"
            type="text"
            class="setting-form-input"
            placeholder="https://api.openai.com/v1"
            @input="updateProviderConfig"
          />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">模型</label>
          <select 
            v-model="aiConfig.providers.openai.model"
            class="setting-form-select"
            @change="updateProviderConfig"
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
        </div>
      </div>

      <!-- Google Gemini 配置 -->
      <div v-if="aiConfig.selectedProvider === 'google'" class="ai-config-form">
        <div class="setting-form-item">
          <label class="setting-form-label">API Key</label>
          <input 
            v-model="aiConfig.providers.google.apiKey"
            type="password"
            class="setting-form-input"
            placeholder="AIza..."
            @input="updateProviderConfig"
          />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">模型</label>
          <select 
            v-model="aiConfig.providers.google.model"
            class="setting-form-select"
            @change="updateProviderConfig"
          >
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-pro">Gemini Pro</option>
          </select>
        </div>
      </div>

      <!-- Anthropic 配置 -->
      <div v-if="aiConfig.selectedProvider === 'anthropic'" class="ai-config-form">
        <div class="setting-form-item">
          <label class="setting-form-label">API Key</label>
          <input 
            v-model="aiConfig.providers.anthropic.apiKey"
            type="password"
            class="setting-form-input"
            placeholder="sk-ant-..."
            @input="updateProviderConfig"
          />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">模型</label>
          <select 
            v-model="aiConfig.providers.anthropic.model"
            class="setting-form-select"
            @change="updateProviderConfig"
          >
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
          </select>
        </div>
      </div>

      <!-- xAI 配置 -->
      <div v-if="aiConfig.selectedProvider === 'xai'" class="ai-config-form">
        <div class="setting-form-item">
          <label class="setting-form-label">API Key</label>
          <input 
            v-model="aiConfig.providers.xai.apiKey"
            type="password"
            class="setting-form-input"
            placeholder="xai-..."
            @input="updateProviderConfig"
          />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">Base URL</label>
          <input 
            v-model="aiConfig.providers.xai.baseURL"
            type="text"
            class="setting-form-input"
            placeholder="https://api.x.ai/v1"
            @input="updateProviderConfig"
          />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">模型</label>
          <select 
            v-model="aiConfig.providers.xai.model"
            class="setting-form-select"
            @change="updateProviderConfig"
          >
            <option value="grok-beta">Grok Beta</option>
            <option value="grok-vision-beta">Grok Vision Beta</option>
          </select>
        </div>
      </div>

      <!-- 自定义配置管理 -->
      <div v-if="aiConfig.selectedProvider.startsWith('custom')" class="ai-config-form">
        <!-- 现有自定义配置列表 -->
        <div v-if="aiConfig.customProviders.length > 0" class="custom-providers-list">
          <h4 class="custom-providers-title">自定义配置</h4>
          <div v-for="(provider, index) in aiConfig.customProviders" :key="provider.id" class="custom-provider-item">
            <div class="custom-provider-header">
              <div class="custom-provider-info">
                <span class="custom-provider-name">{{ provider.name || `自定义配置 ${index + 1}` }}</span>
                <span class="custom-provider-status" :class="{ 'configured': isCustomProviderConfigured(provider) }">
                  {{ isCustomProviderConfigured(provider) ? '已配置' : '未配置' }}
                </span>
              </div>
              <div class="custom-provider-actions">
                <button 
                  class="custom-provider-select-btn"
                  :class="{ 'active': aiConfig.selectedProvider === provider.id }"
                  @click="selectProvider(provider.id)"
                >
                  {{ aiConfig.selectedProvider === provider.id ? '当前选中' : '选择' }}
                </button>
                <button class="custom-provider-delete-btn" @click="deleteCustomProvider(index)">
                  删除
                </button>
              </div>
            </div>
            
            <!-- 配置表单 -->
            <div v-if="aiConfig.selectedProvider === provider.id" class="custom-provider-form">
              <div class="setting-form-item">
                <label class="setting-form-label">配置名称</label>
                <input 
                  v-model="provider.name"
                  type="text"
                  class="setting-form-input"
                  placeholder="自定义配置名称"
                  @input="updateCustomProviderConfig(provider.id, 'name', $event.target.value)"
                />
              </div>
              <div class="setting-form-item">
                <label class="setting-form-label">API Key</label>
                <input 
                  v-model="provider.apiKey"
                  type="password"
                  class="setting-form-input"
                  placeholder="your-api-key"
                  @input="updateCustomProviderConfig(provider.id, 'apiKey', $event.target.value)"
                />
              </div>
              <div class="setting-form-item">
                <label class="setting-form-label">Base URL</label>
                <input 
                  v-model="provider.baseURL"
                  type="text"
                  class="setting-form-input"
                  placeholder="https://api.example.com/v1"
                  @input="updateCustomProviderConfig(provider.id, 'baseURL', $event.target.value)"
                />
              </div>
              <div class="setting-form-item">
                <label class="setting-form-label">模型名称</label>
                <input 
                  v-model="provider.model"
                  type="text"
                  class="setting-form-input"
                  placeholder="model-name"
                  @input="updateCustomProviderConfig(provider.id, 'model', $event.target.value)"
                />
              </div>
            </div>
          </div>
        </div>
        
        <!-- 添加新的自定义配置按钮 -->
        <div class="add-custom-provider">
          <button class="add-custom-provider-btn" @click="addCustomProvider">
            <span class="add-icon">+</span>
            添加自定义配置
          </button>
        </div>
      </div>

      <!-- 测试连接按钮 -->
      <div class="ai-test-section">
        <button 
          class="ai-test-button"
          :disabled="testingConnection || !isProviderConfigured(aiConfig.selectedProvider)"
          @click="testConnection"
        >
          <span v-if="testingConnection" class="ai-test-loading">测试中...</span>
          <span v-else>测试连接</span>
        </button>
        <div v-if="testResult" class="ai-test-result" :class="testResult.type">
          {{ testResult.message }}
        </div>
      </div>
    </div>

    <!-- AI 功能设置 -->
    <div v-if="isProviderConfigured(aiConfig.selectedProvider)" class="setting-group">
      <h3 class="setting-group-title">AI 功能设置</h3>
      
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">智能任务建议</div>
          <div class="setting-item-description">AI 根据任务内容提供优化建议</div>
        </div>
        <div class="setting-item-control">
          <button 
            class="setting-toggle" 
            :class="{ 'setting-toggle-active': aiConfig.features.taskSuggestions }"
            @click="toggleFeature('taskSuggestions')"
          >
            <span class="setting-toggle-button"></span>
          </button>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">自动分类</div>
          <div class="setting-item-description">AI 自动为任务分配合适的分类</div>
        </div>
        <div class="setting-item-control">
          <button 
            class="setting-toggle" 
            :class="{ 'setting-toggle-active': aiConfig.features.autoCategories }"
            @click="toggleFeature('autoCategories')"
          >
            <span class="setting-toggle-button"></span>
          </button>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">智能提醒</div>
          <div class="setting-item-description">AI 根据任务重要性智能设置提醒时间</div>
        </div>
        <div class="setting-item-control">
          <button 
            class="setting-toggle" 
            :class="{ 'setting-toggle-active': aiConfig.features.smartReminders }"
            @click="toggleFeature('smartReminders')"
          >
            <span class="setting-toggle-button"></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, h } from 'vue'

// AI 配置数据
const aiConfig = reactive({
  enabled: true,
  selectedProvider: '',
  providers: {
    openai: {
      apiKey: '',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o'
    },
    google: {
      apiKey: '',
      model: 'gemini-1.5-pro'
    },
    anthropic: {
      apiKey: '',
      model: 'claude-3-5-sonnet-20241022'
    },
    xai: {
      apiKey: '',
      baseURL: 'https://api.x.ai/v1',
      model: 'grok-beta'
    }
  },
  customProviders: [],
  features: {
    taskSuggestions: true,
    autoCategories: false,
    smartReminders: false
  }
})

// 测试相关状态
const testingConnection = ref(false)
const testResult = ref(null)

// AI 提供商列表
const aiProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-3.5 等模型',
    icon: h('svg', {
      class: 'w-6 h-6',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'
      })
    ])
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 1.5 Pro, Flash 等模型',
    icon: h('svg', {
      class: 'w-6 h-6',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z'
      })
    ])
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet, Haiku 等模型',
    icon: h('svg', {
      class: 'w-6 h-6',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M7.307 2.5h1.5L14.5 21.5h-1.5L11.307 16H4.693L3 21.5H1.5L7.307 2.5zM5.307 14.5h5.386L8 6.5 5.307 14.5zM16.5 2.5h1.5L23.693 21.5h-1.5L20.5 16h-6.614L12.193 21.5h-1.5L16.5 2.5zM14.307 14.5h5.386L17 6.5l-2.693 8z'
      })
    ])
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    description: 'Grok Beta, Vision Beta 等模型',
    icon: h('svg', {
      class: 'w-6 h-6',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
      })
    ])
  },
  {
    id: 'custom',
    name: '自定义',
    description: '配置自定义 AI 提供商',
    icon: h('svg', {
      class: 'w-6 h-6',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
      }),
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
      })
    ])
  }
]

// 方法
const selectProvider = async (providerId) => {
  aiConfig.selectedProvider = providerId
  await saveConfig()
}

const updateProviderConfig = async () => {
  await saveConfig()
  // 清除之前的测试结果
  testResult.value = null
}

const updateCustomProviderConfig = async (providerId, field, value) => {
  const provider = aiConfig.customProviders.find(p => p.id === providerId)
  if (provider) {
    provider[field] = value
    await saveConfig()
    // 清除之前的测试结果
    testResult.value = null
  }
}

const toggleFeature = async (featureName) => {
  aiConfig.features[featureName] = !aiConfig.features[featureName]
  await saveConfig()
}

const isProviderConfigured = (providerId) => {
  if (providerId.startsWith('custom-')) {
    const customProvider = aiConfig.customProviders.find(p => p.id === providerId)
    return customProvider && isCustomProviderConfigured(customProvider)
  }
  
  const provider = aiConfig.providers[providerId]
  if (!provider) return false
  
  switch (providerId) {
    case 'openai':
      return !!provider.apiKey
    case 'google':
      return !!provider.apiKey
    case 'anthropic':
      return !!provider.apiKey
    case 'xai':
      return !!provider.apiKey && !!provider.baseURL
    default:
      return false
  }
}

const isCustomProviderConfigured = (provider) => {
  return !!(provider.apiKey && provider.baseURL && provider.model)
}

const addCustomProvider = async () => {
  const newProvider = {
    id: `custom-${Date.now()}`,
    name: '',
    apiKey: '',
    baseURL: '',
    model: ''
  }
  aiConfig.customProviders.push(newProvider)
  aiConfig.selectedProvider = newProvider.id
  await saveConfig()
}

const deleteCustomProvider = async (index) => {
  const provider = aiConfig.customProviders[index]
  if (aiConfig.selectedProvider === provider.id) {
    // 如果删除的是当前选中的配置，切换到默认配置
    aiConfig.selectedProvider = 'openai'
  }
  aiConfig.customProviders.splice(index, 1)
  await saveConfig()
}

const getSelectedProviderName = () => {
  if (aiConfig.selectedProvider.startsWith('custom-')) {
    const customProvider = aiConfig.customProviders.find(p => p.id === aiConfig.selectedProvider)
    return customProvider ? (customProvider.name || '自定义配置') : '自定义配置'
  }
  const provider = aiProviders.find(p => p.id === aiConfig.selectedProvider)
  return provider ? provider.name : ''
}

const testConnection = async () => {
  if (!aiConfig.selectedProvider || !isProviderConfigured(aiConfig.selectedProvider)) {
    return
  }

  testingConnection.value = true
  testResult.value = null

  try {
    let config = {}
    
    if (aiConfig.selectedProvider.startsWith('custom-')) {
      const customProvider = aiConfig.customProviders.find(p => p.id === aiConfig.selectedProvider)
      if (customProvider) {
        config = {
          provider: 'custom',
          apiKey: customProvider.apiKey,
          baseURL: customProvider.baseURL,
          model: customProvider.model
        }
      }
    } else {
      const provider = aiConfig.providers[aiConfig.selectedProvider]
      config = {
        provider: aiConfig.selectedProvider,
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
        model: provider.model
      }
    }
    
    // 调用主进程的测试连接方法
    const result = await window.electronAPI.ai.testConnection(config)
    
    testResult.value = {
      type: result.success ? 'success' : 'error',
      message: result.message
    }
  } catch (error) {
    testResult.value = {
      type: 'error',
      message: `连接失败：${error.message || '未知错误'}`
    }
  } finally {
    testingConnection.value = false
  }
}

const loadConfig = async () => {
  try {
    // 从 electron-store 加载配置
    const allConfig = await window.electronAPI.config.get()
    console.log("allConfig", allConfig)
    if (allConfig && allConfig.ai) {
      Object.assign(aiConfig, allConfig.ai)
    }
  } catch (error) {
    console.error('加载 AI 配置失败:', error)
  }
}

const saveConfig = async () => {
  console.log('保存 AI 配置:', aiConfig)
  try {
    // 将响应式对象转换为普通对象，避免序列化问题
    const configToSave = JSON.parse(JSON.stringify(aiConfig))
    await window.electronAPI.config.update('ai', configToSave)
  } catch (error) {
    console.error('保存 AI 配置失败:', error)
  }
}

// 生命周期
onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.ai-settings-container {
  @apply w-full;
}

.ai-provider-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4 mb-6;
}

.ai-provider-card {
  @apply flex items-center p-4 border border-border rounded-lg cursor-pointer;
  @apply transition-all duration-200 hover:shadow-md hover:border-primary/50;
}

.ai-provider-active {
  @apply border-primary bg-primary/5;
}

.ai-provider-icon {
  @apply flex-shrink-0 w-12 h-12 flex items-center justify-center;
  @apply bg-muted rounded-lg mr-4;
}

.ai-provider-info {
  @apply flex-1;
}

.ai-provider-name {
  @apply font-semibold text-foreground mb-1;
}

.ai-provider-description {
  @apply text-sm text-muted-foreground;
}

.ai-provider-status {
  @apply flex-shrink-0;
}

.ai-provider-status-dot {
  @apply w-3 h-3 rounded-full;
}

.status-connected {
  @apply bg-green-500;
}

.status-disconnected {
  @apply bg-gray-300;
}

.ai-config-form {
  @apply space-y-4;
}

.setting-form-item {
  @apply flex flex-col gap-2;
}

.setting-form-label {
  @apply text-sm font-medium text-foreground;
}

.setting-form-input {
  @apply px-3 py-2 border border-border rounded-md bg-background text-foreground;
  @apply transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary;
}

.setting-form-select {
  @apply px-3 py-2 border border-border rounded-md bg-background text-foreground;
  @apply transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary;
}

.ai-test-section {
  @apply flex items-center gap-4 mt-6 pt-4 border-t border-border;
}

.ai-test-button {
  @apply px-4 py-2 bg-primary text-primary-foreground rounded-md;
  @apply transition-all duration-200 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed;
}

.ai-test-loading {
  @apply flex items-center gap-2;
}

.ai-test-result {
  @apply px-3 py-2 rounded-md text-sm;
}

.ai-test-result.success {
  @apply bg-green-100 text-green-800 border border-green-200;
}

.ai-test-result.error {
  @apply bg-red-100 text-red-800 border border-red-200;
}

/* 自定义配置样式 */
.custom-providers-list {
  @apply mb-6;
}

.custom-providers-title {
  @apply text-lg font-semibold text-foreground mb-4;
}

.custom-provider-item {
  @apply border border-border rounded-lg mb-4 overflow-hidden;
}

.custom-provider-header {
  @apply flex items-center justify-between p-4 bg-muted/30;
}

.custom-provider-info {
  @apply flex items-center gap-3;
}

.custom-provider-name {
  @apply font-medium text-foreground;
}

.custom-provider-status {
  @apply text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600;
}

.custom-provider-status.configured {
  @apply bg-green-100 text-green-700;
}

.custom-provider-actions {
  @apply flex items-center gap-2;
}

.custom-provider-select-btn {
  @apply px-3 py-1 text-sm border border-border rounded-md;
  @apply transition-colors duration-200 hover:bg-muted;
}

.custom-provider-select-btn.active {
  @apply bg-primary text-primary-foreground border-primary;
}

.custom-provider-delete-btn {
  @apply px-3 py-1 text-sm text-red-600 border border-red-200 rounded-md;
  @apply transition-colors duration-200 hover:bg-red-50 hover:border-red-300;
}

.custom-provider-form {
  @apply p-4 border-t border-border space-y-4;
}

.add-custom-provider {
  @apply flex justify-center;
}

.add-custom-provider-btn {
  @apply flex items-center gap-2 px-4 py-2 border-2 border-dashed border-border rounded-lg;
  @apply transition-all duration-200 hover:border-primary hover:bg-primary/5;
  @apply text-muted-foreground hover:text-primary;
}

.add-icon {
  @apply text-lg font-bold;
}

.setting-button {
  @apply px-4 py-2 bg-primary text-primary-foreground rounded-md;
  @apply transition-all duration-200 hover:bg-primary/90;
  @apply text-sm font-medium;
}

/* 深色模式适配 */
[data-theme="dark"] .ai-test-result.success {
  @apply bg-green-900/20 text-green-400 border-green-800;
}

[data-theme="dark"] .ai-test-result.error {
  @apply bg-red-900/20 text-red-400 border-red-800;
}

[data-theme="dark"] .custom-provider-status {
  @apply bg-gray-800 text-gray-300;
}

[data-theme="dark"] .custom-provider-status.configured {
  @apply bg-green-900/30 text-green-400;
}

[data-theme="dark"] .custom-provider-delete-btn {
  @apply text-red-400 border-red-800 hover:bg-red-900/20 hover:border-red-700;
}
</style>