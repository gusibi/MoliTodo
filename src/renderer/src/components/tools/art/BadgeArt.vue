<template>
  <svg class="badge-art" viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path
      v-if="kind === 'expansion'"
      d="M32 4 57 16v20c0 13-11 21-25 25C18 57 7 49 7 36V16z"
      class="badge-shield"
    />
    <circle v-else cx="32" cy="32" r="27" class="badge-ring" />
    <circle cx="32" cy="32" r="22" class="badge-inner" />

    <g class="badge-glyph">
      <g v-if="variant === 'sprout'">
        <path d="M32 46V26" class="glyph-stroke" />
        <path d="M32 34c-9 0-13-6-13-13 9 0 13 6 13 13zM32 30c8 0 12-5 12-12-8 0-12 5-12 12z" class="glyph-fill" />
      </g>
      <g v-else-if="variant === 'calendar'">
        <rect x="16" y="18" width="32" height="30" rx="4" class="glyph-stroke" />
        <path d="M16 26h32M24 14v8M40 14v8" class="glyph-stroke" />
        <circle cx="25" cy="34" r="2" class="glyph-fill" />
        <circle cx="33" cy="34" r="2" class="glyph-fill" />
        <circle cx="41" cy="34" r="2" class="glyph-fill" />
      </g>
      <g v-else-if="variant === 'droplet'">
        <path d="M32 12c8 11 13 18 13 25a13 13 0 0 1-26 0c0-7 5-14 13-25z" class="glyph-fill" />
        <path d="M25 36c0 4 3 7 7 7" class="glyph-highlight" />
      </g>
      <g v-else-if="variant === 'home'">
        <path d="M14 30 32 14l18 16v20H14z" class="glyph-stroke" />
        <path d="M27 50V36h10v14" class="glyph-fill" />
      </g>
      <g v-else-if="variant === 'flame'">
        <path d="M32 10c8 10 4 14 8 20 3 5 2 11-1 15-4 5-12 6-17 1-6-6-4-14 1-20 4-5 7-9 9-16z" class="glyph-fill" />
        <path d="M32 32c4 5 2 9-1 12-3-2-4-6-1-9z" class="glyph-bg" />
      </g>
      <g v-else-if="variant === 'leaf'">
        <path d="M16 46c0-17 11-29 32-30 1 21-11 32-28 32z" class="glyph-fill" />
        <path d="M18 46c8-8 17-15 28-20" class="glyph-highlight" />
      </g>
      <g v-else-if="variant === 'sun'">
        <circle cx="32" cy="32" r="10" class="glyph-fill" />
        <path d="M32 10v6M32 48v6M10 32h6M48 32h6M17 17l4 4M43 43l4 4M47 17l-4 4M21 43l-4 4" class="glyph-stroke" />
      </g>
      <g v-else-if="variant === 'heart'">
        <path d="M32 50S13 39 13 26c0-7 5-12 12-12 5 0 8 3 7 8 0-5 3-8 8-8 7 0 12 5 12 12 0 13-20 24-20 24z" class="glyph-fill" />
      </g>
      <g v-else-if="variant === 'tree'">
        <path d="M30 50V34h4v16z" class="glyph-fill-soft" />
        <circle cx="32" cy="26" r="13" class="glyph-fill" />
        <circle cx="23" cy="32" r="8" class="glyph-fill-soft" />
        <circle cx="41" cy="32" r="8" class="glyph-fill-soft" />
      </g>
      <g v-else-if="variant === 'bolt'">
        <path d="M35 10 18 36h12l-1 18 17-27H34z" class="glyph-fill" />
      </g>
      <g v-else-if="variant === 'moon'">
        <path d="M38 12a20 20 0 1 0 14 32 16 16 0 1 1-14-32z" class="glyph-fill" />
      </g>
      <g v-else-if="variant === 'trophy'">
        <path d="M22 14h20v10c0 8-4 13-10 13s-10-5-10-13z" class="glyph-fill" />
        <path d="M22 18h-7c0 9 4 13 9 13M42 18h7c0 9-4 13-9 13" class="glyph-stroke" />
        <path d="M32 37v8M24 50h16" class="glyph-stroke" />
      </g>
      <g v-else-if="variant === 'star'">
        <path d="m32 11 6.5 13.2 14.5 2.1-10.5 10.2 2.5 14.5L32 44.2 19 51l2.5-14.5L11 26.3l14.5-2.1z" class="glyph-fill" />
      </g>
      <g v-else-if="variant === 'crown'">
        <path d="m12 22 10 8 10-14 10 14 10-8-4 26H16z" class="glyph-fill" />
        <circle cx="20" cy="18" r="2.5" class="glyph-bg" />
        <circle cx="44" cy="18" r="2.5" class="glyph-bg" />
        <circle cx="32" cy="14" r="2.5" class="glyph-bg" />
      </g>
      <g v-else-if="variant === 'flower'">
        <circle cx="32" cy="18" r="6" class="glyph-fill" />
        <circle cx="20" cy="28" r="6" class="glyph-fill-soft" />
        <circle cx="44" cy="28" r="6" class="glyph-fill-soft" />
        <circle cx="24" cy="40" r="6" class="glyph-fill-soft" />
        <circle cx="40" cy="40" r="6" class="glyph-fill-soft" />
        <circle cx="32" cy="30" r="5" class="glyph-bg" />
      </g>
      <g v-else-if="variant === 'fence'">
        <path d="M14 24v26M26 20v30M38 20v30M50 24v26M10 30h44M10 42h44" class="glyph-stroke" />
      </g>
      <g v-else-if="variant === 'pond'">
        <path d="M12 36c6-4 10-4 16 0s10 4 16 0 8-4 10-2M12 44c6-4 10-4 16 0s10 4 16 0 8-4 10-2" class="glyph-stroke" />
        <circle cx="25" cy="28" r="3" class="glyph-fill" />
        <circle cx="39" cy="26" r="2" class="glyph-fill-soft" />
      </g>
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  definitionId: {
    type: String,
    required: true
  },
  kind: {
    type: String,
    default: 'milestone'
  },
  unlocked: {
    type: Boolean,
    default: false
  }
})

