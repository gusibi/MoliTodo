#!/bin/bash

# macOS 图标缓存刷新脚本
# 用于解决应用图标更改后启动台和应用程序文件夹图标不更新的问题

echo "正在刷新 macOS 图标缓存..."

# 清除图标服务缓存
echo "清除图标服务缓存..."
sudo rm -rf /Library/Caches/com.apple.iconservices.store
rm -rf ~/Library/Caches/com.apple.iconservices.store

# 清除 Dock 缓存
echo "清除 Dock 缓存..."
sudo find /private/var/folders/ -name com.apple.dock.iconcache -delete 2>/dev/null || true
sudo find /private/var/folders/ -name com.apple.iconservices -delete 2>/dev/null || true

# 重启相关服务
echo "重启 Dock 和 Finder..."
killall Dock
killall Finder

echo "图标缓存刷新完成！"
echo "如果图标仍未更新，请尝试注销并重新登录。"