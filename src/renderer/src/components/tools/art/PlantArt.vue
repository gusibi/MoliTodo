<template>
  <svg
    class="plant-art"
    viewBox="0 0 160 160"
    role="img"
    :aria-label="stage"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g class="plant-art-sway">
      <ellipse cx="80" cy="139" rx="52" ry="10" class="plant-soil-shadow" />
      <path d="M28 139 Q80 124 132 139 L132 147 Q80 132 28 147 Z" class="plant-soil" />

      <template v-if="stage === 'seed'">
        <ellipse cx="80" cy="126" rx="13" ry="18" class="plant-seed" />
        <path d="M73 119 Q80 124 87 119" class="plant-seed-line" />
        <path d="M80 108 L82 100 M88 110 L93 104 M72 110 L67 104" class="plant-sparkle" />
      </template>

      <template v-else-if="stage === 'sprout'">
        <path d="M80 132 C80 118 80 106 80 96" class="plant-stem" />
        <path d="M80 112 C65 110 56 101 55 89 C69 89 79 98 80 112Z" class="plant-leaf-soft" />
        <path d="M80 106 C94 104 102 96 103 85 C90 85 81 94 80 106Z" class="plant-leaf" />
        <circle cx="80" cy="93" r="4" :style="{ fill: accent }" class="plant-flower" />
      </template>

      <template v-else-if="stage === 'sapling'">
        <path d="M80 134 C79 112 81 88 80 66" class="plant-stem" />
        <path d="M80 112 C64 109 55 99 54 85 C69 86 78 96 80 112Z" class="plant-leaf-soft" />
        <path d="M81 104 C96 101 105 91 106 78 C92 79 83 89 81 104Z" class="plant-leaf" />
        <path d="M80 92 C68 89 61 81 60 70 C72 71 79 80 80 92Z" class="plant-leaf" />
        <path d="M81 84 C92 81 98 75 99 66 C89 67 83 74 81 84Z" class="plant-leaf-soft" />
        <circle cx="80" cy="64" r="5" :style="{ fill: accent }" class="plant-flower" />
        <circle cx="66" cy="78" r="3" :style="{ fill: accent }" class="plant-flower-soft" />
      </template>

      <template v-else>
        <path d="M76 136 C77 118 78 100 80 82 C82 100 83 118 84 136Z" class="plant-trunk" />
        <path d="M80 104 L62 88 M81 108 L101 90 M80 116 L70 104" class="plant-branch" />
        <circle cx="56" cy="80" r="22" class="plant-canopy-soft" />
        <circle cx="104" cy="78" r="23" class="plant-canopy" />
        <circle cx="80" cy="62" r="28" class="plant-canopy-soft" />
        <circle cx="78" cy="82" r="21" class="plant-canopy" />
        <circle cx="60" cy="66" r="3" :style="{ fill: accent }" class="plant-fruit" />
        <circle cx="95" cy="58" r="3" :style="{ fill: accent }" class="plant-fruit" />
        <circle cx="102" cy="88" r="3" :style="{ fill: accent }" class="plant-fruit" />
        <circle cx="72" cy="96" r="2.5" :style="{ fill: accent }" class="plant-fruit" />
      </template>
    </g>
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
  'species-1': '#f59e0b',
  'species-2': '#ec4899',
  'species-3': '#8b5cf6',
  'species-4': '#06b6d4',
  'species-5': '#ef4444',
  'species-6': '#22c55e'
}

const accent = computed(() => ACCENTS[props.speciesId] || '#f59e0b')
</script>

<style scoped>
.plant-art {
  @apply h-full w-full text-primary;
  overflow: visible;
}

.plant-soil-shadow {
  fill: currentColor;
  opacity: 0.1;
}

.plant-soil {
  fill: currentColor;
  opacity: 0.18;
}

.plant-seed {
  fill: currentColor;
  opacity: 0.75;
}

.plant-seed-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  opacity: 0.45;
}

.plant-sparkle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  opacity: 0.5;
}

.plant-stem {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
}

.plant-trunk {
  fill: currentColor;
  opacity: 0.55;
}

.plant-branch {
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.45;
}

.plant-leaf,
.plant-leaf-soft {
  fill: currentColor;
}

.plant-leaf-soft {
  opacity: 0.62;
}

.plant-canopy {
  fill: currentColor;
  opacity: 0.78;
}

.plant-canopy-soft {
  fill: currentColor;
  opacity: 0.48;
}

.plant-flower,
.plant-fruit {
  opacity: 0.95;
}

.plant-flower-soft {
  opacity: 0.6;
}

.plant-art-sway {
  transform-origin: 80px 136px;
  animation: plant-breathe 6s ease-in-out infinite;
}

@keyframes plant-breathe {
  0%, 100% { transform: rotate(-1.2deg); }
  50% { transform: rotate(1.2deg); }
}

@media (prefers-reduced-motion: reduce) {
  .plant-art-sway {
    animation: none;
  }
}
</style>
