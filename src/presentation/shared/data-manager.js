const { ipcRenderer } = require('electron');

/**
 * 公共数据管理器
 * 统一管理任务数据的获取、缓存和更新
 */
class DataManager {
    constructor() {
        this.tasks = [];
        this.completedTasks = [];
        this.listeners = {
            tasksUpdated: [],
            completedTasksUpdated: []
        };
        this.isInitialized = false;
    }

    /**
     * 初始化数据管理器
     */
    async init() {
        if (this.isInitialized) return;
        
        await this.loadAllData();
        this.setupIpcListeners();
        this.isInitialized = true;
    }

    /**
     * 加载所有数据
     */
    async loadAllData() {
        try {
            await Promise.all([
                this.loadTasks(),
                this.loadCompletedTasks()
            ]);
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    /**
     * 加载未完成任务
     */
    async loadTasks() {
        try {
            this.tasks = await ipcRenderer.invoke('get-tasks') || [];
            console.log('DataManager: 加载未完成任务', this.tasks.length, '个');
            this.notifyListeners('tasksUpdated', this.tasks);
        } catch (error) {
            console.error('加载任务失败:', error);
            this.tasks = [];
        }
    }

    /**
     * 加载已完成任务
     */
    async loadCompletedTasks() {
        try {
            this.completedTasks = await ipcRenderer.invoke('get-completed-tasks') || [];
            console.log('DataManager: 加载已完成任务', this.completedTasks.length, '个');
            this.notifyListeners('completedTasksUpdated', this.completedTasks);
        } catch (error) {
            console.error('加载已完成任务失败:', error);
            this.completedTasks = [];
        }
    }

    /**
     * 设置IPC监听器
     */
    setupIpcListeners() {
        // 监听任务更新事件
        ipcRenderer.on('update-tasks', async (event, tasks) => {
            this.tasks = tasks || [];
            this.notifyListeners('tasksUpdated', this.tasks);
        });

        // 监听已完成任务更新事件
        ipcRenderer.on('update-completed-tasks', async (event, completedTasks) => {
            this.completedTasks = completedTasks || [];
            this.notifyListeners('completedTasksUpdated', this.completedTasks);
        });
    }

    /**
     * 创建任务
     */
    async createTask(content, reminderTime = null) {
        try {
            const task = await ipcRenderer.invoke('create-task', content, reminderTime);
            this.tasks.push(task);
            this.notifyListeners('tasksUpdated', this.tasks);
            return task;
        } catch (error) {
            console.error('创建任务失败:', error);
            throw error;
        }
    }

    /**
     * 完成任务
     */
    async completeTask(taskId) {
        try {
            const task = await ipcRenderer.invoke('complete-task', taskId);
            
            // 从未完成任务中移除
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            
            // 添加到已完成任务
            this.completedTasks.unshift(task);
            
            this.notifyListeners('tasksUpdated', this.tasks);
            this.notifyListeners('completedTasksUpdated', this.completedTasks);
            
            return task;
        } catch (error) {
            console.error('完成任务失败:', error);
            throw error;
        }
    }

    /**
     * 恢复任务（取消完成状态）
     */
    async restoreTask(taskId) {
        try {
            const task = await ipcRenderer.invoke('complete-task', taskId, false);
            
            // 从已完成任务中移除
            this.completedTasks = this.completedTasks.filter(t => t.id !== taskId);
            
            // 添加到未完成任务
            this.tasks.push(task);
            
            this.notifyListeners('tasksUpdated', this.tasks);
            this.notifyListeners('completedTasksUpdated', this.completedTasks);
            
            return task;
        } catch (error) {
            console.error('恢复任务失败:', error);
            throw error;
        }
    }

    /**
     * 删除任务
     */
    async deleteTask(taskId) {
        try {
            await ipcRenderer.invoke('delete-task', taskId);
            
            // 从两个列表中移除
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.completedTasks = this.completedTasks.filter(t => t.id !== taskId);
            
            this.notifyListeners('tasksUpdated', this.tasks);
            this.notifyListeners('completedTasksUpdated', this.completedTasks);
            
            return true;
        } catch (error) {
            console.error('删除任务失败:', error);
            throw error;
        }
    }

    /**
     * 更新任务内容
     */
    async updateTaskContent(taskId, content) {
        try {
            const updatedTask = await ipcRenderer.invoke('update-task-content', taskId, content);
            
            // 更新本地缓存
            const taskIndex = this.tasks.findIndex(t => t.id === taskId);
            if (taskIndex >= 0) {
                this.tasks[taskIndex] = updatedTask;
                this.notifyListeners('tasksUpdated', this.tasks);
            }
            
            return updatedTask;
        } catch (error) {
            console.error('更新任务内容失败:', error);
            throw error;
        }
    }

    /**
     * 设置任务提醒
     */
    async setTaskReminder(taskId, reminderTime) {
        try {
            const updatedTask = await ipcRenderer.invoke('set-task-reminder', taskId, reminderTime);
            
            // 更新本地缓存
            const taskIndex = this.tasks.findIndex(t => t.id === taskId);
            if (taskIndex >= 0) {
                this.tasks[taskIndex] = updatedTask;
                this.notifyListeners('tasksUpdated', this.tasks);
            }
            
            return updatedTask;
        } catch (error) {
            console.error('设置任务提醒失败:', error);
            throw error;
        }
    }

    /**
     * 获取未完成任务
     */
    getTasks() {
        return [...this.tasks];
    }

    /**
     * 获取已完成任务
     */
    getCompletedTasks() {
        return [...this.completedTasks];
    }

    /**
     * 获取未完成任务数量
     */
    getTaskCount() {
        return this.tasks.length;
    }

    /**
     * 获取已完成任务数量
     */
    getCompletedTaskCount() {
        return this.completedTasks.length;
    }

    /**
     * 添加事件监听器
     */
    addEventListener(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * 移除事件监听器
     */
    removeEventListener(event, callback) {
        if (this.listeners[event]) {
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }

    /**
     * 通知监听器
     */
    notifyListeners(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('监听器回调执行失败:', error);
                }
            });
        }
    }

    /**
     * 刷新所有数据
     */
    async refresh() {
        await this.loadAllData();
    }

    /**
     * 清理资源
     */
    destroy() {
        this.listeners = {
            tasksUpdated: [],
            completedTasksUpdated: []
        };
        this.isInitialized = false;
    }
}

// 创建全局单例
const dataManager = new DataManager();

// 导出单例和类
module.exports = {
    DataManager,
    dataManager
};