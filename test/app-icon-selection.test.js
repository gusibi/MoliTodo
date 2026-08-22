const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const projectRoot = path.join(__dirname, '..');

function loadFresh(modulePath, mocks) {
  const resolvedPath = require.resolve(modulePath);
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (Object.hasOwn(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[resolvedPath];
  try {
    return require(resolvedPath);
  } finally {
    Module._load = originalLoad;
  }
}

class FakeStore {
  constructor(options = {}) {
    this.store = structuredClone(options.defaults || {});
  }

  get(key, fallback) {
    return this.store[key] ?? fallback;
  }

  set(key, value) {
    this.store[key] = value;
  }
}

test('runtime icon application uses Dock on macOS and windows elsewhere', () => {
  const dockIcons = [];
  const image = { isEmpty: () => false };
  const electron = {
    BrowserWindow: function BrowserWindow() {},
    screen: {},
    nativeImage: { createFromPath: () => image },
    Tray: function Tray() {},
    Menu: {},
    app: { dock: { setIcon: icon => dockIcons.push(icon) } }
  };
  const WindowManager = loadFresh('../src/main/window-manager', {
    electron,
    'electron-store': FakeStore
  });
  const manager = new WindowManager();
  const windowIcons = [];
  manager.floatingWindow = { isDestroyed: () => false, setIcon: icon => windowIcons.push(icon) };

  manager.platform = 'darwin';
  manager.applyAppIcon('/tmp/mac.png');
  assert.deepEqual(dockIcons, [image]);
  assert.equal(windowIcons.length, 0);

  manager.platform = 'win32';
  manager.applyAppIcon('/tmp/windows.png');
  assert.deepEqual(windowIcons, [image]);
});

test('runtime icon paths select the platform-specific variant for every logo', () => {
  const electron = {
    BrowserWindow: function BrowserWindow() {},
    screen: {},
    nativeImage: {},
    Tray: function Tray() {},
    Menu: {},
    app: {}
  };
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';

  try {
    const WindowManager = loadFresh('../src/main/window-manager', {
      electron,
      'electron-store': FakeStore
    });
    const manager = new WindowManager();

    manager.platform = 'darwin';
    assert.match(manager.getAppIconPathForLogo('a1'), /resources\/logos\/macos\/A1\.png$/);
    assert.match(
      manager.resolveRuntimeAppIconPath('/app/resources/logos/B4.png'),
      /resources\/logos\/macos\/B4\.png$/
    );

    manager.platform = 'win32';
    assert.match(manager.getAppIconPathForLogo('b2'), /resources\/logos\/windows\/B2\.ico$/);
    assert.match(
      manager.resolveRuntimeAppIconPath('/app/resources/logos/A3.png'),
      /resources\/logos\/windows\/A3\.ico$/
    );

    manager.platform = 'linux';
    assert.match(manager.getAppIconPathForLogo('b3'), /resources\/logos\/B3\.png$/);
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test('all selectable logos have transparent macOS and multi-size Windows assets', () => {
  const logoNames = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

  for (const logoName of logoNames) {
    const macPath = path.join(projectRoot, 'resources', 'logos', 'macos', `${logoName}.png`);
    const windowsPath = path.join(projectRoot, 'resources', 'logos', 'windows', `${logoName}.ico`);
    const macBuffer = fs.readFileSync(macPath);
    const windowsBuffer = fs.readFileSync(windowsPath);

    assert.deepEqual(macBuffer.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    assert.equal(macBuffer.readUInt8(25), 6, `${logoName} macOS asset must be RGBA PNG`);
    assert.equal(windowsBuffer.readUInt16LE(0), 0, `${logoName} Windows asset must be ICO`);
    assert.equal(windowsBuffer.readUInt16LE(2), 1, `${logoName} Windows asset must be ICO`);
    assert.ok(windowsBuffer.readUInt16LE(4) >= 5, `${logoName} Windows asset needs multiple sizes`);
  }
});

test('window manager reapplies the saved icon during startup', async () => {
  const electron = {
    BrowserWindow: function BrowserWindow() {},
    screen: {},
    nativeImage: {},
    Tray: function Tray() {},
    Menu: {},
    app: {}
  };
  const WindowManager = loadFresh('../src/main/window-manager', {
    electron,
    'electron-store': FakeStore
  });
  const manager = new WindowManager();
  const calls = [];
  manager.applyCurrentAppIcon = () => calls.push('icon');
  manager.createFloatingWindow = () => calls.push('window');
  manager.createTray = () => calls.push('tray');

  const originalSetTimeout = global.setTimeout;
  global.setTimeout = () => 0;
  try {
    await manager.initialize();
    assert.deepEqual(calls.slice(0, 3), ['icon', 'window', 'tray']);
  } finally {
    global.setTimeout = originalSetTimeout;
  }
});

test('update-app-icon delegates to the cross-platform window manager method', () => {
  const ipcHandlers = fs.readFileSync(
    path.join(projectRoot, 'src/main/ipc-handlers.js'),
    'utf8'
  );

  assert.match(ipcHandlers, /this\.windowManager\.resolveRuntimeAppIconPath\(fullIconPath\)/);
  assert.match(ipcHandlers, /this\.windowManager\.applyAppIcon\(runtimeIconPath\)/);
  assert.doesNotMatch(ipcHandlers, /app\.setIcon\(/);
});

test('logo selection checks IPC failure and never restarts Dock or Finder', () => {
  const selector = fs.readFileSync(
    path.join(projectRoot, 'src/renderer/src/components/settings/LogoSelector.vue'),
    'utf8'
  );
  const ipcHandlers = fs.readFileSync(
    path.join(projectRoot, 'src/main/ipc-handlers.js'),
    'utf8'
  );

  assert.match(selector, /iconUpdateResult/);
  assert.match(selector, /iconUpdateResult\?\.success/);
  assert.doesNotMatch(ipcHandlers, /killall Dock|killall Finder|sudo find/);
});
