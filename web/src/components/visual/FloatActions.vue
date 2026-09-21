<script setup lang="ts">
/**
 * 右侧悬浮操作组（Language Explorer 右侧悬浮按钮 → BRAINBOT 映射）
 * ✦ 知识星图开关（active 高亮） · ⛶ 全屏切换 · ⓘ 信息（先留空函数）
 */
import { useVisualizerStore } from '../../stores/visualizer'

const viz = useVisualizerStore()

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    /* 用户拒绝或浏览器不支持：静默忽略 */
  }
}

/* 信息按钮先留空接口（TODO：接入「关于 BRAINBOT」浮层） */
function onInfo() {
  /* intentionally empty */
}
</script>

<template>
  <div class="float-actions" role="group" aria-label="页面工具">
    <button
      class="fab"
      :class="{ active: viz.field }"
      type="button"
      :aria-pressed="viz.field"
      :title="viz.field ? '关闭知识星图' : '开启知识星图'"
      @click="viz.toggle('field')"
    >
      ✦
    </button>
    <button class="fab" type="button" title="全屏" @click="toggleFullscreen">⛶</button>
    <button class="fab" type="button" title="关于" @click="onInfo">ⓘ</button>
  </div>
</template>

<style scoped>
.float-actions {
  position: fixed;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: var(--z-sticky);
}
.fab {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  background: var(--bb-bg-elevated);
  backdrop-filter: blur(var(--bb-card-blur));
  border: 1px solid var(--bb-line-strong);
  border-radius: 0;
  color: var(--bb-muted);
  font-size: 15px;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: color 0.25s, border-color 0.25s, box-shadow 0.25s;
}
.fab:hover {
  color: var(--bb-text);
  border-color: var(--bb-accent-border);
}
.fab.active {
  color: var(--bb-text);
  border-color: var(--bb-accent-border);
  box-shadow: 0 0 18px var(--bb-accent-glow);
}
@media (max-width: 640px) {
  .float-actions {
    right: 12px;
  }
  .fab {
    width: 34px;
    height: 34px;
    font-size: 13px;
  }
}
</style>
