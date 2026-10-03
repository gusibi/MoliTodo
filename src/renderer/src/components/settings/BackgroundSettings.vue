<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '../ui/button/Button.vue'
import Switch from '../ui/switch/Switch.vue'
import { ImagePlus, Upload, RefreshCw, Trash2 } from '@lucide/vue'
import { backgroundPresets, prepareBackground, useBackground } from '@/composables/useBackground'

const { t } = useI18n()
const { background, setBackground } = useBackground()
const fileInput = ref(null)
const busy = ref(false)
const error = ref('')
const removed = ref(false)
async function save(value) {
  busy.value = true
  error.value = ''
  removed.value = false
  try {
    await setBackground(value)
    removed.value = value === null
  }
  catch { error.value = t('settings.background.saveError') }
  finally { busy.value = false }
}
async function upload(event) {
  removed.value = false
  const file = event.target.files?.[0]
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    const image = await prepareBackground(file)
    await setBackground({ ...image, matchColor: background.value?.matchColor || false })
  } catch { error.value = t('settings.background.uploadError') }
  finally { busy.value = false; event.target.value = '' }
}
</script>

<template>
  <section class="setting-group text-foreground" aria-labelledby="background-title">
    <div class="background-heading">
      <h3 id="background-title" class="setting-group-title">{{ t('settings.background.title') }}</h3>
      <Button variant="outline" size="sm" :disabled="busy || !background" @click="save(null)">
        <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />{{ t('settings.background.remove') }}
      </Button>
    </div>
    <p class="text-sm text-muted-foreground mb-4">{{ t('settings.background.description') }}</p>
    <div class="background-presets">
      <Button v-for="preset in backgroundPresets" :key="preset.id" variant="outline"
        class="background-preset" :disabled="busy" :aria-pressed="background?.preset === preset.id"
        @click="save({ preset: preset.id, hue: preset.hue, matchColor: background?.matchColor || false })">
        <img :src="preset.src" alt="" />
        <span>{{ t(`settings.background.${preset.id}`) }}</span>
      </Button>
    </div>
    <div class="background-upload-area">
      <input ref="fileInput" id="background-upload" type="file" accept="image/jpeg,image/png,image/webp"
        class="hidden" tabindex="-1" :disabled="busy" @change="upload" />
      <div class="background-upload-row">
        <div class="background-upload-preview" aria-hidden="true">
          <img v-if="background?.image" :src="background.image" alt="" />
          <ImagePlus v-else class="h-6 w-6 text-muted-foreground" />
        </div>
        <div class="background-upload-copy">
          <h4 class="text-sm font-medium">{{ t('settings.background.upload') }}</h4>
          <p v-if="background?.name" class="background-filename" :title="background.name">{{ background.name }}</p>
          <p v-else class="text-xs text-muted-foreground mt-1">{{ t('settings.background.uploadPrompt') }}</p>
        </div>
        <Button variant="outline" :disabled="busy" @click="fileInput?.click()">
          <component :is="background?.image ? RefreshCw : Upload" class="h-4 w-4" aria-hidden="true" />
          {{ t(background?.image ? 'settings.background.replace' : 'settings.background.choose') }}
        </Button>
      </div>
      <p class="background-upload-hint">{{ t('settings.background.uploadHint') }}</p>
    </div>
    <div class="background-color-row">
      <div class="background-upload-copy">
        <label for="background-color" class="text-sm font-medium">{{ t('settings.background.matchColor') }}</label>
        <p class="text-xs text-muted-foreground mt-1 leading-relaxed">{{ t('settings.background.colorHint') }}</p>
      </div>
      <Switch id="background-color" :model-value="!!background?.matchColor" :disabled="busy || !background"
        @update:model-value="save({ ...background, matchColor: $event })" />
    </div>
    <p v-if="removed" role="status" class="text-xs text-muted-foreground mt-2">{{ t('settings.background.removed') }}</p>
    <p v-if="busy" role="status" class="text-sm mt-2">{{ t('settings.background.saving') }}</p>
    <p v-if="error" role="alert" class="text-sm text-destructive mt-2">{{ error }}</p>
  </section>
</template>

<style scoped>
.background-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.background-preset { height: auto; padding: 6px; flex-direction: column; overflow: hidden; white-space: normal; }
.background-preset img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 4px; }
.background-preset[aria-pressed="true"] { border-color: hsl(var(--primary)); box-shadow: 0 0 0 1px hsl(var(--primary)); }
.background-upload-area { margin-top: 20px; padding: 16px; border: 1px solid hsl(var(--border) / 0.6); border-radius: 12px; background: hsl(var(--background) / 0.35); }
.background-upload-row { display: flex; align-items: center; gap: 14px; }
.background-upload-preview { display: flex; align-items: center; justify-content: center; width: 60px; height: 60px; flex-shrink: 0; border: 1px solid hsl(var(--border) / 0.5); border-radius: 8px; background: hsl(var(--muted) / 0.6); overflow: hidden; }
.background-upload-preview img { width: 100%; height: 100%; object-fit: cover; }
.background-upload-copy { min-width: 0; flex: 1; }
.background-filename { margin-top: 4px; font-size: 12px; color: hsl(var(--muted-foreground)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.background-upload-hint { margin-top: 12px; font-size: 11px; line-height: 1.6; color: hsl(var(--muted-foreground)); }
.background-color-row { display: flex; align-items: center; gap: 24px; padding: 18px 0 12px; }
.background-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.background-heading .setting-group-title { margin: 0; }
@media (max-width: 640px) { .background-presets { grid-template-columns: 1fr; } .background-upload-row { flex-wrap: wrap; } .background-upload-row > button { margin-left: 74px; } }
</style>
