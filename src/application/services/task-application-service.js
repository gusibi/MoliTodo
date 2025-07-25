const { ipcRenderer } = require('electron');

/**
 * 任务应用服务
 * 应用层服务，负责协调任务相关的用例
 * 提供数据获取、缓存、状态管理和事件通知功能
 */
class TaskApplicationService {
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
        if (this.isInitialized) {
            console.log('TaskApplicationService: 已经初始化，跳过重复初始化');
            return;
        }

        console.log('TaskApplicationService: 开始初始化');
        await this.loadAllData();
        this.setupIpcListeners();
        this.isInitialized = true;
        console.log('TaskApplicationService: 初始化完成');
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
            console.log('TaskApplicationService: 加载未完成任务', this.tasks.length, '个');
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
            console.log('TaskApplicationService: 加载已完成任务', this.completedTasks.length, '个');
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
        // 先移除可能存在的旧监听器，避免重复添加
        ipcRenderer.removeAllListeners('update-tasks');
        ipcRenderer.removeAllListeners('update-completed-tasks');
        
        // 监听任务更新事件
        ipcRenderer.on('update-tasks', async (event, tasks) => {
            console.log('TaskApplicationService: 接收到任务更新事件', tasks?.length || 0, '个任务');
            this.tasks = tasks || [];
            this.notifyListeners('tasksUpdated', this.tasks);
        });

        // 监听已完成任务更新事件
        ipcRenderer.on('update-completed-tasks', async (event, completedTasks) => {
            console.log('TaskApplicationService: 接收到已完成任务更新事件', completedTasks?.length || 0, '个任务');
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

            // 不需要手动更新本地缓存，因为主进程会广播更新
            // 主进程的 broadcastTaskUpdates() 会发送 IPC 事件，
            // setupIpcListeners() 中的监听器会自动更新本地缓存

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

            // 不需要手动更新本地缓存，因为主进程会广播更新
            // 主进程的 broadcastTaskUpdates() 会发送 IPC 事件，
            // setupIpcListeners() 中的监听器会自动更新本地缓存

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

            // 不需要手动更新本地缓存，因为主进程会广播更新
            // 主进程的 broadcastTaskUpdates() 会发送 IPC 事件，
            // setupIpcListeners() 中的监听器会自动更新本地缓存

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

            // 不需要手动更新本地缓存，因为主进程会广播更新
            // 主进程的 broadcastTaskUpdates() 会发送 IPC 事件，
            // setupIpcListeners() 中的监听器会自动更新本地缓存

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

            // 不需要手动更新本地缓存，因为主进程会广播更新
            // 主进程的 broadcastTaskUpdates() 会发送 IPC 事件，
            // setupIpcListeners() 中的监听器会自动更新本地缓存

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

            // 不需要手动更新本地缓存，因为主进程会广播更新
            // 主进程的 broadcastTaskUpdates() 会发送 IPC 事件，
            // setupIpcListeners() 中的监听器会自动更新本地缓存

            return updatedTask;
        } catch (error) {
            console.error('设置任务提醒失败:', error);
            throw error;
        }
    }

    /**
     * 更新任务状态
     */
    async updateTaskStatus(taskId, status) {
        try {
            const updatedTask = await ipcRenderer.invoke('update-task-status', taskId, status);

            // 不需要手动更新本地缓存，因为主进程会广播更新
            // 主进程的 broadcastTaskUpdates() 会发送 IPC 事件，
            // setupIpcListeners() 中的监听器会自动更新本地缓存

            return updatedTask;
        } catch (error) {
            console.error('更新任务状态失败:', error);
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
            // 检查是否已经存在相同的回调函数，避免重复添加
            if (!this.listeners[event].includes(callback)) {
                this.listeners[event].push(callback);
                console.log(`TaskApplicationService: 添加 ${event} 监听器，当前数量: ${this.listeners[event].length}`);
            } else {
                console.warn(`TaskApplicationService: ${event} 监听器已存在，跳过重复添加`);
            }
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
                console.log(`TaskApplicationService: 移除 ${event} 监听器，当前数量: ${this.listeners[event].length}`);
            } else {
                console.warn(`TaskApplicationService: 未找到要移除的 ${event} 监听器`);
            }
        }
    }

    /**
     * 通知监听器
     */
    notifyListeners(event, data) {
        if (this.listeners[event] && this.listeners[event].length > 0) {
            console.log(`TaskApplicationService: 通知 ${event} 监听器，数量: ${this.listeners[event].length}`);
            this.listeners[event].forEach((callback, index) => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`监听器回调执行失败 (${event}[${index}]):`, error);
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
     * 清除任务提醒
     */
    async clearTaskReminder(taskId) {
        try {
            const updatedTask = await ipcRenderer.invoke('set-task-reminder', taskId, null);

            // 不需要手动更新本地缓存，因为主进程会广播更新
            // 主进程的 broadcastTaskUpdates() 会发送 IPC 事件，
            // setupIpcListeners() 中的监听器会自动更新本地缓存

            return updatedTask;
        } catch (error) {
            console.error('清除任务提醒失败:', error);
            throw error;
        }
    }

    /**
     * 开始任务 - 从待办状态开始计时
     */
    async startTask(taskId) {
        try {
            const updatedTask = await ipcRenderer.invoke('start-task', taskId);
            return updatedTask;
        } catch (error) {
            console.error('开始任务失败:', error);
            throw error;
        }
    }

    /**
     * 暂停任务 - 从进行中状态暂停，累计已用时间
     */
    async pauseTask(taskId) {
        try {
            const updatedTask = await ipcRenderer.invoke('pause-task', taskId);
            return updatedTask;
        } catch (error) {
            console.error('暂停任务失败:', error);
            throw error;
        }
    }

    /**
     * 完成任务（带时间追踪）
     */
    async completeTaskWithTracking(taskId) {
        try {
            const updatedTask = await ipcRenderer.invoke('complete-task-with-tracking', taskId);
            return updatedTask;
        } catch (error) {
            console.error('完成任务失败:', error);
            throw error;
        }
    }

    /**
     * 重新开始任务 - 从已完成状态重新开始
     */
    async restartTask(taskId) {
        try {
            const updatedTask = await ipcRenderer.invoke('restart-task', taskId);
            return updatedTask;
        } catch (error) {
            console.error('重新开始任务失败:', error);
            throw error;
        }
    }

    /**
     * 获取进行中的任务
     */
    getInProgressTasks() {
        return this.tasks.filter(task => {
            const status = task.status || (task.completed ? 'done' : 'todo');
            return status === 'doing';
        });
    }

    /**
     * 获取时间统计信息
     */
    async getTimeStats() {
        try {
            return await ipcRenderer.invoke('get-time-stats');
        } catch (error) {
            console.error('获取时间统计失败:', error);
            throw error;
        }
    }

    /**
     * 清理资源
     */
    destroy() {
        console.log('TaskApplicationService: 开始清理资源');
        
        // 清理 IPC 监听器
        ipcRenderer.removeAllListeners('update-tasks');
        ipcRenderer.removeAllListeners('update-completed-tasks');
        
        // 清理事件监听器
        this.listeners = {
            tasksUpdated: [],
            completedTasksUpdated: []
        };
        
        // 重置初始化状态
        this.isInitialized = false;
        
        console.log('TaskApplicationService: 资源清理完成');
    }
}

// 创建全局单例
const taskApplicationService = new TaskApplicationService();

// 导出单例和类
module.exports = {
    TaskApplicationService,
    taskApplicationService
};