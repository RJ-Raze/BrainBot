<script setup lang="ts">
/**
 * 知识星图背景层（Language Explorer「3D 粒子」→ BRAINBOT「记忆网络」映射）
 *
 * 追加式增强层：absolute 覆盖在 hero 背景，pointer-events:none，
 * 不侵入任何现有 DOM；经 visualizer store 可整体关闭/移除。
 * 性能：DPR 钳制 [1,2]；离屏（IntersectionObserver）与标签页隐藏时自动暂停。
 *
 * 主题适配（与主题解耦 v3）：
 *   dark  → 保留星空（clear-color=#0a0a0a，粒子自发光#f5f5f7，normal 混合）
 *   light → 画布 multiply 乘法混合：近白清屏色与底层弥散光渐变融合后近乎透明，
 *           粒子保留为点缀，不篡改底色
 *   blue  → 同 light，multiply 融合，界面蓝粒子作为弥散光之上的点缀
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import MemoryScene from './MemoryScene.vue'
import { useThemeStore } from '../../stores/theme'

const root = ref<HTMLElement | null>(null)
const inView = ref(true)
const tabHidden = ref(document.hidden)
const themeStore = useThemeStore()

/** 主题对应的画布清屏色 — three.js 每帧重绘时用 */
const clearColor = computed(() => {
  switch (themeStore.theme) {
    case 'light': return '#F9FAFB'
    case 'blue':  return '#F4F7FF'
    default:      return '#0a0a0a' // dark
  }
})

const paused = computed(() => !inView.value || tabHidden.value)

let io: IntersectionObserver | null = null
function onVisibility() {
  tabHidden.value = document.hidden
}

onMounted(() => {
  io = new IntersectionObserver(
    (entries) => {
      inView.value = entries[0]?.isIntersecting ?? true
    },
    { threshold: 0.02 },
  )
  if (root.value) io.observe(root.value)
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  io?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div
    ref="root"
    class="knowledge-field"
    :class="{ blended: themeStore.theme !== 'dark' }"
    aria-hidden="true"
  >
    <TresCanvas :dpr="[1, 2]" :clear-color="clearColor">
      <TresPerspectiveCamera :position="[0, 0, 7]" :fov="50" />
      <MemoryScene :paused="paused" :theme="themeStore.theme" />
    </TresCanvas>
  </div>
</template>

<style scoped>
.knowledge-field {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  /* 缓冲主题切换时 clear-color/mix-blend-mode 的一次性跳变 */
  transition: opacity 0.3s ease;
}
.knowledge-field :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
/* 星空与主题解耦：light/blue 下乘法混合 —
   近白清屏色（#F9FAFB/#F4F7FF）与页面弥散光渐变相乘后近乎透明，
   星空粒子保留为底层点缀，不再用纯色画布篡改主题底色 */
.knowledge-field.blended {
  mix-blend-mode: multiply;
}
@media (max-width: 640px) {
  .knowledge-field {
    opacity: 0.7;
  }
}
</style>
