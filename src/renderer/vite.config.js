import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  root: resolve(__dirname),
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 允许渲染层直接引用 src/domain 下的 CommonJS 纯函数模块
    // （today-agenda 等页面协调规则与主进程共享同一实现，不做镜像复制）
    commonjsOptions: {
      include: [/node_modules/, /src[\\/]domain/, /src[\\/]infrastructure/],
      extensions: ['.js', '.cjs']
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})