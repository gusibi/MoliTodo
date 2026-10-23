<template>
  <svg
    class="garden-scene"
    viewBox="0 0 800 520"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="garden-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f6ecdd" />
        <stop offset="100%" stop-color="#ead8bd" />
      </linearGradient>
      <linearGradient id="garden-ground" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="#a6d987" />
        <stop offset="100%" stop-color="#6cb65d" />
      </linearGradient>
      <linearGradient id="garden-roof" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#7b4f38" />
        <stop offset="100%" stop-color="#4a2d21" />
      </linearGradient>
      <linearGradient id="garden-wall" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f7e7c6" />
        <stop offset="100%" stop-color="#e4cda5" />
      </linearGradient>
    </defs>

    <rect width="800" height="520" fill="url(#garden-bg)" />
    <circle cx="690" cy="80" r="44" fill="#f7c45b" opacity="0.38" />
    <ellipse cx="140" cy="90" rx="58" ry="18" fill="#ffffff" opacity="0.35" />
    <ellipse cx="185" cy="82" rx="38" ry="20" fill="#ffffff" opacity="0.35" />

    <!-- 地面 -->
    <path d="M400 238 738 352 400 512 62 352Z" fill="url(#garden-ground)" />
    <path d="M400 258 700 360 400 496 100 360Z" fill="#7fc56b" opacity="0.45" />
    <path d="M400 285 662 372 400 480 138 372Z" fill="#8fd17a" opacity="0.5" />
    <path d="M400 300 620 380 400 466 180 380Z" fill="#7cc968" opacity="0.55" />

    <!-- 石板路 -->
    <path d="M300 512 340 430 400 408 470 430 520 512Z" fill="#e5c79b" opacity="0.9" />
    <path d="M320 490 350 440 400 422 452 440 486 490Z" fill="#f0d7ae" opacity="0.6" />

    <!-- 后排树（Lv.3+） -->
    <g v-if="level >= 3" opacity="0.85">
      <g transform="translate(120 210) scale(.62)">
        <rect x="-8" y="70" width="16" height="80" rx="6" fill="#8b5a3c" />
        <circle cx="0" cy="45" r="48" fill="#5daa4c" />
        <circle cx="-32" cy="65" r="32" fill="#70bb58" />
        <circle cx="34" cy="65" r="32" fill="#70bb58" />
      </g>
      <g transform="translate(710 230) scale(.55)">
        <rect x="-8" y="70" width="16" height="80" rx="6" fill="#8b5a3c" />
        <circle cx="0" cy="45" r="48" fill="#5daa4c" />
        <circle cx="-32" cy="65" r="32" fill="#70bb58" />
        <circle cx="34" cy="65" r="32" fill="#70bb58" />
      </g>
    </g>

    <!-- 木屋 -->
    <g class="garden-house">
      <ellipse cx="248" cy="438" rx="150" ry="30" fill="#3d6d38" opacity="0.22" />
      <path d="M118 254 300 298 300 444 118 398Z" fill="url(#garden-wall)" />
      <path d="M300 298 386 268 386 414 300 444Z" fill="#ddc49a" />
      <path d="M118 254 300 298 386 268 204 222Z" fill="#ead4ae" />
      <path d="M104 250 292 296 292 248 176 196Z" fill="url(#garden-roof)" />
      <path d="M292 296 390 264 270 158 176 196Z" fill="#6b432f" />
      <path d="M104 250 176 196 270 158 292 248Z" fill="#8d5d42" />
      <path d="M118 254 300 298 300 312 118 268Z" fill="#c79c6b" opacity="0.55" />
      <path d="M128 302 220 324 220 402 128 378Z" fill="#4b8b4a" />
      <path d="M136 308 212 327 212 394 136 374Z" fill="#5fa558" />
      <circle cx="200" cy="354" r="5" fill="#f2d27a" />
      <path d="M244 330 282 339 282 402 244 392Z" fill="#8fbfd0" />
      <path d="M250 336 276 343 276 395 250 388Z" fill="#bfe4ed" />
      <path d="M252 344 274 349 274 357 252 352Z" fill="#ffffff" opacity="0.55" />
      <path d="M128 380 148 386 148 404 128 398Z" fill="#c98b56" />
      <path d="M212 300 300 320 300 334 212 314Z" fill="#7a4d36" opacity="0.35" />
      <circle cx="206" cy="236" r="27" fill="#6b432f" />
      <circle cx="206" cy="236" r="20" fill="#dff0f4" />
      <path d="M186 236h40M206 216v40" stroke="#8b5a3c" stroke-width="3" />
      <path d="M338 178 352 174 352 208 338 212Z" fill="#6b432f" />
      <path d="M120 404 300 448 300 462 120 418Z" fill="#b68153" />
      <g transform="translate(120 352)">
        <path d="M0 26h34l-6 24H6Z" fill="#c56f53" />
        <path d="M17 24V6" stroke="#4f8a45" stroke-width="4" />
        <circle cx="17" cy="4" r="8" fill="#f1a25f" />
        <circle cx="4" cy="14" r="6" fill="#f4bd5d" />
        <circle cx="30" cy="14" r="6" fill="#ef8c8c" />
      </g>
      <g transform="translate(270 350)">
        <path d="M0 20h30l-5 20H5Z" fill="#cf7b5b" />
        <path d="M15 18V2" stroke="#4f8a45" stroke-width="4" />
        <circle cx="15" cy="0" r="7" fill="#f6c85f" />
      </g>
    </g>

    <!-- 中央生长空地：植物由页面按真实成长阶段覆盖渲染 -->
    <g class="garden-plant-bed">
      <ellipse cx="430" cy="430" rx="118" ry="26" fill="#356634" opacity="0.16" />
      <ellipse cx="430" cy="430" rx="74" ry="18" fill="#b68153" opacity="0.32" />
    </g>

    <!-- 栅栏与花架 -->
    <g class="garden-fence">
      <path d="M556 300 616 280 616 430 556 450Z" fill="#b9855b" opacity="0.18" />
      <path d="M568 300v132M606 288v132M644 276v132M682 264v132" stroke="#a8734c" stroke-width="10" stroke-linecap="round" />
      <path d="M560 330 690 292M560 364 690 326M560 398 690 360" stroke="#bd8a5e" stroke-width="7" stroke-linecap="round" />
      <path d="M576 286c18-20 30-30 46-36M610 320c16-18 28-26 42-32M648 300c16-16 26-24 38-30" stroke="#4f8a45" stroke-width="4" fill="none" />
      <g fill="#f4bd5d">
        <circle cx="600" cy="270" r="9" />
        <circle cx="622" cy="250" r="10" />
        <circle cx="648" cy="242" r="9" />
        <circle cx="668" cy="260" r="8" />
        <circle cx="690" cy="246" r="9" />
      </g>
      <g fill="#f08c7a">
        <circle cx="590" cy="286" r="6" />
        <circle cx="636" cy="266" r="6" />
        <circle cx="676" cy="280" r="6" />
      </g>
    </g>

    <!-- 挂灯 -->
    <g class="garden-lantern">
      <path d="M748 120v38" stroke="#5b4a3e" stroke-width="3" />
      <path d="M730 158h36l-6 44h-24Z" fill="#3e3935" />
      <path d="M736 164h24l-4 32h-16Z" fill="#f6d27a" opacity="0.85" />
      <path d="M724 158h48M732 202h32" stroke="#2c2927" stroke-width="4" stroke-linecap="round" />
      <circle cx="748" cy="180" r="18" fill="#f6d27a" opacity="0.18" />
    </g>

    <!-- 花圃（Lv.2+） -->
    <g v-if="level >= 2" class="garden-flower-bed">
      <path d="M180 430 320 470 286 500 146 460Z" fill="#b9794d" opacity="0.55" />
      <g fill="#f08c7a">
        <circle cx="184" cy="438" r="9" /><circle cx="210" cy="446" r="10" /><circle cx="238" cy="454" r="9" />
        <circle cx="266" cy="462" r="10" /><circle cx="292" cy="470" r="9" />
      </g>
      <g fill="#f6c85f">
        <circle cx="198" cy="456" r="7" /><circle cx="228" cy="464" r="7" /><circle cx="258" cy="472" r="7" />
        <circle cx="286" cy="480" r="7" />
      </g>
      <g fill="#4f8a45">
        <circle cx="170" cy="446" r="6" /><circle cx="248" cy="442" r="6" /><circle cx="304" cy="454" r="6" />
      </g>
    </g>

    <!-- 池塘（Lv.5+） -->
    <g v-if="level >= 5" class="garden-pond">
      <ellipse cx="628" cy="470" rx="94" ry="28" fill="#6fb6c9" opacity="0.65" />
      <ellipse cx="628" cy="466" rx="78" ry="20" fill="#9ad7df" opacity="0.7" />
      <path d="M568 462c14-6 26-6 40 0s26 6 40 0 26-6 40 0" stroke="#e8fbfd" stroke-width="3" fill="none" opacity="0.7" />
      <circle cx="656" cy="458" r="7" fill="#5fae58" />
      <circle cx="680" cy="468" r="5" fill="#5fae58" />
    </g>

    <!-- 前景花丛 -->
    <g class="garden-front-flowers">
      <g fill="#f08c7a">
        <circle cx="90" cy="470" r="12" /><circle cx="116" cy="486" r="10" /><circle cx="66" cy="492" r="9" />
        <circle cx="726" cy="456" r="11" /><circle cx="754" cy="474" r="12" /><circle cx="700" cy="480" r="9" />
      </g>
      <g fill="#f6c85f">
        <circle cx="78" cy="452" r="8" /><circle cx="106" cy="468" r="8" /><circle cx="740" cy="438" r="9" />
        <circle cx="768" cy="454" r="8" />
      </g>
      <g fill="#4f8a45">
        <circle cx="58" cy="476" r="7" /><circle cx="130" cy="470" r="7" /><circle cx="712" cy="466" r="8" />
        <circle cx="778" cy="482" r="7" />
      </g>
    </g>

    <g class="garden-grass" stroke="#4f8a45" stroke-width="4" stroke-linecap="round" opacity="0.55" fill="none">
      <path d="M340 500c2-16 6-24 12-32M360 504c0-14 4-24 10-32M560 486c0-14 4-24 10-30M582 490c0-12 2-20 8-28" />
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
  background: #f4eadc;
}

.garden-house,
.garden-fence,
.garden-lantern,
.garden-flower-bed,
.garden-front-flowers {
  filter: drop-shadow(0 10px 14px rgba(74, 45, 33, 0.12));
}

@media (prefers-reduced-motion: no-preference) {
  .garden-plant-bed {
    animation: garden-breathe 9s ease-in-out infinite;
    transform-origin: 430px 430px;
  }

  @keyframes garden-breathe {
    0%, 100% { opacity: 0.82; }
    50% { opacity: 1; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .garden-plant-bed {
    animation: none;
  }
}
</style>
