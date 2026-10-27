/**
 * macOS 更新替换脚本。
 *
 * 由主进程在应用退出前以 `sh 脚本 <target> <staged> <pid> <log>` 方式启动：
 * 等旧进程退出后备份旧 .app、复制新 .app、去掉隔离属性并重新打开。
 * 任何一步失败都会恢复备份并重新打开旧版本，避免用户桌面上没有应用。
 */
module.exports = `#!/bin/sh
target="$1"
staged="$2"
pid="$3"
log="$4"

while kill -0 "$pid" 2>/dev/null; do
  sleep 0.2
done

backup="\${target}.molitodo-backup"
rm -rf "$backup" 2>>"$log"

if ! mv "$target" "$backup" 2>>"$log"; then
  echo "move-old-failed: $target" >>"$log"
  open "$target" >/dev/null 2>&1 || true
  exit 1
fi

if ditto "$staged" "$target" 2>>"$log"; then
  /usr/bin/xattr -dr com.apple.quarantine "$target" >/dev/null 2>&1 || true
  rm -rf "$backup"
  rm -rf "$staged"
  open "$target"
  exit 0
fi

echo "copy-new-failed: $target" >>"$log"
rm -rf "$target"
mv "$backup" "$target" 2>>"$log" || true
open "$target" >/dev/null 2>&1 || true
exit 1
`;
