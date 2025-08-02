const List = require('../entities/list');

/**
 * 清单管理服务 (List Service)
 * 包含清单相关的业务逻辑和用例协调
 */
class ListService {
  constructor(listRepository, taskRepository) {
    this.listRepository = listRepository;
    this.taskRepository = taskRepository;
  }

  /**
   * 创建新清单
   * @param {string} name 清单名称
   * @param {string} color 清单颜色
   * @param {string} icon 清单图标
   * @returns {Promise<List>}
   */
  async createList(name, color = '#007AFF', icon = 'list') {
    // 验证输入参数
    const list = new List(List.generateId(), name, color, icon);
    
    // 检查名称唯一性
    await this.checkNameUniqueness(name);
    
    // 设置排序顺序（放在最后）
    const maxSortOrder = await this.getMaxSortOrder();
    list.updateSortOrder(maxSortOrder + 1);
    
    // 保存清单
    return await this.listRepository.save(list);
  }

  /**
   * 更新清单信息
   * @param {number} listId 清单ID
   * @param {Object} updates 更新数据
   * @returns {Promise<List>}
   */
  async updateList(listId, updates) {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error('清单不存在');
    }

    // 不允许修改默认清单的某些属性
    if (list.isDefaultList() && (updates.name || updates.isDefault !== undefined)) {
      throw new Error('不能修改默认清单的名称或默认状态');
    }

    // 更新名称
    if (updates.name !== undefined) {
      // 检查名称唯一性（排除当前清单）
      await this.checkNameUniqueness(updates.name, listId);
      list.updateName(updates.name);
    }

    // 更新颜色
    if (updates.color !== undefined) {
      list.updateColor(updates.color);
    }

    // 更新图标
    if (updates.icon !== undefined) {
      list.updateIcon(updates.icon);
    }

    // 更新排序顺序
    if (updates.sortOrder !== undefined) {
      list.updateSortOrder(updates.sortOrder);
    }

