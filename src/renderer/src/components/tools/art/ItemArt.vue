<template>
  <svg class="item-art" viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <g v-if="variant === 'chair'">
      <path d="M20 12h24v24H20z" class="art-fill-soft" />
      <path d="M16 34h32v6H16z" class="art-fill" />
      <path d="M20 40v12M44 40v12" class="art-stroke" />
    </g>

    <g v-else-if="variant === 'table'">
      <rect x="10" y="24" width="44" height="6" rx="2" class="art-fill" />
      <path d="M16 30v18M48 30v18M16 42h32" class="art-stroke" />
    </g>

    <g v-else-if="variant === 'bench'">
      <rect x="10" y="30" width="44" height="6" rx="2" class="art-fill" />
      <path d="M12 18h40M12 22h40" class="art-stroke" />
      <path d="M16 36v12M48 36v12" class="art-stroke" />
    </g>

    <g v-else-if="variant === 'shelf'">
      <rect x="14" y="10" width="36" height="44" rx="3" class="art-stroke" />
      <path d="M14 24h36M14 38h36" class="art-stroke" />
      <rect x="20" y="14" width="5" height="10" class="art-fill" />
      <rect x="28" y="16" width="5" height="8" class="art-fill-soft" />
      <rect x="38" y="14" width="6" height="10" class="art-fill-soft" />
    </g>

    <g v-else-if="variant === 'lamp'">
      <path d="M32 12v8" class="art-stroke" />
      <path d="M22 20h20l-4-10H26z" class="art-fill" />
      <path d="M32 26v26M24 52h16" class="art-stroke" />
      <circle cx="32" cy="20" r="3" class="art-glow" />
    </g>

    <g v-else-if="variant === 'stool'">
      <ellipse cx="32" cy="24" rx="16" ry="6" class="art-fill" />
      <path d="M20 26l-4 24M44 26l4 24M26 28v20M38 28v20" class="art-stroke" />
    </g>

    <g v-else-if="variant === 'pot'">
      <path d="M20 36h24l-4 18H24z" class="art-fill" />
      <path d="M32 34V18" class="art-stroke" />
      <path d="M32 24c-8 0-12-5-12-11 8 0 12 5 12 11zM32 28c8 0 12-5 12-11-8 0-12 5-12 11z" class="art-fill-soft" />
      <circle cx="32" cy="14" r="4" class="art-accent" />
    </g>

    <g v-else-if="variant === 'lantern'">
      <path d="M32 6v8" class="art-stroke" />
      <path d="M20 18h24l-4 26H24z" class="art-fill" />
      <path d="M24 24h16M24 44h16" class="art-stroke" />
      <circle cx="32" cy="32" r="6" class="art-glow" />
    </g>

    <g v-else-if="variant === 'fountain'">
      <ellipse cx="32" cy="48" rx="22" ry="6" class="art-fill-soft" />
      <path d="M24 40h16l-2 10H26z" class="art-fill" />
      <path d="M32 38V24M26 30h12" class="art-stroke" />
      <path d="M32 18c-4 4-4 8 0 10 4-2 4-6 0-10z" class="art-glow" />
    </g>

    <g v-else-if="variant === 'birdhouse'">
      <path d="M32 8L14 24h36z" class="art-fill" />
      <rect x="20" y="24" width="24" height="22" rx="2" class="art-fill-soft" />
      <circle cx="32" cy="34" r="5" class="art-bg" />
      <path d="M32 46v10M24 56h16" class="art-stroke" />
    </g>

    <g v-else-if="variant === 'stone'">
      <path d="M12 48c0-10 7-18 18-18s22 7 22 16c0 8-9 12-22 12s-18-3-18-10z" class="art-fill-soft" />
      <path d="M22 38c4-4 12-5 17-1" class="art-stroke" />
      <circle cx="26" cy="30" r="2" class="art-accent" />
    </g>

    <g v-else-if="variant === 'cottage'">
      <path d="M12 30L32 12l20 18v24H12z" class="art-fill" />
      <path d="M26 54V38h12v16" class="art-bg" />
      <rect x="18" y="32" width="8" height="8" class="art-glow" />
      <path d="M40 22v-6h5v10" class="art-fill-soft" />
    </g>

    <g v-else-if="variant === 'cat'">
      <path d="M18 52c0-12 6-20 14-20s14 8 14 20" class="art-fill-soft" />
      <circle cx="32" cy="24" r="10" class="art-fill" />
      <path d="M24 17l-3-8 9 4M40 17l3-8-9 4" class="art-fill" />
      <path d="M46 48c8-4 8-14 2-16" class="art-stroke" />
      <circle cx="28" cy="24" r="1.5" class="art-bg" />
      <circle cx="36" cy="24" r="1.5" class="art-bg" />
    </g>

    <g v-else-if="variant === 'dog'">
      <path d="M16 52c0-12 7-20 16-20s16 8 16 20" class="art-fill-soft" />
      <circle cx="32" cy="24" r="10" class="art-fill" />
      <path d="M22 18c-6-4-8 4-4 10M42 18c6-4 8 4 4 10" class="art-fill" />
      <path d="M46 46c8 0 10-8 4-12" class="art-stroke" />
      <circle cx="28" cy="24" r="1.5" class="art-bg" />
      <circle cx="36" cy="24" r="1.5" class="art-bg" />
    </g>

    <g v-else-if="variant === 'bird'">
      <ellipse cx="32" cy="34" rx="14" ry="11" class="art-fill" />
      <circle cx="42" cy="26" r="8" class="art-fill" />
      <path d="M50 25l7 3-7 3z" class="art-accent" />
      <path d="M26 30c8-4 14-2 18 4-6 4-14 3-18-4z" class="art-fill-soft" />
      <path d="M28 44v8M38 44v8M24 52h8M34 52h8" class="art-stroke" />
      <circle cx="44" cy="24" r="1.3" class="art-bg" />
    </g>

    <g v-else-if="variant === 'rabbit'">
      <ellipse cx="32" cy="40" rx="13" ry="12" class="art-fill-soft" />
      <circle cx="32" cy="24" r="10" class="art-fill" />
      <path d="M26 16c-3-10 2-14 5-4M38 16c3-10-2-14-5-4" class="art-fill" />
      <circle cx="28" cy="24" r="1.4" class="art-bg" />
      <circle cx="36" cy="24" r="1.4" class="art-bg" />
      <circle cx="48" cy="44" r="4" class="art-fill" />
    </g>

    <g v-else-if="variant === 'moon-tree'">
      <path d="M30 56V34h4v22z" class="art-fill-soft" />
      <circle cx="32" cy="28" r="16" class="art-fill-soft" />
      <path d="M44 10a10 10 0 1 0 8 16 8 8 0 1 1-8-16z" class="art-accent" />
      <circle cx="24" cy="26" r="2" class="art-bg" />
      <circle cx="38" cy="20" r="2" class="art-bg" />
    </g>

    <g v-else-if="variant === 'tree'">
      <path d="M30 56V34h4v22z" class="art-fill-soft" />
      <circle cx="32" cy="26" r="16" class="art-fill" />
      <circle cx="22" cy="32" r="9" class="art-fill-soft" />
      <circle cx="42" cy="32" r="9" class="art-fill-soft" />
    </g>

    <g v-else-if="variant === 'memorial'">
      <path d="M22 52h20V30c0-8-20-8-20 0z" class="art-fill-soft" />
      <path d="M32 30V18" class="art-stroke" />
      <circle cx="32" cy="16" r="4" class="art-accent" />
      <path d="M16 54h32" class="art-stroke" />
    </g>

    <g v-else>
      <rect x="14" y="20" width="36" height="30" rx="4" class="art-fill-soft" />
      <path d="M32 20v30M14 35h36" class="art-stroke" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'box'
  }
})
</script>

<style scoped>
.item-art {
  @apply h-full w-full text-primary;
  overflow: visible;
}

.art-fill {
  fill: currentColor;
  opacity: 0.82;
}

.art-fill-soft {
  fill: currentColor;
  opacity: 0.42;
}

.art-stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.75;
}

.art-glow {
  fill: currentColor;
  opacity: 0.3;
}

.art-accent {
  fill: #f59e0b;
  opacity: 0.9;
}

.art-bg {
  fill: hsl(var(--card));
  opacity: 0.9;
}
</style>
