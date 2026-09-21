<template>
  <div class="app-root">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <div v-if="toast.text" class="bb-toast" :class="{ error: toast.isError }">{{ toast.text }}</div>
  </div>
</template>

<script setup>
import { provide, reactive } from 'vue'

const toast = reactive({ text: '', isError: false })
let timer = null
function showToast(text, isError = false) {
  toast.text = text
  toast.isError = isError
  clearTimeout(timer)
  timer = setTimeout(() => { toast.text = '' }, 2400)
}
provide('toast', showToast)
</script>

<style>
/* ============ 全局根容器 — 分层背景架构 ============ */
.app-root {
  position: relative;
  /* z-index:0 建立层叠上下文，让渐变层 ::before 垫在内容之下 */
  z-index: 0;
  min-height: 100vh;
  background-color: var(--bb-bg-color);
  color: var(--bb-text);
  transition: background-color 0.3s ease, color 0.3s ease;
  overflow-x: hidden;
}
/* 弥散光渐变层 — 固定定位，随主题以 opacity 交叉淡化（blue=1 / 其余=0）
   渐变无法被 transition 插值，改用 opacity 过渡实现任意主题组合切换零跳变 */
.app-root::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--bb-bg-image);
  opacity: var(--bb-bg-opacity, 0);
  transition: opacity 0.3s ease;
}

/* 页面切换动画（全站唯一的一套切页动效，iOS 风格缓动） */
.page-enter-active {
  transition: opacity var(--bb-dur-slow) var(--bb-ease-smooth),
    transform var(--bb-dur-slow) var(--bb-ease-smooth);
}
.page-leave-active {
  transition: opacity var(--bb-dur-quick) var(--bb-ease-out),
    transform var(--bb-dur-quick) var(--bb-ease-out);
}
.page-enter-from { opacity: 0; transform: translateY(14px); }
.page-leave-to { opacity: 0; transform: translateY(-8px) scale(0.99); }

/* Toast（全站唯一的一套 toast 样式） */
.bb-toast {
  position: fixed; bottom: 28px; left: 50%;
  transform: translateX(-50%);
  padding: 10px 22px;
  border-radius: 999px;
  font-size: var(--bb-fs-sm); letter-spacing: 0.06em;
  background: var(--bb-bg-elevated, var(--bb-soft));
  border: 1px solid var(--bb-line-strong);
  color: var(--bb-text);
  box-shadow: var(--bb-shadow-card);
  z-index: var(--z-toast);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: rise 0.3s both;
}
.bb-toast.error {
  border-color: var(--bb-danger);
  color: var(--bb-danger);
}
</style>
