/**
 * 通知音效管理工具
 */

let audioInstance = null

/**
 * 播放通知音效
 * @param {string} soundFile - 音效文件名
 * @param {number} volume - 音量 (0-100)
 */
export const playNotificationSound = async (soundFile = 'ding-126626.mp3', volume = 50) => {
  try {
    // 如果有正在播放的音频，先停止
    if (audioInstance) {
      audioInstance.pause()
      audioInstance.currentTime = 0
    }

    // 创建新的音频实例
    audioInstance = new Audio(`/${soundFile}`)
    audioInstance.volume = Math.max(0, Math.min(1, volume / 100)) // 确保音量在 0-1 范围内
    
    // 播放音效
    await audioInstance.play()
    
    // 播放完成后清理
    audioInstance.addEventListener('ended', () => {
      audioInstance = null
    })
    
    return true
  } catch (error) {
    console.error('播放通知音效失败:', error)
    return false
  }
}

/**
 * 根据配置播放通知音效
 * @param {Object} config - 通知音效配置
 */
export const playNotificationSoundFromConfig = async (config) => {
  if (!config || !config.enabled) {
    return false
  }
  
  return await playNotificationSound(config.soundFile, config.volume)
}

/**
 * 停止当前播放的音效
 */
export const stopNotificationSound = () => {
  if (audioInstance) {
    audioInstance.pause()
    audioInstance.currentTime = 0
    audioInstance = null
  }
}

/**
 * 预加载音效文件
 * @param {string} soundFile - 音效文件名
 */
export const preloadSound = (soundFile) => {
  try {
    const audio = new Audio(`/${soundFile}`)
    audio.preload = 'auto'
    return audio
  } catch (error) {
    console.error('预加载音效失败:', error)
    return null
  }
}

/**
 * 获取可用的音效列表
 */
export const getAvailableSounds = () => {
  return [
    { value: 'ding-126626.mp3', label: '叮咚' },
    { value: 'bell-chord1-83260.mp3', label: '铃声' },
    { value: 'bellding-254774.mp3', label: '铃铛' },
    { value: 'bubblepop-254773.mp3', label: '泡泡' },
    { value: 'ding-1-14705.mp3', label: '提示音' },
    { value: 'metal-clang-284809.mp3', label: '金属音' }
  ]
}