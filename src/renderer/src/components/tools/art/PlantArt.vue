<template>
  <svg
    class="plant-art"
    viewBox="0 0 160 160"
    role="img"
    :aria-label="stage"
    xml:space="preserve"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <g id="plant-leaf-block">
        <polygon points="20,0 40,8 20,16 0,8" fill="#86ce63" />
        <polygon points="0,8 20,16 20,40 0,32" fill="#5fa84a" />
        <polygon points="20,16 40,8 40,32 20,40" fill="#407d35" />
      </g>
    </defs>

    <!-- 泥土方块 -->
    <polygon points="80,132 126,120 80,108 34,120" fill="#98653f" />
    <polygon points="34,120 80,132 80,142 34,130" fill="#7a4c2f" />
    <polygon points="80,132 126,120 126,130 80,142" fill="#654027" />
    <polygon points="80,128 120,117 80,106 40,117" fill="#7fbd56" opacity="0.45" />

    <template v-if="stage === 'seed'">
      <rect x="71" y="103" width="18" height="20" fill="#7a4f2e" />
      <rect x="75" y="99" width="10" height="8" fill="#a06b3f" />
      <rect x="78" y="88" width="4" height="12" fill="#5fa84a" />
      <rect x="72" y="84" width="8" height="5" fill="#86ce63" />
      <rect x="84" y="90" width="7" height="5" fill="#86ce63" />
    </template>

    <template v-else-if="stage === 'sprout'">
      <rect x="77" y="70" width="6" height="52" fill="#5fa84a" />
      <rect x="80" y="70" width="3" height="52" fill="#407d35" />
      <rect x="57" y="86" width="20" height="8" fill="#86ce63" />
      <rect x="57" y="94" width="20" height="4" fill="#5fa84a" />
      <rect x="83" y="74" width="20" height="8" fill="#86ce63" />
      <rect x="83" y="82" width="20" height="4" fill="#5fa84a" />
      <rect x="73" y="66" width="14" height="8" fill="#86ce63" />
      <rect x="73" y="74" width="14" height="4" fill="#407d35" />
      <rect x="78" y="60" width="4" height="8" fill="#5fa84a" />
      <rect x="78" y="56" width="6" height="6" :fill="accent" />
    </template>

    <template v-else-if="stage === 'sapling'">
      <rect x="73" y="58" width="14" height="64" fill="#8b5a3c" />
      <rect x="80" y="58" width="7" height="64" fill="#6d442c" />
      <rect x="70" y="92" width="20" height="6" fill="#8b5a3c" />
      <rect x="86" y="84" width="6" height="14" fill="#8b5a3c" />
      <use href="#plant-leaf-block" transform="translate(48 58) scale(.62)" />
      <use href="#plant-leaf-block" transform="translate(76 38) scale(.72)" />
      <use href="#plant-leaf-block" transform="translate(94 60) scale(.58)" />
      <rect x="92" y="54" width="5" height="5" :fill="accent" />
      <rect x="62" y="72" width="4" height="4" :fill="accent" />
    </template>

    <template v-else>
      <rect x="70" y="44" width="20" height="82" fill="#8b5a3c" />
      <rect x="80" y="44" width="10" height="82" fill="#6d442c" />
      <rect x="62" y="86" width="24" height="7" fill="#8b5a3c" />
      <rect x="90" y="72" width="8" height="20" fill="#6d442c" />
      <use href="#plant-leaf-block" transform="translate(28 50) scale(.86)" />
      <use href="#plant-leaf-block" transform="translate(48 30) scale(1.02)" />
      <use href="#plant-leaf-block" transform="translate(82 26) scale(.98)" />
      <use href="#plant-leaf-block" transform="translate(106 48) scale(.84)" />
      <use href="#plant-leaf-block" transform="translate(58 66) scale(.9)" />
      <use href="#plant-leaf-block" transform="translate(86 62) scale(.82)" />
      <rect x="48" y="42" width="6" height="6" :fill="accent" />
      <rect x="98" y="36" width="6" height="6" :fill="accent" />
      <rect x="112" y="60" width="5" height="5" :fill="accent" />
      <rect x="68" y="84" width="5" height="5" :fill="accent" />
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stage: {
    type: String,
    default: 'seed'
  },
  speciesId: {
    type: String,
    default: 'species-1'
  }
})

const ACCENTS = {
  'species-1': '#f5a623',
  'species-2': '#ec4899',
  'species-3': '#8b5cf6',
  'species-4': '#06b6d4',
  'species-5': '#ef4444',
  'species-6': '#22c55e'
}

const accent = computed(() => ACCENTS[props.speciesId] || '#f5a623')
</script>

<style scoped>
.plant-art {
  @apply block;
  width: 100%;
  height: 100%;
  overflow: visible;
  shape-rendering: geometricPrecision;
}
</style>
