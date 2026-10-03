import { ref, readonly, watch } from 'vue'
import { useTheme } from './useTheme'
import mountains from '@/assets/backgrounds/mountains.svg'
import architecture from '@/assets/backgrounds/architecture.svg'
import waves from '@/assets/backgrounds/waves.svg'

export const backgroundPresets = [
  { id: 'mountains', src: mountains, hue: 185 },
  { id: 'architecture', src: architecture, hue: 20 },
  { id: 'waves', src: waves, hue: 245 }
]
const background = ref(null)
let initialized = false

function applyBackground(value) {
  background.value = value || null
  const root = document.documentElement
  // Only full-size windows receive wallpaper; floating window behavior stays native.
  const supported = /task-manager|settings/.test(window.location.hash)
  const preset = backgroundPresets.find(item => item.id === value?.preset)
  const source = preset?.src || (/^data:image\/jpeg;base64,/.test(value?.image || '') ? value.image : '')
  root.classList.toggle('has-app-background', supported && !!source)
  root.style.setProperty('--app-background-image', source ? `url("${source}")` : 'none')
  for (const token of ['primary', 'primary-foreground', 'ring', 'sidebar-primary', 'sidebar-primary-foreground', 'accent', 'accent-foreground', 'sidebar-accent', 'sidebar-accent-foreground']) {
    root.style.removeProperty(`--${token}`)
  }
  if (supported && source && value?.matchColor && Number.isFinite(value.hue)) {
    const hue = value.hue
    const dark = root.classList.contains('dark')
    root.style.setProperty('--primary', `${hue} 45% ${dark ? 72 : 28}%`)
    root.style.setProperty('--primary-foreground', dark ? '0 0% 12%' : '0 0% 100%')
    root.style.setProperty('--ring', `${hue} 45% ${dark ? 72 : 28}%`)
    root.style.setProperty('--sidebar-primary', `${hue} 45% ${dark ? 72 : 28}%`)
    root.style.setProperty('--sidebar-primary-foreground', dark ? '0 0% 12%' : '0 0% 100%')
    root.style.setProperty('--accent', `${hue} 30% ${dark ? 22 : 90}%`)
    root.style.setProperty('--accent-foreground', `${hue} 45% ${dark ? 85 : 25}%`)
    root.style.setProperty('--sidebar-accent', `${hue} 30% ${dark ? 22 : 90}%`)
    root.style.setProperty('--sidebar-accent-foreground', `${hue} 45% ${dark ? 85 : 25}%`)
  }
}

export function useBackground() {
  async function initializeBackground() {
    if (initialized) return
    initialized = true
    const { isDark } = useTheme()
    watch(isDark, () => applyBackground(background.value))
    const listener = (_event, value) => applyBackground(value)
    window.electronAPI?.events.on('background-updated', listener)
    window.addEventListener('beforeunload', () => window.electronAPI?.events.off('background-updated', listener), { once: true })
    try {
      const config = await window.electronAPI?.config.getAll()
      applyBackground(config?.background)
    } catch (error) {
      console.error('Failed to load background:', error)
    }
  }
  async function setBackground(value) {
    await window.electronAPI.config.set('background', value)
    applyBackground(value)
  }
  return { background: readonly(background), initializeBackground, setBackground }
}

// Decode and resize locally; the persisted image no longer depends on its original file.
export async function prepareBackground(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error('invalid-image')
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1920 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const encoded = canvas.toDataURL('image/jpeg', 0.82)
    const sample = document.createElement('canvas')
    sample.width = sample.height = 32
    const sampleContext = sample.getContext('2d')
    sampleContext.drawImage(canvas, 0, 0, 32, 32)
    const pixels = sampleContext.getImageData(0, 0, 32, 32).data
    const bins = Array.from({ length: 36 }, () => 0)
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]].map(v => v / 255)
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
      if (delta < 0.08 || max < 0.12 || min > 0.9) continue
      let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
      hue = (hue * 60 + 360) % 360
      bins[Math.floor(hue / 10)] += delta
    }
    const hue = bins.some(v => v > 0) ? bins.indexOf(Math.max(...bins)) * 10 + 5 : 215
    return { image: encoded, name: file.name, hue }
  } finally {
    URL.revokeObjectURL(url)
  }
}
