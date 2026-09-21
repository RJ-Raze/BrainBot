<script setup lang="ts">
/**
 * 环境音开关（导航右侧，等宽小字，风格与导航链接一致）
 * 状态持久化于 visualizer store；启动失败自动回退。
 */
import { watch } from 'vue'
import { useVisualizerStore } from '../../stores/visualizer'
import { playAmbient, stopAmbient } from './useAmbient'

const viz = useVisualizerStore()

watch(
  () => viz.ambient,
  (on) => {
    if (on) {
      if (!playAmbient()) viz.toggle('ambient')
    } else {
      stopAmbient()
    }
  },
)
</script>

<template>
  <button
    class="ambient-toggle"
    type="button"
    :aria-pressed="viz.ambient"
    :title="viz.ambient ? '关闭环境音' : '开启环境音'"
    @click="viz.toggle('ambient')"
  >
    SOUND {{ viz.ambient ? 'ON' : 'OFF' }}
  </button>
</template>

<style scoped>
.ambient-toggle {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 8px 4px;
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.05em;
  color: var(--bb-dim);
  transition: color 0.25s;
}
.ambient-toggle:hover {
  color: var(--bb-text);
}
.ambient-toggle[aria-pressed='true'] {
  color: var(--bb-text);
}
@media (max-width: 640px) {
  .ambient-toggle {
    display: none;
  }
}
</style>
