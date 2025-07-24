// 导入必要的服务
const { ipcRenderer } = require('electron');
const { taskApplicationService } = require('../../application/services/task-application-service');

class TaskManager {
    constructor() {
        this.tasks = [];
        this.completedTasks = [];
        this.currentCategory = 'today';
        this.searchQuery = '';
        this.selectedTasks = new Set();
        this.currentEditingTask = null;
        this.currentDeletingTask = null;

        // DOM 元素
        this.initDOMElements();

        this.init();
    }

    initDOMElements() {
        // 侧边栏
        this.sidebarItems = document.querySelectorAll('.sidebar-item');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.taskCounts = {
            today: document.getElementById('todayCount'),
            scheduled: document.getElementById('scheduledCount'),
            todo: document.getElementById('todoCount'),
            doing: document.getElementById('doingCount'),
            all: document.getElementById('allCount'),
            completed: document.getElementById('completedCount')
        };

        // 工具栏
        this.searchInput = document.getElementById('searchInput');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.batchActionsBtn = document.getElementById('batchActionsBtn');

        // 内容区
        this.contentTitle = document.getElementById('contentTitle');
        this.quickAddSection = document.getElementById('quickAddSection');
        this.quickAddInput = document.getElementById('quickAddInput');
        this.quickAddButton = document.getElementById('quickAddButton');
        this.taskList = document.getElementById('taskList');
        this.emptyState = document.getElementById('emptyState');

        // 统计栏
        this.totalTasks = document.getElementById('totalTasks');
        this.completedTasksCount = document.getElementById('completedTasks');
        this.completionRate = document.getElementById('completionRate');

        // 模态框
        this.taskEditModal = document.getElementById('taskEditModal');
        this.editTaskContent = document.getElementById('editTaskContent');
        this.editReminderDate = document.getElementById('editReminderDate');
        this.editReminderTime = document.getElementById('editReminderTime');
        this.closeEditModal = document.getElementById('closeEditModal');
        this.cancelEdit = document.getElementById('cancelEdit');
        this.saveEdit = document.getElementById('saveEdit');

        this.deleteConfirmModal = document.getElementById('deleteConfirmModal');
        this.cancelDelete = document.getElementById('cancelDelete');
        this.confirmDelete = document.getElementById('confirmDelete');

        this.batchActionsModal = document.getElementById('batchActionsModal');
        this.closeBatchModal = document.getElementById('closeBatchModal');
        this.selectedCount = document.getElementById('selectedCount');
        this.batchComplete = document.getElementById('batchComplete');
        this.batchDelete = document.getElementById('batchDelete');
        this.cancelBatch = document.getElementById('cancelBatch');
    }

    async init() {
        // 初始化数据管理器
        await taskApplicationService.init();

        this.setupEventListeners();
        this.setupTaskApplicationServiceListeners();
        this.loadTasks();

        // 聚焦搜索框
        this.searchInput.focus();
    }

    setupTaskApplicationServiceListeners() {
        // 确保先清理旧的监听器
        this.cleanupTaskApplicationServiceListeners();

        // 创建新的监听器函数并保存引用
        this.tasksUpdatedListener = (tasks) => {
            console.log('TaskManager: 接收到任务更新', tasks.length, '个任务');
            this.tasks = tasks;
            this.renderCurrentView();
            this.updateCounts();
            this.updateStats();
        };

        this.completedTasksUpdatedListener = (completedTasks) => {
            console.log('TaskManager: 接收到已完成任务更新', completedTasks.length, '个任务');
            this.completedTasks = completedTasks;
            this.renderCurrentView();
            this.updateCounts();
            this.updateStats();
        };

        // 监听任务数据更新
        taskApplicationService.addEventListener('tasksUpdated', this.tasksUpdatedListener);

        // 监听已完成任务数据更新
        taskApplicationService.addEventListener('completedTasksUpdated', this.completedTasksUpdatedListener);
        
        console.log('TaskManager: 事件监听器已设置');
    }

