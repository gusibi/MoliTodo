const { generateText, streamText } = require('ai');
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
   * 获取模型实例
   * @param {Object} aiConfig AI配置
   * @returns {Object} 模型实例
   */
  static getModelInstance(aiConfig) {
    const { provider, apiKey, baseURL, model } = aiConfig;
    
    if (!apiKey) {
      throw new Error('AI配置不完整：缺少API Key');
    }
    
    if (!model) {
      throw new Error('AI配置不完整：缺少模型名称');
    }
    
    switch (provider.toLowerCase()) {
      case 'openai':
        const openaiProvider = createOpenAI({
          apiKey,
          baseURL: baseURL || 'https://api.openai.com/v1'
        });
        return openaiProvider.chat(model);
        
      case 'anthropic':
        const anthropicProvider = anthropic({
          apiKey
        });
        return anthropicProvider(model);
        
      case 'google':
        const googleProvider = google({
          apiKey
        });
        return googleProvider(model);
        
      default:
        // 自定义提供商，使用OpenAI兼容格式
        if (!baseURL) {
          throw new Error('自定义提供商需要提供baseURL');
        }
        const customProvider = createOpenAI({
          apiKey,
          baseURL
        });
        return customProvider.chat(model);
    }
  }

  /**
   * 根据 AI 模型信息获取模型配置
   * @param {Object} aiModel - AI模型信息 { id, name, provider }
   * @param {Object} windowManager - WindowManager实例，用于获取配置
   * @returns {Object} 模型配置
   */
  static getModelConfig(aiModel, windowManager) {
    // 从配置中获取 AI 配置
    const config = windowManager.getConfig();
    const aiConfig = config.ai || {};
    const providers = aiConfig.providers || {};
    const customProviders = aiConfig.customProviders || [{}];
    
    // 根据 aiModel 找到对应的配置
    let modelConfig = null;
    
    if (aiModel.provider === 'OpenAI' && providers.openai) {
      modelConfig = {
        provider: 'openai',
        model: providers.openai.model || 'gpt-4o',
        apiKey: providers.openai.apiKey,
        baseURL: providers.openai.baseURL || 'https://api.openai.com/v1'
      };
    } else if (aiModel.provider === 'Google' && providers.google) {
      modelConfig = {
        provider: 'google',
        model: providers.google.model || 'gemini-1.5-pro',
        apiKey: providers.google.apiKey
      };
    } else if (aiModel.provider === 'Anthropic' && providers.anthropic) {
      modelConfig = {
        provider: 'anthropic',
        model: providers.anthropic.model || 'claude-3-5-sonnet-20241022',
        apiKey: providers.anthropic.apiKey,
        baseURL: providers.anthropic.baseURL || 'https://api.anthropic.com'
      };
    } else if (aiModel.provider === 'Custom' && customProviders.length > 0) {
      // 对于自定义提供商，需要根据 aiModel.id 找到对应的配置
      const customProvider = customProviders.find(p => p.id === aiModel.id);
      if (customProvider) {
        modelConfig = {
          provider: 'custom',
          model: customProvider.model,
          apiKey: customProvider.apiKey,
          baseURL: customProvider.baseURL
        };
      }
    }
    
    if (!modelConfig) {
      throw new Error(`未找到 AI 模型 ${aiModel.name} (${aiModel.provider}) 的配置`);
    }
    
    if (!modelConfig.apiKey) {
      throw new Error(`AI 模型 ${aiModel.name} 的 API Key 未配置`);
    }
    
    return modelConfig;
  }

  /**
   * 生成任务列表
   * @param {string} content - 用户输入的内容
   * @param {Object} aiModel - AI模型信息 { id, name, provider }
   * @param {Object} windowManager - WindowManager实例，用于获取配置
   * @returns {Promise<Object>} 生成结果
   */
  static async generateTaskList(content, aiModel, windowManager) {
    try {
      const modelConfig = this.getModelConfig(aiModel, windowManager);
      const modelInstance = this.getModelInstance(modelConfig);
      const currentTime = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString();
      console.log("currentTime:", currentTime);
      
      const prompt = `{
  "user_prompt": {
    "role": "你是一名顶级的任务规划师（Task Planner）和项目经理（Project Manager）。",
    "capabilities": [
      "深入分析用户提供的目标，理解其核心需求。",
      "能够判断用户目标的复杂性，并决定是直接创建单个任务还是进行多任务拆解。",
      "将复杂的目标拆解为一系列具体的、可执行的、符合逻辑顺序的子任务（atomic tasks）。",
      "根据上下文信息（如当前日期、时间描述）智能推断任务的截止日期和时间。",
      "严格按照指定的 JSON 格式生成结果，不添加任何额外的解释性文字。"
    ]
  },
  "instructions": {
    "goal": "根据用户提供的'user_goal'和'context'，生成一个结构化的'task_list' JSON 对象。",
    "steps": [
      "1. **判断任务类型**: 首先，评估 'user_goal' 是一个'简单直接的行动'（如'看电影', '打电话', '买东西'）还是一个'需要多步骤完成的项目'（如'完成功能开发', '准备报告', '策划活动'）。",
      "2. **创建任务 (简单行动型)**: 如果目标是'简单行动型'，则直接将其作为单个任务的 'content'，并进入第4步。",
      "3. **任务拆解 (项目型)**: 如果目标是'项目型'，则将其拆解为关键的逻辑步骤，每个步骤生成一个任务对象。",
      "4. **填充时间信息**: 使用 'context.current_time' 和 'user_goal' 中的时间描述来确定 'dueDate' 和 'dueTime'，转换后的时间需要和 'context.current_time' 保持时区一致，如果没有时间信息，就忽略时间字段",
      "5. **完成并封装**: 根据规则填充其他字段，将所有生成的任务组合成一个 'task_list' 数组，并编写 'output_description'。"
    ],
    "rules": {
      "task_atomicity": "对于项目型任务，每个子任务都应该是最小的可执行单元。",
      "time_inference": {
        "specific_time": "如果用户提供了具体时间（如'下午3点', '15:00'），则优先使用该时间作为 'dueTime'。",
        "today": "使用 'context.current_time' 的天。",
        "tomorrow": "使用 'context.current_time' 的后一天。",
        "afternoon": "如果未指定具体时间，'dueTime' 默认为 18:00。",
        "evening": "如果未指定具体时间，'dueTime' 默认为 21:00。",
        "default_time": "如果未指定任何时间，默认为当天 23:59。"
      },
      "reminder_calculation": "'reminderTime' 应设置为 'dueTime' 之前的一小时。",
      "placeholder_fields": "如果 'listId' 或 'metadata' 没有特定信息，可以直接使用示例中的值或保持为空。",
      "output_strictness": "最终输出必须是一个完整的、格式正确的 JSON 对象，除此之外不要有任何其他内容。"
    }
  },
  "context": {
    "current_time": "${currentTime}",
    "user_goal": "${content}"
  },
  "output_format_and_examples": {
    "description": "输出应包含 'task_list' 和 'output_description' 两个键。",
    "example_1_complex": {
      "input_goal": "今天下午完成 AI 生成任务功能",
      "output": {
        "task_list": [
          {
            "content": "后端：设计并实现 AI 模型调用接口",
            "dueDate": "2025-08-24",
            "dueTime": "18:00",
            "reminderTime": "2025-08-24T17:00:00.000Z",
            "listId": 1755532210103,
            "metadata": { "note": "需要考虑认证和速率限制" }
          },
          {
            "content": "前端：开发任务生成按钮和交互逻辑",
            "dueDate": "2025-08-24",
            "dueTime": "18:00",
            "reminderTime": "2025-08-24T17:00:00.000Z",
            "listId": 1755532210103,
            "metadata": { "note": "" }
          },
          {
            "content": "联调前后端接口并完成测试",
            "dueDate": "2025-08-24",
            "dueTime": "18:00",
            "reminderTime": "2025-08-24T17:00:00.000Z",
            "listId": 1755532210103,
            "metadata": { "note": "" }
          }
        ],
        "output_description": "已为您将“完成AI生成任务功能”拆解为3个可执行任务，并安排在今天下午18:00前完成。"
      }
    },
    "example_2_complex": {
      "input_goal": "明天要完成第一版产品宣传网站的上线",
      "output": {
        "task_list": [
          { "content": "完成网站首页的 UI 设计稿", "dueDate": "2025-08-25", "dueTime": "12:00", "reminderTime": "2025-08-25T11:00:00.000Z", "listId": 1755532210104, "metadata": { "note": "重点突出产品核心卖点" } },
          { "content": "编写网站所需的宣传文案", "dueDate": "2025-08-25", "dueTime": "15:00", "reminderTime": "2025-08-25T14:00:00.000Z", "listId": 1755532210104, "metadata": { "note": "" } },
          { "content": "开发网站前端页面并部署到测试环境", "dueDate": "2025-08-25", "dueTime": "20:00", "reminderTime": "2025-08-25T19:00:00.000Z", "listId": 1755532210104, "metadata": { "note": "确保移动端兼容性" } },
          { "content": "最终测试并正式上线网站", "dueDate": "2025-08-25", "dueTime": "23:00", "reminderTime": "2025-08-25T22:00:00.000Z", "listId": 1755532210104, "metadata": { "note": "检查域名解析和 SSL 证书" } }
        ],
        "output_description": "已将“上线产品宣传网站”规划为4个关键步骤，并安排在明天完成。"
      }
    },
    "example_3_simple": {
      "input_goal": "今天下午3点去看电影",
      "output": {
        "task_list": [
          {
            "content": "去看电影",
            "dueDate": "2025-08-24",
            "dueTime": "15:00",
            "reminderTime": "2025-08-24T04:00:00.000Z",
            "listId": 1755532210105,
            "metadata": { "note": "" }
          }
        ],
        "output_description": "已为您创建任务“去看电影”，时间是今天下午3点。"
      }
    }
  }
}
`;
      
      const { text } = await generateText({
        model: modelInstance,
        prompt: prompt,
        maxTokens: 1000,
        temperature: 0.7
      });

      console.log('AI返回的原始内容:', text);
      
      // 尝试解析AI返回的JSON
      let parsedResult;
      try {
        // 清理可能的markdown代码块标记
        const cleanedText = text.replace(/```json\n?|```\n?/g, '').trim();
        parsedResult = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('AI返回的内容无法解析为JSON:', text);
        throw new Error('AI返回的格式不正确，无法解析为任务列表');
      }
      
      // 验证返回的数据结构
      if (!parsedResult.task_list || !Array.isArray(parsedResult.task_list)) {
        throw new Error('AI返回的数据结构不正确：缺少tasks数组');
      }
      
      // 验证每个任务的基本结构
      const validTasks = parsedResult.task_list.filter(task => {
        return task && typeof task.content === 'string' && task.content.trim();
      }).map(task => {
        let reminderTime = null;
        if (task.dueDate && task.dueTime) {
          // 将 dueDate + dueTime 拼接并转换为 UTC 时间
          const localDateTime = `${task.dueDate}T${task.dueTime}:00`;
          const localDate = new Date(localDateTime);
          reminderTime = localDate.toISOString();
          console.log("reminderTime:", reminderTime);
        } else if (task.reminderTime) {
          reminderTime = task.reminderTime;
        }
        
        return {
          content: task.content.trim(),
          dueDate: task.dueDate || null,
          dueTime: task.dueTime || null,
          reminderTime: reminderTime,
          metadata: task.metadata || { note: '' }
        };
      });
      
      console.log("validTasks:", validTasks);
      return {
        success: true,
        tasks: validTasks,
        originalResponse: text
      };
      
    } catch (error) {
      console.error('AI生成任务列表失败:', error);
      
      let errorMessage = '生成任务列表失败';
      
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
      
      throw new Error(errorMessage);
    }
  }

  /**
   * 流式生成任务列表
   * @param {string} content - 用户输入的内容
   * @param {Object} aiModel - AI模型信息 { id, name, provider }
   * @param {Object} windowManager - WindowManager实例，用于获取配置
   * @param {Function} onChunk - 流式数据回调函数
   * @returns {Promise<Object>} 生成结果
   */
  static async streamGenerateTaskList(content, aiModel, windowManager, onChunk) {
    console.log('[AIService] streamGenerateTaskList 开始', { content, aiModel, onChunk: !!onChunk });
    
    try {
      console.log('[AIService] 获取模型配置');
      const modelConfig = this.getModelConfig(aiModel, windowManager);
      console.log('[AIService] 模型配置:', modelConfig);
      
      const modelInstance = this.getModelInstance(modelConfig);
      console.log('[AIService] 模型实例创建完成');
      
      const currentTime = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString();
      console.log('[AIService] 当前时间:', currentTime);
      
      const prompt = `{
  "user_prompt": {
    "role": "你是一名顶级的任务规划师（Task Planner）和项目经理（Project Manager）。",
    "capabilities": [
      "深入分析用户提供的目标，理解其核心需求。",
      "能够判断用户目标的复杂性，并决定是直接创建单个任务还是进行多任务拆解。",
      "将复杂的目标拆解为一系列具体的、可执行的、符合逻辑顺序的子任务（atomic tasks）。",
      "根据上下文信息（如当前日期、时间描述）智能推断任务的截止日期和时间。",
      "严格按照指定的 JSON 格式生成结果，不添加任何额外的解释性文字。"
    ]
  },
  "instructions": {
    "goal": "根据用户提供的'user_goal'和'context'，生成一个结构化的'task_list' JSON 对象。",
    "steps": [
      "1. **判断任务类型**: 首先，评估 'user_goal' 是一个'简单直接的行动'（如'看电影', '打电话', '买东西'）还是一个'需要多步骤完成的项目'（如'完成功能开发', '准备报告', '策划活动'）。",
      "2. **创建任务 (简单行动型)**: 如果目标是'简单行动型'，则直接将其作为单个任务的 'content'，并进入第4步。",
      "3. **任务拆解 (项目型)**: 如果目标是'项目型'，则将其拆解为关键的逻辑步骤，每个步骤生成一个任务对象。",
      "4. **填充时间信息**: 使用 'context.current_time' 和 'user_goal' 中的时间描述来确定 'dueDate' 和 'dueTime'，转换后的时间需要和 'context.current_time' 保持时区一致，如果没有时间信息，就忽略时间字段",
      "5. **完成并封装**: 根据规则填充其他字段，将所有生成的任务组合成一个 'task_list' 数组，并编写 'output_description'。"
    ],
    "rules": {
      "task_atomicity": "对于项目型任务，每个子任务都应该是最小的可执行单元。",
      "time_inference": {
        "specific_time": "如果用户提供了具体时间（如'下午3点', '15:00'），则优先使用该时间作为 'dueTime'。",
        "today": "使用 'context.current_time' 的天。",
        "tomorrow": "使用 'context.current_time' 的后一天。",
        "afternoon": "如果未指定具体时间，'dueTime' 默认为 18:00。",
        "evening": "如果未指定具体时间，'dueTime' 默认为 21:00。",
        "default_time": "如果未指定任何时间，默认为当天 23:59。"
      },
      "reminder_calculation": "'reminderTime' 应设置为 'dueTime' 之前的一小时。",
      "placeholder_fields": "如果 'listId' 或 'metadata' 没有特定信息，可以直接使用示例中的值或保持为空。",
      "output_strictness": "最终输出必须是一个完整的、格式正确的 JSON 对象，除此之外不要有任何其他内容。"
    }
  },
  "context": {
    "current_time": "${currentTime}",
    "user_goal": "${content}"
  },
  "output_format_and_examples": {
    "description": "输出应包含 'task_list' 和 'output_description' 两个键。",
    "example_1_simple": {
      "input_goal": "今天下午3点去看电影",
      "output": {
        "task_list": [
          {
            "content": "去看电影",
            "dueDate": "2025-08-24",
            "dueTime": "15:00",
            "reminderTime": "2025-08-24T04:00:00.000Z",
            "listId": 1755532210105,
            "metadata": { "note": "" }
          }
        ],
        "output_description": "已为您创建任务"去看电影"，时间是今天下午3点。"
      }
    }
  }
}`;

      let fullText = '';
      
      console.log('[AIService] 开始调用streamText');
      const { textStream } = await streamText({
        model: modelInstance,
        prompt: prompt,
        maxTokens: 1000,
        temperature: 0.7
      });
      console.log('[AIService] streamText调用成功，开始处理流式数据');

      // 处理流式数据
      let chunkCount = 0;
      for await (const textPart of textStream) {
        chunkCount++;
        fullText += textPart;
        console.log(`[AIService] 接收到第${chunkCount}个chunk:`, textPart);
        console.log(`[AIService] 当前累积文本长度:`, fullText.length);
        
        // 调用回调函数，传递当前累积的文本
        if (onChunk) {
          console.log('[AIService] 调用onChunk回调');
          onChunk(fullText);
        }
      }

      console.log(`[AIService] 流式数据处理完成，共接收${chunkCount}个chunk`);
      console.log('[AIService] AI流式返回的完整内容:', fullText);
      
      // 解析最终结果
      let parsedResult;
      try {
        const cleanedText = fullText.replace(/```json\n?|```\n?/g, '').trim();
        parsedResult = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('AI返回的内容无法解析为JSON:', fullText);
        throw new Error('AI返回的格式不正确，无法解析为任务列表');
      }
      
      // 验证返回的数据结构
      if (!parsedResult.task_list || !Array.isArray(parsedResult.task_list)) {
        throw new Error('AI返回的数据结构不正确：缺少tasks数组');
      }
      
      // 验证每个任务的基本结构
      const validTasks = parsedResult.task_list.filter(task => {
        return task && typeof task.content === 'string' && task.content.trim();
      }).map(task => {
        let reminderTime = null;
        if (task.dueDate && task.dueTime) {
          const localDateTime = `${task.dueDate}T${task.dueTime}:00`;
          const localDate = new Date(localDateTime);
          reminderTime = localDate.toISOString();
        } else if (task.reminderTime) {
          reminderTime = task.reminderTime;
        }
        
        return {
          content: task.content.trim(),
          dueDate: task.dueDate || null,
          dueTime: task.dueTime || null,
          reminderTime: reminderTime,
          metadata: task.metadata || { note: '' }
        };
      });
      
      return {
        success: true,
        tasks: validTasks,
        originalResponse: fullText
      };
      
    } catch (error) {
      console.error('AI流式生成任务列表失败:', error);
      
      let errorMessage = '生成任务列表失败';
      
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
      
      throw new Error(errorMessage);
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