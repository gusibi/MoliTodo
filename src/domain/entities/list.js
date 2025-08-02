/**
 * 清单实体 (List Entity)
 * 领域层核心实体，包含清单的所有业务逻辑
 */
class List {
  constructor(id, name, color = '#007AFF', icon = 'list', createdAt = new Date(), isDefault = false) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.icon = icon;
    this.createdAt = createdAt;
    this.updatedAt = new Date();
    this.isDefault = isDefault;
    this.sortOrder = 0;
  }

  /**
   * 更新清单名称
   * @param {string} name 新的清单名称
   */
  updateName(name) {
    const validatedName = this.validateName(name);
    this.name = validatedName;
    this.updatedAt = new Date();
  }

  /**
   * 更新清单颜色
   * @param {string} color 新的颜色值 (HEX格式)
   */
  updateColor(color) {
    const validatedColor = this.validateColor(color);
    this.color = validatedColor;
    this.updatedAt = new Date();
  }

  /**
   * 更新清单图标
   * @param {string} icon 新的图标名称
   */
  updateIcon(icon) {
    const validatedIcon = this.validateIcon(icon);
    this.icon = validatedIcon;
    this.updatedAt = new Date();
  }

  /**
   * 更新排序顺序
   * @param {number} sortOrder 排序顺序
   */
  updateSortOrder(sortOrder) {
    if (typeof sortOrder !== 'number' || sortOrder < 0) {
      throw new Error('排序顺序必须是非负数');
    }
    this.sortOrder = sortOrder;
    this.updatedAt = new Date();
  }

  /**
   * 验证清单名称
   * @param {string} name 清单名称
   * @returns {string} 验证后的名称
   */
  validateName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('清单名称必须是非空字符串');
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new Error('清单名称不能为空');
    }

    if (trimmedName.length > 50) {
      throw new Error('清单名称不能超过50个字符');
    }

    // 防止包含特殊字符
    if (trimmedName.includes('<') || trimmedName.includes('>') || trimmedName.includes('&')) {
      throw new Error('清单名称包含非法字符');
    }

    return trimmedName;
  }

  /**
   * 验证颜色格式
   * @param {string} color 颜色值
   * @returns {string} 验证后的颜色值
   */
  validateColor(color) {
    if (!color || typeof color !== 'string') {
      throw new Error('颜色值必须是字符串');
    }

    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(color)) {
      throw new Error('颜色格式不正确，必须是HEX格式（如 #FF0000）');
    }

    return color.toUpperCase();
  }

  /**
   * 验证图标名称
   * @param {string} icon 图标名称
   * @returns {string} 验证后的图标名称
   */
  validateIcon(icon) {
    if (!icon || typeof icon !== 'string') {
      throw new Error('图标名称必须是字符串');
    }

    const trimmedIcon = icon.trim();
    if (trimmedIcon.length === 0) {
      throw new Error('图标名称不能为空');
    }

    // 预定义的图标列表
    const validIcons = [
      'list', 'inbox', 'star', 'heart', 'bookmark', 'flag', 
      'folder', 'briefcase', 'home', 'user', 'calendar', 
      'clock', 'target', 'trophy', 'book', 'music'
    ];

    if (!validIcons.includes(trimmedIcon)) {
      console.warn(`图标 "${trimmedIcon}" 不在预定义列表中，但仍然允许使用`);
    }

    return trimmedIcon;
  }

  /**
   * 检查是否为默认清单
   * @returns {boolean}
   */
  isDefaultList() {
    return this.isDefault || this.id === 0;
  }

  /**
   * 检查是否可以删除
   * @returns {boolean}
   */
  canBeDeleted() {
    return !this.isDefaultList();
  }

  /**
   * 获取显示名称（用于UI显示）
   * @returns {string}
   */
  getDisplayName() {
    return this.isDefaultList() ? '默认清单' : this.name;
  }

  /**
   * 获取颜色的RGB值
   * @returns {Object} {r, g, b}
   */
  getRGBColor() {
    const hex = this.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
  }

  /**
   * 获取颜色的RGBA值
   * @param {number} alpha 透明度 (0-1)
   * @returns {string} RGBA字符串
   */
  getRGBAColor(alpha = 1) {
    const { r, g, b } = this.getRGBColor();
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 比较两个清单是否相等
   * @param {List} other 另一个清单实例
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof List)) {
      return false;
    }
    return this.id === other.id;
  }

  /**
   * 克隆清单实例
   * @returns {List}
   */
  clone() {
    const cloned = new List(
      this.id,
      this.name,
      this.color,
      this.icon,
      new Date(this.createdAt),
      this.isDefault
    );
    cloned.updatedAt = new Date(this.updatedAt);
    cloned.sortOrder = this.sortOrder;
    return cloned;
  }

  /**
   * 转换为普通对象 (用于序列化)
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      icon: this.icon,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isDefault: this.isDefault,
      sortOrder: this.sortOrder
    };
  }

  /**
   * 从普通对象创建清单实例 (用于反序列化)
   * @param {Object} data 
   * @returns {List}
   */
  static fromJSON(data) {
    const list = new List(
      data.id,
      data.name,
      data.color || '#007AFF',
      data.icon || 'list',
      new Date(data.createdAt),
      data.isDefault || false
    );
    
    if (data.updatedAt) {
      list.updatedAt = new Date(data.updatedAt);
    }
    
    if (typeof data.sortOrder === 'number') {
      list.sortOrder = data.sortOrder;
    }
    
    return list;
  }

  /**
   * 创建默认清单实例
   * @returns {List}
   */
  static createDefault() {
    return new List(0, '默认清单', '#007AFF', 'inbox', new Date(), true);
  }

  /**
   * 获取预定义颜色选项
   * @returns {string[]}
   */
  static getColorOptions() {
    return [
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
    ];
  }

  /**
   * 获取预定义图标选项
   * @returns {string[]}
   */
  static getIconOptions() {
    return [
      'list', 'inbox', 'star', 'heart', 'bookmark', 'flag',
      'folder', 'briefcase', 'home', 'user', 'calendar',
      'clock', 'target', 'trophy', 'book', 'music'
    ];
  }

  /**
   * 生成唯一ID（用于新建清单）
   * @returns {number}
   */
  static generateId() {
    return Date.now();
  }

  /**
   * 验证清单数据的完整性
   * @param {Object} data 清单数据
   * @returns {boolean}
   */
  static validateData(data) {
    try {
      if (!data || typeof data !== 'object') {
        return false;
      }

      // 检查必需字段
      if (typeof data.id === 'undefined' || !data.name) {
        return false;
      }

      // 验证字段类型
      if (typeof data.name !== 'string' || 
          (data.color && typeof data.color !== 'string') ||
          (data.icon && typeof data.icon !== 'string')) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn('清单数据验证失败:', error);
      return false;
    }
  }
}

module.exports = List;