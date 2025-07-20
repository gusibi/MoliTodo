const { ipcRenderer } = require('electron');
const { dataManager } = require('../shared/data-manager');

class HistoryManager {
    constructor() {
        this.completedTasks = [];
        this.allTasks = [];
        this.filteredTasks = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.init();
    }

    async init() {
        // 初始化数据管理器
        await dataManager.init();
        
        // 显示加载状态
        this.showLoading(true);
        
        // 加载任务数据
        await this.loadTasks();
        
        // 初始化UI
        this.initUI();
        
        // 绑定事件
        this.bindEvents();
        
        // 设置数据管理器监听器
        this.setupDataManagerListeners();
        
        // 隐藏加载状态
        this.showLoading(false);
        
        // 渲染任务列表
        this.renderTasks();
        
        // 更新统计信息
        this.updateStats();
    }

    setupDataManagerListeners() {
        // 监听任务数据更新
        dataManager.addEventListener('tasksUpdated', () => {
            this.loadTasks();
        });

        // 监听已完成任务数据更新
        dataManager.addEventListener('completedTasksUpdated', () => {
            this.loadTasks();
        });
    }

    async loadTasks() {
        try {
            // 获取所有任务（包括未完成和已完成）
            const incompleteTasks = dataManager.getTasks();
            const completedTasks = dataManager.getCompletedTasks();
            
            console.log('HistoryManager: 获取未完成任务', incompleteTasks.length, '个');
            console.log('HistoryManager: 获取已完成任务', completedTasks.length, '个');
            
            // 合并所有任务
            this.allTasks = [...incompleteTasks, ...completedTasks];
            
            console.log('HistoryManager: 合并后总任务数', this.allTasks.length, '个');
            
            this.applyFilters();
            this.updateStats();
        } catch (error) {
            console.error('加载任务失败:', error);
            this.showError('加载任务失败');
        }
    }

    initUI() {
        // 设置今天的日期作为默认结束日期
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('endDate').value = today;
        
        // 设置一周前作为默认开始日期
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        document.getElementById('startDate').value = weekAgo.toISOString().split('T')[0];
    }

