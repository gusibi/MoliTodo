# 构建指南

本指南详细说明了如何构建和打包 MoliTodo 应用程序。

## 构建环境要求

### 系统要求

**通用要求**
- Node.js 16.0 或更高版本
- npm 7.0 或更高版本
- Git (用于版本管理)

**macOS 构建要求**
- macOS 10.15 或更高版本
- Xcode Command Line Tools
- 有效的 Apple Developer ID (用于代码签名)

**Windows 构建要求**
- Windows 10 或更高版本
- Visual Studio Build Tools 或 Visual Studio Community
- Windows SDK

**Linux 构建要求**
- Ubuntu 18.04+ / CentOS 7+ 或其他主流发行版
- build-essential 包
- libnss3-dev, libatk-bridge2.0-dev 等依赖

### 开发工具

```bash
# 检查 Node.js 版本
node --version  # 应该 >= 16.0

# 检查 npm 版本
npm --version   # 应该 >= 7.0

# 检查 Git 版本
git --version
```

## 项目准备

### 1. 克隆项目

```bash
# 克隆仓库
git clone https://github.com/your-username/moli-todo.git
cd moli-todo

# 检查当前分支
git branch

# 切换到发布分支 (如果需要)
git checkout release/v0.5.0
```

### 2. 安装依赖

```bash
# 安装所有依赖
npm install

# 验证依赖安装
npm list --depth=0
```

### 3. 环境配置

创建环境配置文件 `.env.production`:

```bash
# .env.production
NODE_ENV=production
VITE_APP_VERSION=0.5.0
VITE_APP_BUILD_TIME=2024-07-26T10:00:00.000Z
```

## 构建命令

### 开发构建

```bash
# 构建渲染进程 (Vue 应用)
npm run build:renderer

# 构建主进程
npm run build:main

# 构建整个应用 (不打包)
npm run build
```

### 生产构建

```bash
# 构建并打包 macOS 版本
npm run build:mac

# 构建并打包 Windows 版本
npm run build:win

# 构建并打包 Linux 版本
npm run build:linux

# 构建所有平台版本
npm run build:all
```

### 平台特定构建

#### macOS 构建

```bash
# 构建 Intel 版本
npm run build:mac:intel

# 构建 Apple Silicon 版本
npm run build:mac:arm

# 构建通用版本 (Intel + Apple Silicon)
npm run build:mac:universal
```

#### Windows 构建

```bash
# 构建 x64 版本
npm run build:win:x64

# 构建 ia32 版本 (32位)
npm run build:win:ia32

# 构建 ARM64 版本
npm run build:win:arm64
```

## 构建配置

### electron-builder 配置

主要配置文件 `package.json` 中的 `build` 部分：

```json
{
  "build": {
    "appId": "com.molitodo.app",
    "productName": "MoliTodo",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist-electron/**/*",
      "dist/**/*",
      "node_modules/**/*"
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icons/icon.icns"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icons/icon.ico"
    },
    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icons/icon.png"
    }
  }
}
```

### Vite 构建配置

渲染进程构建配置 `src/renderer/vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron']
    }
  },
  base: './'
})
```

## 代码签名

### macOS 代码签名

#### 1. 准备证书

```bash
# 查看可用证书
security find-identity -v -p codesigning

# 导入证书 (如果需要)
security import certificate.p12 -k ~/Library/Keychains/login.keychain
```

#### 2. 配置签名

在 `package.json` 中添加签名配置：

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAM_ID)",
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    }
  }
}
```

#### 3. 权限配置

创建 `build/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.debugger</key>
    <true/>
</dict>
</plist>
```

### Windows 代码签名

#### 1. 准备证书

```bash
# 使用 signtool 签名
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com dist/MoliTodo-Setup.exe
```

#### 2. 配置自动签名

在 `package.json` 中配置：

```json
{
  "build": {
    "win": {
      "certificateFile": "certificate.p12",
      "certificatePassword": "password",
      "timeStampServer": "http://timestamp.digicert.com"
    }
  }
}
```

## 构建优化

### 1. 包体积优化

#### 排除不必要的文件

```json
{
  "build": {
    "files": [
      "dist-electron/**/*",
      "dist/**/*",
      "!node_modules/**/{README.md,CHANGELOG.md,*.d.ts}",
      "!node_modules/**/{test,tests,spec,specs}/**/*",
      "!node_modules/**/*.{map,orig}"
    ]
  }
}
```

#### 压缩配置

```javascript
// vite.config.js
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})
```

### 2. 构建性能优化

#### 并行构建

```bash
# 使用并行构建
npm run build:all -- --parallel
```

#### 缓存配置

```json
{
  "build": {
    "buildDependenciesFromSource": false,
    "nodeGypRebuild": false
  }
}
```

## 构建脚本

### 自动化构建脚本

创建 `scripts/build.js`:

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const platforms = process.argv.slice(2)
const supportedPlatforms = ['mac', 'win', 'linux']

if (platforms.length === 0) {
  console.log('Usage: node scripts/build.js <platform1> <platform2> ...')
  console.log('Supported platforms:', supportedPlatforms.join(', '))
  process.exit(1)
}

// 清理构建目录
console.log('🧹 Cleaning build directory...')
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true })
}

// 构建渲染进程
console.log('🔨 Building renderer process...')
execSync('npm run build:renderer', { stdio: 'inherit' })

// 构建各平台版本
for (const platform of platforms) {
  if (!supportedPlatforms.includes(platform)) {
    console.error(`❌ Unsupported platform: ${platform}`)
    continue
  }
  
  console.log(`🚀 Building for ${platform}...`)
  try {
    execSync(`npm run build:${platform}`, { stdio: 'inherit' })
    console.log(`✅ ${platform} build completed`)
  } catch (error) {
    console.error(`❌ ${platform} build failed:`, error.message)
  }
}

console.log('🎉 Build process completed!')
```

