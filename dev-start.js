const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

// 设置开发环境变量
process.env.NODE_ENV = 'development';

// 检测可用端口的函数
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
  // Vite默认端口是5173，如果被占用会自动递增
  for (let port = 5173; port <= 5180; port++) {
    const isAvailable = await checkPort(port);
    if (!isAvailable) {
      // 端口被占用，可能是Vite服务器
      return port;
    }
  }
  return 5173; // 默认返回5173
}

// 启动渲染进程开发服务器
console.log('启动渲染进程开发服务器...');
const rendererProcess = spawn('npm', ['run', 'dev:renderer'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: true
});

let vitePort = null;

// 监听渲染进程输出以获取实际端口
rendererProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(data); // 继续显示输出
  
  // 匹配Vite输出中的端口信息
  const portMatch = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
  if (portMatch) {
    vitePort = parseInt(portMatch[1]);
    console.log(`检测到Vite服务器端口: ${vitePort}`);
  }
});

// 等待开发服务器启动
setTimeout(async () => {
  // 如果没有从输出中检测到端口，尝试自动检测
  if (!vitePort) {
    console.log('正在检测Vite服务器端口...');
    vitePort = await findVitePort();
    console.log(`使用端口: ${vitePort}`);
  }
  
  // 设置环境变量传递给主进程
  process.env.VITE_DEV_PORT = vitePort.toString();
  
  console.log('启动主进程...');
  
  // 启动主进程
  const mainProcess = spawn('electron', ['.'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_DEV_PORT: vitePort.toString() }
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