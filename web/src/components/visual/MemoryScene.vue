<script setup lang="ts">
/**
 * 知识星图场景 —— 必须作为 <TresCanvas> 的子组件（useLoop 依赖画布上下文）。
 * 仅渲染 <primitive>；逐帧动画直接改 three 对象，零响应式开销。
 * prefers-reduced-motion 用户：不注册逐帧更新，呈现静态星图。
 *
 * 主题适配（v2）：
 *   父组件传入 :theme="..." → watch 热切换 applyTheme()
 */
import { onMounted, onUnmounted, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import { useLoop } from '@tresjs/core'
import { createMemoryNetwork, type ThemeName } from './useMemoryNetwork'

const props = defineProps<{
  paused?: boolean
  theme?: ThemeName
}>()

const isMobile = window.matchMedia('(max-width: 640px)').matches
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const network = createMemoryNetwork({
  nodeCount: isMobile ? 1000 : 2800,
  linkCount: isMobile ? 28 : 90,
  theme: props.theme || 'dark',
})
const group = shallowRef(network.group)

/* 鼠标视差（普通对象，不进响应式系统，避免每帧触发 Vue） */
const pointer = { x: 0, y: 0 }
function onPointerMove(e: PointerEvent) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1
}

const { onBeforeRender, stop, start } = useLoop()

if (!reduced) {
  onBeforeRender((loopCtx: { delta: number; elapsed: number }) => {
    if (props.paused) return
    network.update(loopCtx.delta, loopCtx.elapsed, pointer)
  })
}

/* TresJS v5：pause/resume 已更名为 stop/start（v4→v5 breaking change） */
watch(
  () => props.paused,
  (p) => {
    if (reduced) return
    if (p) stop()
    else start()
  },
)

/* 主题热切换 — 直接改 material，不销毁重建 */
watch(
  () => props.theme,
  (t) => {
    if (t) network.applyTheme(t)
  },
)

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  if (!reduced && props.paused) stop()
})
onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  network.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
