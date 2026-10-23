<template>
  <svg
    class="garden-scene"
    viewBox="0 0 800 520"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    shape-rendering="geometricPrecision"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <g id="scene-leaf-block">
        <polygon points="24,0 48,9 24,18 0,9" fill="#86ce63" />
        <polygon points="0,9 24,18 24,48 0,39" fill="#5fa84a" />
        <polygon points="24,18 48,9 48,39 24,48" fill="#407d35" />
      </g>
      <g id="scene-post">
        <rect x="-5" y="0" width="10" height="56" fill="#8a5a3b" />
        <rect x="0" y="0" width="5" height="56" fill="#6d442c" />
        <polygon points="0,-4 8,0 0,4 -8,0" fill="#a06b3f" />
      </g>
    </defs>

    <!-- 天空 -->
    <rect width="800" height="520" fill="#bfe3ff" />

    <!-- 像素云 -->
    <g fill="#ffffff" opacity="0.82">
      <rect x="84" y="58" width="104" height="16" />
      <rect x="110" y="42" width="62" height="16" />
      <rect x="62" y="74" width="56" height="12" />
      <rect x="522" y="76" width="112" height="16" />
      <rect x="552" y="60" width="64" height="16" />
      <rect x="650" y="82" width="58" height="12" />
    </g>

    <!-- 方块太阳 -->
    <g fill="#ffe08a">
      <rect x="692" y="50" width="40" height="8" />
      <rect x="680" y="58" width="64" height="12" />
      <rect x="672" y="70" width="80" height="28" />
      <rect x="680" y="98" width="64" height="12" />
      <rect x="692" y="110" width="40" height="8" />
    </g>

    <!-- 草地平台 -->
    <g class="garden-ground">
      <polygon points="400,236 760,368 400,500 40,368" fill="#7fbd56" />
      <polygon points="40,368 400,500 400,520 40,388" fill="#8a5a3b" />
      <polygon points="400,500 760,368 760,388 400,520" fill="#6d442c" />

      <!-- 草皮边缘 -->
      <polygon points="40,368 400,500 400,511 40,379" fill="#5c9a40" />
      <polygon points="400,500 760,368 760,379 400,511" fill="#4d8435" />

      <!-- 等距网格 -->
      <g stroke="#69a847" stroke-width="2" opacity="0.38" fill="none">
        <path d="M445,252 85,384M490,269 130,401M535,286 175,418M580,303 220,435M625,320 265,452M670,337 310,469M715,354 355,486" />
        <path d="M355,252 715,384M310,269 670,401M265,286 625,418M220,303 580,435M175,320 535,452M130,337 490,469M85,354 445,486" />
      </g>

      <!-- 像素草点 -->
      <g fill="#a3d873" opacity="0.8">
        <rect x="120" y="390" width="14" height="5" />
        <rect x="250" y="430" width="10" height="4" />
        <rect x="520" y="420" width="16" height="5" />
        <rect x="620" y="392" width="10" height="4" />
        <rect x="440" y="452" width="12" height="4" />
      </g>
    </g>

    <!-- 石板小路 -->
    <g class="garden-path">
      <polygon points="190,386 230,400 190,414 150,400" fill="#c9c9c9" />
      <polygon points="150,400 190,414 190,420 150,406" fill="#8f8f8f" />
      <polygon points="230,400 270,414 230,428 190,414" fill="#b5b5b5" />
      <polygon points="190,414 230,428 230,434 190,420" fill="#7f7f7f" />
      <polygon points="270,414 310,428 270,442 230,428" fill="#c9c9c9" />
      <polygon points="230,428 270,442 270,448 230,434" fill="#8f8f8f" />
      <polygon points="310,428 350,442 310,456 270,442" fill="#b5b5b5" />
      <polygon points="270,442 310,456 310,462 270,448" fill="#7f7f7f" />
    </g>

    <!-- Lv.3 背景树 -->
    <g v-if="level >= 3" class="garden-back-trees">
      <g transform="translate(54 208)">
        <rect x="24" y="58" width="16" height="58" fill="#8b5a3c" />
        <rect x="32" y="58" width="8" height="58" fill="#6d442c" />
        <use href="#scene-leaf-block" transform="translate(0 18) scale(.9)" />
        <use href="#scene-leaf-block" transform="translate(28 0) scale(1.05)" />
        <use href="#scene-leaf-block" transform="translate(54 24) scale(.82)" />
      </g>
      <g transform="translate(660 196)">
        <rect x="24" y="62" width="16" height="62" fill="#8b5a3c" />
        <rect x="32" y="62" width="8" height="62" fill="#6d442c" />
        <use href="#scene-leaf-block" transform="translate(0 22) scale(.86)" />
        <use href="#scene-leaf-block" transform="translate(26 2) scale(1.02)" />
        <use href="#scene-leaf-block" transform="translate(52 26) scale(.8)" />
      </g>
    </g>

    <!-- 木屋 -->
    <polygon points="76,346 268,398 366,350 172,298" fill="#356634" opacity="0.16" />
    <g class="garden-house" transform="translate(-6 -30) scale(.86)">
      <polygon points="105,336 318,392 318,488 105,432" fill="#e7d2a5" />
      <polygon points="318,392 428,338 428,434 318,488" fill="#cbb183" />
      <polygon points="215,282 428,338 318,392 105,336" fill="#f1deba" />

      <!-- 墙体像素纹理 -->
      <g fill="#d8c094" opacity="0.55">
        <rect x="126" y="356" width="22" height="4" />
        <rect x="158" y="365" width="34" height="4" />
        <rect x="232" y="386" width="28" height="4" />
        <rect x="348" y="382" width="26" height="4" />
        <rect x="386" y="394" width="22" height="4" />
      </g>

      <!-- 门与门框 -->
      <polygon points="168,392 224,407 224,474 168,459" fill="#5b3822" />
      <polygon points="174,396 218,408 218,467 174,455" fill="#7d4d2c" />
      <rect x="207" y="432" width="5" height="5" fill="#f2c14e" />
      <polygon points="168,392 224,407 224,414 168,399" fill="#8a5a3b" />

      <!-- 窗户 -->
      <polygon points="118,366 166,379 166,410 118,397" fill="#5f4632" />
      <polygon points="122,370 162,381 162,405 122,394" fill="#9fd4e8" />
      <path d="M140,375v27M124,382l36,9" stroke="#dff3fb" stroke-width="3" />
      <polygon points="342,376 392,390 392,422 342,408" fill="#5f4632" />
      <polygon points="347,381 387,392 387,417 347,406" fill="#9fd4e8" />
      <path d="M366,386v28M349,394l34,9" stroke="#dff3fb" stroke-width="3" />

      <!-- 窗台花箱 -->
      <polygon points="114,397 170,412 170,422 114,407" fill="#8a5a3b" />
      <rect x="124" y="398" width="5" height="8" fill="#5fa84a" />
      <rect x="124" y="392" width="5" height="5" fill="#f2a03d" />
      <rect x="142" y="403" width="5" height="8" fill="#5fa84a" />
      <rect x="142" y="397" width="5" height="5" fill="#ef7f8f" />
      <polygon points="338,408 396,424 396,434 338,418" fill="#8a5a3b" />
      <rect x="350" y="409" width="5" height="8" fill="#5fa84a" />
      <rect x="350" y="403" width="5" height="5" fill="#f2a03d" />

      <!-- 烟囱 -->
      <g class="garden-chimney" transform="translate(0 38)">
        <polygon points="352,206 380,215 352,224 324,215" fill="#a86a4c" />
        <polygon points="324,215 352,224 352,266 324,257" fill="#7a4632" />
        <polygon points="352,224 380,215 380,257 352,266" fill="#5f3626" />
        <g fill="#ffffff" opacity="0.55">
          <rect x="360" y="178" width="10" height="10" />
          <rect x="372" y="164" width="8" height="8" />
          <rect x="350" y="152" width="6" height="6" />
        </g>
      </g>

      <!-- 阶梯屋顶 -->
      <g class="garden-roof">
        <polygon points="188,264 442,327 318,383 72,326" fill="#a86945" />
        <polygon points="72,326 318,383 318,399 72,342" fill="#6d3f2b" />
        <polygon points="318,383 442,327 442,343 318,399" fill="#7a4a32" />

        <polygon points="210,244 420,296 318,346 118,296" fill="#b7784e" />
        <polygon points="118,296 318,346 318,360 118,310" fill="#7a4632" />
        <polygon points="318,346 420,296 420,310 318,360" fill="#8a5438" />

        <g stroke="#8a5438" stroke-width="4" opacity="0.35" fill="none">
          <path d="M130,306 330,360M156,296 356,350M182,286 382,340M208,276 408,330" />
        </g>
        <polygon points="72,342 318,399 318,407 72,350" fill="#5f3626" />
        <polygon points="318,399 442,343 442,351 318,407" fill="#5f3626" />
      </g>
    </g>

    <!-- 木栅栏 -->
    <g class="garden-fence">
      <g fill="#8a5a3b">
        <path d="M558 352 742 402 742 416 558 366Z" />
        <path d="M558 380 742 430 742 444 558 394Z" />
      </g>
      <g fill="#6d442c">
        <path d="M558 366 742 416 742 420 558 370Z" />
        <path d="M558 394 742 444 742 448 558 398Z" />
      </g>
      <g transform="translate(570 324)">
        <use href="#scene-post" />
      </g>
      <g transform="translate(620 338)">
        <use href="#scene-post" />
      </g>
      <g transform="translate(670 352)">
        <use href="#scene-post" />
      </g>
      <g transform="translate(720 366)">
        <use href="#scene-post" />
      </g>
      <g>
        <rect x="574" y="316" width="7" height="8" fill="#5fa84a" />
        <rect x="570" y="310" width="7" height="7" fill="#ef7f8f" />
        <rect x="624" y="330" width="7" height="8" fill="#5fa84a" />
        <rect x="620" y="324" width="7" height="7" fill="#f2c14e" />
        <rect x="674" y="344" width="7" height="8" fill="#5fa84a" />
        <rect x="670" y="338" width="7" height="7" fill="#ef7f8f" />
        <rect x="724" y="358" width="7" height="8" fill="#5fa84a" />
        <rect x="720" y="352" width="7" height="7" fill="#f2c14e" />
      </g>
    </g>

    <!-- 方块挂灯 -->
    <g class="garden-lantern" transform="translate(0 52)">
      <rect x="736" y="250" width="8" height="96" fill="#5b4a3e" />
      <rect x="740" y="250" width="4" height="96" fill="#41332b" />
      <polygon points="740,232 764,240 740,248 716,240" fill="#4b4038" />
      <polygon points="716,240 740,248 740,292 716,284" fill="#332c27" />
      <polygon points="740,248 764,240 764,284 740,292" fill="#241f1c" />
      <rect x="724" y="252" width="16" height="24" fill="#f6d27a" />
      <rect x="728" y="256" width="8" height="16" fill="#fff0b0" />
      <rect x="712" y="286" width="56" height="8" fill="#332c27" />
      <g fill="#ffe9a3" opacity="0.2">
        <rect x="704" y="244" width="72" height="56" />
      </g>
    </g>

    <!-- Lv.2 花圃 -->
    <g v-if="level >= 2" class="garden-flower-bed">
      <polygon points="64,408 184,442 142,466 22,432" fill="#98653f" />
      <polygon points="22,432 142,466 142,476 22,442" fill="#7a4c2f" />
      <g>
        <rect x="56" y="418" width="4" height="12" fill="#5fa84a" />
        <rect x="52" y="412" width="7" height="7" fill="#ef7f8f" />
        <rect x="84" y="428" width="4" height="12" fill="#5fa84a" />
        <rect x="80" y="422" width="7" height="7" fill="#f2c14e" />
        <rect x="112" y="438" width="4" height="12" fill="#5fa84a" />
        <rect x="108" y="432" width="7" height="7" fill="#ef7f8f" />
        <rect x="136" y="446" width="4" height="10" fill="#5fa84a" />
        <rect x="132" y="440" width="7" height="7" fill="#f2c14e" />
      </g>
    </g>

    <!-- Lv.4 石墙 -->
    <g v-if="level >= 4" class="garden-stone-wall">
      <polygon points="520,336 596,358 596,382 520,360" fill="#8f8f8f" />
      <polygon points="520,360 596,382 596,390 520,368" fill="#6e6e6e" />
      <g fill="#b5b5b5">
        <rect x="530" y="342" width="18" height="8" />
        <rect x="558" y="350" width="18" height="8" />
        <rect x="540" y="360" width="18" height="8" />
      </g>
    </g>

    <!-- Lv.5 池塘 -->
    <g v-if="level >= 5" class="garden-pond">
      <polygon points="608,456 724,490 664,512 548,478" fill="#64b5d6" />
      <polygon points="608,464 712,494 664,508 560,480" fill="#8bd3e8" />
      <g fill="#dff8ff" opacity="0.7">
        <rect x="612" y="476" width="18" height="4" />
        <rect x="650" y="486" width="22" height="4" />
        <rect x="584" y="482" width="14" height="4" />
      </g>
      <polygon points="548,478 664,512 664,516 548,482" fill="#4b8f68" />
    </g>

    <!-- 前景像素花与草 -->
    <g class="garden-front-flowers">
      <g>
        <rect x="44" y="462" width="4" height="14" fill="#4f8f3f" />
        <rect x="39" y="455" width="8" height="8" fill="#ef7f8f" />
        <rect x="66" y="472" width="4" height="12" fill="#4f8f3f" />
        <rect x="61" y="466" width="8" height="7" fill="#f2c14e" />
        <rect x="90" y="480" width="4" height="10" fill="#4f8f3f" />
        <rect x="85" y="474" width="8" height="7" fill="#f7f2dd" />
      </g>
      <g>
        <rect x="706" y="456" width="4" height="14" fill="#4f8f3f" />
        <rect x="701" y="449" width="8" height="8" fill="#f2c14e" />
        <rect x="734" y="468" width="4" height="12" fill="#4f8f3f" />
        <rect x="729" y="462" width="8" height="7" fill="#ef7f8f" />
        <rect x="758" y="478" width="4" height="10" fill="#4f8f3f" />
        <rect x="753" y="472" width="8" height="7" fill="#f7f2dd" />
      </g>
      <g fill="#4f8f3f">
        <rect x="250" y="470" width="3" height="10" />
        <rect x="262" y="474" width="3" height="8" />
        <rect x="484" y="462" width="3" height="10" />
        <rect x="498" y="468" width="3" height="8" />
      </g>
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
  background: #bfe3ff;
}

.garden-house,
.garden-fence,
.garden-lantern,
.garden-back-trees,
.garden-flower-bed,
.garden-front-flowers {
  filter: drop-shadow(0 6px 0 rgba(56, 78, 43, 0.12));
}
</style>
