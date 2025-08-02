# Electron应用中的智能端口检测与环境配置

## 背景

在开发Electron应用时，我们经常遇到一个令人头疼的问题：开发环境中的前端服务器端口冲突。传统的做法是在代码中硬编码端口号（如`http://localhost:5173`），但当端口被占用时，Vite会自动切换到其他端口（如5174、5175等），导致Electron主进程无法正确加载前端页面，出现白屏问题。

本文将介绍如何实现智能端口检测，让Electron应用能够自动适应Vite开发服务器的端口变化。

## 问题分析

### 传统硬编码方式的问题

```javascript
// ❌ 硬编码端口 - 容易出现端口冲突
if (process.env.NODE_ENV === 'development') {
  this.floatingWindow.loadURL('http://localhost:5173');
} else {
  this.floatingWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
}
```

**问题：**
- 端口5173被占用时，Vite自动使用5174，但Electron仍尝试连接5173
- 需要手动修改代码中的端口号
- 开发体验差，容易出错

### 开发环境 vs 生产环境的差异

| 环境 | 加载方式 | 协议 | 是否需要端口 |
|------|----------|------|--------------|
| 开发环境 | HTTP服务器 | `http://` | ✅ 需要 |
| 生产环境 | 本地文件 | `file://` | ❌ 不需要 |

## 解决方案：智能端口检测

### 1. 启动脚本改进

首先改进`dev-start.js`，添加端口检测功能：

```javascript
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

// 检测端口是否被占用
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true); // 端口可用
      });
      server.close();
    });
    server.on('error', () => {
      resolve(false); // 端口被占用
    });
  });
}

// 查找Vite服务器实际使用的端口
async function findVitePort() {
  for (let port = 5173; port <= 5180; port++) {
    const isAvailable = await checkPort(port);
    if (!isAvailable) {
      return port; // 找到被占用的端口（可能是Vite）
    }
  }
  return 5173; // 默认端口
}
```

### 2. 监听Vite输出获取端口

```javascript
// 启动渲染进程并监听输出
const rendererProcess = spawn('npm', ['run', 'dev:renderer'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: true
});

let vitePort = null;

// 解析Vite输出中的端口信息
rendererProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(data);
  
  // 匹配: "Local: http://localhost:5173/"
  const portMatch = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
  if (portMatch) {
    vitePort = parseInt(portMatch[1]);
    console.log(`检测到Vite服务器端口: ${vitePort}`);
  }
});
```

### 3. 通过环境变量传递端口

```javascript
// 启动主进程时传递端口信息
setTimeout(async () => {
  if (!vitePort) {
    vitePort = await findVitePort();
  }
  
  // 设置环境变量
  process.env.VITE_DEV_PORT = vitePort.toString();
  
  const mainProcess = spawn('electron', ['.'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_DEV_PORT: vitePort.toString() }
  });
}, 3000);
```

### 4. 主进程中使用动态端口

在`window-manager.js`中：

```javascript
class WindowManager {
  constructor(app, configStore) {
    this.app = app;
    this.configStore = configStore;
    
    // 获取动态端口
    this.devPort = process.env.VITE_DEV_PORT || '5173';
    this.devBaseUrl = `http://localhost:${this.devPort}`;
  }

  createFloatingWindow() {
    // ... 窗口配置 ...
    
    if (process.env.NODE_ENV === 'development') {
      // ✅ 使用动态端口
      this.floatingWindow.loadURL(this.devBaseUrl);
    } else {
      this.floatingWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
    }
  }
}
```

## 生产环境的处理

### 文件协议 vs HTTP协议

**开发环境：**
```javascript
// 使用HTTP协议，需要端口
this.window.loadURL('http://localhost:5173/#/task-manager');
```

**生产环境：**
```javascript
// 使用文件协议，无需端口
this.window.loadFile(path.join(__dirname, '../renderer/dist/index.html'), {
  hash: 'task-manager'
});
```

### 构建流程

1. **前端构建**：`npm run build:renderer`
   - Vite将Vue应用编译为静态文件
   - 输出到`src/renderer/dist/`目录

2. **应用打包**：`npm run build`
   - electron-builder打包整个应用
   - 包含主进程代码和构建后的前端文件

3. **最终结构**：
   ```
   MoliTodo.app/
   ├── Contents/
   │   ├── MacOS/MoliTodo        # Electron主进程
   │   └── Resources/
   │       ├── app.asar          # 应用代码
   │       │   ├── src/main/     # 主进程
   │       │   └── src/renderer/dist/  # 前端静态文件
   │       └── resources/        # 资源文件
   ```

## 优势总结

### ✅ 开发体验提升
- **自动适应**：无需手动修改端口配置
- **零配置**：开发者无感知的端口处理
- **健壮性**：支持多种端口检测方式

### ✅ 技术优势
- **双重检测**：输出解析 + 端口扫描
- **向后兼容**：检测失败时使用默认端口
- **环境隔离**：开发/生产环境完全分离

### ✅ 维护性
- **统一配置**：所有窗口使用同一个动态端口
- **易于扩展**：可轻松添加更多窗口类型
- **错误处理**：完善的异常处理机制

## 实际效果

实施后的效果：

```bash
$ npm run dev
启动渲染进程开发服务器...
VITE v4.5.14  ready in 169 ms
➜  Local:   http://localhost:5173/
检测到Vite服务器端口: 5173
启动主进程...
SQLite 数据库已初始化
MoliTodo Vue 应用已启动
```

当端口5173被占用时：

```bash
$ npm run dev
启动渲染进程开发服务器...
VITE v4.5.14  ready in 169 ms
➜  Local:   http://localhost:5174/    # 自动切换端口
检测到Vite服务器端口: 5174          # 自动检测新端口
启动主进程...
应用正常启动                         # 无需手动配置
```

## 优化建议：集成到开发流程

为了避免每次遇到段错误都需要手动执行 `npx electron-rebuild`，建议将rebuild集成到开发脚本中：

```json
{
  "scripts": {
    "dev": "npm run rebuild && node dev-start.js",
    "dev:renderer": "vite --config src/renderer/vite.config.js",
    "dev:clean": "npm run rebuild && npm run dev",
    "rebuild": "electron-rebuild",
    "build:renderer": "vite build --config src/renderer/vite.config.js",
    "build": "npm run build:renderer && electron-builder"
  }
}
```

**脚本说明：**
- `npm run dev`：自动rebuild后启动开发环境
- `npm run dev:clean`：强制rebuild的开发启动（双重保险）
- `npm run rebuild`：单独的rebuild命令

这样可以确保每次开发启动时native模块都是最新编译的，避免兼容性问题。

## 总结

通过实现智能端口检测，我们解决了Electron开发中的端口冲突问题，提升了开发体验。这个方案的核心思想是：

1. **动态检测**：实时获取Vite服务器端口
2. **环境变量传递**：在进程间共享端口信息  
3. **统一配置**：所有窗口使用同一套动态配置
4. **环境分离**：开发环境动态端口，生产环境本地文件

这种方案不仅解决了当前问题，还为未来的扩展提供了良好的基础架构。无论是添加新的窗口类型，还是支持更复杂的开发环境配置，都可以在这个基础上轻松实现。