    bindEvents() {
        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.applyFilters();
        });
        
        searchButton.addEventListener('click', () => {
            this.applyFilters();
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
        });

        // 时间过滤器
        const timeFilter = document.getElementById('timeFilter');
        timeFilter.addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.toggleCustomDateRange();
            this.applyFilters();
        });

        // 自定义日期范围
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        
        startDate.addEventListener('change', () => {
            if (this.currentFilter === 'custom') {
                this.applyFilters();
            }
        });
        
        endDate.addEventListener('change', () => {
            if (this.currentFilter === 'custom') {
                this.applyFilters();
            }
        });

        // 清空历史
        const clearHistory = document.getElementById('clearHistory');
        clearHistory.addEventListener('click', () => {
            this.clearHistory();
        });
    }

    toggleCustomDateRange() {
        const customDateRange = document.getElementById('customDateRange');
        customDateRange.style.display = this.currentFilter === 'custom' ? 'flex' : 'none';
    }

    applyFilters() {
        // 确保 allTasks 已初始化
        if (!this.allTasks) {
            this.allTasks = [];
        }
        
        // 只显示已完成的任务
        let filtered = this.allTasks.filter(task => task.completed);

        // 应用搜索过滤
        if (this.searchQuery) {
            filtered = filtered.filter(task => 
                task.content.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        }

        // 应用时间过滤
        filtered = this.applyTimeFilter(filtered);

        this.filteredTasks = filtered;
        this.renderTasks();
        this.updateStats();
    }

    applyTimeFilter(tasks) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (this.currentFilter) {
            case 'today':
                return tasks.filter(task => {
                    const completedDate = new Date(task.completedAt || task.updatedAt);
                    return completedDate >= today;
                });
                
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return tasks.filter(task => {
                    const completedDate = new Date(task.completedAt || task.updatedAt);
                    return completedDate >= weekAgo;
                });
                
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return tasks.filter(task => {
                    const completedDate = new Date(task.completedAt || task.updatedAt);
                    return completedDate >= monthAgo;
                });
                
            case 'custom':
                const startDate = new Date(document.getElementById('startDate').value);
                const endDate = new Date(document.getElementById('endDate').value);
                endDate.setHours(23, 59, 59, 999); // 包含结束日期的整天
                
                return tasks.filter(task => {
                    const completedDate = new Date(task.completedAt || task.updatedAt);
                    return completedDate >= startDate && completedDate <= endDate;
                });
                
            default:
                return tasks;
        }
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        const emptyState = document.getElementById('emptyState');
        const noResults = document.getElementById('noResults');

        // 清空现有内容
        tasksList.innerHTML = '';

        if (this.filteredTasks.length === 0) {
            tasksList.style.display = 'none';
            // 检查是否有已完成任务
            const completedTasks = this.allTasks.filter(task => task.completed);
            if (completedTasks.length === 0) {
                emptyState.style.display = 'block';
                noResults.style.display = 'none';
            } else {
                emptyState.style.display = 'none';
                noResults.style.display = 'block';
            }
            return;
        }

        tasksList.style.display = 'block';
        emptyState.style.display = 'none';
        noResults.style.display = 'none';

        // 按完成时间倒序排列
        const sortedTasks = [...this.filteredTasks].sort((a, b) => 
            new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt)
        );

        sortedTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            tasksList.appendChild(taskElement);
        });
    }

    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';
        taskDiv.dataset.taskId = task.id;

        const completedDate = new Date(task.completedAt || task.updatedAt);
        const formattedDate = this.formatDate(completedDate);
        const formattedTime = this.formatTime(completedDate);

        taskDiv.innerHTML = `
            <div class="task-header">
                <div class="task-content">${this.escapeHtml(task.content)}</div>
                <div class="task-actions">
                    <button class="action-button restore" data-action="restore">恢复</button>
                    <button class="action-button delete" data-action="delete">删除</button>
                </div>
            </div>
            <div class="task-meta">
                <div class="completion-time">完成于 ${formattedDate} ${formattedTime}</div>
                ${task.priority ? `<div class="task-priority priority-${task.priority}">${this.getPriorityText(task.priority)}</div>` : ''}
            </div>
        `;

        // 绑定操作按钮事件
        const restoreBtn = taskDiv.querySelector('[data-action="restore"]');
        const deleteBtn = taskDiv.querySelector('[data-action="delete"]');

        restoreBtn.addEventListener('click', () => this.restoreTask(task.id));
        deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

        return taskDiv;
    }

    async restoreTask(taskId) {
        try {
            await dataManager.completeTask(taskId, false); // 恢复任务（设置为未完成）
            this.showMessage('任务已恢复');
        } catch (error) {
            console.error('恢复任务失败:', error);
            this.showError('恢复任务失败');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('确定要删除这个任务吗？此操作不可撤销。')) {
            return;
        }

        try {
            await dataManager.deleteTask(taskId);
            this.showMessage('任务已删除');
        } catch (error) {
            console.error('删除任务失败:', error);
            this.showError('删除任务失败');
        }
    }

    async clearHistory() {
        if (!confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
            return;
        }

        try {
            // 获取所有已完成任务的ID
            const completedTasks = dataManager.getCompletedTasks();
            
            // 批量删除所有已完成任务
            for (const task of completedTasks) {
                await dataManager.deleteTask(task.id);
            }
            
            this.showMessage('历史记录已清空');
        } catch (error) {
            console.error('清空历史记录失败:', error);
            this.showError('清空历史记录失败');
        }
    }

    updateStats() {
        const completedTasks = this.allTasks.filter(task => task.completed);
        const totalCompleted = completedTasks.length;
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);

        const todayCompleted = completedTasks.filter(task => 
            new Date(task.completedAt || task.updatedAt) >= todayStart
        ).length;

        const weekCompleted = completedTasks.filter(task => 
            new Date(task.completedAt || task.updatedAt) >= weekStart
        ).length;

        document.getElementById('totalCompleted').textContent = totalCompleted;
        document.getElementById('todayCompleted').textContent = todayCompleted;
        document.getElementById('weekCompleted').textContent = weekCompleted;
    }

    showLoading(show) {
        const loadingState = document.getElementById('loadingState');
        loadingState.style.display = show ? 'block' : 'none';
    }

    formatDate(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return '今天';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return '昨天';
        } else {
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getPriorityText(priority) {
        const priorityMap = {
            'high': '高优先级',
            'medium': '中优先级',
            'low': '低优先级'
        };
        return priorityMap[priority] || '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showMessage(message, type = 'info') {
        // 创建消息提示
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#34C759' : type === 'error' ? '#FF3B30' : '#007AFF'};
        `;

        document.body.appendChild(messageEl);

        // 3秒后自动移除
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    showError(message) {
        this.showMessage(message, 'error');
    }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 初始化历史管理器
new HistoryManager();