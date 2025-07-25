/**
 * 任务仓储接口 (Task Repository Interface)
 * 定义任务数据访问的抽象接口
 */
class TaskRepository {
  /**
   * 获取所有任务
   * @returns {Promise<Task[]>}
   */
  async findAll() {
    throw new Error('Method not implemented');
  }

  /**
   * 根据ID查找任务
   * @param {string} id 
   * @returns {Promise<Task|null>}
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * 获取所有未完成的任务
   * @returns {Promise<Task[]>}
   */
  async findIncomplete() {
    throw new Error('Method not implemented');
  }

  /**
   * 获取所有已完成的任务
   * @returns {Promise<Task[]>}
   */
  async findCompleted() {
    throw new Error('Method not implemented');
  }

  /**
   * 获取需要提醒的任务
   * @returns {Promise<Task[]>}
   */
  async findTasksToRemind() {
    throw new Error('Method not implemented');
  }

  /**
   * 保存任务
   * @param {Task} task 
   * @returns {Promise<Task>}
   */
  async save(task) {
    throw new Error('Method not implemented');
  }

  /**
   * 删除任务
   * @param {string} id 
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * 获取未完成任务数量
   * @returns {Promise<number>}
   */
  async getIncompleteCount() {
    throw new Error('Method not implemented');
  }
}

module.exports = TaskRepository;