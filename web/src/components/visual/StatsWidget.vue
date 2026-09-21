<script setup lang="ts">
/**
 * 右下统计卡（Language Explorer「World Overview」→ BRAINBOT 语义映射）
 * 记忆条目 / 协作人数 / 任务 / 文档 —— 绝无 Languages 7K、Population 8B。
 * 无后端时展示演示数据并明确标注「演示」；接入后端后替换数据源即可。
 * 移动端隐藏（性能要求）。
 */
import { useVisualizerStore } from '../../stores/visualizer'

const viz = useVisualizerStore()

/* 演示数据（占位）：不做任何真实统计断言 — 数字带 ~ 前缀，防止被误认为真实统计 */
const stats = [
  { label: '记忆条目', value: '~1,284' },
  { label: '协作人数', value: '~12' },
  { label: '任务', value: '~47' },
  { label: '文档', value: '~9' },
]
</script>

<template>
  <aside class="stats-widget" aria-label="平台概览（演示数据，非真实统计）">
    <p class="stats-title">平台概览</p>
    <dl>
      <div v-for="s in stats" :key="s.label" class="stats-row">
        <dt>{{ s.label }}</dt>
        <dd>{{ s.value }}</dd>
      </div>
    </dl>
    <p class="stats-note">演示数据 · 非真实统计</p>
  </aside>
</template>

<style scoped>
.stats-widget {
  position: fixed;
  right: 32px;
  bottom: 32px;
  z-index: var(--z-dropdown);
  text-align: right;
  font-family: var(--bb-font-mono);
  pointer-events: none;
  animation: stats-in 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.4s both;
}
@keyframes stats-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.stats-title {
  margin: 0 0 10px;
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.08em;
  color: var(--bb-muted);
}
.stats-row {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  padding: 2px 0;
}
.stats-row dt {
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.06em;
  color: var(--bb-dim);
}
.stats-row dd {
  margin: 0;
  min-width: 42px;
  font-size: var(--bb-fs-xs);
  color: var(--bb-text);
}
.stats-note {
  margin: 10px 0 0;
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.08em;
  color: var(--bb-text-3);
}
@media (max-width: 900px) {
  .stats-widget {
    display: none;
  }
}
</style>
