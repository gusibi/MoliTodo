<template>
  <div class="ai-settings-container">
    <h1 class="setting-page-title">AI 配置</h1>
    <p class="setting-page-description">配置 AI 助手功能，支持多种 AI 提供商</p>

    <!-- AI 提供商列表 -->
    <div class="setting-group">
      <h3 class="setting-group-title">AI 提供商</h3>
      <div class="ai-provider-list">
        <!-- 内置提供商 -->
        <div 
          v-for="provider in builtInProviders" 
          :key="provider.id"
          class="ai-provider-item"
        >
          <div 
            class="ai-provider-header"
            :class="{ 'ai-provider-active': aiConfig.selectedProvider === provider.id }"
            @click="toggleProvider(provider.id)"
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
            <div class="ai-provider-toggle">
              <svg 
                class="ai-provider-chevron dark:text-foreground"
                :class="{ 'ai-provider-chevron-expanded': expandedProvider === provider.id }"
                width="20" 
                height="20" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
          
          <!-- 配置表单 -->
          <div v-if="expandedProvider === provider.id" class="ai-provider-config">
            <div v-if="provider.id === 'openai'" class="ai-config-form">
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

            <div v-if="provider.id === 'google'" class="ai-config-form">
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

            <div v-if="provider.id === 'anthropic'" class="ai-config-form">
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

            <div v-if="provider.id === 'xai'" class="ai-config-form">
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

            <!-- 测试连接按钮 -->
            <div class="ai-test-section">
              <button 
                class="ai-test-button"
                :disabled="testingConnection || !isProviderConfigured(provider.id)"
                @click="testConnection"
              >
                <span v-if="testingConnection" class="ai-test-loading">测试中...</span>
                <span v-else>测试连接</span>
              </button>
              <div v-if="customTestResults[provider.id]" class="ai-test-result" :class="customTestResults[provider.id].type">
                {{ customTestResults[provider.id].message }}
              </div>
            </div>
          </div>
        </div>

        <!-- 自定义提供商 -->
        <div 
          v-for="(provider, index) in aiConfig.customProviders" 
          :key="provider.id"
          class="ai-provider-item"
        >
          <div 
            class="ai-provider-header"
            :class="{ 'ai-provider-active': aiConfig.selectedProvider === provider.id }"
            @click="toggleProvider(provider.id)"
          >
            <div class="ai-provider-icon">
              <svg class="w-6 h-6 dark:text-primary dark:stroke-[2.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div class="ai-provider-info">
              <div class="ai-provider-name">{{ provider.name || `自定义配置 ${index + 1}` }}</div>
              <div class="ai-provider-description">自定义 AI 提供商配置</div>
            </div>
            <div class="ai-provider-status">
              <div 
                class="ai-provider-status-dot"
                :class="{
                  'status-connected': isCustomProviderConfigured(provider),
                  'status-disconnected': !isCustomProviderConfigured(provider)
                }"
              ></div>
            </div>
            <div class="ai-provider-actions">
              <button 
                class="custom-provider-delete-btn"
                @click.stop="deleteCustomProvider(index)"
                title="删除配置"
              >
                <svg class="w-4 h-4 dark:text-destructive dark:stroke-[2.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div class="ai-provider-toggle">
              <svg 
                class="ai-provider-chevron"
                :class="{ 'ai-provider-chevron-expanded': expandedProvider === provider.id }"
                width="20" 
                height="20" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
          
          <!-- 自定义配置表单 -->
          <div v-if="expandedProvider === provider.id" class="ai-provider-config">
            <div class="ai-config-form">
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

            <!-- 测试连接按钮 -->
            <div class="ai-test-section">
              <button 
                class="ai-test-button"
                :disabled="testingConnection || !isCustomProviderConfigured(provider)"
                @click="testCustomConnection(provider)"
              >
                <span v-if="testingConnection" class="ai-test-loading">测试中...</span>
                <span v-else>测试连接</span>
              </button>
              <div v-if="customTestResults[provider.id]" class="ai-test-result" :class="customTestResults[provider.id].type">
                {{ customTestResults[provider.id].message }}
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
import { ref, reactive, computed, onMounted, h } from 'vue'

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
const customTestResults = ref({}) // 为每个自定义配置存储独立的测试结果

