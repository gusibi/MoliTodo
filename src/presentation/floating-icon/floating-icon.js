console.log('JS: floating-icon.js 文件开始加载');

const { ipcRenderer } = require('electron');

console.log('JS: electron模块导入成功');
console.log('JS: ipcRenderer =', ipcRenderer);

// 创建一个函数将渲染进程日志发送到主进程
function logToMain(message, ...args) {
    console.log(message, ...args);
    try {
        ipcRenderer.invoke('log-message', `[渲染进程] ${message}`, ...args);
    } catch (error) {
        console.error('发送日志到主进程失败:', error);
    }
}

logToMain('JS: floating-icon.js 文件开始加载');
logToMain('JS: electron模块导入成功');

class FloatingIcon {
    constructor() {
        logToMain('FloatingIcon: 构造函数开始');
        
        this.isHovering = false;
        this.isPanelHovering = false; // 添加面板悬停状态
        this.panelVisible = false;
        this.hoverTimeout = null;
        this.hideTimeout = null; // 添加隐藏定时器
        
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            logToMain('FloatingIcon: DOM还在加载中，等待DOMContentLoaded事件');
            document.addEventListener('DOMContentLoaded', () => {
                logToMain('FloatingIcon: DOMContentLoaded事件触发，开始获取DOM元素');
                this.initializeElements();
            });
        } else {
            logToMain('FloatingIcon: DOM已加载完成，直接获取元素');
            this.initializeElements();
        }
    }

    initializeElements() {
        console.log('FloatingIcon: 开始获取DOM元素');
        
        this.icon = document.getElementById('floatingIcon');
        this.badge = document.getElementById('badge');
        this.badgeText = document.getElementById('badgeText');
        this.defaultIcon = document.getElementById('defaultIcon');
        this.alertIcon = document.getElementById('alertIcon');
        
        console.log('FloatingIcon: DOM元素获取结果:');
        console.log('- icon:', this.icon);
        console.log('- badge:', this.badge);
        console.log('- badgeText:', this.badgeText);
        console.log('- defaultIcon:', this.defaultIcon);
        console.log('- alertIcon:', this.alertIcon);
        
        this.isHovering = false;
        this.hoverTimeout = null;
        this.panelVisible = false;
        
        // 如果所有元素都获取到了，开始初始化
        if (this.icon) {
            console.log('FloatingIcon: 主要元素获取成功，开始初始化');
            this.init();
        } else {
            console.error('FloatingIcon: 主要元素获取失败，无法初始化');
            // 尝试延迟获取
            setTimeout(() => {
                console.log('FloatingIcon: 延迟重试获取元素');
                this.initializeElements();
            }, 1000);
        }
    }

    createIcon() {
        logToMain('FloatingIcon: 创建图标 - 图标已在HTML中定义，无需动态创建');
        // 图标已经在HTML中定义，这里只需要确保样式正确
        if (this.icon) {
            logToMain('FloatingIcon: 图标元素存在，设置初始样式');
            this.icon.style.cursor = 'pointer';
        } else {
            logToMain('FloatingIcon: 错误 - 图标元素不存在');
        }
    }

    init() {
        logToMain('FloatingIcon: 开始初始化');
        this.createIcon();
        this.setupEventListeners();
        this.setupIpcListeners();
        this.requestBadgeUpdate();
        
        // 初始化时不启用鼠标穿透，让图标可以接收事件
        logToMain('FloatingIcon: 初始化完成，保持窗口可接收鼠标事件');
        
        // 验证DOM元素是否正确获取
        logToMain('FloatingIcon: 验证DOM元素');
        logToMain('FloatingIcon: icon元素:', this.icon);
        logToMain('FloatingIcon: badge元素:', this.badge);
    }

    setupEventListeners() {
        console.log('FloatingIcon: 开始设置事件监听器');
        logToMain('FloatingIcon: 开始设置事件监听器');
        
        if (!this.icon) {
            console.error('FloatingIcon: 图标元素不存在，无法设置事件监听器');
            logToMain('FloatingIcon: 错误 - 图标元素不存在，无法设置事件监听器');
            return;
        }
        
        console.log('FloatingIcon: 为图标元素添加mouseenter事件监听器');
        logToMain('FloatingIcon: 为图标元素添加mouseenter事件监听器');
        this.icon.addEventListener('mouseenter', (e) => {
            console.log('FloatingIcon: mouseenter事件触发！', e);
            logToMain('FloatingIcon: ✅ mouseenter事件触发！鼠标进入悬浮按钮');
            this.handleMouseEnter(e);
        });
        
        console.log('FloatingIcon: 为图标元素添加mouseleave事件监听器');
        logToMain('FloatingIcon: 为图标元素添加mouseleave事件监听器');
        this.icon.addEventListener('mouseleave', (e) => {
            console.log('FloatingIcon: mouseleave事件触发！', e);
            logToMain('FloatingIcon: ❌ mouseleave事件触发！鼠标离开悬浮按钮');
            this.handleMouseLeave(e);
        });
        
        console.log('FloatingIcon: 事件监听器设置完成');
        logToMain('FloatingIcon: ✅ 事件监听器设置完成');
        
        // 拖拽事件
        this.setupDragEvents();
    }

    setupDragEvents() {
        let isDragging = false;
        let hasMoved = false;
        let startX, startY;
        let startTime;
        let initialWindowPos = null;
        let finalPosition = null;

        this.icon.addEventListener('mousedown', (e) => {
            logToMain('FloatingIcon: 🖱️ mousedown事件触发');
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            startTime = Date.now();
            
            // 获取当前窗口位置
            ipcRenderer.invoke('get-window-position').then(pos => {
                initialWindowPos = pos;
            });
            
            // 阻止显示面板的定时器
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
                this.hoverTimeout = null;
                logToMain('FloatingIcon: 清除悬停显示定时器');
            }
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !initialWindowPos) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // 如果移动距离超过阈值，认为是拖拽
            if (distance > 5) {
                if (!hasMoved) {
                    logToMain('FloatingIcon: 🚀 开始拖拽模式');
                    this.icon.classList.add('dragging');
                    hasMoved = true;
                }
                
                // 🚀 即时视觉反馈：使用CSS transform移动图标（GPU加速，极其流畅）
                this.icon.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                
                // 计算最终位置，但不立即发送IPC
                finalPosition = {
                    x: initialWindowPos.x + deltaX,
                    y: initialWindowPos.y + deltaY
                };
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            logToMain('FloatingIcon: 🖱️ mouseup事件触发', { hasMoved, duration });
            
            if (isDragging) {
                isDragging = false;
                
                // 清理CSS transform
                this.icon.style.transform = '';
                
                if (hasMoved) {
                    // 这是拖拽操作 - 只在拖拽结束时进行一次IPC调用
                    logToMain('FloatingIcon: 🚀 拖拽操作完成，同步最终位置');
                    this.icon.classList.remove('dragging');
                    
                    // 🎯 关键优化：只在拖拽结束时进行一次IPC调用
                    if (finalPosition) {
                        ipcRenderer.invoke('drag-window', finalPosition);
                        logToMain('FloatingIcon: 最终位置已同步', finalPosition);
                    }
                    
                    ipcRenderer.invoke('end-drag');
                } else if (duration < 500) {
                    // 这是点击操作（短时间且没有移动）
                    logToMain('FloatingIcon: 🖱️ 检测到点击操作');
                    this.handleClick(e);
                }
                
                // 重置状态
                hasMoved = false;
                initialWindowPos = null;
                finalPosition = null;
            }
        });
    }

    handleClick(e) {
        logToMain('FloatingIcon: 🖱️ 处理点击事件');
        
        // 如果面板可见，则隐藏面板
        if (this.panelVisible) {
            logToMain('FloatingIcon: 面板可见，点击收起面板');
            this.hideTaskPanel();
            
            // 清除相关定时器
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
        } else {
            logToMain('FloatingIcon: 面板不可见，点击无操作');
        }
        
        e.preventDefault();
        e.stopPropagation();
    }

    setupIpcListeners() {
        // 监听角标更新
        ipcRenderer.on('update-badge', (event, data) => {
            this.updateBadge(data.count, data.alertState);
        });

        // 监听任务提醒
        ipcRenderer.on('task-reminder', (event, task) => {
            this.handleTaskReminder(task);
        });

        // 监听面板鼠标进入事件
        ipcRenderer.on('panel-mouse-enter', () => {
            logToMain('FloatingIcon: 收到面板鼠标进入事件');
            this.isPanelHovering = true;
            // 清除隐藏定时器
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
                logToMain('FloatingIcon: 清除面板隐藏定时器');
            }
        });

        // 监听面板鼠标离开事件
        ipcRenderer.on('panel-mouse-leave', () => {
            logToMain('FloatingIcon: 收到面板鼠标离开事件');
            this.isPanelHovering = false;
            // 延迟隐藏面板
            this.hideTimeout = setTimeout(() => {
                if (!this.isHovering && !this.isPanelHovering && this.panelVisible) {
                    logToMain('FloatingIcon: 面板隐藏定时器触发，隐藏任务面板');
                    this.hideTaskPanel();
                }
            }, 300);
        });
    }

    handleMouseEnter() {
        logToMain('FloatingIcon: 🎯 处理鼠标进入事件开始');
        console.log('FloatingIcon: 处理鼠标进入事件开始');
        this.isHovering = true;
        logToMain('FloatingIcon: 设置 isHovering = true');
        
        // 清除隐藏定时器
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
            logToMain('FloatingIcon: 清除隐藏定时器');
        }
        
        // 清除提醒状态
        if (this.icon.classList.contains('alert-state')) {
            logToMain('FloatingIcon: 清除提醒状态');
            ipcRenderer.invoke('clear-alert-state');
        }
        
        // 延迟显示任务面板
        logToMain('FloatingIcon: 🕐 设置任务面板显示定时器 (300ms)');
        this.hoverTimeout = setTimeout(() => {
            logToMain('FloatingIcon: ⏰ 显示定时器触发！检查状态...');
            logToMain('FloatingIcon: 当前状态 - isHovering:', this.isHovering, 'panelVisible:', this.panelVisible);
            if (this.isHovering && !this.panelVisible) {
                logToMain('FloatingIcon: ✅ 条件满足，开始显示任务面板');
                this.showTaskPanel();
            } else {
                logToMain('FloatingIcon: ❌ 条件不满足，不显示面板');
                if (!this.isHovering) logToMain('FloatingIcon: 原因：鼠标已离开');
                if (this.panelVisible) logToMain('FloatingIcon: 原因：面板已可见');
            }
        }, 300); // 300ms 延迟
        logToMain('FloatingIcon: 🎯 处理鼠标进入事件完成');
    }

    handleMouseLeave() {
        logToMain('FloatingIcon: 处理鼠标离开事件');
        this.isHovering = false;
        
        // 清除悬停定时器
        if (this.hoverTimeout) {
            logToMain('FloatingIcon: 清除悬停定时器');
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }
        
        // 延迟隐藏任务面板，但要考虑面板悬停状态
        logToMain('FloatingIcon: 设置任务面板隐藏定时器');
        this.hideTimeout = setTimeout(() => {
            if (!this.isHovering && !this.isPanelHovering && this.panelVisible) {
                logToMain('FloatingIcon: 定时器触发，隐藏任务面板');
                this.hideTaskPanel();
            }
        }, 300); // 300ms 延迟，给用户时间移动到面板
    }

    showTaskPanel() {
        logToMain('FloatingIcon: 开始显示任务面板');
        if (this.panelVisible) {
            logToMain('FloatingIcon: 任务面板已经可见，跳过显示');
            return;
        }
        
        logToMain('FloatingIcon: 调用IPC显示任务面板');
        ipcRenderer.invoke('show-task-panel');
        this.panelVisible = true;
        logToMain('FloatingIcon: 任务面板状态设置为可见');
    }

    hideTaskPanel() {
        logToMain('FloatingIcon: 开始隐藏任务面板');
        if (!this.panelVisible) {
            logToMain('FloatingIcon: 任务面板已经隐藏，跳过隐藏');
            return;
        }
        
        logToMain('FloatingIcon: 调用IPC隐藏任务面板');
        ipcRenderer.invoke('hide-task-panel');
        this.panelVisible = false;
        logToMain('FloatingIcon: 任务面板状态设置为隐藏');
    }

    updateBadge(count, alertState = false) {
        // 更新角标数字
        if (count > 0) {
            this.badgeText.textContent = count > 99 ? '99+' : count.toString();
            this.badge.classList.add('show');
        } else {
            this.badge.classList.remove('show');
        }

        // 更新提醒状态
        if (alertState) {
            this.icon.classList.add('alert-state');
        } else {
            this.icon.classList.remove('alert-state');
        }
    }

    handleTaskReminder(task) {
        // 任务提醒时的视觉效果
        this.icon.classList.add('alert-state');
        
        // 播放提醒动画
        this.playReminderAnimation();
        
        console.log('任务提醒:', task.content);
    }

    playReminderAnimation() {
        // 添加额外的提醒动画效果
        this.icon.style.animation = 'none';
        
        // 强制重绘
        this.icon.offsetHeight;
        
        // 重新应用动画
        this.icon.style.animation = '';
        
        // 添加震动效果（如果支持）
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    }

    async requestBadgeUpdate() {
        try {
            // 请求主进程更新角标
            const tasks = await ipcRenderer.invoke('get-tasks');
            const count = tasks ? tasks.length : 0;
            this.updateBadge(count);
        } catch (error) {
            console.error('请求角标更新失败:', error);
        }
    }

    // 公共方法：手动更新角标
    setBadgeCount(count) {
        this.updateBadge(count);
    }

    // 公共方法：设置提醒状态
    setAlertState(alertState) {
        if (alertState) {
            this.icon.classList.add('alert-state');
        } else {
            this.icon.classList.remove('alert-state');
        }
    }

    // 公共方法：获取当前状态
    getState() {
        return {
            badgeCount: parseInt(this.badgeText.textContent) || 0,
            alertState: this.icon.classList.contains('alert-state'),
            panelVisible: this.panelVisible,
            isHovering: this.isHovering
        };
    }
}

// 页面加载完成后初始化
logToMain('JS: 设置DOMContentLoaded事件监听器');
document.addEventListener('DOMContentLoaded', () => {
    logToMain('JS: DOMContentLoaded事件触发，创建FloatingIcon实例');
    window.floatingIcon = new FloatingIcon();
    logToMain('JS: FloatingIcon实例已创建并赋值给window.floatingIcon');
});

// 如果DOM已经加载完成，直接创建实例
if (document.readyState === 'loading') {
    logToMain('JS: DOM正在加载中，等待DOMContentLoaded事件');
} else {
    logToMain('JS: DOM已加载完成，直接创建FloatingIcon实例');
    window.floatingIcon = new FloatingIcon();
    logToMain('JS: FloatingIcon实例已创建并赋值给window.floatingIcon');
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatingIcon;
}