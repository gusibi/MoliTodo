const Store = require('electron-store');
const Task = require('../../domain/entities/task');
const TaskRepository = require('../../domain/repositories/task-repository');

/**
 * 基于文件的任务仓储实现
 * 使用 electron-store 进行数据持久化
 */
class FileTaskRepository extends TaskRepository {
  constructor() {
    super();
    this.store = new Store({
      name: 'tasks',
      defaults: {
        tasks: []
      }
    });
  }

  /**
   * 获取所有任务
   * @returns {Promise<Task[]>}
   */
  async findAll() {
    const tasksData = this.store.get('tasks', []);
    return tasksData.map(data => Task.fromJSON(data));
  }

  /**
   * 根据ID查找任务
   * @param {string} id 
   * @returns {Promise<Task|null>}
   */
  async findById(id) {
    const tasks = await this.findAll();
    return tasks.find(task => task.id === id) || null;
  }

  /**
   * 获取所有未完成的任务
   * @returns {Promise<Task[]>}
   */
  async findIncomplete() {
    const tasks = await this.findAll();
    return tasks.filter(task => !task.completed);
  }

  /**
   * 获取所有已完成的任务
   * @returns {Promise<Task[]>}
   */
  async findCompleted() {
    const tasks = await this.findAll();
    return tasks.filter(task => task.completed);
  }

  /**
   * 获取需要提醒的任务
   * @returns {Promise<Task[]>}
   */
  async findTasksToRemind() {
    const tasks = await this.findAll();
    return tasks.filter(task => task.shouldRemind());
  }

  /**
   * 保存任务
   * @param {Task} task 
   * @returns {Promise<Task>}
   */
  async save(task) {
    const tasks = await this.findAll();
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      // 更新现有任务
      tasks[existingIndex] = task;
    } else {
      // 添加新任务
      tasks.push(task);
    }
    
    // 保存到存储
    this.store.set('tasks', tasks.map(t => t.toJSON()));
    return task;
  }

  /**
   * 删除任务
   * @param {string} id 
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const tasks = await this.findAll();
    const initialLength = tasks.length;
    const filteredTasks = tasks.filter(task => task.id !== id);
    
    if (filteredTasks.length < initialLength) {
      this.store.set('tasks', filteredTasks.map(t => t.toJSON()));
      return true;
    }
    
    return false;
  }

  /**
   * 获取未完成任务数量
   * @returns {Promise<number>}
   */
  async getIncompleteCount() {
    const incompleteTasks = await this.findIncomplete();
    return incompleteTasks.length;
  }

  /**
   * 清空所有任务 (用于测试或重置)
   * @returns {Promise<void>}
   */
  async clear() {
    this.store.set('tasks', []);
  }

  /**
   * 导出所有任务数据
   * @returns {Promise<Object>}
   */
  async exportData() {
    return {
      tasks: this.store.get('tasks', []),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * 导入任务数据
   * @param {Object} data 
   * @returns {Promise<void>}
   */
  async importData(data) {
    if (data.tasks && Array.isArray(data.tasks)) {
      this.store.set('tasks', data.tasks);
    }
  }
}

module.exports = FileTaskRepository;