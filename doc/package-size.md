# 安装包体积说明

2026-10-27 优化后，macOS arm64 DMG 从 **209 MB 降到 113 MB**（应用解包体积 462 MB → 269 MB），
主要来自去掉重复打包的前端依赖、原始 logo 与构建产物。

## 打包内容

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 主进程与业务代码 | `app.asar` / `src/{main,application,domain,infrastructure,utils}` | 运行时必需 |
| 渲染层构建产物 | `app.asar` / `src/renderer/dist` | Vite 已经打包好的 JS/CSS/音频/图标预览 |
| 生产依赖 | `app.asar` / `node_modules` | 只包含 `dependencies` 及其传递依赖 |
| 运行时资源 | `Contents/Resources/resources` | tray 图标与当前平台的 logo 变体（`extraResources`） |
| Electron 框架 | `Contents/Frameworks` | Electron 28 自带，约 223 MB（未压缩） |

## 不再打包的内容

| 内容 | 原因 |
| --- | --- |
| 渲染层依赖（`vue`、`reka-ui`、`three`、`chart.js`、`@vuepic/vue-datepicker`、`v-calendar`、`@lucide/vue`、`@fullcalendar/*` 等） | 已被 Vite 打进 `renderer/dist`，放在 `dependencies` 会重复一份（原先多出约 145 MB） |
| `resources/**/*` 进 asar | 运行时统一读 `process.resourcesPath/resources`，asar 里那份是重复的（约 30 MB） |
| `resources/logos/*.png` 原始 logo | 设置页只用压缩后的预览图，Dock/任务栏用 `logos/macos`、`logos/windows`；原始图只在仓库里作为生成源（约 13 MB） |
| `resources/icon.png`、`icon.icns`、`icon.ico` | 只在打包时作为安装包图标使用，运行时不读取 |
| 另一平台的 logo 变体 | `mac.extraResources` / `win.extraResources` 只带当前平台目录 |
| `node_modules/**/*.map` | Source map 只用于调试（约 15 MB） |
| `sqlite3` 的 `deps/`、`src/`、`build/Release/obj/` | 运行时只加载 `build/Release/node_sqlite3.node`（约 13 MB） |
| `src/renderer/public/logos` 原图 | 预览图由 `scripts/generate-icon-variants.py` 生成 256px 版本（13 MB → 2.3 MB） |

## 维护规则

1. 给渲染层用的库一律放 `devDependencies`；只有主进程 `require` 的包才放 `dependencies`。
   判断方法：`rg "require\\('包名'" src/main src/application src/domain src/infrastructure src/utils`。
2. 不要往 `build.files` 里加 `resources/**/*`，运行时资源走 `extraResources`。
3. 修改 `resources/logos/*.png` 后执行 `npm run generate:icon-variants`，同时更新平台图标和设置页预览图。
4. `resources/logos/*.png` 是唯一保留的全尺寸原图，只供生成脚本使用；不要直接在页面里引用。

## 可继续压缩的空间

- Electron 框架占解包体积的 80%，升级 Electron 或改用更小的运行时才能明显下降。
- macOS Dock 图标是 1024px PNG，共约 14 MB，属于运行时必需资源。
- 剩余 `node_modules` 约 66 MB（AI SDK、MCP SDK、sqlite3），暂未做更细的裁剪。
