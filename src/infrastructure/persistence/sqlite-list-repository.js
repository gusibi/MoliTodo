const List = require('../../domain/entities/list');

/**
 * 基于 SQLite 的清单仓储实现
 */
class SqliteListRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 获取所有清单
   * @returns {Promise<List[]>}
   */
  async findAll() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const rows = await this.db.all('SELECT * FROM lists ORDER BY sort_order ASC, id ASC');
    return rows.map(row => this.rowToList(row));
  }

  /**
   * 根据ID查找清单
   * @param {number} id 清单ID
   * @returns {Promise<List|null>}
   */
  async findById(id) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const row = await this.db.get('SELECT * FROM lists WHERE id = ?', [id]);
    return row ? this.rowToList(row) : null;
  }

  /**
   * 根据名称查找清单
   * @param {string} name 清单名称
   * @returns {Promise<List|null>}
   */
  async findByName(name) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const row = await this.db.get('SELECT * FROM lists WHERE name = ?', [name]);
    return row ? this.rowToList(row) : null;
  }

  /**
   * 保存清单
   * @param {List} list 清单实例
   * @returns {Promise<List>}
   */
  async save(list) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const row = this.listToRow(list);
    
    // 检查清单是否已存在
    const existing = await this.findById(list.id);
    
    if (existing) {
      // 更新现有清单
      await this.db.run(`
        UPDATE lists SET 
          name = ?,
          color = ?,
          icon = ?,
          updated_at = ?,
          is_default = ?,
          sort_order = ?
        WHERE id = ?
      `, [
        row.name,
        row.color,
        row.icon,
        row.updated_at,
        row.is_default,
        row.sort_order,
        row.id
      ]);
    } else {
      // 插入新清单
      if (list.id === 0) {
        // 特殊处理默认清单（ID为0）
        await this.db.run(`
          INSERT OR REPLACE INTO lists (
            id, name, color, icon, created_at, updated_at, is_default, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          row.id,
          row.name,
          row.color,
          row.icon,
          row.created_at,
          row.updated_at,
          row.is_default,
          row.sort_order
        ]);
      } else {
        // 普通清单插入
        await this.db.run(`
          INSERT INTO lists (
            id, name, color, icon, created_at, updated_at, is_default, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          row.id,
          row.name,
          row.color,
          row.icon,
          row.created_at,
          row.updated_at,
          row.is_default,
          row.sort_order
        ]);
      }
    }
    
    return list;
  }

  /**
   * 删除清单
   * @param {number} id 清单ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    // 防止删除默认清单
    if (id === 0) {
      throw new Error('不能删除默认清单');
    }

    const result = await this.db.run('DELETE FROM lists WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * 获取清单的任务数量
   * @param {number} listId 清单ID
   * @returns {Promise<number>}
   */
  async getTaskCount(listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.get(
      'SELECT COUNT(*) as count FROM tasks WHERE list_id = ?',
      [listId]
    );
    return result.count;
  }

  /**
   * 获取清单的任务统计信息
   * @param {number} listId 清单ID
   * @returns {Promise<Object>}
   */
  async getTaskStatistics(listId) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const stats = await this.db.all(`
      SELECT 
        status,
        COUNT(*) as count
      FROM tasks 
      WHERE list_id = ? 
      GROUP BY status
    `, [listId]);

    const result = {
      total: 0,
      todo: 0,
      doing: 0,
      paused: 0,
      done: 0
    };

    stats.forEach(stat => {
      result[stat.status] = stat.count;
      result.total += stat.count;
    });

    return result;
  }

  /**
   * 获取所有清单的任务统计信息
   * @returns {Promise<Object>} 清单ID到统计信息的映射
   */
  async getAllTaskStatistics() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const stats = await this.db.all(`
      SELECT 
        list_id,
        status,
        COUNT(*) as count
      FROM tasks 
      GROUP BY list_id, status
    `);

    const result = {};

    stats.forEach(stat => {
      if (!result[stat.list_id]) {
        result[stat.list_id] = {
          total: 0,
          todo: 0,
          doing: 0,
          paused: 0,
          done: 0
        };
      }
      
      result[stat.list_id][stat.status] = stat.count;
      result[stat.list_id].total += stat.count;
    });

    return result;
  }

  /**
   * 更新清单排序顺序
   * @param {number} listId 清单ID
   * @param {number} sortOrder 排序顺序
   * @returns {Promise<void>}
   */
  async updateSortOrder(listId, sortOrder) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    await this.db.run(
      'UPDATE lists SET sort_order = ?, updated_at = ? WHERE id = ?',
      [sortOrder, new Date().toISOString(), listId]
    );
  }

  /**
   * 批量更新清单排序顺序
   * @param {Array<{id: number, sortOrder: number}>} updates 更新数据
   * @returns {Promise<void>}
   */
  async batchUpdateSortOrder(updates) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const stmt = await this.db.prepare(
      'UPDATE lists SET sort_order = ?, updated_at = ? WHERE id = ?'
    );

    const now = new Date().toISOString();
    
    try {
      await this.db.exec('BEGIN TRANSACTION');
      
      for (const update of updates) {
        await stmt.run([update.sortOrder, now, update.id]);
      }
      
      await this.db.exec('COMMIT');
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    } finally {
      await stmt.finalize();
    }
  }

  /**
   * 获取最大排序顺序
   * @returns {Promise<number>}
   */
  async getMaxSortOrder() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.get('SELECT MAX(sort_order) as max_order FROM lists');
    return result.max_order || 0;
  }

  /**
   * 清空所有清单（保留默认清单）
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    await this.db.run('DELETE FROM lists WHERE id != 0');
  }

  /**
   * 获取清单数量
   * @returns {Promise<number>}
   */
  async getCount() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const result = await this.db.get('SELECT COUNT(*) as count FROM lists');
    return result.count;
  }

  /**
   * 检查清单名称是否存在
   * @param {string} name 清单名称
   * @param {number|null} excludeId 排除的清单ID
   * @returns {Promise<boolean>}
   */
  async nameExists(name, excludeId = null) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    let query = 'SELECT COUNT(*) as count FROM lists WHERE name = ?';
    const params = [name];

    if (excludeId !== null) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const result = await this.db.get(query, params);
    return result.count > 0;
  }

  /**
   * 搜索清单
   * @param {string} query 搜索关键词
   * @returns {Promise<List[]>}
   */
  async search(query) {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    if (!query || query.trim().length === 0) {
      return await this.findAll();
    }

    const searchTerm = `%${query.trim()}%`;
    const rows = await this.db.all(
      'SELECT * FROM lists WHERE name LIKE ? ORDER BY sort_order ASC, id ASC',
      [searchTerm]
    );
    
    return rows.map(row => this.rowToList(row));
  }

  /**
   * 将清单对象转换为数据库行
   * @param {List} list 清单实例
   * @returns {Object}
   */
  listToRow(list) {
    return {
      id: list.id,
      name: list.name,
      color: list.color,
      icon: list.icon,
      created_at: list.createdAt.toISOString(),
      updated_at: list.updatedAt.toISOString(),
      is_default: list.isDefault ? 1 : 0,
      sort_order: list.sortOrder || 0
    };
  }

  /**
   * 将数据库行转换为清单对象
   * @param {Object} row 数据库行
   * @returns {List}
   */
  rowToList(row) {
    const list = new List(
      row.id,
      row.name,
      row.color || '#007AFF',
      row.icon || 'list',
      new Date(row.created_at),
      row.is_default === 1
    );
    
    list.updatedAt = new Date(row.updated_at);
    list.sortOrder = row.sort_order || 0;
    
    return list;
  }

  /**
   * 获取数据库统计信息
   * @returns {Promise<Object>}
   */
  async getStats() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const listCount = await this.db.get('SELECT COUNT(*) as count FROM lists');
    const defaultListExists = await this.db.get('SELECT COUNT(*) as count FROM lists WHERE id = 0');
    
    return {
      totalLists: listCount.count,
      hasDefaultList: defaultListExists.count > 0,
      customLists: listCount.count - (defaultListExists.count > 0 ? 1 : 0)
    };
  }

  /**
   * 验证数据库完整性
   * @returns {Promise<boolean>}
   */
  async validateIntegrity() {
    try {
      if (!this.db) {
        return false;
      }

      // 检查表是否存在
      const tableExists = await this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='lists'"
      );
      
      if (!tableExists) {
        return false;
      }

      // 检查默认清单是否存在
      const defaultList = await this.findById(0);
      if (!defaultList) {
        console.warn('默认清单不存在，将自动创建');
        const defaultListEntity = List.createDefault();
        await this.save(defaultListEntity);
      }

      // 检查数据完整性
      await this.db.get('SELECT COUNT(*) FROM lists');
      
      return true;
    } catch (error) {
      console.error('清单仓储完整性验证失败:', error);
      return false;
    }
  }
}

module.exports = SqliteListRepository;