### 版本管理脚本

创建 `scripts/version.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/version.js <version>')
  process.exit(1)
}

// 更新 package.json
const packagePath = path.join(__dirname, '../package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
packageJson.version = version
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))

// 更新渲染进程 package.json
const rendererPackagePath = path.join(__dirname, '../src/renderer/package.json')
const rendererPackageJson = JSON.parse(fs.readFileSync(rendererPackagePath, 'utf8'))
rendererPackageJson.version = version
fs.writeFileSync(rendererPackagePath, JSON.stringify(rendererPackageJson, null, 2))

console.log(`✅ Version updated to ${version}`)
```

## 构建产物

### 输出目录结构

```
dist/
├── mac/
│   ├── MoliTodo-0.5.0-x64.dmg
│   ├── MoliTodo-0.5.0-arm64.dmg
│   └── MoliTodo-0.5.0-universal.dmg
├── win/
│   ├── MoliTodo Setup 0.5.0.exe
│   └── MoliTodo-0.5.0-win.zip
├── linux/
│   ├── MoliTodo-0.5.0.AppImage
│   └── MoliTodo-0.5.0.tar.gz
└── latest.yml                    # 自动更新配置
```

### 文件命名规范

- **macOS**: `MoliTodo-{version}-{arch}.dmg`
- **Windows**: `MoliTodo Setup {version}.exe`
- **Linux**: `MoliTodo-{version}.AppImage`

## 质量检查

### 构建验证

```bash
# 验证构建产物
npm run verify:build

# 检查文件完整性
npm run check:integrity

# 运行构建测试
npm run test:build
```

### 自动化测试

创建 `scripts/test-build.js`:

```javascript
const { spawn } = require('child_process')
const path = require('path')

const testBuild = async (platform) => {
  const appPath = getAppPath(platform)
  
  return new Promise((resolve, reject) => {
    const child = spawn(appPath, ['--test-mode'], {
      stdio: 'pipe'
    })
    
    let output = ''
    child.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    child.on('close', (code) => {
      if (code === 0 && output.includes('Test passed')) {
        resolve(true)
      } else {
        reject(new Error(`Test failed for ${platform}`))
      }
    })
    
    // 5秒后超时
    setTimeout(() => {
      child.kill()
      reject(new Error(`Test timeout for ${platform}`))
    }, 5000)
  })
}
```

## 故障排除

### 常见构建问题

#### 1. 依赖问题

```bash
# 清理依赖重新安装
rm -rf node_modules package-lock.json
npm install

# 检查依赖冲突
npm ls
```

#### 2. 权限问题

```bash
# macOS 权限问题
sudo xattr -rd com.apple.quarantine /path/to/app

# 修复文件权限
chmod +x scripts/*.js
```

#### 3. 内存不足

```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

#### 4. 证书问题

```bash
# 检查证书有效性
security find-identity -v -p codesigning

# 重新导入证书
security delete-identity -c "Certificate Name"
security import certificate.p12
```

### 调试构建过程

```bash
# 启用详细日志
DEBUG=electron-builder npm run build:mac

# 保留临时文件
npm run build:mac -- --publish=never --debug
```

## 性能监控

### 构建时间监控

```javascript
// scripts/build-monitor.js
const startTime = Date.now()

process.on('exit', () => {
  const duration = Date.now() - startTime
  console.log(`Build completed in ${duration}ms`)
  
  // 记录到文件
  fs.appendFileSync('build-times.log', 
    `${new Date().toISOString()}: ${duration}ms\n`)
})
```

### 包体积分析

```bash
# 分析包体积
npm run analyze:bundle

# 生成体积报告
npm run build:analyze
```

## 最佳实践

### 1. 构建前检查

- 确保所有测试通过
- 检查代码质量 (ESLint)
- 验证依赖安全性
- 更新版本号

### 2. 构建环境

- 使用干净的构建环境
- 固定 Node.js 版本
- 使用 CI/CD 自动化构建
- 定期更新构建工具

### 3. 质量保证

- 自动化测试构建产物
- 验证应用功能完整性
- 检查性能指标
- 确保跨平台兼容性

---

*遵循本指南可以确保构建出高质量、稳定的 MoliTodo 应用程序。*