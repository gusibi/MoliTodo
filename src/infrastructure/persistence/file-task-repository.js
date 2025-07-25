const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const Task = require('../../domain/entities/task');

/**
 * 基于文件的任务仓储实现（向后兼容）
 */
class FileTaskRepository {
  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'tasks.json');
    this.tasks = [];
    this.initialized = false;
  }

  /**
   * 初始化仓储
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // 确保目录存在
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      // 尝试读取现有文件
      try {
        const data = await fs.readFile(this.filePath, 'utf8');
        const tasksData = JSON.parse(data);
        this.tasks = tasksData.map(taskData => Task.fromJSON(taskData));
      } catch (error) {
        // 文件不存在或格式错误，使用空数组
        this.tasks = [];
      }

      this.initialized = true;
      console.log(`文件仓储已初始化: ${this.filePath}`);
    } catch (error) {
      console.error('初始化文件仓储失败:', error);
      throw error;
    }
  }

  /**
   * 保存任务到文件
   */
  async saveToFile() {
    try {
      const tasksData = this.tasks.map(task => task.toJSON());
      await fs.writeFile(this.filePath, JSON.stringify(tasksData, null, 2), 'utf8');
    } catch (error) {
      console.error('保存任务文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有任务
   * @returns {Promise<Task[]>}
   */
  async findAll() {
    if (!this.initialized) {
      await this.initialize();
    }
    return [...this.tasks];
  }

  /**
   * 根据ID查找任务
   * @param {string} id 
   * @returns {Promise<Task|null>}
   */
  async findById(id) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.tasks.find(task => task.id === id) || null;
  }

  /**
   * 获取所有未完成的任务
   * @returns {Promise<Task[]>}
   */
  async findIncomplete() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.tasks.filter(task => !task.isCompleted());
  }

  /**
   * 获取所有已完成的任务
   * @returns {Promise<Task[]>}
   */
  async findCompleted() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.tasks.filter(task => task.isCompleted());
  }

  /**
   * 保存任务
   * @param {Task} task 
   * @returns {Promise<Task>}
   */
  async save(task) {
    if (!this.initialized) {
      await this.initialize();
    }

    const existingIndex = this.tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      // 更新现有任务
      this.tasks[existingIndex] = task;
    } else {
      // 添加新任务
      this.tasks.push(task);
    }

    await this.saveToFile();
    return task;
  }

  /**
   * 删除任务
   * @param {string} id 
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!this.initialized) {
      await this.initialize();
    }

    const initialLength = this.tasks.length;
    this.tasks = this.tasks.filter(task => task.id !== id);
    
    if (this.tasks.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }

  /**
   * 获取未完成任务数量
   * @returns {Promise<number>}
   */
  async getIncompleteCount() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.tasks.filter(task => !task.isCompleted()).length;
  }

  /**
   * 清空所有任务
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    this.tasks = [];
    await this.saveToFile();
  }

  /**
   * 获取统计信息
   * @returns {Promise<Object>}
   */
  async getStats() {
    if (!this.initialized) {
      await this.initialize();
    }

    let fileSize = 0;
    try {
      const stats = await fs.stat(this.filePath);
      fileSize = stats.size;
    } catch (error) {
      fileSize = 0;
    }

    return {
      path: this.filePath,
      taskCount: this.tasks.length,
      fileSize: fileSize
    };
  }
}

module.exports = FileTaskRepository;