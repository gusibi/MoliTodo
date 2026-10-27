/**
 * 应用内更新服务（主进程）。
 *
 * - macOS：应用未做代码签名，Squirrel.Mac 无法校验签名，因此自己下载官方 DMG，
 *   在应用退出后由独立脚本替换 .app 并重新启动，实现“下载 → 重启即可用”。
 * - Windows：使用 electron-updater 的 NSIS 更新流程。
 *
 * 状态通过 app-update-state 广播给所有窗口，渲染层只负责展示和触发动作。
 */

const { app, net } = require('electron');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const {
  RELEASE_API_URL,
  RELEASE_PAGE_URL,
  normalizeVersion,
  compareVersions,
  parseUpdateFiles,
  selectMacAsset,
  buildDownloadUrl
} = require('./update-release');
const MAC_INSTALL_SCRIPT = require('./update-install-script');

const UPDATE_STATE_CHANNEL = 'app-update-state';
const DOWNLOAD_DIR_NAME = 'MoliTodo-updates';
const INSTALL_LOG_NAME = 'MoliTodo-update-install.log';
const REQUEST_TIMEOUT = 30 * 1000;

function errorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error || '未知错误');
}

function execFileAsync(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.message = stderr ? `${error.message}\n${stderr.trim()}` : error.message;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

class UpdateService {
  constructor({ broadcast = () => {}, quitApp = () => app.quit() } = {}) {
    this.broadcast = broadcast;
    this.quitApp = quitApp;

    this.checking = false;
    this.downloading = false;
    this.installing = false;

    // macOS 上待下载/已下载的安装包信息
    this.pendingRelease = null;
    this.downloadedFile = null;
    this.windowsUpdater = null;

    this.state = {
      status: 'idle',
      currentVersion: app.getVersion(),
      newVersion: null,
      releaseNotes: '',
      releaseDate: '',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: null,
      manual: false,
      lastChecked: null,
      platform: process.platform,
      arch: process.arch,
      canAutoInstall: app.isPackaged && (process.platform === 'darwin' || process.platform === 'win32'),
      isTranslocated: this.detectTranslocation(),
      releaseUrl: RELEASE_PAGE_URL
    };
  }

  getState() {
    return { ...this.state };
  }

  emitState() {
    try {
      this.broadcast(UPDATE_STATE_CHANNEL, this.getState());
    } catch (error) {
      console.warn('广播更新状态失败:', error);
    }
  }

  update(patch) {
    Object.assign(this.state, patch);
    this.emitState();
  }

  async check({ manual = false } = {}) {
    if (this.checking || this.downloading || this.installing) {
      if (manual) this.emitState();
      return this.getState();
    }

    this.checking = true;
    this.update({
      status: 'checking',
      error: null,
      manual,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      isTranslocated: this.detectTranslocation()
    });

    try {
      let result;
      if (process.platform === 'darwin') {
        result = await this.checkMacRelease();
      } else if (process.platform === 'win32') {
        result = await this.checkWindowsRelease();
      } else {
        throw new Error('当前平台暂不支持自动更新');
      }
      this.applyCheckResult(result);
    } catch (error) {
      console.error('检查更新失败:', error);
      this.update({ status: 'error', error: errorMessage(error) });
    } finally {
      this.checking = false;
    }

    return this.getState();
  }

  applyCheckResult({ version, notes = '', date = '', asset = null }) {
    const hasUpdate = compareVersions(version, this.state.currentVersion) > 0;
    this.update({ lastChecked: Date.now(), releaseNotes: notes || '', releaseDate: date || '' });

    if (!hasUpdate) {
      this.pendingRelease = null;
      this.downloadedFile = null;
      this.update({ status: 'up-to-date', newVersion: null, progress: 0, downloadedBytes: 0, totalBytes: 0 });
      return;
    }

    this.pendingRelease = asset ? { ...asset, version } : null;
    this.update({
      status: 'available',
      newVersion: version,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: (asset && asset.size) || 0
    });
  }

  async checkMacRelease() {
    const release = await this.fetchRelease();
    const version = normalizeVersion(release.tag_name);
    const notes = release.body || '';
    const date = release.published_at || '';

    if (compareVersions(version, this.state.currentVersion) <= 0) {
      return { version, notes, date };
    }

    const asset = await this.resolveMacAsset(release, version);
    return { version, notes, date, asset };
  }

  async resolveMacAsset(release, version) {
    const assets = Array.isArray(release.assets) ? release.assets : [];

    // 优先使用 electron-builder 生成的 latest-mac.yml，可拿到 sha512 校验值。
    const ymlAsset = assets.find((item) => item.name === 'latest-mac.yml');
    if (ymlAsset && ymlAsset.browser_download_url) {
      try {
        const yamlText = await this.fetchText(ymlAsset.browser_download_url);
        const selected = selectMacAsset(parseUpdateFiles(yamlText), process.arch);
        if (selected) {
          return {
            fileName: selected.url,
            size: selected.size || 0,
            sha512: selected.sha512 || '',
            url: buildDownloadUrl(version, selected.url)
          };
        }
      } catch (error) {
        console.warn('读取 latest-mac.yml 失败，回退到 GitHub Release 资源列表:', error);
      }
    }

    const dmgs = assets.filter((item) => /\.dmg$/i.test(item.name || ''));
    if (dmgs.length === 0) throw new Error('未找到适用于当前设备的安装包');

    const expectsArm64 = process.arch === 'arm64';
    const asset = dmgs.find((item) => /arm64/i.test(item.name) === expectsArm64) || dmgs[0];
    return {
      fileName: asset.name,
      size: asset.size || 0,
      sha512: '',
      url: asset.browser_download_url
    };
  }

  async checkWindowsRelease() {
    const autoUpdater = this.getWindowsUpdater();
    const result = await autoUpdater.checkForUpdates();
    const info = result && result.updateInfo;
    if (!info) return { version: this.state.currentVersion };

    let notes = '';
    if (typeof info.releaseNotes === 'string') {
      notes = info.releaseNotes;
    } else if (Array.isArray(info.releaseNotes)) {
      notes = info.releaseNotes
        .map((item) => `${item.version ? `v${item.version}\n` : ''}${item.note || ''}`)
        .join('\n\n');
    }

    return {
      version: normalizeVersion(info.version),
      notes,
      date: info.releaseDate || ''
    };
  }

  async download() {
    if (this.downloading || this.installing) return this.getState();
    if (!this.state.newVersion) return this.getState();

    this.downloading = true;
    this.update({
      status: 'downloading',
      error: null,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: (this.pendingRelease && this.pendingRelease.size) || this.state.totalBytes || 0
    });

    try {
      if (process.platform === 'win32') {
        await this.getWindowsUpdater().downloadUpdate();
        this.downloadedFile = null;
      } else if (process.platform === 'darwin') {
        if (!this.pendingRelease) throw new Error('缺少安装包信息，请重新检查更新');
        this.downloadedFile = await this.downloadMacAsset(this.pendingRelease);
      } else {
        throw new Error('当前平台暂不支持自动更新');
      }
      this.update({ status: 'ready', progress: 100 });
    } catch (error) {
      console.error('下载更新失败:', error);
      this.downloadedFile = null;
      this.update({ status: 'error', error: errorMessage(error) });
    } finally {
      this.downloading = false;
    }

    return this.getState();
  }

  async install() {
    if (this.installing) return this.getState();

    if (process.platform === 'win32') {
      this.installing = true;
      this.update({ status: 'installing', error: null });
      setTimeout(() => {
        try {
          this.getWindowsUpdater().quitAndInstall(false, true);
        } catch (error) {
          this.installing = false;
          this.update({ status: 'error', error: errorMessage(error) });
        }
      }, 200);
      return this.getState();
    }

    if (process.platform !== 'darwin') {
      this.update({ status: 'error', error: '当前平台暂不支持自动更新' });
      return this.getState();
    }

    if (!this.downloadedFile) {
      this.update({ status: 'error', error: '更新包尚未下载完成，请重新下载' });
      return this.getState();
    }

    this.installing = true;
    this.update({ status: 'installing', error: null });

    try {
      if (!this.state.canAutoInstall) {
        throw new Error('开发模式下不支持自动安装更新');
      }
      if (this.detectTranslocation()) {
        throw new Error('应用正从只读位置运行，请先将 MoliTodo 移动到「应用程序」文件夹后再更新');
      }

      const appPath = this.currentAppBundlePath();
      if (!appPath) throw new Error('无法定位当前应用，请手动下载安装');
      await this.assertWritable(path.dirname(appPath));

      const stagedApp = await this.stageMacApp(this.downloadedFile);
      const logPath = path.join(app.getPath('temp'), INSTALL_LOG_NAME);
      const scriptPath = path.join(path.dirname(stagedApp), 'apply-update.sh');
      await fsp.writeFile(scriptPath, MAC_INSTALL_SCRIPT, { mode: 0o755 });

      const child = spawn(
        '/bin/sh',
        [scriptPath, appPath, stagedApp, String(process.pid), logPath],
        { detached: true, stdio: 'ignore' }
      );
      child.unref();

      await fsp.rm(this.downloadedFile, { force: true }).catch(() => {});
      this.downloadedFile = null;

      // 留出时间让渲染层收到“正在重启”状态
      setTimeout(() => this.quitApp(), 400);
    } catch (error) {
      console.error('安装更新失败:', error);
      this.installing = false;
      this.update({ status: 'error', error: errorMessage(error) });
    }

    return this.getState();
  }

  getWindowsUpdater() {
    if (this.windowsUpdater) return this.windowsUpdater;

    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = {
      info: (...args) => console.log('[autoUpdater]', ...args),
      warn: (...args) => console.warn('[autoUpdater]', ...args),
      error: (...args) => console.error('[autoUpdater]', ...args),
      debug: () => {}
    };
    autoUpdater.on('download-progress', (progress) => {
      this.update({
        progress: Math.round(progress.percent || 0),
        downloadedBytes: Math.round(progress.transferred || 0),
        totalBytes: Math.round(progress.total || 0)
      });
    });
    // electron-updater 以事件方式上报错误；没有监听器时 EventEmitter 会抛出未捕获异常
    autoUpdater.on('error', (error) => {
      if (this.state.status === 'downloading' || this.state.status === 'installing') {
        this.installing = false;
        this.update({ status: 'error', error: errorMessage(error) });
      }
    });

    this.windowsUpdater = autoUpdater;
    return autoUpdater;
  }

  async downloadMacAsset(asset) {
    const directory = path.join(app.getPath('temp'), DOWNLOAD_DIR_NAME);
    await fsp.mkdir(directory, { recursive: true });

    const safeName = (asset.fileName || 'MoliTodo.dmg').replace(/[^\w.@-]/g, '_');
    const target = path.join(directory, safeName);
    const part = `${target}.part`;

    await fsp.rm(part, { force: true });
    await fsp.rm(target, { force: true });

    const hash = crypto.createHash('sha512');
    let downloadedBytes = 0;
    let lastEmit = 0;

    await new Promise((resolve, reject) => {
      const request = net.request({ method: 'GET', url: asset.url, redirect: 'follow' });
      request.setHeader('User-Agent', `MoliTodo/${this.state.currentVersion}`);

      let settled = false;
      // 大文件下载可能持续数分钟，这里用“无数据超时”而不是总时长超时
      let idleTimer = null;
      const armIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          request.abort();
          fail(new Error('下载超时，请检查网络后重试'));
        }, REQUEST_TIMEOUT);
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(idleTimer);
        reject(error);
      };

      armIdleTimer();
      request.on('error', fail);
      request.on('response', (response) => {
        if (response.statusCode >= 400) {
          response.on('data', () => {});
          fail(new Error(`下载失败（HTTP ${response.statusCode}）`));
          return;
        }

        const totalBytes = Number(response.headers['content-length']) || asset.size || 0;
        this.update({ totalBytes });

        const stream = fs.createWriteStream(part);

        const failStream = (error) => {
          if (settled) return;
          clearTimeout(idleTimer);
          stream.destroy();
          fail(error);
        };

        response.on('data', (chunk) => {
          if (settled) return;
          armIdleTimer();
          downloadedBytes += chunk.length;
          hash.update(chunk);

          if (!stream.write(chunk)) {
            response.pause();
            stream.once('drain', () => response.resume());
          }

          const now = Date.now();
          if (now - lastEmit > 200) {
            lastEmit = now;
            this.update({
              downloadedBytes,
              progress: totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0
            });
          }
        });
        response.on('end', () => stream.end());
        response.on('error', failStream);
        stream.on('error', failStream);
        stream.on('finish', () => {
          if (settled) return;
          settled = true;
          clearTimeout(idleTimer);
          resolve();
        });
      });

      request.end();
    });

    const digest = hash.digest('base64');
    if (asset.sha512 && digest !== asset.sha512) {
      await fsp.rm(part, { force: true }).catch(() => {});
      throw new Error('安装包校验失败，请重试');
    }

    await fsp.rename(part, target);
    this.update({ progress: 100, downloadedBytes, totalBytes: downloadedBytes });
    return target;
  }

  async fetchRelease() {
    const text = await this.fetchText(RELEASE_API_URL);
    let release;
    try {
      release = JSON.parse(text);
    } catch {
      throw new Error('更新信息解析失败，请稍后重试');
    }
    if (!release || !release.tag_name) {
      throw new Error('未找到可用的版本信息');
    }
    return release;
  }

  fetchText(url) {
    return new Promise((resolve, reject) => {
      const request = net.request({ method: 'GET', url, redirect: 'follow' });
      request.setHeader('User-Agent', `MoliTodo/${this.state.currentVersion}`);
      request.setHeader('Accept', 'application/vnd.github+json');

      const chunks = [];
      const timer = setTimeout(() => {
        request.abort();
        reject(new Error('请求超时，请检查网络后重试'));
      }, REQUEST_TIMEOUT);

      request.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      request.on('response', (response) => {
        if (response.statusCode >= 400) {
          response.on('data', () => {});
          response.on('end', () => {
            clearTimeout(timer);
            reject(new Error(`请求失败（HTTP ${response.statusCode}）`));
          });
          return;
        }
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          clearTimeout(timer);
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
        response.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      request.end();
    });
  }

  detectTranslocation() {
    if (process.platform !== 'darwin') return false;
    return process.execPath.includes('AppTranslocation');
  }

  currentAppBundlePath() {
    if (process.platform !== 'darwin') return null;
    const candidate = path.resolve(process.execPath, '../../..');
    return path.basename(candidate).endsWith('.app') ? candidate : null;
  }

  async assertWritable(directory) {
    try {
      await fsp.access(directory, fs.constants.W_OK);
    } catch {
      throw new Error(`没有写入权限：${directory}。请将 MoliTodo 移动到「应用程序」文件夹后重试`);
    }
  }

  async stageMacApp(dmgPath) {
    const stageRoot = path.join(app.getPath('temp'), `MoliTodo-update-${Date.now()}`);
    const mountPoint = path.join(stageRoot, 'mnt');
    await fsp.mkdir(mountPoint, { recursive: true });

    await execFileAsync('hdiutil', [
      'attach',
      '-nobrowse',
      '-readonly',
      '-noverify',
      '-mountpoint',
      mountPoint,
      dmgPath
    ]);

    try {
      const entries = await fsp.readdir(mountPoint);
      const appName = entries.find((name) => name.endsWith('.app'));
      if (!appName) throw new Error('安装包中未找到应用');

      const stagedApp = path.join(stageRoot, appName);
      await execFileAsync('ditto', [path.join(mountPoint, appName), stagedApp]);
      return stagedApp;
    } finally {
      await execFileAsync('hdiutil', ['detach', mountPoint, '-force']).catch(() => {});
    }
  }
}

module.exports = UpdateService;
module.exports.UPDATE_STATE_CHANNEL = UPDATE_STATE_CHANNEL;
