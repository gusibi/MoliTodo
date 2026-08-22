const { contextBridge, desktopCapturer } = require('electron')

const noop = () => Promise.resolve()

contextBridge.exposeInMainWorld('electronAPI', {
  app: { platform: 'darwin' },
  tasks: { getAll: () => Promise.resolve([]) },
  config: { get: () => Promise.resolve({ floatingIcon: { size: 50 } }) },
  events: { on: noop, removeAllListeners: noop },
  windows: { setFloatingIconIgnoreMouse: noop },
  drag: { getWindowPosition: () => Promise.resolve({ x: 0, y: 0 }) }
})

contextBridge.exposeInMainWorld('debugCapture', {
  getWindowSources: async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 240, height: 240 },
      fetchWindowIcons: false
    })

    return sources.map(source => ({
      name: source.name,
      id: source.id,
      png: source.thumbnail.toPNG().toString('base64')
    }))
  }
})
