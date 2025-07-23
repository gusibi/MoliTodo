// 这是修复后的 task-panel.js

const { ipcRenderer } = require('electron');
const { taskApplicationService } = require('../../application/services/task-application-service');

class TaskPanel {
    constructor() {
        this.tasks = [];
        this.currentEditingTask = null;

        // DOM 元素
        this.taskList = document.getElementById('taskList');
        this.emptyState = document.getElementById('emptyState');
        this.quickAddInput = document.getElementById('quickAddInput');
        this.addButton = document.getElementById('addButton');
        this.taskCount = document.getElementById('taskCount');
        this.footerStats = document.getElementById('footerStats');

        // 提醒弹窗元素
        this.reminderModal = document.getElementById('reminderModal');
        this.reminderDate = document.getElementById('reminderDate');
        this.reminderTime = document.getElementById('reminderTime');
        this.closeReminderModal = document.getElementById('closeReminderModal');
        this.cancelReminder = document.getElementById('cancelReminder');
        this.saveReminder = document.getElementById('saveReminder');

        this.init();
    }

    async init() {
        // 初始化数据管理器
        await taskApplicationService.init();

        this.setupEventListeners();
        this.setupTaskApplicationServiceListeners();
        this.loadTasks();

        // 聚焦输入框
        this.quickAddInput.focus();
    }

    setupTaskApplicationServiceListeners() {
        // 确保先清理旧的监听器
        this.cleanupTaskApplicationServiceListeners();

        // 创建新的监听器函数并保存引用
        this.tasksUpdatedListener = (tasks) => {
            console.log('TaskPanel: 接收到任务更新', tasks.length, '个任务');
            this.tasks = tasks;
            this.renderTasks();
            this.updateStats();
        };

        this.completedTasksUpdatedListener = () => {
            console.log('TaskPanel: 接收到已完成任务更新');
            this.updateStats();
        };

        // 监听任务数据更新
        taskApplicationService.addEventListener('tasksUpdated', this.tasksUpdatedListener);

        // 监听已完成任务数据更新（用于统计）
        taskApplicationService.addEventListener('completedTasksUpdated', this.completedTasksUpdatedListener);

        console.log('TaskPanel: 事件监听器已设置');
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
        console.log('TaskPanel: 旧的事件监听器已清理');
    }

