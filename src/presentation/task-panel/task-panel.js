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
        // 先移除可能存在的旧监听器，避免重复添加
        if (this.tasksUpdatedListener) {
            taskApplicationService.removeEventListener('tasksUpdated', this.tasksUpdatedListener);
        }
        if (this.completedTasksUpdatedListener) {
            taskApplicationService.removeEventListener('completedTasksUpdated', this.completedTasksUpdatedListener);
        }

        // 创建新的监听器函数并保存引用
        this.tasksUpdatedListener = (tasks) => {
            this.tasks = tasks;
            this.renderTasks();
            this.updateStats();
        };

        this.completedTasksUpdatedListener = () => {
            this.updateStats();
        };

        // 监听任务数据更新
        taskApplicationService.addEventListener('tasksUpdated', this.tasksUpdatedListener);

        // 监听已完成任务数据更新（用于统计）
        taskApplicationService.addEventListener('completedTasksUpdated', this.completedTasksUpdatedListener);
    }

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

        // 提醒弹窗事件
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

        // 窗口焦点事件 - 当窗口获得焦点时刷新数据
        window.addEventListener('focus', () => {
            this.refresh();
        });

        // 页面可见性变化事件 - 当页面变为可见时刷新数据
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.refresh();
            }
        });

        // 面板鼠标事件 - 使用更稳定的事件处理
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
                    // 延迟触发离开事件，避免在子元素间移动时误触发
                    debounceTimeout = setTimeout(() => {
                        if (!isMouseInside) {
                            ipcRenderer.invoke('panel-mouse-leave');
                        }
                    }, 100);
                }
            };
            
            // 使用mouseover/mouseout事件，只在真正进入/离开面板时触发
            taskPanel.addEventListener('mouseover', (e) => {
                // 只有当事件目标是面板本身或其子元素，且鼠标从外部进入时才触发
                if (e.target === taskPanel || taskPanel.contains(e.target)) {
                    if (!taskPanel.contains(e.relatedTarget)) {
                        handleMouseEnter();
                    }
                }
            });
            
            taskPanel.addEventListener('mouseout', (e) => {
                // 只有当鼠标真正离开面板区域时才触发
                if (!taskPanel.contains(e.relatedTarget)) {
                    handleMouseLeave();
                }
            });
        }
    }

    setupIpcListeners() {
        // 保留原有的IPC监听器作为备用
        ipcRenderer.on('update-tasks', async (event, tasks) => {
            // 这个监听器现在主要用于兼容性
            console.log('收到任务更新事件（兼容模式）');
        });
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
            
            // 重新聚焦输入框
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
            'todo': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                     </svg>`,
            'doing': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="currentColor"/>
                        <circle cx="12" cy="12" r="4" fill="white"/>
                      </svg>`,
            'done': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <circle cx="12" cy="12" r="10" fill="currentColor"/>
                       <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                     </svg>`
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

        // 对任务进行排序：有提醒时间的在前面按时间排序，无提醒时间的按创建时间排序在后面
        const sortedTasks = [...this.tasks].sort((a, b) => {
            // 如果两个任务都有提醒时间，按提醒时间排序
            if (a.reminderTime && b.reminderTime) {
                return new Date(a.reminderTime) - new Date(b.reminderTime);
            }
            
            // 有提醒时间的任务排在前面
            if (a.reminderTime && !b.reminderTime) {
                return -1;
            }
            if (!a.reminderTime && b.reminderTime) {
                return 1;
            }
            
            // 两个任务都没有提醒时间，按创建时间排序（新的在后面）
            return new Date(a.createdAt) - new Date(b.createdAt);
        });

        this.taskList.innerHTML = sortedTasks.map(task => this.createTaskElement(task)).join('');
        
        // 绑定事件
        this.bindTaskEvents();
    }

    createTaskElement(task) {
        const reminderText = task.reminderTime ? 
            this.formatReminderTime(new Date(task.reminderTime)) : '';
        
        // 检查任务是否超时
        const isOverdue = task.reminderTime && new Date(task.reminderTime) < new Date();
        const reminderClass = isOverdue ? 'task-reminder overdue' : 'task-reminder';
        
        // 获取任务状态
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
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" fill="currentColor"/>
                                </svg>
                                ${reminderText}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="action-button reminder-btn" data-action="reminder" title="设置提醒">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" fill="currentColor"/>
                        </svg>
                    </button>
                    <button class="action-button delete-btn" data-action="delete" title="删除任务">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    bindTaskEvents() {
        this.taskList.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;

            const taskId = taskItem.dataset.taskId;
            const action = e.target.closest('[data-action]')?.dataset.action;

            switch (action) {
                case 'cycle-status':
                    this.cycleTaskStatus(taskId);
                    break;
                case 'complete':
                    this.completeTask(taskId);
                    break;
                case 'delete':
                    this.deleteTask(taskId);
                    break;
                case 'reminder':
                    this.showReminderModal(taskId);
                    break;
            }
        });

        // 添加双击编辑事件
        this.taskList.addEventListener('dblclick', (e) => {
            const taskText = e.target.closest('.task-text');
            if (taskText && taskText.dataset.action === 'edit') {
                const taskItem = taskText.closest('.task-item');
                const taskId = taskItem.dataset.taskId;
                this.startEditTask(taskId);
            }
        });

        // 添加键盘事件处理
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

        // 添加失焦事件处理
        this.taskList.addEventListener('blur', (e) => {
            if (e.target.classList.contains('task-edit-input')) {
                this.saveTaskEdit(e.target);
            }
        }, true);
    }

    showReminderModal(taskId) {
        this.currentEditingTask = taskId;
        const task = this.tasks.find(t => t.id === taskId);
        
        if (task && task.reminderTime) {
            const reminderDate = new Date(task.reminderTime);
            this.reminderDate.value = reminderDate.toISOString().split('T')[0];
            this.reminderTime.value = reminderDate.toTimeString().slice(0, 5);
        } else {
            // 默认设置为1小时后
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

    // 开始编辑任务
    startEditTask(taskId) {
        const taskItem = this.taskList.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskItem) return;

        const taskText = taskItem.querySelector('.task-text');
        const editInput = taskItem.querySelector('.task-edit-input');
        
        if (!taskText || !editInput) return;

        // 隐藏文本，显示输入框
        taskText.style.display = 'none';
        editInput.style.display = 'block';
        editInput.focus();
        editInput.select();
    }

    // 保存任务编辑
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

    async updateTaskContent(taskId, newContent) {
        try {
            await taskApplicationService.updateTaskContent(taskId, newContent);
        } catch (error) {
            console.error('更新任务内容失败:', error);
            this.showError('更新任务失败');
        }
    }

    async setTaskReminder(taskId, reminderTime) {
        try {
            await taskApplicationService.setTaskReminder(taskId, reminderTime);
        } catch (error) {
            console.error('设置提醒失败:', error);
            this.showError('设置提醒失败');
        }
    }

    async clearTaskReminder(taskId) {
        try {
            await taskApplicationService.clearTaskReminder(taskId);
        } catch (error) {
            console.error('清除提醒失败:', error);
            this.showError('清除提醒失败');
        }
    }

    // 取消任务编辑
    cancelTaskEdit(inputElement) {
        const taskItem = inputElement.closest('.task-item');
        if (!taskItem) return;

        const taskText = taskItem.querySelector('.task-text');
        const editInput = taskItem.querySelector('.task-edit-input');
        
        if (!taskText || !editInput) return;

        // 恢复原始值
        const task = this.tasks.find(t => t.id === taskItem.dataset.taskId);
        if (task) {
            editInput.value = task.content;
        }

        // 显示文本，隐藏输入框
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
            
            // 更新任务计数
            this.taskCount.textContent = incompleteCount;
            
            // 更新底部统计
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
        // 移除事件监听器
        if (this.tasksUpdatedListener) {
            taskApplicationService.removeEventListener('tasksUpdated', this.tasksUpdatedListener);
            this.tasksUpdatedListener = null;
        }
        if (this.completedTasksUpdatedListener) {
            taskApplicationService.removeEventListener('completedTasksUpdated', this.completedTasksUpdatedListener);
            this.completedTasksUpdatedListener = null;
        }
        console.log('TaskPanel: 资源清理完成');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 如果已经存在实例，先清理
    if (window.taskPanel) {
        console.log('TaskPanel: 发现已存在的实例，先清理');
        window.taskPanel.destroy();
    }
    
    console.log('TaskPanel: 创建新实例');
    window.taskPanel = new TaskPanel();
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskPanel;
}