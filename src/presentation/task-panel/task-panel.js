const { ipcRenderer } = require('electron');

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

    init() {
        this.setupEventListeners();
        this.setupIpcListeners();
        this.loadTasks();
        
        // 聚焦输入框
        this.quickAddInput.focus();
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
        // 监听任务更新
        ipcRenderer.on('update-tasks', async (event, tasks) => {
            this.tasks = tasks || [];
            this.renderTasks();
            await this.updateStats();
        });
    }

    async loadTasks() {
        try {
            this.tasks = await ipcRenderer.invoke('get-tasks') || [];
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
            const task = await ipcRenderer.invoke('create-task', content);
            this.tasks.push(task); // 使用push而不是unshift，让排序逻辑处理顺序
            this.quickAddInput.value = '';
            this.renderTasks();
            await this.updateStats();
            
            // 重新聚焦输入框
            this.quickAddInput.focus();
        } catch (error) {
            console.error('添加任务失败:', error);
            this.showError('添加任务失败');
        }
    }

    async completeTask(taskId) {
        try {
            await ipcRenderer.invoke('complete-task', taskId);
            this.tasks = this.tasks.filter(task => task.id !== taskId);
            this.renderTasks();
            await this.updateStats();
        } catch (error) {
            console.error('完成任务失败:', error);
            this.showError('完成任务失败');
        }
    }

    async deleteTask(taskId) {
        try {
            await ipcRenderer.invoke('delete-task', taskId);
            this.tasks = this.tasks.filter(task => task.id !== taskId);
            this.renderTasks();
            await this.updateStats();
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
        
        return `
            <div class="task-item" data-task-id="${task.id}">
                <div class="task-checkbox" data-action="complete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: none;">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
                    </svg>
                </div>
                <div class="task-content">
                    <div class="task-text" data-action="edit" title="双击编辑">${this.escapeHtml(task.content)}</div>
                    <input class="task-edit-input" style="display: none;" value="${this.escapeHtml(task.content)}" />
                    ${reminderText ? `
                        <div class="${reminderClass}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" fill="currentColor"/>
                            </svg>
                            ${reminderText}
                        </div>
                    ` : ''}
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
            const updatedTask = await ipcRenderer.invoke('set-task-reminder', this.currentEditingTask, reminderTime.toISOString());
            
            // 更新本地任务数据
            const taskIndex = this.tasks.findIndex(t => t.id === this.currentEditingTask);
            if (taskIndex >= 0) {
                this.tasks[taskIndex] = updatedTask;
                this.renderTasks();
            }
            
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
            const updatedTask = await ipcRenderer.invoke('update-task-content', taskId, newContent);
            
            // 更新本地任务数据
            const taskIndex = this.tasks.findIndex(t => t.id === taskId);
            if (taskIndex >= 0) {
                this.tasks[taskIndex] = updatedTask;
                this.renderTasks();
            }
        } catch (error) {
            console.error('更新任务失败:', error);
            this.showError('更新任务失败');
            this.cancelTaskEdit(inputElement);
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
        const count = this.tasks.length;
        this.taskCount.textContent = `${count} 个任务`;
        
        // 获取今日完成的任务数
        try {
            const completedTasks = await ipcRenderer.invoke('get-completed-tasks');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // 筛选今天完成的任务
            const todayCompletedCount = completedTasks.filter(task => {
                const completedAt = new Date(task.updatedAt);
                return completedAt >= today && completedAt < tomorrow;
            }).length;
            
            this.footerStats.textContent = `今日完成 ${todayCompletedCount} 个任务`;
        } catch (error) {
            console.error('获取已完成任务失败:', error);
            this.footerStats.textContent = `今日完成 0 个任务`;
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
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.taskPanel = new TaskPanel();
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskPanel;
}