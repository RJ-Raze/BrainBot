<template>
  <section class="home">
    <!-- ===== 增强层 · 知识星图背景 ===== -->
    <KnowledgeField v-if="viz.field" class="home-field" />

    <!-- ===== 顶部导航（含用户名 / 退出） ===== -->
    <SiteNav :user="user" />

    <!-- ===== 团队入口（图1） ===== -->
    <section class="block entry-block">
      <p class="label block-label">团队入口</p>
      <div class="block-grid">
        <h2 class="title">看见团队的<br><span class="dim">思考方式。</span></h2>
        <p class="sub block-sub">AI 加入每一次讨论，把有价值的结论自动晋升为共享记忆；任务在看板上流转，总文档从记忆中生长出来。</p>
      </div>

      <div class="entries">
        <button class="entry" @click="router.push('/setup')">
          <span class="entry-text">
            <span class="entry-name">创建科研团队</span>
            <small>三步初始化你的知识空间</small>
          </span>
        </button>
        <button class="entry" @click="router.push('/join')">
          <span class="entry-text">
            <span class="entry-name">加入我的团队</span>
            <small>使用邀请码进入已有项目</small>
          </span>
        </button>
      </div>
    </section>

    <!-- ===== 我的项目 ===== -->
    <section class="block">
      <p class="label block-label">我的项目</p>
      <div v-if="loading" class="state">
        <p class="bb-progress" role="status" aria-live="polite" aria-atomic="true">
          <span class="bb-progress-mark" aria-hidden="true">⌁</span>
          <span class="bb-progress-copy">正在同步我的项目</span>
        </p>
      </div>
      <div v-else-if="loadError" class="state" role="alert">
        <b>项目列表暂时无法加载</b>
        <small>{{ loadError }}</small>
        <button class="bb-btn small" @click="load">重新加载</button>
      </div>
      <template v-else-if="projects.length">
        <div class="proj-list">
          <div v-for="p in projects" :key="p.id" class="proj-row" @click="openProject(p)">
            <div class="proj-main">
              <div class="proj-name">
                {{ p.name }}
                <span class="bb-tag" :class="p.status === 1 ? 'green' : p.status === 0 ? '' : 'red'">
                  {{ p.status === 0 ? '初始化中' : p.status === 1 ? '运行中' : '已归档' }}
                </span>
                <span v-if="p.is_owner" class="bb-tag green">创立人</span>
              </div>
              <p class="proj-desc">{{ p.description || '暂无描述' }}</p>
            </div>
            <span class="arrow">{{ p.status === 0 && p.is_owner ? '继续初始化 →' : '进入 →' }}</span>
          </div>
        </div>
      </template>
      <div v-else class="state">
        <b>还没有项目</b>
        <small>从「创建科研团队」开始，或使用邀请码加入已有团队。</small>
      </div>
    </section>

    <footer id="about" class="foot">
      <span class="label">BRAINBOT © 2026</span>
      <span class="label">knowledge, in motion.</span>
    </footer>

    <!-- ===== 增强层模块 ===== -->
    <SearchOverlay />
  </section>
</template>

<script setup>
import { inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { useVisualizerStore } from '../stores/visualizer'
import SiteNav from '../components/SiteNav.vue'
import KnowledgeField from '../components/visual/KnowledgeField.vue'
import SearchOverlay from '../components/visual/SearchOverlay.vue'

const router = useRouter()
const toast = inject('toast')
const viz = useVisualizerStore()

const user = ref(null)
const projects = ref([])
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    user.value = await api('GET', '/api/v1/auth/me')
    const data = await api('GET', '/api/v1/projects')
    projects.value = data.items
  } catch (e) {
    loadError.value = e.message || '请检查服务与登录状态后重试。'
    toast(loadError.value, true)
  } finally { loading.value = false }
}

function openProject(p) {
  // 初始化中的项目，创立人回到草案页；其余进工作台
  if (p.status === 0 && p.is_owner) router.push(`/proposal/${p.id}`)
  else router.push(`/workspace/${p.id}`)
}

onMounted(load)
</script>

<style scoped>
/* ============================================
   BrainBot · 登录后团队工作台
   ============================================ */

.label, .block-label {
  font-family: var(--bb-font-mono);
}
.home {
  position: absolute; inset: 0;
  background: transparent;
  color: var(--bb-text);
  overflow-x: hidden; overflow-y: auto;
}