    cleanupTaskApplicationServiceListeners() {
        // 移除旧的监听器
        if (this.tasksUpdatedListener) {
            taskApplicationService.removeEventListener('tasksUpdated', this.tasksUpdatedListener);
            this.tasksUpdatedListener = null;
        }
        if (this.completedTasksUpdatedListener) {
            taskApplicationService.removeEventListener('completedTasksUpdated', this.completedTasksUpdatedListener);
            this.completedTasksUpdatedListener = null;
        }
        console.log('TaskManager: 旧的事件监听器已清理');
    }

    setupEventListeners() {
        // 侧边栏导航
        this.sidebarItems.forEach(item => {
            item.addEventListener('click', () => {
                const category = item.dataset.category;
                if (category) {
                    this.switchCategory(category);
                }
            });
        });

        // 设置按钮
        this.settingsBtn.addEventListener('click', () => {
            this.openSettings();
        });

        // 搜索
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.renderCurrentView();
        });

        // 工具栏按钮
        this.addTaskBtn.addEventListener('click', () => {
            this.showQuickAdd();
        });

        this.batchActionsBtn.addEventListener('click', () => {
            this.showBatchActionsModal();
        });

        // 快速添加
        this.quickAddInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        this.quickAddButton.addEventListener('click', () => {
            this.addTask();
        });

        // 任务列表事件
        this.taskList.addEventListener('click', (e) => {
            this.handleTaskListClick(e);
        });

        // 编辑模态框
        this.closeEditModal.addEventListener('click', () => {
            this.hideEditModal();
        });

        this.cancelEdit.addEventListener('click', () => {
            this.hideEditModal();
        });

        this.saveEdit.addEventListener('click', () => {
            this.saveTaskEdit();
        });

        // 快速时间按钮
        document.querySelectorAll('.quick-time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setQuickTime(btn);
            });
        });

        // 删除确认模态框
        this.cancelDelete.addEventListener('click', () => {
            this.hideDeleteModal();
        });

        this.confirmDelete.addEventListener('click', () => {
            this.confirmDeleteTask();
        });

        // 批量操作模态框
        this.closeBatchModal.addEventListener('click', () => {
            this.hideBatchActionsModal();
        });

        this.cancelBatch.addEventListener('click', () => {
            this.hideBatchActionsModal();
        });

        this.batchComplete.addEventListener('click', () => {
            this.batchCompleteTask();
        });

        this.batchDelete.addEventListener('click', () => {
            this.batchDeleteTasks();
        });

        // 模态框背景点击关闭
        [this.taskEditModal, this.deleteConfirmModal, this.batchActionsModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 窗口焦点事件 - 当窗口获得焦点时刷新数据
        window.addEventListener('focus', () => {
            this.refreshData();
        });

        // 页面可见性变化事件 - 当页面变为可见时刷新数据
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.refreshData();
            }
        });
    }

    async loadTasks() {
        try {
            this.tasks = taskApplicationService.getTasks();
            this.completedTasks = taskApplicationService.getCompletedTasks();
            this.renderCurrentView();
            this.updateCounts();
            this.updateStats();
        } catch (error) {
            console.error('加载任务失败:', error);
        }
    }

    /**
     * 刷新数据 - 当窗口获得焦点或变为可见时调用
     */
    async refreshData() {
        try {
            // 重新加载任务数据
            this.tasks = taskApplicationService.getTasks();
            this.completedTasks = taskApplicationService.getCompletedTasks();
            
            // 更新当前视图
            this.renderCurrentView();
            this.updateCounts();
            this.updateStats();
            
            console.log('Task Manager: 数据已刷新');
        } catch (error) {
            console.error('刷新数据失败:', error);
        }
    }

    switchCategory(category) {
        this.currentCategory = category;
        this.selectedTasks.clear();

        // 更新侧边栏状态
        this.sidebarItems.forEach(item => {
            item.classList.toggle('active', item.dataset.category === category);
        });

        // 更新内容标题
        const titles = {
            today: '今天',
            scheduled: '计划中',
            todo: '待办任务',
            doing: '进行中',
            all: '所有任务',
            completed: '已完成'
        };
        this.contentTitle.textContent = titles[category];

        // 显示/隐藏快速添加区域
        this.quickAddSection.style.display = category === 'completed' ? 'none' : 'block';

        this.renderCurrentView();
        this.updateBatchActionsButton();
    }

    renderCurrentView() {
        const filteredTasks = this.getFilteredTasks();

        if (filteredTasks.length === 0) {
            this.showEmptyState();
        } else {
            this.hideEmptyState();
            this.renderTasks(filteredTasks);
        }
    }

    getFilteredTasks() {
        let tasks = [];

        switch (this.currentCategory) {
            case 'today':
                tasks = this.getTodayTasks();
                break;
            case 'scheduled':
                tasks = this.getScheduledTasks();
                break;
            case 'todo':
                tasks = this.tasks.filter(task => {
                    const status = task.status || (task.completed ? 'done' : 'todo');
                    return status === 'todo';
                });
                break;
            case 'doing':
                tasks = this.tasks.filter(task => {
                    const status = task.status || (task.completed ? 'done' : 'todo');
                    return status === 'doing';
                });
                break;
            case 'all':
                tasks = [...this.tasks];
                break;
            case 'completed':
                tasks = [...this.completedTasks];
                break;
        }

        // 应用搜索过滤
        if (this.searchQuery) {
            tasks = tasks.filter(task =>
                task.content.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        }

        return tasks;
    }

    getTodayTasks() {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1);

        return this.tasks.filter(task => {
            if (!task.reminderTime) return false;
            const reminderDate = new Date(task.reminderTime);
            return reminderDate <= todayEnd;
        });
    }

    getScheduledTasks() {
        return this.tasks.filter(task => task.reminderTime);
    }

    renderTasks(tasks) {
        // 按类别排序任务
        const sortedTasks = this.sortTasks(tasks);

        // 按日期分组（仅对有提醒时间的任务）
        const groupedTasks = this.groupTasksByDate(sortedTasks);

        this.taskList.innerHTML = '';

        if (Object.keys(groupedTasks).length > 0) {
            // 渲染分组任务
            Object.entries(groupedTasks).forEach(([dateKey, dateTasks]) => {
                this.renderDateGroup(dateKey, dateTasks);
            });
        } else {
            // 渲染无分组任务
            sortedTasks.forEach(task => {
                this.taskList.appendChild(this.createTaskElement(task));
            });
        }
    }

    sortTasks(tasks) {
        return [...tasks].sort((a, b) => {
            // 已完成任务按完成时间倒序
            if (this.currentCategory === 'completed') {
                return new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt);
            }

            // 未完成任务排序逻辑
            const aOverdue = this.isOverdue(a);
            const bOverdue = this.isOverdue(b);

            // 逾期任务优先
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            // 有提醒时间的任务按时间排序
            if (a.reminderTime && b.reminderTime) {
                return new Date(a.reminderTime) - new Date(b.reminderTime);
            }

            // 有提醒时间的任务排在前面
            if (a.reminderTime && !b.reminderTime) return -1;
            if (!a.reminderTime && b.reminderTime) return 1;

            // 都没有提醒时间，按创建时间排序
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
    }

    groupTasksByDate(tasks) {
        const groups = {};
        const now = new Date();
        // 使用本地时区获取今天的开始时间
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        tasks.forEach(task => {
            let dateKey = 'no-date';

            if (task.reminderTime) {
                const reminderDate = new Date(task.reminderTime);

                if (this.isSameDay(reminderDate, today)) {
                    dateKey = 'today';
                } else if (this.isSameDay(reminderDate, tomorrow)) {
                    dateKey = 'tomorrow';
                } else if (reminderDate < today) {
                    dateKey = 'overdue';
                } else {
                    dateKey = reminderDate.toDateString();
                }
            }

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(task);
        });

        return groups;
    }

    renderDateGroup(dateKey, tasks) {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';

        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';

        let dateText = '';
        let dateIcon = '📅';

        switch (dateKey) {
            case 'overdue':
                dateText = '逾期';
                dateIcon = '⚠️';
                break;
            case 'today':
                dateText = '今天';
                dateIcon = '📅';
                break;
            case 'tomorrow':
                dateText = '明天';
                dateIcon = '📋';
                break;
            case 'no-date':
                dateText = '无日期';
                dateIcon = '📝';
                break;
            default:
                const date = new Date(dateKey);
                dateText = date.toLocaleDateString('zh-CN', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short'
                });
                dateIcon = '📅';
        }

        dateHeader.innerHTML = `
            <div class="date-icon">${dateIcon}</div>
            ${dateText}
        `;

        dateGroup.appendChild(dateHeader);

        tasks.forEach(task => {
            dateGroup.appendChild(this.createTaskElement(task));
        });

        this.taskList.appendChild(dateGroup);
    }

    createTaskElement(task) {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.dataset.taskId = task.id;

        if (this.selectedTasks.has(task.id)) {
            taskItem.classList.add('selected');
        }

        if (this.isOverdue(task)) {
            taskItem.classList.add('overdue');
        }

        const isCompleted = this.currentCategory === 'completed';
        const status = task.status || (task.completed ? 'done' : 'todo');
        
        // Add status class
        taskItem.classList.add(`status-${status}`);

        taskItem.innerHTML = `
            <div class="task-status-indicator" data-action="cycle-status" title="点击切换状态">
                ${this.getStatusIcon(status)}
            </div>
            <div class="task-content">
                <div class="task-text ${isCompleted ? 'completed' : ''}">${this.escapeHtml(task.content)}</div>
                <div class="task-meta">
                    ${this.renderTaskMeta(task)}
                </div>
            </div>
            <div class="task-actions">
                ${this.renderTaskActions(task)}
            </div>
        `;

        return taskItem;
    }

    renderTaskMeta(task) {
        const meta = [];
        const status = task.status || (task.completed ? 'done' : 'todo');
        const statusText = this.getStatusText(status);

        // Add status badge
        meta.push(`
            <div class="task-status status-${status}">
                ${statusText}
            </div>
        `);

        if (task.reminderTime) {
            const reminderText = this.formatReminderTime(new Date(task.reminderTime));
            const isOverdue = this.isOverdue(task);
            meta.push(`
                <div class="task-reminder ${isOverdue ? 'overdue' : ''}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" fill="currentColor"/>
                    </svg>
                    ${reminderText}
                </div>
            `);
        }

        if (this.currentCategory === 'completed') {
            meta.push(`
                <div class="task-created">
                    完成于 ${new Date(task.completedAt || task.updatedAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}
                </div>
            `);
        } else {
            meta.push(`
                <div class="task-created">
                    创建于 ${new Date(task.createdAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}
                </div>
            `);
        }

        return meta.join('');
    }

    renderTaskActions(task) {
        if (this.currentCategory === 'completed') {
            return `
                <button class="action-button action-restore" data-action="restore" title="恢复任务">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8M3 12l2.26-2.26A9.75 9.75 0 0112 3a9 9 0 019 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="action-button action-delete" data-action="delete" title="删除任务">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            `;
        } else {
            return `
                <button class="action-button action-edit" data-action="edit" title="编辑任务">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="action-button action-delete" data-action="delete" title="删除任务">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            `;
        }
    }

    handleTaskListClick(e) {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;

        const taskId = taskItem.dataset.taskId;
        const action = e.target.closest('[data-action]')?.dataset.action;

        // 阻止事件冒泡
        e.stopPropagation();

        switch (action) {
            case 'cycle-status':
                this.cycleTaskStatus(taskId);
                break;
            case 'toggle':
                if (this.currentCategory === 'completed') {
                    this.restoreTask(taskId);
                } else {
                    this.completeTask(taskId);
                }
                break;
            case 'edit':
                this.showEditModal(taskId);
                break;
            case 'delete':
                this.showDeleteModal(taskId);
                break;
            case 'restore':
                this.restoreTask(taskId);
                break;
            default:
                // 点击任务项本身，切换选择状态
                if (e.ctrlKey || e.metaKey) {
                    this.toggleTaskSelection(taskId);
                } else {
                    // 双击编辑
                    if (e.detail === 2 && this.currentCategory !== 'completed') {
                        this.showEditModal(taskId);
                    }
                }
        }
    }

    toggleTaskSelection(taskId) {
        if (this.selectedTasks.has(taskId)) {
            this.selectedTasks.delete(taskId);
        } else {
            this.selectedTasks.add(taskId);
        }

        // 更新UI
        const taskItem = this.taskList.querySelector(`[data-task-id="${taskId}"]`);
        if (taskItem) {
            taskItem.classList.toggle('selected', this.selectedTasks.has(taskId));
        }

        this.updateBatchActionsButton();
    }

    updateBatchActionsButton() {
        const hasSelection = this.selectedTasks.size > 0;
        this.batchActionsBtn.style.display = hasSelection ? 'block' : 'none';
    }

    async addTask() {
        const content = this.quickAddInput.value.trim();
        if (!content) return;

        try {
            await taskApplicationService.createTask(content);
            this.quickAddInput.value = '';
            this.quickAddInput.focus();
        } catch (error) {
            console.error('添加任务失败:', error);
            this.showError('添加任务失败');
        }
    }

    async completeTask(taskId) {
        try {
            await taskApplicationService.completeTask(taskId);
            this.selectedTasks.delete(taskId);
            this.updateBatchActionsButton();
        } catch (error) {
            console.error('完成任务失败:', error);
            this.showError('完成任务失败');
        }
    }

    async restoreTask(taskId) {
        try {
            await taskApplicationService.restoreTask(taskId);
            this.selectedTasks.delete(taskId);
            this.updateBatchActionsButton();
        } catch (error) {
            console.error('恢复任务失败:', error);
            this.showError('恢复任务失败');
        }
    }

    async deleteTask(taskId) {
        try {
            await taskApplicationService.deleteTask(taskId);
            this.selectedTasks.delete(taskId);
            this.updateBatchActionsButton();
        } catch (error) {
            console.error('删除任务失败:', error);
            this.showError('删除任务失败');
        }
    }

    async cycleTaskStatus(taskId) {
        try {
            const task = [...this.tasks, ...this.completedTasks].find(t => t.id === taskId);
            if (!task) return;

            const currentStatus = task.status || (task.completed ? 'done' : 'todo');
            let nextStatus;
            
            // Cycle through statuses: todo -> doing -> done -> todo
            switch (currentStatus) {
                case 'todo':
                    nextStatus = 'doing';
                    break;
                case 'doing':
                    nextStatus = 'done';
                    break;
                case 'done':
                    nextStatus = 'todo';
                    break;
                default:
                    nextStatus = 'doing';
            }

            await taskApplicationService.updateTaskStatus(taskId, nextStatus);
        } catch (error) {
            console.error('更新任务状态失败:', error);
            this.showError('更新任务状态失败');
        }
    }

    getStatusText(status) {
        const statusMap = {
            'todo': '待办',
            'doing': '进行中',
            'done': '已完成'
        };
        return statusMap[status] || '待办';
    }

    getStatusIcon(status) {
        const iconMap = {
            'todo': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                     </svg>`,
            'doing': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="currentColor"/>
                        <circle cx="12" cy="12" r="4" fill="white"/>
                      </svg>`,
            'done': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <circle cx="12" cy="12" r="10" fill="currentColor"/>
                       <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                     </svg>`
        };
        return iconMap[status] || iconMap['todo'];
    }

    showEditModal(taskId) {
        const task = [...this.tasks, ...this.completedTasks].find(t => t.id === taskId);
        if (!task) return;

        this.currentEditingTask = taskId;
        this.editTaskContent.value = task.content;

        if (task.reminderTime) {
            const reminderDate = new Date(task.reminderTime);
            this.editReminderDate.value = reminderDate.getFullYear() + '-' +
                String(reminderDate.getMonth() + 1).padStart(2, '0') + '-' +
                String(reminderDate.getDate()).padStart(2, '0');
            this.editReminderTime.value = String(reminderDate.getHours()).padStart(2, '0') + ':' +
                String(reminderDate.getMinutes()).padStart(2, '0');
        } else {
            this.editReminderDate.value = '';
            this.editReminderTime.value = '';
        }

        this.taskEditModal.classList.add('show');
        this.editTaskContent.focus();
    }

    hideEditModal() {
        this.taskEditModal.classList.remove('show');
        this.currentEditingTask = null;
    }

    async saveTaskEdit() {
        if (!this.currentEditingTask) return;

        const content = this.editTaskContent.value.trim();
        if (!content) {
            this.showError('任务内容不能为空');
            return;
        }

        try {
            // 更新任务内容
            await taskApplicationService.updateTaskContent(this.currentEditingTask, content);

            // 更新提醒时间
            const date = this.editReminderDate.value;
            const time = this.editReminderTime.value;

            if (date) {
                // 如果设置了日期
                const timeToUse = time || '09:00'; // 如果没有设置时间，默认使用9:00
                const reminderTime = new Date(`${date}T${timeToUse}`);

                // 检查是否是过去的时间
                if (reminderTime <= new Date()) {
                    this.showError('提醒时间不能是过去的时间');
                    return;
                }

                await taskApplicationService.setTaskReminder(this.currentEditingTask, reminderTime.toISOString());
            } else {
                // 如果没有设置日期，清除提醒
                await taskApplicationService.setTaskReminder(this.currentEditingTask, null);
            }

            this.hideEditModal();
        } catch (error) {
            console.error('保存任务失败:', error);
            this.showError('保存任务失败');
        }
    }

    setQuickTime(button) {
        if (button.dataset.clear) {
            this.editReminderDate.value = '';
            this.editReminderTime.value = '';
            return;
        }

        const minutes = parseInt(button.dataset.minutes) || 0;
        const hours = parseInt(button.dataset.hours) || 0;

        const targetTime = new Date(Date.now() + (minutes * 60 + hours * 60 * 60) * 1000);

        this.editReminderDate.value = targetTime.toISOString().split('T')[0];
        this.editReminderTime.value = targetTime.toTimeString().slice(0, 5);
    }

    showDeleteModal(taskId) {
        this.currentDeletingTask = taskId;
        this.deleteConfirmModal.classList.add('show');
    }

    hideDeleteModal() {
        this.deleteConfirmModal.classList.remove('show');
        this.currentDeletingTask = null;
    }

    async confirmDeleteTask() {
        if (!this.currentDeletingTask) return;

        try {
            await this.deleteTask(this.currentDeletingTask);
            this.hideDeleteModal();
        } catch (error) {
            console.error('删除任务失败:', error);
            this.showError('删除任务失败');
        }
    }

    showBatchActionsModal() {
        this.selectedCount.textContent = this.selectedTasks.size;
        this.batchActionsModal.classList.add('show');
    }

    hideBatchActionsModal() {
        this.batchActionsModal.classList.remove('show');
    }

    async batchCompleteTask() {
        try {
            const promises = Array.from(this.selectedTasks).map(taskId =>
                taskApplicationService.completeTask(taskId)
            );
            await Promise.all(promises);

            this.selectedTasks.clear();
            this.updateBatchActionsButton();
            this.hideBatchActionsModal();
        } catch (error) {
            console.error('批量完成任务失败:', error);
            this.showError('批量完成任务失败');
        }
    }

    async batchDeleteTasks() {
        try {
            const promises = Array.from(this.selectedTasks).map(taskId =>
                taskApplicationService.deleteTask(taskId)
            );
            await Promise.all(promises);

            this.selectedTasks.clear();
            this.updateBatchActionsButton();
            this.hideBatchActionsModal();
        } catch (error) {
            console.error('批量删除任务失败:', error);
            this.showError('批量删除任务失败');
        }
    }

    showQuickAdd() {
        this.quickAddInput.focus();
    }

    openSettings() {
        // 通过 IPC 通知主进程打开设置窗口
        ipcRenderer.send('open-settings');
    }

    showEmptyState() {
        this.taskList.style.display = 'none';
        this.emptyState.classList.add('show');
    }

    hideEmptyState() {
        this.taskList.style.display = 'block';
        this.emptyState.classList.remove('show');
    }

    updateCounts() {
        const todayTasks = this.getTodayTasks();
        const scheduledTasks = this.getScheduledTasks();

        // Count tasks by status
        const todoTasks = this.tasks.filter(task => {
            const status = task.status || (task.completed ? 'done' : 'todo');
            return status === 'todo';
        });
        
        const doingTasks = this.tasks.filter(task => {
            const status = task.status || (task.completed ? 'done' : 'todo');
            return status === 'doing';
        });

        this.taskCounts.today.textContent = todayTasks.length;
        this.taskCounts.scheduled.textContent = scheduledTasks.length;
        this.taskCounts.all.textContent = this.tasks.length;
        this.taskCounts.completed.textContent = this.completedTasks.length;
        
        // Update status-specific counts
        if (this.taskCounts.todo) this.taskCounts.todo.textContent = todoTasks.length;
        if (this.taskCounts.doing) this.taskCounts.doing.textContent = doingTasks.length;
    }

    updateStats() {
        const totalTasks = this.tasks.length + this.completedTasks.length;
        const completedCount = this.completedTasks.length;
        const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

        this.totalTasks.textContent = totalTasks;
        this.completedTasksCount.textContent = completedCount;
        this.completionRate.textContent = `${completionRate}%`;
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + N: 新建任务
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.showQuickAdd();
        }

        // Escape: 关闭模态框
        if (e.key === 'Escape') {
            if (this.taskEditModal.classList.contains('show')) {
                this.hideEditModal();
            } else if (this.deleteConfirmModal.classList.contains('show')) {
                this.hideDeleteModal();
            } else if (this.batchActionsModal.classList.contains('show')) {
                this.hideBatchActionsModal();
            }
        }

        // Ctrl/Cmd + A: 全选任务
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && this.currentCategory !== 'completed') {
            e.preventDefault();
            const currentTasks = this.getFilteredTasks();
            currentTasks.forEach(task => this.selectedTasks.add(task.id));
            this.renderCurrentView();
            this.updateBatchActionsButton();
        }

        // F5 或 Ctrl/Cmd + R: 刷新数据
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
            e.preventDefault();
            this.refreshData();
        }
    }

    isOverdue(task) {
        if (!task.reminderTime) return false;
        return new Date(task.reminderTime) < new Date();
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate();
    }

    formatReminderTime(date) {
        const now = new Date();
        // 使用本地时区获取今天的开始时间
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        if (this.isSameDay(date, today)) {
            return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (this.isSameDay(date, tomorrow)) {
            return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (date < today) {
            return `逾期 ${date.toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}`;
        } else {
            return date.toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        // 简单的错误提示，可以后续改进为更好的UI
        console.error(message);
        // TODO: 实现更好的错误提示UI
        alert(message);
    }

    // 公共方法：刷新任务列表
    async refresh() {
        await this.loadTasks();
    }

    // 公共方法：获取当前任务数量
    getTaskCount() {
        return this.tasks.length;
    }

    // 清理资源
    destroy() {
        console.log('TaskManager: 开始清理资源');
        
        // 清理事件监听器
        this.cleanupTaskApplicationServiceListeners();
        
        // 清理其他资源
        this.tasks = [];
        this.completedTasks = [];
        this.selectedTasks.clear();
        this.currentEditingTask = null;
        this.currentDeletingTask = null;
        
        console.log('TaskManager: 资源清理完成');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 如果已经存在实例，先清理
    if (window.taskManager) {
        console.log('TaskManager: 发现已存在的实例，先清理');
        if (typeof window.taskManager.destroy === 'function') {
            window.taskManager.destroy();
        }
    }
    
    console.log('TaskManager: 创建新实例');
    window.taskManager = new TaskManager();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.taskManager && typeof window.taskManager.destroy === 'function') {
        console.log('TaskManager: 页面卸载，清理资源');
        window.taskManager.destroy();
        window.taskManager = null;
    }
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManager;
}