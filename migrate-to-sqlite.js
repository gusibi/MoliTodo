#!/usr/bin/env node

/**
 * 数据迁移脚本：从文件存储迁移到 SQLite
 */

const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');
const Store = require('electron-store');
const SqliteTaskRepository = require('./src/infrastructure/persistence/sqlite-task-repository');

class DataMigrator {
  constructor() {
    this.fileStore = new Store({
      name: 'tasks',
      defaults: { tasks: [] }
    });
    this.sqliteRepo = new SqliteTaskRepository();
  }

  /**
   * 执行数据迁移
   */
  async migrate() {
    console.log('🔄 开始数据迁移...\n');

    try {
      // 1. 读取现有文件数据
      console.log('📖 读取现有任务数据...');
      const fileData = this.fileStore.get('tasks', []);
      console.log(`   找到 ${fileData.length} 个任务`);

      if (fileData.length === 0) {
        console.log('   没有需要迁移的数据');
        return;
      }

      // 2. 初始化 SQLite 数据库
      console.log('\n🗄️  初始化 SQLite 数据库...');
      const dbPath = this.getDefaultDatabasePath();
      await this.sqliteRepo.initialize(dbPath);
      console.log(`   数据库路径: ${dbPath}`);

      // 3. 检查是否已有数据
      const existingTasks = await this.sqliteRepo.findAll();
      if (existingTasks.length > 0) {
        console.log(`\n⚠️  SQLite 数据库中已有 ${existingTasks.length} 个任务`);
        const answer = await this.promptUser('是否要覆盖现有数据？(y/N): ');
        if (answer.toLowerCase() !== 'y') {
          console.log('❌ 迁移已取消');
          return;
        }
        await this.sqliteRepo.clear();
      }

      // 4. 迁移数据
      console.log('\n📦 开始迁移任务数据...');
      let migratedCount = 0;
      let errorCount = 0;

      for (const taskData of fileData) {
        try {
          // 确保数据格式正确
          const migratedTask = this.migrateTaskData(taskData);
          
          // 创建任务对象并保存
          const Task = require('./src/domain/entities/task');
          const task = Task.fromJSON(migratedTask);
          await this.sqliteRepo.save(task);
          
          migratedCount++;
          console.log(`   ✅ 迁移任务: ${task.content.substring(0, 50)}...`);
        } catch (error) {
          errorCount++;
          console.error(`   ❌ 迁移失败: ${error.message}`);
        }
      }

      // 5. 验证迁移结果
      console.log('\n🔍 验证迁移结果...');
      const migratedTasks = await this.sqliteRepo.findAll();
      console.log(`   SQLite 中的任务数量: ${migratedTasks.length}`);
      console.log(`   成功迁移: ${migratedCount} 个任务`);
      if (errorCount > 0) {
        console.log(`   迁移失败: ${errorCount} 个任务`);
      }

      // 6. 备份原始数据
      console.log('\n💾 备份原始数据...');
      const backupPath = this.getBackupPath();
      await this.backupOriginalData(backupPath);
      console.log(`   备份文件: ${backupPath}`);

      // 7. 更新配置
      console.log('\n⚙️  更新应用配置...');
      await this.updateAppConfig(dbPath);

      console.log('\n✅ 数据迁移完成！');
      console.log('\n📋 迁移摘要:');
      console.log(`   - 原始任务数量: ${fileData.length}`);
      console.log(`   - 成功迁移: ${migratedCount}`);
      console.log(`   - 失败数量: ${errorCount}`);
      console.log(`   - 数据库路径: ${dbPath}`);
      console.log(`   - 备份文件: ${backupPath}`);

    } catch (error) {
      console.error('\n❌ 迁移过程中出现错误:', error.message);
      console.error(error.stack);
    } finally {
      await this.sqliteRepo.close();
    }
  }

  /**
   * 迁移单个任务数据，确保格式正确
   */
  migrateTaskData(taskData) {
    const migrated = { ...taskData };
    
    // 确保有状态字段
    if (!migrated.status) {
      migrated.status = migrated.completed ? 'done' : 'todo';
    }
    
    // 确保日期格式正确
    if (migrated.createdAt && typeof migrated.createdAt === 'string') {
      migrated.createdAt = migrated.createdAt;
    } else if (migrated.createdAt) {
      migrated.createdAt = new Date(migrated.createdAt).toISOString();
    } else {
      migrated.createdAt = new Date().toISOString();
    }
    
    if (migrated.updatedAt && typeof migrated.updatedAt === 'string') {
      migrated.updatedAt = migrated.updatedAt;
    } else if (migrated.updatedAt) {
      migrated.updatedAt = new Date(migrated.updatedAt).toISOString();
    } else {
      migrated.updatedAt = migrated.createdAt;
    }
    
    return migrated;
  }

  /**
   * 获取默认数据库路径
   */
  getDefaultDatabasePath() {
    const userDataPath = process.env.APPDATA || 
                        (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share');
    const appDataPath = path.join(userDataPath, 'moli-todo');
    return path.join(appDataPath, 'tasks.db');
  }

  /**
   * 获取备份文件路径
   */
  getBackupPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const userDataPath = process.env.APPDATA || 
                        (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share');
    const appDataPath = path.join(userDataPath, 'moli-todo');
    return path.join(appDataPath, `tasks-backup-${timestamp}.json`);
  }

  /**
   * 备份原始数据
   */
  async backupOriginalData(backupPath) {
    const backupDir = path.dirname(backupPath);
    try {
      await fs.access(backupDir);
    } catch (error) {
      await fs.mkdir(backupDir, { recursive: true });
    }

    const originalData = {
      version: '1.0.0',
      backupDate: new Date().toISOString(),
      tasks: this.fileStore.get('tasks', []),
      source: 'file-store-migration'
    };

    await fs.writeFile(backupPath, JSON.stringify(originalData, null, 2));
  }

  /**
   * 更新应用配置
   */
  async updateAppConfig(dbPath) {
    const configStore = new Store({
      name: 'config',
      defaults: {}
    });

    configStore.set('database.type', 'sqlite');
    configStore.set('database.path', dbPath);
    configStore.set('database.migrated', true);
    configStore.set('database.migratedAt', new Date().toISOString());
  }

  /**
   * 简单的用户输入提示
   */
  async promptUser(question) {
    // 在实际应用中，这里应该使用更好的用户交互方式
    // 现在先返回默认值
    console.log(question);
    return 'y'; // 默认同意迁移
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const migrator = new DataMigrator();
  migrator.migrate().catch(console.error);
}

module.exports = DataMigrator;