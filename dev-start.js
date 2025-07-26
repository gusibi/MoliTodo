const { spawn } = require('child_process');
const path = require('path');

// 设置开发环境变量
process.env.NODE_ENV = 'development';

// 启动渲染进程开发服务器
console.log('启动渲染进程开发服务器...');
const rendererProcess = spawn('npm', ['run', 'dev:renderer'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// 等待开发服务器启动
setTimeout(() => {
  console.log('启动主进程...');
  
  // 启动主进程
  const mainProcess = spawn('electron', ['.'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  // 处理进程退出
  mainProcess.on('close', (code) => {
    console.log(`主进程退出，代码: ${code}`);
    rendererProcess.kill();
    process.exit(code);
  });

  rendererProcess.on('close', (code) => {
    console.log(`渲染进程退出，代码: ${code}`);
    mainProcess.kill();
    process.exit(code);
  });

}, 3000); // 等待3秒让开发服务器启动