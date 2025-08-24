const { generateText } = require('ai');
const { openai, createOpenAI } = require('@ai-sdk/openai');
const { anthropic } = require('@ai-sdk/anthropic');
const { google } = require('@ai-sdk/google');

/**
 * AI服务类，负责处理不同AI提供商的连接和测试
 */
class AIService {
  /**
   * 测试AI连接
   * @param {Object} config - AI配置
   * @param {string} config.provider - 提供商名称
   * @param {string} config.apiKey - API密钥
   * @param {string} config.baseURL - 基础URL（可选）
   * @param {string} config.model - 模型名称
   * @returns {Promise<Object>} 测试结果
   */
  static async testConnection(config) {
    const { provider, apiKey, baseURL, model } = config;

    console.log("测试连接配置:", config);
    
    if (!apiKey) {
      return { success: false, error: 'API Key 不能为空' };
    }
    
    if (!model) {
      return { success: false, error: '模型名称不能为空' };
    }
    
    try {
      let modelInstance;
      
      // console.log("apiKey类型:", typeof apiKey, "值:", apiKey);
      
      switch (provider.toLowerCase()) {
        case 'openai':
          const openaiProvider = createOpenAI({
            apiKey,
            baseURL: baseURL || 'https://api.openai.com/v1'
          });
          modelInstance = openaiProvider.chat(model);
          break;
          
        case 'anthropic':
          const anthropicProvider = anthropic({
            apiKey
          });
          modelInstance = anthropicProvider(model);
          break;
          
        case 'google':
          const googleProvider = google({
            apiKey
          });
          modelInstance = googleProvider(model);
          break;
          
        default:
          // 自定义提供商，使用OpenAI兼容格式
          if (!baseURL) {
            return { success: false, error: '自定义提供商需要提供baseURL' };
          }
          const customProvider = createOpenAI({
            apiKey,
            baseURL
          });
          modelInstance = customProvider.chat(model);
      }
      
      // console.log("apiKey:", apiKey, "baseUrl: ", baseURL);
      // 发送测试请求
      const { text } = await generateText({
        model: modelInstance,
        prompt: 'Hello, this is a connection test. Please respond with "Connection successful".',
        maxTokens: 50,
        temperature: 0
      });

      console.log("测试响应:", text);
      
      return {
        success: true,
        message: `${provider} 连接成功`,
        model: model,
        response: text.trim()
      };
      
    } catch (error) {
      console.error('AI连接测试失败:', error);
      
      // 解析不同类型的错误
      let errorMessage = '连接失败';
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'API密钥无效或已过期';
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        errorMessage = '模型不存在或API端点错误';
      } else if (error.message.includes('429') || error.message.includes('Rate limit')) {
        errorMessage = 'API调用频率超限，请稍后重试';
      } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
        errorMessage = '网络连接超时，请检查网络设置';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * 获取支持的提供商列表
   * @returns {Array} 提供商列表
   */
  static getSupportedProviders() {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
      },
      {
        id: 'google',
        name: 'Google',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']
      }
    ];
  }
}

module.exports = { AIService };