/**
 * 全局通知音效监听器
 * 监听来自主进程的通知音效播放请求
 */

import { playNotificationSoundFromConfig } from './notificationSound.js'

let isListenerSetup = false

/**
 * 设置全局通知音效监听器
 */
export const setupGlobalNotificationListener = () => {
  if (isListenerSetup || !window.electronAPI) {
    return
  }

  // 监听播放通知音效的事件
  window.electronAPI.onPlayNotificationSound(async () => {
    try {
      // 获取当前的通知音效配置
      const config = await window.electronAPI.config.getAll()
      
      if (config && config.notificationSound) {
        await playNotificationSoundFromConfig(config.notificationSound)
      }
    } catch (error) {
      console.error('播放通知音效失败:', error)
    }
  })

  isListenerSetup = true
  console.log('全局通知音效监听器已设置')
}

/**
 * 清理监听器
 */
export const cleanupGlobalNotificationListener = () => {
  // Electron IPC 监听器会在窗口关闭时自动清理
  isListenerSetup = false
}