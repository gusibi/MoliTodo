const { ipcRenderer } = require('electron');

class SettingsManager {
    constructor() {
        this.config = {};
        this.init();
    }

    async init() {
        // 加载当前配置
        await this.loadConfig();
        
        // 初始化标签页
        this.initTabs();
        
        // 初始化设置控件
        this.initControls();
        
        // 绑定事件
        this.bindEvents();
    }

    async loadConfig() {
        try {
            this.config = await ipcRenderer.invoke('get-config');
            this.updateUI();
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }

    updateUI() {
        // 更新悬浮图标设置
        const opacitySlider = document.getElementById('opacitySlider');
        const opacityValue = document.getElementById('opacityValue');
        const sizeSlider = document.getElementById('sizeSlider');
        const sizeValue = document.getElementById('sizeValue');

        if (this.config.floatingIcon) {
            opacitySlider.value = this.config.floatingIcon.opacity;
            opacityValue.textContent = `${this.config.floatingIcon.opacity}%`;
            sizeSlider.value = this.config.floatingIcon.size;
            sizeValue.textContent = `${this.config.floatingIcon.size}px`;
        }

        // 更新主题设置
        const themeRadios = document.querySelectorAll('input[name="theme"]');
        themeRadios.forEach(radio => {
            radio.checked = radio.value === this.config.theme;
        });

        // 更新声音设置
        const alertSoundSelect = document.getElementById('alertSound');
        if (alertSoundSelect) {
            alertSoundSelect.value = this.config.alertSound || 'system';
        }

        // 更新通知设置
        const showNotifications = document.getElementById('showNotifications');
        if (showNotifications) {
            showNotifications.checked = this.config.showNotifications !== false;
        }
    }

    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                
                // 移除所有活动状态
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // 激活当前标签
                button.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    initControls() {
        // 透明度滑块
        const opacitySlider = document.getElementById('opacitySlider');
        const opacityValue = document.getElementById('opacityValue');
        
        opacitySlider.addEventListener('input', (e) => {
            const value = e.target.value;
            opacityValue.textContent = `${value}%`;
            this.updateFloatingIconConfig('opacity', parseInt(value));
        });

        // 大小滑块
        const sizeSlider = document.getElementById('sizeSlider');
        const sizeValue = document.getElementById('sizeValue');
        
        sizeSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            sizeValue.textContent = `${value}px`;
            this.updateFloatingIconConfig('size', parseInt(value));
        });

        // 主题单选按钮
        const themeRadios = document.querySelectorAll('input[name="theme"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.updateConfig('theme', e.target.value);
                }
            });
        });

        // 声音选择
        const alertSoundSelect = document.getElementById('alertSound');
        alertSoundSelect.addEventListener('change', (e) => {
            this.updateConfig('alertSound', e.target.value);
        });

        // 通知设置
        const showNotifications = document.getElementById('showNotifications');
        showNotifications.addEventListener('change', (e) => {
            this.updateConfig('showNotifications', e.target.checked);
        });

        // 自动启动
        const autoStart = document.getElementById('autoStart');
        autoStart.addEventListener('change', (e) => {
            this.setAutoStart(e.target.checked);
        });
    }

    bindEvents() {
        // 播放声音按钮
        const playSound = document.getElementById('playSound');
        playSound.addEventListener('click', () => {
            const soundType = document.getElementById('alertSound').value;
            ipcRenderer.invoke('play-alert-sound', soundType);
        });

        // 导出数据
        const exportData = document.getElementById('exportData');
        exportData.addEventListener('click', async () => {
            try {
                const result = await ipcRenderer.invoke('export-data');
                if (result.success) {
                    this.showMessage('数据导出成功！', 'success');
                } else {
                    this.showMessage('导出失败: ' + result.error, 'error');
                }
            } catch (error) {
                this.showMessage('导出失败: ' + error.message, 'error');
            }
        });

        // 导入数据
        const importData = document.getElementById('importData');
        importData.addEventListener('click', async () => {
            if (confirm('导入数据将覆盖现有的所有任务，确定要继续吗？')) {
                try {
                    const result = await ipcRenderer.invoke('import-data');
                    if (result.success) {
                        this.showMessage('数据导入成功！', 'success');
                    } else if (result.cancelled) {
                        // 用户取消了操作
                    } else {
                        this.showMessage('导入失败: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('导入失败: ' + error.message, 'error');
                }
            }
        });

        // 清除所有数据
        const clearAllData = document.getElementById('clearAllData');
        clearAllData.addEventListener('click', async () => {
            if (confirm('这将永久删除所有任务数据，无法恢复。确定要继续吗？')) {
                try {
                    const result = await ipcRenderer.invoke('clear-all-data');
                    if (result.success) {
                        this.showMessage('所有数据已清除', 'success');
                    } else {
                        this.showMessage('清除失败: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('清除失败: ' + error.message, 'error');
                }
            }
        });
    }

    async updateFloatingIconConfig(key, value) {
        try {
            const newConfig = {
                ...this.config.floatingIcon,
                [key]: value
            };
            
            await ipcRenderer.invoke('update-config', 'floatingIcon', newConfig);
            this.config.floatingIcon = newConfig;
        } catch (error) {
            console.error('更新悬浮图标配置失败:', error);
        }
    }

    async updateConfig(key, value) {
        try {
            await ipcRenderer.invoke('update-config', key, value);
            this.config[key] = value;
        } catch (error) {
            console.error('更新配置失败:', error);
        }
    }

    async setAutoStart(enabled) {
        try {
            const result = await ipcRenderer.invoke('set-auto-start', enabled);
            if (!result.success) {
                this.showMessage('设置自动启动失败: ' + result.error, 'error');
                // 恢复复选框状态
                document.getElementById('autoStart').checked = !enabled;
            }
        } catch (error) {
            console.error('设置自动启动失败:', error);
            this.showMessage('设置自动启动失败: ' + error.message, 'error');
            document.getElementById('autoStart').checked = !enabled;
        }
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

// 初始化设置管理器
new SettingsManager();