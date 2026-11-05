// 应用默认配置：electron-store 初始化默认值与 reset-config 重置值共用此份，避免两处漂移
const DEFAULT_CONFIG = {
  // 首次启动检测（reset-config 不重置这两项）
  isFirstLaunch: true,
  userGuideCompleted: false,
  background: null,
  floatingIcon: {
    x: 100,
    y: 100,
    size: 50,
    opacity: 100,
    visible: true
  },
  focusWidget: {
    visible: false,
    x: null,
    y: null
  },
  autoStart: false,
  showNotifications: true,
  apiServer: {
    enabled: false,
    host: '127.0.0.1',
    port: 1234
  },
  notificationSound: {
    enabled: true,
    soundFile: 'ding-126626.mp3',
    volume: 50
  },
  theme: 'system',
  customReminders: [
    { id: 1, label: '30分钟后', type: 'relative', value: 30, unit: 'minutes' },
    { id: 2, label: '1小时后', type: 'relative', value: 1, unit: 'hours' },
    { id: 3, label: '2小时后', type: 'relative', value: 2, unit: 'hours' },
    { id: 4, label: '1天后', type: 'relative', value: 1, unit: 'days' },
    { id: 5, label: '下周', type: 'relative', value: 7, unit: 'days' },
    { id: 6, label: '今天下午4点', type: 'absolute', time: '16:00', dayOffset: 0 },
    { id: 7, label: '明天9点', type: 'absolute', time: '09:00', dayOffset: 1 },
    { id: 8, label: '3天后上午10点', type: 'absolute', time: '10:00', dayOffset: 3 }
  ],
  ai: {
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
  }
}

module.exports = { DEFAULT_CONFIG }
