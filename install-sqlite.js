#!/usr/bin/env node

/**
 * SQLite 依赖安装脚本
 * 安装 sqlite3 和 sqlite 包
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 开始安装 SQLite 依赖...\n');

try {
  // 检查 package.json 是否存在
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ 未找到 package.json 文件');
    process.exit(1);
  }

  // 读取当前的 package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  console.log('📦 安装 SQLite 相关依赖...');
  
  // 安装 sqlite3 和 sqlite
  const dependencies = ['sqlite3@^5.1.6', 'sqlite@^5.1.1'];
  
  for (const dep of dependencies) {
    console.log(`   安装 ${dep}...`);
    try {
      execSync(`npm install ${dep}`, { stdio: 'inherit' });
      console.log(`   ✅ ${dep} 安装成功`);
    } catch (error) {
      console.error(`   ❌ ${dep} 安装失败:`, error.message);
      throw error;
    }
  }

  // 更新 package.json 中的依赖信息
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  
  packageJson.dependencies['sqlite3'] = '^5.1.6';
  packageJson.dependencies['sqlite'] = '^5.1.1';
  
  // 写回 package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  
  console.log('\n✅ SQLite 依赖安装完成！');
  console.log('\n📋 已安装的依赖:');
  console.log('   - sqlite3@^5.1.6 (SQLite3 Node.js 绑定)');
  console.log('   - sqlite@^5.1.1 (Promise-based SQLite 包装器)');
  
  console.log('\n🚀 现在可以使用 SQLite 数据库功能了！');
  
} catch (error) {
  console.error('\n❌ 安装过程中出现错误:', error.message);
  console.error('\n💡 请尝试手动安装:');
  console.error('   npm install sqlite3@^5.1.6 sqlite@^5.1.1');
  process.exit(1);
}