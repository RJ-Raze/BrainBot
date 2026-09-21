<template>
  <section class="landing">
    <!-- ===== 增强层 · 知识星图背景（悬浮按钮 ✦ 可关闭） ===== -->
    <KnowledgeField v-if="viz.field" />

    <!-- ===== 顶部导航（功能下拉 / 搜索 / 环境音） ===== -->
    <SiteNav />

    <!-- ===== Hero：标题与入口分栏 ===== -->
    <section class="hero">
      <div class="hero-inner">
        <p class="eyebrow">科研协作智能平台 / 2026</p>
        <h1 class="hero-title">把团队的讨论<br><span class="dim">沉淀为记忆。</span></h1>
        <div class="hero-actions">
        <p class="hero-sub">对话、共享记忆与任务，<br>一个都不会丢失。</p>
        <button class="hero-cta" @click="enter">
          {{ authed ? '进入工作台' : '进入平台' }} <i class="cta-arrow">→</i>
        </button>
        <RouterLink class="film-link" to="/film"><span aria-hidden="true">▷</span> 观看 45 秒演示</RouterLink>
        <p class="sound-hint">开启声音体验更佳</p>
        </div>
      </div>
    </section>

    <!-- ===== 极简页脚（导航「关于」锚点） ===== -->
    <footer id="about" class="foot">
      <span class="label">BRAINBOT © 2026</span>
      <span class="label">knowledge, in motion.</span>
    </footer>

    <!-- ===== 增强层模块（各自可经 visualizer store 开关） ===== -->
    <FloatActions v-if="viz.float" />
    <StatsWidget v-if="viz.stats" />
    <SearchOverlay />
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router'
// —— 视觉增强层（Language Explorer 融合，均可开关 / 整体移除）——
import { useVisualizerStore } from '../stores/visualizer'
import SiteNav from '../components/SiteNav.vue'
import KnowledgeField from '../components/visual/KnowledgeField.vue'
import FloatActions from '../components/visual/FloatActions.vue'
import StatsWidget from '../components/visual/StatsWidget.vue'
import SearchOverlay from '../components/visual/SearchOverlay.vue'

const router = useRouter()
const viz = useVisualizerStore()

// 公开首页不请求任何业务接口；登录态仅用于决定入口按钮去向
const authed = !!localStorage.getItem('token')

function enter() {
  router.push(authed ? '/home' : '/login')
}
</script>

<style scoped>
/* ============================================
   BrainBot · 公开首页（登录前）
   标题与入口分栏 · 紧凑排版
   ============================================ */

.label, .eyebrow, .hero-scroll {
  font-family: var(--bb-font-mono);
}
.landing {
  position: absolute; inset: 0;
  background: transparent;
  color: var(--bb-text);
  overflow-x: hidden; overflow-y: auto;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* ============ Hero · 主视觉 ============ */
.hero {
  position: relative; z-index: 1;
  min-height: min(760px, calc(100dvh - 82px));
  padding: 132px clamp(24px, 7vw, 100px) 64px;
  display: flex; align-items: center;
  animation: hero-in .8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes hero-in {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: none; }
}
.hero-inner {
  width: 100%;
  max-width: 1240px;
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(240px, 1fr);
  column-gap: clamp(32px, 5vw, 80px);
  align-items: end;
}
.eyebrow {
  font-size: var(--bb-fs-sm); letter-spacing: 0.08em; color: var(--bb-dim);
  grid-column: 1 / -1;
  margin: 0 0 28px;
}
.hero-title {
  font-size: clamp(48px, 5.8vw, 88px);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--bb-text);
  margin: 0;
}
.hero-title .dim {
  color: var(--bb-text-3); font-weight: 300;
}
.hero-sub {
  font-size: 15px; line-height: 1.95; color: var(--bb-muted);
  margin: 0 0 24px;
  max-width: 400px;
}
.hero-cta {
  display: inline-flex; align-items: center; gap: 12px;
  width: fit-content;
  border: 0;
  background: transparent; color: var(--bb-text);
  font-size: clamp(26px, 2.3vw, 34px); font-weight: 600;
  min-height: 48px; padding: 8px 0;
  cursor: pointer; letter-spacing: 0.02em;
  text-decoration: underline; text-decoration-color: transparent;
  text-underline-offset: 8px;
  transition: color .2s, text-decoration-color .2s;
}
.hero-cta:hover, .hero-cta:focus-visible {
  color: var(--bb-accent);
  text-decoration-color: currentColor;
}
.hero-cta:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 6px; }
.cta-arrow {
  font-style: normal; font-size: 26px;
  transition: transform .2s;
}
.hero-cta:hover .cta-arrow { transform: translateX(6px); }

/* 页脚 */
.foot {
  position: relative; z-index: 1;
  display: flex; justify-content: space-between; align-items: center;
  padding: 32px clamp(48px, 7vw, 100px);
  border-top: 1px solid var(--bb-line);
}
.foot .label { font-size: var(--bb-fs-xs); letter-spacing: 0.1em; color: var(--bb-dim); }

/* ============ 视觉增强层 ============ */
/* 层级：星图 z-0 → 内容 z-1 → 统计卡 z-30 → 悬浮件 z-40 → 搜索 z-60 */
.hero-title { text-shadow: 0 0 32px var(--bb-title-glow, transparent); }

/* 声音提示行 */
.film-link {
  display: flex; align-items: center; gap: 9px; width: fit-content;
  min-height: 44px; margin-top: 12px; color: var(--bb-muted);
  font-size: 14px; text-decoration: none;
}
.film-link:hover { color: var(--bb-accent); }
.film-link:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 4px; }
.film-link span { font-size: 20px; }
.sound-hint {
  margin: 20px 0 0;
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs); letter-spacing: 0.1em; color: var(--bb-text-3);
}

/* ============ 响应式 ============ */
@media (max-width: 900px) {
  .hero-inner { grid-template-columns: 1fr; gap: 28px; }
  .eyebrow { margin: 0; }
  .hero-sub { margin-bottom: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .hero { animation: none; }
  .hero-cta, .cta-arrow { transition: none; }
  .hero-cta:hover .cta-arrow { transform: none; }
}
@media (max-width: 640px) {
  .hero { min-height: auto; padding: 116px 24px 52px; }
  .hero-title { font-size: clamp(32px, 8.5vw, 48px); letter-spacing: -0.03em; }
  .foot { padding: 24px; gap: 16px; flex-wrap: wrap; }
}
</style>
