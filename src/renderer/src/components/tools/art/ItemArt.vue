<template>
  <svg
    class="item-art"
    viewBox="0 0 64 64"
    aria-hidden="true"
    shape-rendering="geometricPrecision"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g v-if="variant === 'chair'">
      <polygon points="12,32 32,26 52,32 32,38" fill="#c08a5a" />
      <polygon points="12,32 32,38 32,42 12,36" fill="#8a5a3b" />
      <polygon points="32,38 52,32 52,36 32,42" fill="#6d442c" />
      <polygon points="16,10 31,5 31,26 16,31" fill="#9a6a43" />
      <polygon points="31,5 35,7 35,28 31,26" fill="#6d442c" />
      <rect x="17" y="42" width="4" height="12" fill="#6d442c" />
      <rect x="43" y="42" width="4" height="12" fill="#5b3822" />
      <polygon points="21,31 32,28 43,31 32,34" fill="#6aa9d9" />
    </g>

    <g v-else-if="variant === 'table'">
      <polygon points="8,25 32,18 56,25 32,32" fill="#d0a06a" />
      <polygon points="8,25 32,32 32,37 8,30" fill="#9a6a43" />
      <polygon points="32,32 56,25 56,30 32,37" fill="#7a4c2f" />
      <rect x="14" y="34" width="5" height="18" fill="#7a4c2f" />
      <rect x="45" y="34" width="5" height="18" fill="#6d442c" />
      <rect x="20" y="42" width="24" height="4" fill="#8a5a3b" />
    </g>

    <g v-else-if="variant === 'bench'">
      <polygon points="6,32 32,24 58,32 32,40" fill="#c08a5a" />
      <polygon points="6,32 32,40 32,44 6,36" fill="#8a5a3b" />
      <polygon points="32,40 58,32 58,36 32,44" fill="#6d442c" />
      <polygon points="12,18 32,12 52,18 32,24" fill="#9a6a43" />
      <rect x="12" y="20" width="40" height="4" fill="#7a4c2f" />
      <rect x="16" y="42" width="4" height="10" fill="#6d442c" />
      <rect x="44" y="42" width="4" height="10" fill="#5b3822" />
    </g>

    <g v-else-if="variant === 'shelf'">
      <polygon points="12,10 44,10 52,16 20,16" fill="#b9855b" />
      <rect x="12" y="10" width="32" height="44" fill="#9a6a43" />
      <rect x="44" y="10" width="8" height="44" fill="#6d442c" />
      <rect x="16" y="20" width="24" height="4" fill="#5b3822" />
      <rect x="16" y="34" width="24" height="4" fill="#5b3822" />
      <rect x="19" y="14" width="5" height="6" fill="#6aa9d9" />
      <rect x="28" y="14" width="5" height="6" fill="#e6b95c" />
      <rect x="36" y="28" width="5" height="6" fill="#6aa9d9" />
    </g>

    <g v-else-if="variant === 'lamp'">
      <rect x="30" y="12" width="4" height="8" fill="#5b3822" />
      <polygon points="22,20 42,20 38,10 26,10" fill="#e0b052" />
      <polygon points="22,20 42,20 42,24 22,24" fill="#b98536" />
      <rect x="22" y="24" width="20" height="6" fill="#f6d27a" />
      <rect x="30" y="30" width="4" height="22" fill="#5b3822" />
      <rect x="24" y="52" width="16" height="4" fill="#6d442c" />
      <rect x="26" y="16" width="12" height="8" fill="#fff0b0" />
    </g>

    <g v-else-if="variant === 'stool'">
      <polygon points="16,24 32,19 48,24 32,29" fill="#c08a5a" />
      <polygon points="16,24 32,29 32,33 16,28" fill="#8a5a3b" />
      <polygon points="32,29 48,24 48,28 32,33" fill="#6d442c" />
      <rect x="19" y="31" width="4" height="18" fill="#7a4c2f" />
      <rect x="41" y="31" width="4" height="18" fill="#6d442c" />
      <rect x="24" y="40" width="16" height="3" fill="#8a5a3b" />
    </g>

    <g v-else-if="variant === 'pot'">
      <polygon points="20,36 44,36 40,52 24,52" fill="#b96a4a" />
      <polygon points="20,36 44,36 44,40 20,40" fill="#d88a64" />
      <rect x="31" y="20" width="3" height="16" fill="#4f8f3f" />
      <rect x="24" y="18" width="9" height="6" fill="#6aa84f" />
      <rect x="34" y="24" width="9" height="6" fill="#5fa84a" />
      <rect x="28" y="14" width="7" height="7" fill="#f2a03d" />
    </g>

    <g v-else-if="variant === 'lantern'">
      <rect x="30" y="4" width="4" height="8" fill="#5b3822" />
      <polygon points="20,16 44,16 44,20 20,20" fill="#4b4038" />
      <rect x="22" y="20" width="20" height="24" fill="#332c27" />
      <rect x="26" y="24" width="12" height="16" fill="#f6d27a" />
      <rect x="29" y="27" width="6" height="10" fill="#fff0b0" />
      <rect x="20" y="44" width="24" height="5" fill="#241f1c" />
    </g>

    <g v-else-if="variant === 'fountain'">
      <polygon points="8,44 32,36 56,44 32,52" fill="#b5b5b5" />
      <polygon points="8,44 32,52 32,56 8,48" fill="#8f8f8f" />
      <polygon points="32,52 56,44 56,48 32,56" fill="#6e6e6e" />
      <polygon points="16,44 32,39 48,44 32,49" fill="#64b5d6" />
      <rect x="29" y="26" width="6" height="14" fill="#8f8f8f" />
      <rect x="24" y="30" width="6" height="4" fill="#8bd3e8" />
      <rect x="36" y="28" width="6" height="4" fill="#8bd3e8" />
      <rect x="30" y="20" width="4" height="8" fill="#8bd3e8" />
    </g>

    <g v-else-if="variant === 'birdhouse'">
      <polygon points="32,8 12,22 52,22" fill="#8a5a3b" />
      <rect x="18" y="22" width="28" height="22" fill="#c08a5a" />
      <rect x="22" y="26" width="20" height="4" fill="#8a5a3b" />
      <rect x="27" y="32" width="10" height="8" fill="#332c27" />
      <rect x="30" y="44" width="4" height="12" fill="#6d442c" />
      <rect x="24" y="56" width="16" height="3" fill="#5b3822" />
    </g>

    <g v-else-if="variant === 'stone'">
      <polygon points="10,40 30,32 54,40 34,48" fill="#a5a5a5" />
      <polygon points="10,40 34,48 34,54 10,46" fill="#7f7f7f" />
      <polygon points="34,48 54,40 54,46 34,54" fill="#666666" />
      <rect x="24" y="32" width="10" height="6" fill="#8f8f8f" />
      <rect x="38" y="36" width="8" height="5" fill="#b5b5b5" />
    </g>

    <g v-else-if="variant === 'cottage'">
      <polygon points="30,10 10,24 50,24" fill="#8a4a34" />
      <rect x="16" y="24" width="28" height="24" fill="#e7d2a5" />
      <rect x="16" y="24" width="28" height="4" fill="#f1deba" />
      <rect x="24" y="36" width="10" height="12" fill="#6b4226" />
      <rect x="38" y="32" width="6" height="6" fill="#9fd4e8" />
      <rect x="28" y="16" width="4" height="8" fill="#8a5a3b" />
      <rect x="36" y="12" width="3" height="6" fill="#ffffff" opacity="0.7" />
    </g>

    <g v-else-if="variant === 'cat'">
      <rect x="20" y="30" width="24" height="16" fill="#d9a65c" />
      <rect x="24" y="18" width="18" height="16" fill="#e6b96c" />
      <rect x="24" y="12" width="6" height="7" fill="#e6b96c" />
      <rect x="36" y="12" width="6" height="7" fill="#e6b96c" />
      <rect x="29" y="24" width="3" height="3" fill="#332c27" />
      <rect x="38" y="24" width="3" height="3" fill="#332c27" />
      <rect x="32" y="30" width="4" height="3" fill="#ef7f8f" />
      <rect x="44" y="34" width="8" height="4" fill="#d9a65c" />
      <rect x="22" y="46" width="5" height="8" fill="#b9854f" />
      <rect x="38" y="46" width="5" height="8" fill="#b9854f" />
    </g>

    <g v-else-if="variant === 'dog'">
      <rect x="18" y="32" width="26" height="16" fill="#9a6a43" />
      <rect x="22" y="20" width="18" height="16" fill="#b9855b" />
      <rect x="18" y="20" width="6" height="10" fill="#7a4c2f" />
      <rect x="40" y="20" width="6" height="10" fill="#7a4c2f" />
      <rect x="27" y="26" width="3" height="3" fill="#332c27" />
      <rect x="37" y="26" width="3" height="3" fill="#332c27" />
      <rect x="31" y="33" width="5" height="4" fill="#5b3822" />
      <rect x="44" y="36" width="7" height="4" fill="#9a6a43" />
      <rect x="20" y="48" width="5" height="7" fill="#7a4c2f" />
      <rect x="38" y="48" width="5" height="7" fill="#7a4c2f" />
    </g>

    <g v-else-if="variant === 'bird'">
      <rect x="20" y="24" width="20" height="14" fill="#6aa9d9" />
      <rect x="24" y="18" width="14" height="10" fill="#8cc7de" />
      <rect x="26" y="21" width="3" height="3" fill="#332c27" />
      <rect x="40" y="25" width="6" height="4" fill="#f2c14e" />
      <polygon points="22,30 34,34 22,38" fill="#4d8fb8" />
      <rect x="26" y="38" width="3" height="8" fill="#e6b95c" />
      <rect x="34" y="38" width="3" height="8" fill="#e6b95c" />
    </g>

    <g v-else-if="variant === 'rabbit'">
      <rect x="22" y="32" width="20" height="14" fill="#e8e2d4" />
      <rect x="24" y="22" width="16" height="14" fill="#f4eee0" />
      <rect x="26" y="8" width="5" height="14" fill="#f4eee0" />
      <rect x="34" y="8" width="5" height="14" fill="#f4eee0" />
      <rect x="29" y="27" width="3" height="3" fill="#332c27" />
      <rect x="35" y="27" width="3" height="3" fill="#332c27" />
      <rect x="31" y="32" width="4" height="3" fill="#ef7f8f" />
      <rect x="20" y="46" width="5" height="8" fill="#c9c1b0" />
      <rect x="38" y="46" width="5" height="8" fill="#c9c1b0" />
    </g>

    <g v-else-if="variant === 'moon-tree'">
      <rect x="28" y="30" width="8" height="26" fill="#6d442c" />
      <rect x="32" y="30" width="4" height="26" fill="#5b3822" />
      <use href="#item-leaf-block" transform="translate(12 8)" fill="#7b6ad6" />
      <use href="#item-leaf-block" transform="translate(28 2)" fill="#9586ef" />
      <use href="#item-leaf-block" transform="translate(38 16)" fill="#6a58c4" />
      <rect x="22" y="20" width="5" height="5" fill="#ffe08a" />
      <rect x="40" y="28" width="4" height="4" fill="#ffe08a" />
    </g>

    <g v-else-if="variant === 'tree'">
      <rect x="28" y="28" width="8" height="28" fill="#8b5a3c" />
      <rect x="32" y="28" width="4" height="28" fill="#6d442c" />
      <use href="#item-leaf-block" transform="translate(10 8)" fill="#5fa84a" />
      <use href="#item-leaf-block" transform="translate(27 2)" fill="#86ce63" />
      <use href="#item-leaf-block" transform="translate(38 14)" fill="#4f8f3f" />
      <rect x="22" y="26" width="4" height="4" fill="#f2a03d" />
    </g>

    <g v-else-if="variant === 'memorial'">
      <polygon points="12,42 32,34 52,42 32,50" fill="#a5a5a5" />
      <polygon points="12,42 32,50 32,56 12,48" fill="#7f7f7f" />
      <polygon points="32,50 52,42 52,48 32,56" fill="#666666" />
      <rect x="26" y="18" width="12" height="20" fill="#c9c9c9" />
      <rect x="30" y="22" width="4" height="10" fill="#8f8f8f" />
      <rect x="26" y="26" width="12" height="4" fill="#8f8f8f" />
    </g>

    <g v-else>
      <polygon points="12,34 32,26 52,34 32,42" fill="#c08a5a" />
      <polygon points="12,34 32,42 32,50 12,42" fill="#8a5a3b" />
      <polygon points="32,42 52,34 52,42 32,50" fill="#6d442c" />
      <rect x="24" y="28" width="16" height="4" fill="#d0a06a" />
    </g>

    <defs>
      <g id="item-leaf-block">
        <polygon points="12,0 24,5 12,10 0,5" />
        <polygon points="0,5 12,10 12,24 0,19" />
        <polygon points="12,10 24,5 24,19 12,24" />
      </g>
    </defs>
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
  @apply block;
  width: 100%;
  height: 100%;
  overflow: visible;
  shape-rendering: geometricPrecision;
}
</style>