    return await this.listRepository.save(list);
  }

  /**
   * 删除清单
   * @param {number} listId 清单ID
   * @param {string} taskHandling 任务处理方式: 'move' | 'delete'
   * @returns {Promise<boolean>}
   */
  async deleteList(listId, taskHandling = 'move') {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error('清单不存在');
    }

    // 防止删除默认清单
    if (list.isDefaultList()) {
      throw new Error('不能删除默认清单');
    }

    // 检查清单中的任务
    const taskCount = await this.getListTaskCount(listId);
    if (taskCount > 0) {
      if (taskHandling === 'move') {
        // 将任务移动到默认清单
        await this.moveAllTasksToDefaultList(listId);
      } else if (taskHandling === 'delete') {
        // 删除所有任务
        await this.deleteAllTasksInList(listId);
      } else {
        throw new Error('无效的任务处理方式，必须是 "move" 或 "delete"');
      }
    }

    // 删除清单
    return await this.listRepository.delete(listId);
  }

  /**
   * 获取所有清单
   * @returns {Promise<List[]>}
   */
  async getAllLists() {
    const lists = await this.listRepository.findAll();
    
    // 确保默认清单存在
    const hasDefaultList = lists.some(list => list.isDefaultList());
    if (!hasDefaultList) {
      const defaultList = List.createDefault();
      await this.listRepository.save(defaultList);
      lists.unshift(defaultList);
    }

    // 按排序顺序排列
    return lists.sort((a, b) => {
      // 默认清单始终在最前面
      if (a.isDefaultList()) return -1;
      if (b.isDefaultList()) return 1;
      return a.sortOrder - b.sortOrder;
    });
  }

  /**
   * 根据ID获取清单
   * @param {number} listId 清单ID
   * @returns {Promise<List|null>}
   */
  async getListById(listId) {
    return await this.listRepository.findById(listId);
  }

  /**
   * 获取清单的任务数量
   * @param {number} listId 清单ID
   * @returns {Promise<number>}
   */
  async getListTaskCount(listId) {
    return await this.listRepository.getTaskCount(listId);
  }

  /**
   * 获取所有清单的任务统计
   * @returns {Promise<Object>} 清单ID到任务数量的映射
   */
  async getAllListTaskCounts() {
    const lists = await this.getAllLists();
    const counts = {};
    
    for (const list of lists) {
      counts[list.id] = await this.getListTaskCount(list.id);
    }
    
    return counts;
  }

  /**
   * 移动任务到指定清单
   * @param {string[]} taskIds 任务ID数组
   * @param {number} targetListId 目标清单ID
   * @returns {Promise<void>}
   */
  async moveTasksToList(taskIds, targetListId) {
    // 验证目标清单存在
    const targetList = await this.listRepository.findById(targetListId);
    if (!targetList) {
      throw new Error('目标清单不存在');
    }

    // 批量更新任务的清单关联
    if (this.taskRepository.batchUpdateListId) {
      await this.taskRepository.batchUpdateListId(taskIds, targetListId);
    } else {
      // 如果没有批量更新方法，逐个更新
      for (const taskId of taskIds) {
        const task = await this.taskRepository.findById(taskId);
        if (task) {
          task.moveToList(targetListId);
          await this.taskRepository.save(task);
        }
      }
    }
  }

  /**
   * 重新排序清单
   * @param {Array<{id: number, sortOrder: number}>} sortOrders 排序数据
   * @returns {Promise<void>}
   */
  async reorderLists(sortOrders) {
    for (const { id, sortOrder } of sortOrders) {
      const list = await this.listRepository.findById(id);
      if (list && !list.isDefaultList()) { // 不允许移动默认清单
        list.updateSortOrder(sortOrder);
        await this.listRepository.save(list);
      }
    }
  }

  /**
   * 检查清单名称唯一性
   * @param {string} name 清单名称
   * @param {number} excludeId 排除的清单ID（用于更新时）
   * @returns {Promise<void>}
   */
  async checkNameUniqueness(name, excludeId = null) {
    const existingLists = await this.listRepository.findAll();
    const duplicateList = existingLists.find(list => 
      list.name === name && list.id !== excludeId
    );
    
    if (duplicateList) {
      throw new Error(`清单名称 "${name}" 已存在`);
    }
  }

  /**
   * 获取最大排序顺序
   * @returns {Promise<number>}
   */
  async getMaxSortOrder() {
    const lists = await this.listRepository.findAll();
    return Math.max(0, ...lists.map(list => list.sortOrder || 0));
  }

  /**
   * 将指定清单的所有任务移动到默认清单
   * @param {number} listId 源清单ID
   * @returns {Promise<void>}
   */
  async moveAllTasksToDefaultList(listId) {
    if (this.taskRepository.updateListId) {
      // 批量更新所有任务到默认清单
      await this.taskRepository.updateListId(listId, 0);
    } else {
      // 逐个更新任务
      const tasks = await this.taskRepository.findByListId(listId);
      for (const task of tasks) {
        task.moveToList(0);
        await this.taskRepository.save(task);
      }
    }
  }

  /**
   * 删除指定清单中的所有任务
   * @param {number} listId 清单ID
   * @returns {Promise<void>}
   */
  async deleteAllTasksInList(listId) {
    if (this.taskRepository.deleteByListId) {
      // 批量删除
      await this.taskRepository.deleteByListId(listId);
    } else {
      // 逐个删除任务
      const tasks = await this.taskRepository.findByListId(listId);
      for (const task of tasks) {
        await this.taskRepository.delete(task.id);
      }
    }
  }

  /**
   * 获取清单的详细统计信息
   * @param {number} listId 清单ID
   * @returns {Promise<Object>}
   */
  async getListStatistics(listId) {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error('清单不存在');
    }

    // 获取任务统计
    const tasks = await this.taskRepository.findByListId(listId);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.isCompleted()).length;
    const inProgressTasks = tasks.filter(task => task.isInProgress()).length;
    const pausedTasks = tasks.filter(task => task.isPaused()).length;
    const todoTasks = tasks.filter(task => task.isTodo()).length;

    // 计算完成率
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // 计算总工作时长
    const totalWorkTime = tasks.reduce((total, task) => {
      return total + task.getTotalWorkDuration();
    }, 0);

    return {
      list: list.toJSON(),
      taskCounts: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        paused: pausedTasks,
        todo: todoTasks
      },
      completionRate: Math.round(completionRate * 100) / 100,
      totalWorkTime,
      averageTaskTime: completedTasks > 0 ? Math.round(totalWorkTime / completedTasks) : 0
    };
  }

  /**
   * 搜索清单
   * @param {string} query 搜索关键词
   * @returns {Promise<List[]>}
   */
  async searchLists(query) {
    if (!query || query.trim().length === 0) {
      return await this.getAllLists();
    }

    const allLists = await this.getAllLists();
    const searchTerm = query.trim().toLowerCase();
    
    return allLists.filter(list => 
      list.name.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * 导出清单数据
   * @param {number} listId 清单ID，如果为null则导出所有清单
   * @returns {Promise<Object>}
   */
  async exportListData(listId = null) {
    if (listId !== null) {
      // 导出单个清单
      const list = await this.listRepository.findById(listId);
      if (!list) {
        throw new Error('清单不存在');
      }
      
      const tasks = await this.taskRepository.findByListId(listId);
      return {
        lists: [list.toJSON()],
        tasks: tasks.map(task => task.toJSON()),
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
    } else {
      // 导出所有清单
      const lists = await this.getAllLists();
      const allTasks = await this.taskRepository.findAll();
      
      return {
        lists: lists.map(list => list.toJSON()),
        tasks: allTasks.map(task => task.toJSON()),
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
    }
  }

  /**
   * 导入清单数据
   * @param {Object} data 导入的数据
   * @param {Object} options 导入选项
   * @returns {Promise<Object>} 导入结果
   */
  async importListData(data, options = {}) {
    const { 
      overwriteExisting = false, 
      skipDuplicates = true,
      handleNameConflicts = 'rename' // 'rename' | 'skip' | 'overwrite'
    } = options;

    const result = {
      importedLists: 0,
      importedTasks: 0,
      skippedLists: 0,
      skippedTasks: 0,
      errors: []
    };

    try {
      // 导入清单
      if (data.lists && Array.isArray(data.lists)) {
        for (const listData of data.lists) {
          try {
            // 跳过默认清单
            if (listData.id === 0 || listData.isDefault) {
              result.skippedLists++;
              continue;
            }

            // 检查名称冲突
            const existingList = await this.listRepository.findByName(listData.name);
            if (existingList) {
              if (handleNameConflicts === 'skip') {
                result.skippedLists++;
                continue;
              } else if (handleNameConflicts === 'rename') {
                listData.name = await this.generateUniqueName(listData.name);
              }
            }

            const list = List.fromJSON(listData);
            list.id = List.generateId(); // 生成新ID避免冲突
            await this.listRepository.save(list);
            result.importedLists++;
          } catch (error) {
            result.errors.push(`导入清单失败: ${error.message}`);
          }
        }
      }

      // 导入任务
      if (data.tasks && Array.isArray(data.tasks)) {
        for (const taskData of data.tasks) {
          try {
            // 验证清单关联
            if (taskData.listId && taskData.listId !== 0) {
              const listExists = await this.listRepository.findById(taskData.listId);
              if (!listExists) {
                taskData.listId = 0; // 移动到默认清单
              }
            }

            const task = Task.fromJSON(taskData);
            await this.taskRepository.save(task);
            result.importedTasks++;
          } catch (error) {
            result.errors.push(`导入任务失败: ${error.message}`);
          }
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`导入过程出错: ${error.message}`);
      return result;
    }
  }

  /**
   * 生成唯一的清单名称
   * @param {string} baseName 基础名称
   * @returns {Promise<string>}
   */
  async generateUniqueName(baseName) {
    let counter = 1;
    let uniqueName = baseName;
    
    while (true) {
      try {
        await this.checkNameUniqueness(uniqueName);
        return uniqueName;
      } catch (error) {
        uniqueName = `${baseName} (${counter})`;
        counter++;
      }
    }
  }
}

module.exports = ListService;