    // *** 主要修改区域 ***
    setupEventListeners() {
        // 快速添加任务
        this.quickAddInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        this.addButton.addEventListener('click', () => {
            this.addTask();
        });

        // ==========================================================
        // 使用事件委托，为父容器 taskList 绑定一次性事件监听器
        // ==========================================================

        // 处理点击事件
        this.taskList.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;

            const taskId = taskItem.dataset.taskId;
            const action = e.target.closest('[data-action]')?.dataset.action;

            switch (action) {
                case 'cycle-status':
                    this.cycleTaskStatus(taskId);
                    break;
                case 'delete':
                    this.deleteTask(taskId);
                    break;
                case 'reminder':
                    this.showReminderModal(taskId);
                    break;
            }
        });

        // 处理双击编辑事件
        this.taskList.addEventListener('dblclick', (e) => {
            const taskText = e.target.closest('.task-text');
            if (taskText && taskText.dataset.action === 'edit') {
                const taskItem = taskText.closest('.task-item');
                const taskId = taskItem.dataset.taskId;
                this.startEditTask(taskId);
            }
        });

        // 处理键盘事件（用于编辑输入框）
        this.taskList.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('task-edit-input')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveTaskEdit(e.target);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelTaskEdit(e.target);
                }
            }
        });

        // 处理失焦事件（用于编辑输入框）
        this.taskList.addEventListener('blur', (e) => {
            if (e.target.classList.contains('task-edit-input')) {
                this.saveTaskEdit(e.target);
            }
        }, true); // 使用捕获阶段确保失焦事件触发

        // ==========================================================
        // 提醒弹窗事件
        // ==========================================================
        this.closeReminderModal.addEventListener('click', () => {
            this.hideReminderModal();
        });

        this.cancelReminder.addEventListener('click', () => {
            this.hideReminderModal();
        });

        this.saveReminder.addEventListener('click', () => {
            this.saveTaskReminder();
        });

        // 快速时间按钮
        document.querySelectorAll('.quick-time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setQuickTime(btn);
            });
        });

        // 点击弹窗背景关闭
        this.reminderModal.addEventListener('click', (e) => {
            if (e.target === this.reminderModal) {
                this.hideReminderModal();
            }
        });

        // 窗口焦点事件
        window.addEventListener('focus', () => {
            this.refresh();
        });

        // 页面可见性变化事件
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.refresh();
            }
        });

        // 面板鼠标事件
        const taskPanel = document.querySelector('.task-panel');
        if (taskPanel) {
            let isMouseInside = false;
            let debounceTimeout = null;

            const handleMouseEnter = () => {
                if (!isMouseInside) {
                    isMouseInside = true;
                    if (debounceTimeout) {
                        clearTimeout(debounceTimeout);
                        debounceTimeout = null;
                    }
                    ipcRenderer.invoke('panel-mouse-enter');
                }
            };

            const handleMouseLeave = () => {
                if (isMouseInside) {
                    isMouseInside = false;
                    debounceTimeout = setTimeout(() => {
                        if (!isMouseInside) {
                            ipcRenderer.invoke('panel-mouse-leave');
                        }
                    }, 100);
                }
            };

            taskPanel.addEventListener('mouseover', (e) => {
                if (e.target === taskPanel || taskPanel.contains(e.target)) {
                    if (!taskPanel.contains(e.relatedTarget)) {
                        handleMouseEnter();
                    }
                }
            });

            taskPanel.addEventListener('mouseout', (e) => {
                if (!taskPanel.contains(e.relatedTarget)) {
                    handleMouseLeave();
                }
            });
        }
    }

    async loadTasks() {
        try {
            this.tasks = taskApplicationService.getTasks();
            this.renderTasks();
            await this.updateStats();
        } catch (error) {
            console.error('加载任务失败:', error);
        }
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
        } catch (error) {
            console.error('完成任务失败:', error);
            this.showError('完成任务失败');
        }
    }

    async cycleTaskStatus(taskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;

            const currentStatus = task.status || (task.completed ? 'done' : 'todo');
            let nextStatus;

            switch (currentStatus) {
                case 'todo': nextStatus = 'doing'; break;
                case 'doing': nextStatus = 'done'; break;
                case 'done': nextStatus = 'todo'; break;
                default: nextStatus = 'doing';
            }

            await taskApplicationService.updateTaskStatus(taskId, nextStatus);
        } catch (error) {
            console.error('更新任务状态失败:', error);
            this.showError('更新任务状态失败');
        }
    }

    getStatusText(status) {
        const statusMap = { 'todo': '待办', 'doing': '进行中', 'done': '已完成' };
        return statusMap[status] || '待办';
    }

    getStatusIcon(status) {
        const iconMap = {
            'todo': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/></svg>`,
            'doing': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`,
            'done': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/></svg>`
        };
        return iconMap[status] || iconMap['todo'];
    }

    async deleteTask(taskId) {
        try {
            await taskApplicationService.deleteTask(taskId);
        } catch (error) {
            console.error('删除任务失败:', error);
            this.showError('删除任务失败');
        }
    }

    renderTasks() {
        if (this.tasks.length === 0) {
            this.taskList.style.display = 'none';
            this.emptyState.classList.add('show');
            return;
        }

        this.taskList.style.display = 'block';
        this.emptyState.classList.remove('show');

        const sortedTasks = [...this.tasks].sort((a, b) => {
            if (a.reminderTime && b.reminderTime) return new Date(a.reminderTime) - new Date(b.reminderTime);
            if (a.reminderTime && !b.reminderTime) return -1;
            if (!a.reminderTime && b.reminderTime) return 1;
            return new Date(a.createdAt) - new Date(b.createdAt);
        });

        this.taskList.innerHTML = sortedTasks.map(task => this.createTaskElement(task)).join('');

        // *** 主要修改区域 ***
        // 不再调用 this.bindTaskEvents()，因为事件监听器已经在 setupEventListeners 中设置好了
    }

    createTaskElement(task) {
        const reminderText = task.reminderTime ? this.formatReminderTime(new Date(task.reminderTime)) : '';
        const isOverdue = task.reminderTime && new Date(task.reminderTime) < new Date();
        const reminderClass = isOverdue ? 'task-reminder overdue' : 'task-reminder';
        const status = task.status || (task.completed ? 'done' : 'todo');
        const statusText = this.getStatusText(status);
        const statusClass = `task-status status-${status}`;

        return `
            <div class="task-item ${status}" data-task-id="${task.id}" data-status="${status}">
                <div class="task-status-indicator" data-action="cycle-status" title="点击切换状态">
                    ${this.getStatusIcon(status)}
                </div>
                <div class="task-content">
                    <div class="task-text" data-action="edit" title="双击编辑">${this.escapeHtml(task.content)}</div>
                    <input class="task-edit-input" style="display: none;" value="${this.escapeHtml(task.content)}" />
                    <div class="task-meta">
                        <span class="${statusClass}">${statusText}</span>
                        ${reminderText ? `
                            <div class="${reminderClass}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" fill="currentColor"/></svg>
                                ${reminderText}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="action-button reminder-btn" data-action="reminder" title="设置提醒"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" fill="currentColor"/></svg></button>
                    <button class="action-button delete-btn" data-action="delete" title="删除任务"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                </div>
            </div>
        `;
    }

    // *** 主要修改区域 ***
    // bindTaskEvents 方法已被移除

    showReminderModal(taskId) {
        this.currentEditingTask = taskId;
        const task = this.tasks.find(t => t.id === taskId);

        if (task && task.reminderTime) {
            const reminderDate = new Date(task.reminderTime);
            this.reminderDate.value = reminderDate.toISOString().split('T')[0];
            this.reminderTime.value = reminderDate.toTimeString().slice(0, 5);
        } else {
            const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
            this.reminderDate.value = defaultTime.toISOString().split('T')[0];
            this.reminderTime.value = defaultTime.toTimeString().slice(0, 5);
        }

        this.reminderModal.classList.add('show');
    }

    hideReminderModal() {
        this.reminderModal.classList.remove('show');
        this.currentEditingTask = null;
    }

    setQuickTime(button) {
        const minutes = parseInt(button.dataset.minutes) || 0;
        const hours = parseInt(button.dataset.hours) || 0;
        const targetTime = new Date(Date.now() + (minutes * 60 + hours * 60 * 60) * 1000);
        this.reminderDate.value = targetTime.toISOString().split('T')[0];
        this.reminderTime.value = targetTime.toTimeString().slice(0, 5);
    }

    async saveTaskReminder() {
        if (!this.currentEditingTask) return;

        const date = this.reminderDate.value;
        const time = this.reminderTime.value;

        if (!date || !time) {
            this.showError('请选择提醒时间');
            return;
        }

        const reminderTime = new Date(`${date}T${time}`);

        if (reminderTime <= new Date()) {
            this.showError('提醒时间不能是过去的时间');
            return;
        }

        try {
            await taskApplicationService.setTaskReminder(this.currentEditingTask, reminderTime.toISOString());
            this.hideReminderModal();
        } catch (error) {
            console.error('设置提醒失败:', error);
            this.showError('设置提醒失败');
        }
    }

    startEditTask(taskId) {
        const taskItem = this.taskList.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskItem) return;

        const taskText = taskItem.querySelector('.task-text');
        const editInput = taskItem.querySelector('.task-edit-input');

        if (!taskText || !editInput) return;

        taskText.style.display = 'none';
        editInput.style.display = 'block';
        editInput.focus();
        editInput.select();
    }

    async saveTaskEdit(inputElement) {
        const taskItem = inputElement.closest('.task-item');
        if (!taskItem) return;

        const taskId = taskItem.dataset.taskId;
        const newContent = inputElement.value.trim();

        if (!newContent) {
            this.showError('任务内容不能为空');
            this.cancelTaskEdit(inputElement);
            return;
        }

        try {
            await taskApplicationService.updateTaskContent(taskId, newContent);
        } catch (error) {
            console.error('更新任务失败:', error);
            this.showError('更新任务失败');
            this.cancelTaskEdit(inputElement);
        }
    }

    cancelTaskEdit(inputElement) {
        const taskItem = inputElement.closest('.task-item');
        if (!taskItem) return;

        const taskText = taskItem.querySelector('.task-text');
        const editInput = taskItem.querySelector('.task-edit-input');

        if (!taskText || !editInput) return;

        const task = this.tasks.find(t => t.id === taskItem.dataset.taskId);
        if (task) {
            editInput.value = task.content;
        }

        taskText.style.display = 'block';
        editInput.style.display = 'none';
    }

    async updateStats() {
        try {
            const incompleteTasks = this.tasks;
            const completedTasks = taskApplicationService.getCompletedTasks();

            const incompleteCount = incompleteTasks.length;
            const completedCount = completedTasks.length;
            const totalCount = incompleteCount + completedCount;

            this.taskCount.textContent = incompleteCount;

            if (totalCount === 0) {
                this.footerStats.textContent = '暂无任务';
            } else {
                this.footerStats.textContent = `共 ${totalCount} 个任务，已完成 ${completedCount} 个`;
            }
        } catch (error) {
            console.error('更新统计失败:', error);
        }
    }

    formatReminderTime(date) {
        const now = new Date();
        const today = now.toDateString();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();

        if (date.toDateString() === today) {
            return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (date.toDateString() === tomorrow) {
            return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error(message);
    }

    async refresh() {
        await this.loadTasks();
    }

    getTaskCount() {
        return this.tasks.length;
    }

    destroy() {
        console.log('TaskPanel: 开始清理资源');
        this.cleanupTaskApplicationServiceListeners();
        this.tasks = [];
        this.currentEditingTask = null;
        console.log('TaskPanel: 资源清理完成');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.taskPanel) {
        console.log('TaskPanel: 发现已存在的实例，先清理');
        window.taskPanel.destroy();
    }
    console.log('TaskPanel: 创建新实例');
    window.taskPanel = new TaskPanel();
});

window.addEventListener('beforeunload', () => {
    if (window.taskPanel) {
        console.log('TaskPanel: 页面卸载，清理资源');
        window.taskPanel.destroy();
        window.taskPanel = null;
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskPanel;
}