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

        // 更新数据库设置
        const dbTypeSelect = document.getElementById('dbType');
        const dbPath = document.getElementById('dbPath');
        
        if (this.config.database) {
            if (dbTypeSelect) {
                dbTypeSelect.value = this.config.database.type || 'sqlite';
            }
            
            if (dbPath) {
                dbPath.value = this.config.database.path || '';
                dbPath.placeholder = this.config.database.path ? '' : '使用默认位置';
            }
        }

        // 更新主题设置
        const appThemeSelect = document.getElementById('appTheme');
        if (appThemeSelect) {
            appThemeSelect.value = this.config.theme || 'system';
        }

        const iconStyleSelect = document.getElementById('iconStyle');
        if (iconStyleSelect) {
            iconStyleSelect.value = this.config.iconStyle || 'default';
        }

        // 更新声音设置
        const soundTypeSelect = document.getElementById('soundType');
        if (soundTypeSelect) {
            soundTypeSelect.value = this.config.alertSound || 'default';
        }

        const soundVolumeSlider = document.getElementById('soundVolume');
        const volumeValue = document.getElementById('volumeValue');
        if (soundVolumeSlider && this.config.soundVolume !== undefined) {
            soundVolumeSlider.value = this.config.soundVolume;
            if (volumeValue) {
                volumeValue.textContent = `${this.config.soundVolume}%`;
            }
        }

        // 更新通知设置
        const systemNotifications = document.getElementById('systemNotifications');
        if (systemNotifications) {
            systemNotifications.checked = this.config.showNotifications !== false;
        }

        const iconAnimation = document.getElementById('iconAnimation');
        if (iconAnimation) {
            iconAnimation.checked = this.config.iconAnimation !== false;
        }

        const alertSound = document.getElementById('alertSound');
        if (alertSound) {
            alertSound.checked = this.config.alertSoundEnabled !== false;
        }

        // 更新启动设置
        const showIconOnStart = document.getElementById('showIconOnStart');
        if (showIconOnStart) {
            showIconOnStart.checked = this.config.showIconOnStart !== false;
        }

        // 加载数据库统计信息
        this.loadDatabaseStats();
        
        // 初始化图标预览
        this.updateIconPreview();
    }

    initTabs() {
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        const tabContents = document.querySelectorAll('.tab-content');

        sidebarItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                
                // 移除所有活动状态
                sidebarItems.forEach(sidebarItem => sidebarItem.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // 激活当前标签
                item.classList.add('active');
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

        // 主题选择
        const appThemeSelect = document.getElementById('appTheme');
        if (appThemeSelect) {
            appThemeSelect.addEventListener('change', (e) => {
                this.updateConfig('theme', e.target.value);
            });
        }

        const iconStyleSelect = document.getElementById('iconStyle');
        if (iconStyleSelect) {
            iconStyleSelect.addEventListener('change', (e) => {
                this.updateConfig('iconStyle', e.target.value);
                this.updateIconPreview();
            });
        }

        // 声音设置
        const soundTypeSelect = document.getElementById('soundType');
        if (soundTypeSelect) {
            soundTypeSelect.addEventListener('change', (e) => {
                this.updateConfig('alertSound', e.target.value);
            });
        }

        const soundVolumeSlider = document.getElementById('soundVolume');
        const volumeValue = document.getElementById('volumeValue');
        if (soundVolumeSlider) {
            soundVolumeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                if (volumeValue) {
                    volumeValue.textContent = `${value}%`;
                }
                this.updateConfig('soundVolume', parseInt(value));
            });
        }

        // 通知设置
        const systemNotifications = document.getElementById('systemNotifications');
        if (systemNotifications) {
            systemNotifications.addEventListener('change', (e) => {
                this.updateConfig('showNotifications', e.target.checked);
            });
        }

        const iconAnimation = document.getElementById('iconAnimation');
        if (iconAnimation) {
            iconAnimation.addEventListener('change', (e) => {
                this.updateConfig('iconAnimation', e.target.checked);
            });
        }

        const alertSound = document.getElementById('alertSound');
        if (alertSound) {
            alertSound.addEventListener('change', (e) => {
                this.updateConfig('alertSoundEnabled', e.target.checked);
            });
        }

        // 启动设置
        const showIconOnStart = document.getElementById('showIconOnStart');
        if (showIconOnStart) {
            showIconOnStart.addEventListener('change', (e) => {
                this.updateConfig('showIconOnStart', e.target.checked);
            });
        }

        // 自动启动
        const autoStart = document.getElementById('autoStart');
        autoStart.addEventListener('change', (e) => {
            this.setAutoStart(e.target.checked);
        });

        // 数据库类型选择
        const dbTypeSelect = document.getElementById('dbType');
        if (dbTypeSelect) {
            dbTypeSelect.addEventListener('change', (e) => {
                this.changeDatabaseType(e.target.value);
            });
        }

        // 选择数据库路径
        const choosePath = document.getElementById('choosePath');
        choosePath.addEventListener('click', () => {
            this.chooseDatabasePath();
        });

        // 重置数据库路径
        const resetPath = document.getElementById('resetPath');
        resetPath.addEventListener('click', () => {
            this.resetDatabasePath();
        });
    }

    bindEvents() {
        // 播放声音按钮
        const playSound = document.getElementById('playSound');
        if (playSound) {
            playSound.addEventListener('click', () => {
                const soundType = document.getElementById('soundType').value;
                ipcRenderer.invoke('play-alert-sound', soundType);
            });
        }

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
            
            // 更新预览
            this.updateIconPreview();
        } catch (error) {
            console.error('更新悬浮图标配置失败:', error);
        }
    }

    updateIconPreview() {
        const preview = document.getElementById('iconPreview');
        if (preview && this.config.floatingIcon) {
            const { size, opacity } = this.config.floatingIcon;
            preview.style.width = `${size || 60}px`;
            preview.style.height = `${size || 60}px`;
            preview.style.opacity = `${(opacity || 90) / 100}`;
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

    async loadDatabaseStats() {
        try {
            const stats = await ipcRenderer.invoke('get-database-stats');
            const dbStatsEl = document.getElementById('dbStats');
            
            if (stats.error) {
                dbStatsEl.textContent = '无法获取数据库统计信息';
                dbStatsEl.className = 'setting-description';
            } else {
                const statusCounts = stats.statusCounts || {};
                const statsText = `总任务: ${stats.total || 0} | 待办: ${statusCounts.todo || 0} | 进行中: ${statusCounts.doing || 0} | 已完成: ${statusCounts.done || 0}${stats.withReminder ? ` | 有提醒: ${stats.withReminder}` : ''}${stats.dbPath ? ` | 位置: ${stats.dbPath}` : ''}`;
                
                dbStatsEl.textContent = statsText;
                dbStatsEl.className = 'setting-description stats';
            }
        } catch (error) {
            console.error('加载数据库统计失败:', error);
            const dbStatsEl = document.getElementById('dbStats');
            dbStatsEl.textContent = '数据库统计信息加载失败';
            dbStatsEl.className = 'setting-description';
        }
    }

    async changeDatabaseType(newType) {
        const currentType = this.config.database?.type || 'sqlite';
        
        if (newType === currentType) {
            return;
        }

        if (confirm(`切换数据库类型将迁移现有数据。确定要从 ${currentType === 'sqlite' ? 'SQLite' : '文件存储'} 切换到 ${newType === 'sqlite' ? 'SQLite' : '文件存储'} 吗？`)) {
            try {
                const result = await ipcRenderer.invoke('migrate-database', currentType, newType);
                
                if (result.success) {
                    this.showMessage(`数据库迁移成功！已迁移 ${result.taskCount} 个任务`, 'success');
                    await this.loadConfig(); // 重新加载配置
                } else {
                    this.showMessage('数据库迁移失败: ' + result.error, 'error');
                    // 恢复原来的选择
                    const dbTypeSelect = document.getElementById('dbType');
                    if (dbTypeSelect) {
                        dbTypeSelect.value = currentType;
                    }
                }
            } catch (error) {
                this.showMessage('数据库迁移失败: ' + error.message, 'error');
                const dbTypeSelect = document.getElementById('dbType');
                if (dbTypeSelect) {
                    dbTypeSelect.value = currentType;
                }
            }
        } else {
            // 用户取消，恢复原来的选择
            const dbTypeSelect = document.getElementById('dbType');
            if (dbTypeSelect) {
                dbTypeSelect.value = currentType;
            }
        }
    }

    async chooseDatabasePath() {
        try {
            const result = await ipcRenderer.invoke('set-database-path');
            
            if (result.success) {
                this.showMessage('数据库路径设置成功', 'success');
                await this.loadConfig(); // 重新加载配置
            } else if (result.canceled) {
                // 用户取消了操作
            } else {
                this.showMessage('设置数据库路径失败: ' + result.error, 'error');
            }
        } catch (error) {
            this.showMessage('设置数据库路径失败: ' + error.message, 'error');
        }
    }

    async resetDatabasePath() {
        if (confirm('重置为默认数据库路径？这将创建一个新的数据库文件。')) {
            try {
                await this.updateConfig('database.path', null);
                this.showMessage('数据库路径已重置为默认', 'success');
                await this.loadConfig(); // 重新加载配置
            } catch (error) {
                this.showMessage('重置数据库路径失败: ' + error.message, 'error');
            }
        }
    }

    showMessage(message, type = 'info') {
        // 使用现有的消息容器
        const messageContainer = document.querySelector('.message-container');
        if (!messageContainer) {
            console.warn('Message container not found');
            return;
        }

        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = type === 'success' ? 'success-message' : 'error-message';
        messageEl.textContent = message;
        
        // 添加到容器
        messageContainer.appendChild(messageEl);
        
        // 显示消息
        setTimeout(() => {
            messageEl.classList.add('show');
        }, 10);

        // 3秒后自动移除
        setTimeout(() => {
            messageEl.classList.remove('show');
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