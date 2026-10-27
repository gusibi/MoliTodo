# 应用内自动更新

> 参考 `molipibot/apps/desktop` 的版本检测与升级体验：检查 → 下载（带进度）→ 重启后直接使用。

## 用户流程

1. 应用启动 15 秒后静默检查一次更新（仅打包版本，开发与 E2E 不访问网络）。
2. 设置 → 关于 展示当前版本、更新状态、更新说明、下载进度与操作按钮。
3. 点「下载并安装」后下载官方安装包并校验 sha512。
4. 点「重启并更新」后应用退出，安装完成后自动重新打开；「发布页面」保留手动下载入口。

有可用更新时，设置侧边栏「关于」会显示一个提示圆点。

## 平台实现

| 平台 | 下载 | 安装 |
| --- | --- | --- |
| macOS | `net.request` 下载 Release 中的 DMG，边下边算 sha512 | 挂载 DMG → `ditto` 复制到临时目录 → 独立 shell 脚本等旧进程退出后替换 `.app` |
| Windows | `electron-updater`（NSIS） | `autoUpdater.quitAndInstall()` |

macOS 目前没有 Developer ID 签名（`CSC_IDENTITY_AUTO_DISCOVERY: false`），Squirrel.Mac 会拒绝未签名应用的更新，
因此没有使用 electron-updater 的 macOS 安装流程，而是按 Tauri/molipibot 的方式替换应用包：

1. 校验安装包 sha512（来自 `latest-mac.yml`）。
2. `hdiutil attach` 挂载，`ditto` 把 `MoliTodo.app` 复制到临时目录，随后卸载。
3. 写入 `src/main/update-install-script.js` 生成的脚本，等待当前进程退出。
4. 把旧 `.app` 移到 `.molitodo-backup`，复制新版本，`xattr -dr com.apple.quarantine`，`open` 新应用。
5. 任一步失败都会恢复备份并重新打开旧版本；安装日志写入临时目录的 `MoliTodo-update-install.log`。

只读位置（例如 macOS 的 App Translocation，从 DMG/下载目录直接运行）无法替换应用，界面会提示先把应用拖到「应用程序」文件夹。
应用会自动重新启动，因此更新完成后无需手动打开。

## 版本检测

- 数据源：`https://api.github.com/repos/gusibi/MoliTodo/releases/latest`。
- 安装包清单：Release 里的 `latest-mac.yml` / `latest.yml`（由 electron-builder 生成，含 url/sha512/size）。
- 版本比较见 `src/main/update-release.js`（`x.y.z`，预发布版本低于同号正式版）。
- 只有正式 Release 才会被 `/releases/latest` 命中，预发布版本不会推送给用户。

## 主进程与渲染层协作

- `src/main/update-service.js`：状态机（`idle → checking → available → downloading → ready → installing`，失败为 `error`），
  通过 `app-update-state` 广播给所有窗口。
- IPC：`app-update-state` / `app-update-check` / `app-update-download` / `app-update-install`。
- preload：`window.electronAPI.updates.{getState,check,download,install,onStateChange}`。
- 渲染层：`AboutSettings.vue` 负责展示状态、进度、更新说明与按钮；`Settings.vue` 负责导航提示点。

## 发布要求

- 通过 tag（`v*`）触发 `.github/workflows/release.yml`，由 electron-builder 生成并上传
  `latest-mac.yml`、`latest.yml`、`*.blockmap`、DMG 与 NSIS 安装包。
- `package.json` 的 `build.publish` 必须指向 `gusibi/MoliTodo`，打包时才会写入 `app-update.yml`（Windows 更新读取它）。
- Release 不能标记为 prerelease，否则 `/releases/latest` 不会返回它。
- DMG 命名保持 electron-builder 默认：`MoliTodo-<version>.dmg`（x64）与 `MoliTodo-<version>-arm64.dmg`，
  客户端按当前架构匹配 `latest-mac.yml` 中的文件。

## 已知限制

- 旧版本（1.5.4 及之前）没有更新模块：用户需要手动安装一次包含本次改动的版本，之后才能走应用内更新。
- 应用仍未签名/公证，首次安装与更新后可能仍需要绕过 Gatekeeper；更新会主动移除隔离属性。
- 只校验 sha512，没有 minisign 类签名；信任链与直接下载 GitHub Release 相同。

## 验证

```bash
npm test                              # 版本比较、清单解析、架构选择
npx playwright test e2e/settings.spec.js   # 关于页更新卡片渲染
```

手动验证建议：打包一个低版本 → 启动 → 关于页应提示新版本 → 下载 → 重启并更新 → 新版本启动且数据保留。
