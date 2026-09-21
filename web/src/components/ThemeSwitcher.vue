<template>
  <button
    type="button"
    class="theme-switch"
    :class="variant"
    :data-current="theme"
    :title="`主题：${labelMap[theme]}（点击切换）`"
    :aria-label="`切换主题，当前 ${labelMap[theme]}`"
    @click="cycle"
  >
    <span class="ts-dots">
      <i class="d1"></i><i class="d2"></i><i class="d3"></i>
    </span>
    <span v-if="variant === 'inline'" class="ts-label">{{ labelMap[theme] }}</span>
  </button>
</template>

<script setup>
import { useThemeStore } from '../stores/theme'

defineProps({
  variant: { type: String, default: 'icon' }, // 'icon' | 'inline'
})

const LABEL = { dark: '深色', light: '浅色', blue: '蓝白' }
const store = useThemeStore()
const theme = store.theme
const cycle = () => store.cycleTheme()
const labelMap = LABEL
</script>

<style scoped>
.theme-switch {
  border: 1px solid var(--bb-line-strong);
  border-radius: var(--bb-radius-control);
  background: var(--bb-soft);
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 0.2s;
  padding: 5px 8px;
}
.theme-switch:hover {
  border-color: var(--bb-accent-border);
  background: var(--bb-accent-tint);
}
.theme-switch.inline { padding: 4px 10px; border-radius: 999px; }
.ts-dots { display: flex; gap: 3px; padding: 2px 3px; border-radius: 999px; background: var(--bb-icon-tile); }
.ts-dots i {
  width: 5px; height: 5px; border-radius: 50%;
  display: inline-block; transition: opacity 0.2s;
}
/* 指示点颜色固定映射三主题：用户可预知切换结果；当前主题对应的点变暗 */
.ts-dots .d1 { background: #0a0a0a; }        /* dark */
.ts-dots .d2 { background: #5F86FF; }       /* light */
.ts-dots .d3 { background: #0A2540; }       /* blue */
.theme-switch[data-current='dark'] .d1,
.theme-switch[data-current='light'] .d2,
.theme-switch[data-current='blue'] .d3 { opacity: 0.3; }
.ts-label {
  font-size: var(--bb-fs-xs); color: var(--bb-muted);
  letter-spacing: 0.05em;
  font-family: var(--bb-font-mono);
}
.theme-switch:hover .ts-label { color: var(--bb-text); }

/* SiteNav 内联变体：与导航栏风格统一（monospace） */
.theme-switch.site-nav {
  border: 0; background: transparent; border-radius: 0; padding: 8px 4px;
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs); letter-spacing: 0.05em;
  color: var(--bb-dim);
}
.theme-switch.site-nav:hover { color: var(--bb-text); background: transparent; border-color: transparent; }
.theme-switch.site-nav .ts-dots i { width: 6px; height: 6px; }
.theme-switch.site-nav .ts-label { font-size: var(--bb-fs-xs); letter-spacing: 0.05em; color: inherit; }
</style>
