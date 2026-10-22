<template>
  <svg
    class="garden-scene text-primary"
    viewBox="0 0 800 260"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="800" height="260" class="scene-sky" />
    <circle cx="676" cy="56" r="30" class="scene-sun" />
    <g class="scene-clouds">
      <ellipse cx="150" cy="60" rx="48" ry="14" class="scene-cloud" />
      <ellipse cx="190" cy="54" rx="32" ry="16" class="scene-cloud" />
      <ellipse cx="470" cy="42" rx="42" ry="12" class="scene-cloud" />
      <ellipse cx="505" cy="38" rx="26" ry="13" class="scene-cloud" />
    </g>

    <path d="M0 180C120 130 220 132 330 168C440 204 540 130 660 138C730 142 780 156 800 168V260H0Z" class="scene-hill-soft" />
    <path d="M0 206C130 166 250 178 380 206C520 236 650 186 800 206V260H0Z" class="scene-hill" />

    <g v-if="level >= 3" class="scene-back-trees">
      <g transform="translate(110 118)">
        <rect x="-4" y="52" width="8" height="30" rx="3" class="scene-trunk" />
        <circle cx="0" cy="40" r="30" class="scene-canopy-soft" />
        <circle cx="-20" cy="54" r="18" class="scene-canopy-soft" />
        <circle cx="22" cy="54" r="18" class="scene-canopy-soft" />
      </g>
      <g transform="translate(690 126)">
        <rect x="-4" y="48" width="8" height="26" rx="3" class="scene-trunk" />
        <circle cx="0" cy="36" r="26" class="scene-canopy-soft" />
        <circle cx="-18" cy="48" r="16" class="scene-canopy-soft" />
      </g>
    </g>

    <g transform="translate(352 108)">
      <path d="M0 66 52 22l52 44v70H0z" class="scene-house" />
      <path d="M-10 66 52 12l62 54" class="scene-roof" />
      <rect x="30" y="82" width="22" height="54" rx="2" class="scene-door" />
      <rect x="66" y="80" width="24" height="22" rx="2" class="scene-window" />
      <path d="M78 80v22M66 91h24" class="scene-window-line" />
      <rect x="94" y="18" width="10" height="28" rx="2" class="scene-chimney" />
    </g>

    <g transform="translate(228 146)">
      <path d="M0 58V38h7v20z" class="scene-trunk" />
      <circle cx="3" cy="28" r="26" class="scene-canopy" />
      <circle cx="-15" cy="40" r="15" class="scene-canopy-soft" />
      <circle cx="22" cy="40" r="15" class="scene-canopy-soft" />
      <circle cx="-6" cy="18" r="2.5" class="scene-fruit" />
      <circle cx="12" cy="30" r="2.5" class="scene-fruit" />
    </g>

    <g v-if="level >= 2" class="scene-flower-bed">
      <path d="M0 62h150v30H0z" class="scene-bed" />
      <circle cx="18" cy="56" r="6" class="scene-flower" />
      <circle cx="42" cy="52" r="5" class="scene-flower-soft" />
      <circle cx="68" cy="58" r="6" class="scene-flower" />
      <circle cx="96" cy="53" r="5" class="scene-flower-soft" />
      <circle cx="124" cy="58" r="6" class="scene-flower" />
    </g>

    <path d="M310 260c20-40 60-62 120-70 40-5 70-18 90-34 16 26 10 64-10 104z" class="scene-path" />

    <g v-if="level >= 4" class="scene-fence">
      <path d="M0 190h140M0 210h140" class="scene-fence-rail" />
      <path d="M18 176v42M48 176v42M78 176v42M108 176v42M138 176v42" class="scene-fence-post" />
    </g>

    <g v-if="level >= 5" class="scene-pond">
      <ellipse cx="650" cy="214" rx="92" ry="28" class="scene-water" />
      <path d="M590 208c12-6 22-6 34 0s22 6 34 0 22-6 34 0" class="scene-water-line" />
      <path d="M604 222c12-6 22-6 34 0s22 6 34 0 22-6 34 0" class="scene-water-line" />
      <circle cx="700" cy="202" r="5" class="scene-lily" />
    </g>

    <g class="scene-grass">
      <path d="M20 244c2-18 6-26 12-34M36 246c0-16 4-26 10-34M760 238c0-18 4-28 12-36M784 242c0-14 2-24 8-32" class="scene-grass-line" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  level: {
    type: Number,
    default: 1
  }
})
</script>

<style scoped>
.garden-scene {
  @apply h-full w-full;
  display: block;
}

.scene-sky {
  fill: hsl(var(--primary) / 0.08);
}

.scene-sun {
  fill: #fbbf24;
  opacity: 0.55;
}

.scene-cloud {
  fill: hsl(var(--background));
  opacity: 0.55;
}

.scene-clouds {
  animation: scene-drift 22s ease-in-out infinite alternate;
}

.scene-hill-soft {
  fill: currentColor;
  opacity: 0.1;
}

.scene-hill {
  fill: currentColor;
  opacity: 0.18;
}

.scene-trunk {
  fill: currentColor;
  opacity: 0.45;
}

.scene-canopy {
  fill: currentColor;
  opacity: 0.55;
}

.scene-canopy-soft {
  fill: currentColor;
  opacity: 0.32;
}

.scene-fruit {
  fill: #f59e0b;
  opacity: 0.85;
}

.scene-house {
  fill: hsl(var(--card));
  stroke: currentColor;
  stroke-width: 3;
  opacity: 0.92;
}

.scene-roof {
  fill: none;
  stroke: currentColor;
  stroke-width: 7;
  stroke-linecap: round;
  opacity: 0.7;
}

.scene-door,
.scene-window {
  fill: currentColor;
  opacity: 0.28;
}

.scene-window-line {
  fill: none;
  stroke: hsl(var(--card));
  stroke-width: 1.5;
  opacity: 0.8;
}

.scene-chimney {
  fill: currentColor;
  opacity: 0.35;
}

.scene-bed {
  fill: currentColor;
  opacity: 0.14;
}

.scene-flower {
  fill: #f472b6;
}

.scene-flower-soft {
  fill: #fbbf24;
  opacity: 0.85;
}

.scene-path {
  fill: hsl(var(--muted-foreground) / 0.22);
}

.scene-fence-rail,
.scene-fence-post {
  stroke: currentColor;
  stroke-width: 5;
  stroke-linecap: round;
  opacity: 0.35;
}

.scene-water {
  fill: #38bdf8;
  opacity: 0.32;
}

.scene-water-line {
  fill: none;
  stroke: #0ea5e9;
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.45;
}

.scene-lily {
  fill: #22c55e;
  opacity: 0.7;
}

.scene-grass-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.45;
}

@keyframes scene-drift {
  from { transform: translateX(-8px); }
  to { transform: translateX(18px); }
}

@media (prefers-reduced-motion: reduce) {
  .scene-clouds {
    animation: none;
  }
}
</style>