const VARIANTS = {
  'first-sprout': 'sprout',
  'seven-day-garden': 'calendar',
  'hydration-start': 'droplet',
  'garden-begins': 'home',
  'half-month-streak': 'flame',
  'focus-apprentice': 'leaf',
  'season-garden': 'sun',
  'healthy-life': 'heart',
  'hundred-day-garden': 'tree',
  'focus-advanced': 'bolt',
  'half-year-garden': 'moon',
  'focus-expert': 'trophy',
  'hydration-master': 'droplet',
  'deep-gardener': 'leaf',
  'focus-master': 'star',
  'annual-gardener': 'crown',
  'expansion-lv2': 'flower',
  'expansion-lv3': 'tree',
  'expansion-lv4': 'fence',
  'expansion-lv5': 'pond'
}

const variant = computed(() => VARIANTS[props.definitionId] || 'star')
</script>

<style scoped>
.badge-art {
  @apply h-full w-full;
  overflow: visible;
}

.badge-ring,
.badge-shield {
  fill: currentColor;
  opacity: 0.16;
  stroke: currentColor;
  stroke-width: 2;
}

.badge-inner {
  fill: hsl(var(--card));
  stroke: currentColor;
  stroke-width: 1.2;
  opacity: 0.9;
}

.badge-glyph {
  color: currentColor;
}

.glyph-stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.glyph-fill {
  fill: currentColor;
  opacity: 0.85;
}

.glyph-fill-soft {
  fill: currentColor;
  opacity: 0.45;
}

.glyph-highlight {
  fill: none;
  stroke: hsl(var(--card));
  stroke-width: 2;
  stroke-linecap: round;
  opacity: 0.75;
}

.glyph-bg {
  fill: hsl(var(--card));
  opacity: 0.9;
}
</style>