/* ============ 章节块 ============ */
.block {
  position: relative; z-index: 1;
  padding: 48px clamp(24px, 7vw, 100px) 56px;
  border-top: 1px solid var(--bb-line);
}
.entry-block {
  /* 首屏留出固定导航高度 */
  padding-top: clamp(112px, 14vh, 152px);
}
.block-label { display: block; margin: 0 0 28px; }
.block .label {
  font-size: var(--bb-fs-xs); letter-spacing: 0.08em; color: var(--bb-dim);
}
.block-grid {
  display: grid; gap: 20px; max-width: 760px;
}
.block .title {
  font-size: clamp(36px, 4.2vw, 62px);
  font-weight: 500; line-height: 1.15; letter-spacing: -0.01em;
  color: var(--bb-text); margin: 0;
  text-shadow: 0 0 32px var(--bb-title-glow, transparent);
}
.block .title .dim { color: var(--bb-dim); font-weight: 300; }
.block .sub {
  font-size: 15px; line-height: 1.8; color: var(--bb-muted);
  max-width: 600px; margin: 0;
}

/* 两个独立、同级的团队入口。 */
.home-field { opacity: .2; }
.entries {
  margin-top: 32px; max-width: 960px;
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.entry {
  display: flex; align-items: center;
  border: 1px solid var(--bb-line-strong);
  border-radius: var(--bb-radius-card);
  background: var(--bb-card); box-shadow: var(--bb-shadow-card);
  text-align: left; cursor: pointer; padding: 30px 32px;
  color: var(--bb-text); min-height: 148px;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.entry-text { display: grid; gap: 12px; min-width: 0; }
.entry-name { font-size: 24px; font-weight: 600; letter-spacing: -.02em; }
.entry small { font-size: 14px; line-height: 1.6; color: var(--bb-muted); }
.entry:hover {
  border-color: var(--bb-accent); transform: translateY(-2px);
  box-shadow: var(--bb-shadow-card-hover);
}
.entry:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 4px; }

/* 项目列表 */
.state {
  display: grid; align-content: start; justify-items: start;
  gap: 10px; min-height: 80px; color: var(--bb-dim); font-size: 13px;
}
.state b { color: var(--bb-text); font-size: 16px; font-weight: 500; letter-spacing: -0.01em; }
.state small { color: var(--bb-dim); }
.proj-list {
  display: grid; max-width: 960px; gap: 14px;
}
.proj-row {
  display: flex; align-items: center; justify-content: space-between;
  border: 1px solid var(--bb-card-border, transparent);
  border-radius: 12px;
  background: var(--bb-card);
  padding: 26px 30px;
  cursor: pointer;
  box-shadow: var(--bb-shadow-card);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease,
    background-color 0.3s ease, color 0.3s ease;
}
.proj-row:hover {
  transform: translateY(-2px);
  box-shadow: var(--bb-shadow-card-hover, var(--bb-shadow-card));
  border-color: var(--bb-accent-border);
}
.proj-name {
  font-size: 18px; font-weight: 400;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  letter-spacing: -0.01em; color: var(--bb-text);
}
.proj-desc { color: var(--bb-dim); font-size: 12px; margin-top: 8px; max-width: 620px; }
.arrow {
  color: var(--bb-dim); font-size: 13px; flex-shrink: 0; margin-left: 16px;
  font-family: 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.10em;
  transition: color 0.25s, transform 0.25s;
}
.proj-row:hover .arrow { color: var(--bb-text); transform: translateX(6px); }

/* 页脚 — 独立于 section，间距自控 */
.foot {
  position: relative; z-index: 1;
  display: flex; justify-content: space-between; align-items: center;
  padding: 28px clamp(48px, 7vw, 100px) 48px;
  border-top: 1px solid var(--bb-line);
}
.foot .label { font-size: var(--bb-fs-xs); letter-spacing: 0.08em; color: var(--bb-dim); }

/* ============ 响应式 ============ */
@media (max-width: 1024px) {
  .block-grid { flex-direction: column; align-items: flex-start; gap: 28px; }
}
@media (max-width: 640px) {
  .block { padding: 36px 24px 40px; }
  .entry-block { padding-top: 112px; }
  .entries { grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
  .entry { padding: 24px; min-height: 128px; }
  .proj-row { padding: 20px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .entry { transition: none; }
  .entry:hover { transform: none; }
}
</style>
