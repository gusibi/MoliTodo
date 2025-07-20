const { ipcRenderer } = require('electron');

class HistoryManager {
    constructor() {
        this.completedTasks = [];
        this.filteredTasks = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.init();
    }

    async init() {
        // 显示加载状态
        this.showLoading(true);
        
        // 加载已完成任务
        await this.loadCompletedTasks();
        
        // 初始化UI
        this.initUI();
        
        // 绑定事件
        this.bindEvents();
        
        // 隐藏加载状态
        this.showLoading(false);
        
        // 渲染任务列表
        this.renderTasks();
        
        // 更新统计信息
        this.updateStats();
    }

    async loadCompletedTasks() {
        try {
            const allTasks = await ipcRenderer.invoke('get-tasks');
            this.completedTasks = allTasks.filter(task => task.completed);
            this.filteredTasks = [...this.completedTasks];
        } catch (error) {
            console.error('加载已完成任务失败:', error);
            this.completedTasks = [];
            this.filteredTasks = [];
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
        let filtered = [...this.completedTasks];

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
                    const completedDate = new Date(task.completedAt);
                    return completedDate >= today;
                });
                
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return tasks.filter(task => {
                    const completedDate = new Date(task.completedAt);
                    return completedDate >= weekAgo;
                });
                
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return tasks.filter(task => {
                    const completedDate = new Date(task.completedAt);
                    return completedDate >= monthAgo;
                });
                
            case 'custom':
                const startDate = new Date(document.getElementById('startDate').value);
                const endDate = new Date(document.getElementById('endDate').value);
                endDate.setHours(23, 59, 59, 999); // 包含结束日期的整天
                
                return tasks.filter(task => {
                    const completedDate = new Date(task.completedAt);
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
            if (this.completedTasks.length === 0) {
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
            new Date(b.completedAt) - new Date(a.completedAt)
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

        const completedDate = new Date(task.completedAt);
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
            await ipcRenderer.invoke('complete-task', taskId, false);
            
            // 从列表中移除
            this.completedTasks = this.completedTasks.filter(task => task.id !== taskId);
            this.applyFilters();
            
            this.showMessage('任务已恢复到未完成状态', 'success');
        } catch (error) {
            console.error('恢复任务失败:', error);
            this.showMessage('恢复任务失败', 'error');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('确定要永久删除这个任务吗？此操作无法撤销。')) {
            return;
        }

        try {
            await ipcRenderer.invoke('delete-task', taskId);
            
            // 从列表中移除
            this.completedTasks = this.completedTasks.filter(task => task.id !== taskId);
            this.applyFilters();
            
            this.showMessage('任务已删除', 'success');
        } catch (error) {
            console.error('删除任务失败:', error);
            this.showMessage('删除任务失败', 'error');
        }
    }

    async clearHistory() {
        if (!confirm('确定要清空所有已完成任务的历史记录吗？此操作无法撤销。')) {
            return;
        }

        try {
            // 删除所有已完成的任务
            const deletePromises = this.completedTasks.map(task => 
                ipcRenderer.invoke('delete-task', task.id)
            );
            
            await Promise.all(deletePromises);
            
            this.completedTasks = [];
            this.filteredTasks = [];
            this.renderTasks();
            this.updateStats();
            
            this.showMessage('历史记录已清空', 'success');
        } catch (error) {
            console.error('清空历史记录失败:', error);
            this.showMessage('清空历史记录失败', 'error');
        }
    }

    updateStats() {
        const totalCompleted = this.completedTasks.length;
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);

        const todayCompleted = this.completedTasks.filter(task => 
            new Date(task.completedAt) >= todayStart
        ).length;

        const weekCompleted = this.completedTasks.filter(task => 
            new Date(task.completedAt) >= weekStart
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