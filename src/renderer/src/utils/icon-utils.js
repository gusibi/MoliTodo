/**
 * 图标工具函数
 * 提供图标映射和处理功能
 */

/**
 * 获取列表图标的 CSS 类名
 * @param {string} icon - 图标名称
 * @returns {string} 对应的 FontAwesome CSS 类名
 */
export const getListIconClass = (icon) => {
  const iconMap = {
    'list': 'fas fa-list',
    'inbox': 'fas fa-inbox',
    'star': 'fas fa-star',
    'heart': 'fas fa-heart',
    'bookmark': 'fas fa-bookmark',
    'flag': 'fas fa-flag',
    'folder': 'fas fa-folder',
    'briefcase': 'fas fa-briefcase',
    'home': 'fas fa-home',
    'user': 'fas fa-user',
    'calendar': 'fas fa-calendar',
    'clock': 'fas fa-clock',
    'target': 'fas fa-bullseye',
    'trophy': 'fas fa-trophy',
    'book': 'fas fa-book',
    'music': 'fas fa-music'
  }
  return iconMap[icon] || 'fas fa-list'
}

/**
 * 获取当前图标的类名（用于任务管理器）
 * @param {Object} currentList - 当前列表对象
 * @returns {string} 图标类名
 */
export const getCurrentIconClass = (currentList) => {
  if (currentList && currentList.icon) {
    return `icon-${currentList.icon}`
  }
  return 'icon-list' // 默认图标
}