// 展开状态管理
const expandedProvider = ref('')

// 内置提供商计算属性
const builtInProviders = computed(() => aiProviders)

// AI 提供商列表
const aiProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-3.5 等模型',
    icon: h('img', {
      class: 'w-6 h-6 dark:invert dark:brightness-90',
      src: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openai.svg',
      alt: 'OpenAI Logo'
    })
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 1.5 Pro, Flash 等模型',
    icon: h('img', {
      class: 'w-6 h-6 dark:invert dark:brightness-90',
      src: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemini.svg',
      alt: 'Google Gemini Logo'
    })
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet, Haiku 等模型',
    icon: h('img', {
      class: 'w-6 h-6 dark:invert dark:brightness-90',
      src: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/claude.svg',
      alt: 'Anthropic Claude Logo'
    })
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    description: 'Grok Beta, Vision Beta 等模型',
    icon: h('img', {
      class: 'w-6 h-6 dark:invert dark:brightness-90',
      src: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/grok.svg',
      alt: 'xAI Grok Logo'
    })
  },
 
]

// 方法
const selectProvider = async (providerId) => {
  aiConfig.selectedProvider = providerId
  await saveConfig()
}

const toggleProvider = (providerId) => {
  if (expandedProvider.value === providerId) {
    expandedProvider.value = ''
  } else {
    expandedProvider.value = providerId
    // 点击任何提供商都自动选择它
    selectProvider(providerId)
  }
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
    // 清除该配置的测试结果
    customTestResults.value[providerId] = null
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
  // 自动展开新添加的配置
  expandedProvider.value = newProvider.id
  await saveConfig()
}

const deleteCustomProvider = async (index) => {
  const provider = aiConfig.customProviders[index]
  if (aiConfig.selectedProvider === provider.id) {
    // 如果删除的是当前选中的配置，切换到默认配置
    aiConfig.selectedProvider = 'openai'
  }
  if (expandedProvider.value === provider.id) {
    expandedProvider.value = ''
  }
  // 清除该配置的测试结果
  delete customTestResults.value[provider.id]
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

  console.log('测试连接', aiConfig.selectedProvider)

  testingConnection.value = true
  testResult.value = null

  try {
    let aiModel = {}
    
    if (aiConfig.selectedProvider.startsWith('custom-')) {
      const customProvider = aiConfig.customProviders.find(p => p.id === aiConfig.selectedProvider)
      if (customProvider) {
        aiModel = {
          id: aiConfig.selectedProvider,
          name: customProvider.name || '自定义配置',
          provider: 'Custom'
        }
      }
    } else {
      // 获取提供商名称
      const providerNames = {
        'openai': 'OpenAI',
        'google': 'Google', 
        'anthropic': 'Anthropic',
        'xai': 'xAI'
      }
      
      aiModel = {
        id: aiConfig.selectedProvider,
        name: providerNames[aiConfig.selectedProvider] || aiConfig.selectedProvider,
        provider: providerNames[aiConfig.selectedProvider] || aiConfig.selectedProvider
      }
    }
    
    // 调用主进程的测试连接方法
    const result = await window.electronAPI.ai.testConnectionByModel(aiModel)
    
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

const testCustomConnection = async (provider) => {
  if (!provider || !isCustomProviderConfigured(provider)) {
    return
  }

  console.log('测试自定义配置连接', provider.id)

  testingConnection.value = true
  // 清除该配置的之前测试结果
  customTestResults.value[provider.id] = null

  try {
    const aiModel = {
      id: provider.id,
      name: provider.name || '自定义配置',
      provider: 'Custom'
    }
    
    // 调用主进程的测试连接方法
    const result = await window.electronAPI.ai.testConnectionByModel(aiModel)
    
    customTestResults.value[provider.id] = {
      type: result.success ? 'success' : 'error',
      message: `${provider.name}：${result.message}`
    }
    console.log('自定义配置测试结果', customTestResults.value[provider.id])
  } catch (error) {
    customTestResults.value[provider.id] = {
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

<style>
@import '@/assets/styles/components/ai-settings.css';
</style>