const { app, BrowserWindow, nativeImage } = require('electron')
const path = require('path')

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 120,
    height: 120,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '.tmp-floating-capture-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  window.setOpacity(1)

  window.webContents.on('console-message', (_event, _level, message) => {
    process.stderr.write(`[renderer] ${message}\n`)
  })

  await window.loadURL('http://localhost:5181/')
  await new Promise(resolve => setTimeout(resolve, 1000))

  const dom = await window.webContents.executeJavaScript(`(() => {
    const selectors = ['html', 'body', '#app', '.main-view', '.floating-icon-container', '.floating-icon']
    return Object.fromEntries(selectors.map(selector => {
      const element = document.querySelector(selector)
      if (!element) return [selector, null]
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return [selector, {
        background: style.background,
        backgroundColor: style.backgroundColor,
        opacity: style.opacity,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        className: element.className
      }]
    }))
  })()`)

  window.show()
  await new Promise(resolve => setTimeout(resolve, 500))
  const sources = await window.webContents.executeJavaScript('window.debugCapture.getWindowSources()')
  const sourceDetails = sources.map(source => {
    const image = nativeImage.createFromBuffer(Buffer.from(source.png, 'base64'))
    const bitmap = image.toBitmap()
    const size = image.getSize()
    const offset = (Math.floor(size.height / 2) * size.width + Math.floor(size.width / 2)) * 4
    const corner = (x, y) => Array.from(bitmap.subarray((y * size.width + x) * 4, (y * size.width + x) * 4 + 4))
    return {
      name: source.name,
      size,
      center: Array.from(bitmap.subarray(offset, offset + 4)),
      topLeft: corner(0, 0),
      bottomRight: corner(size.width - 1, size.height - 1)
    }
  })
  const image = await window.capturePage()
  const bitmap = image.toBitmap()
  const size = image.getSize()
  const pixel = (x, y) => {
    const offset = (y * size.width + x) * 4
    return Array.from(bitmap.subarray(offset, offset + 4))
  }

  console.log(JSON.stringify({
    dom,
    sourceDetails,
    size,
    pixels: {
      topLeft: pixel(0, 0),
      topCenter: pixel(Math.floor(size.width / 2), 0),
      center: pixel(Math.floor(size.width / 2), Math.floor(size.height / 2)),
      bottomRight: pixel(size.width - 1, size.height - 1)
    }
  }, null, 2))

  window.destroy()
  app.quit()
})
