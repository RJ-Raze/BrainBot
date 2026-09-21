<script setup>
/**
 * 全局站点导航（公开首页 / 登录后工作台共用）
 * - 「功能」为点击切换的下拉面板：承载原首页 2×2 功能卡片
 * - 点击外部 / Esc / 选择功能后自动收起；窄屏自动变全宽面板
 */
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { setToken } from '../api'
import AmbientToggle from './visual/AmbientToggle.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'

defineProps({
  user: { type: Object, default: null },
})

const router = useRouter()
const toast = inject('toast')

const navEl = ref(null)
const menuOpen = ref(false)

// 原首页右侧 2×2 功能矩阵 —— 内容与描述原样迁移
const features = [
  {
    name: 'AI 协作',
    desc: '以你的角色身份，带着项目记忆推进。',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 2a7 7 0 0 1 7 7c0 2-1 3-1 5v3a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-3c0-2-1-3-1-5a7 7 0 0 1 7-7Z"/><circle cx="9" cy="11" r="1" fill="currentColor"/><circle cx="15" cy="11" r="1" fill="currentColor"/></svg>',
    route: '/setup',
  },
  {
    name: '共享记忆',
    desc: '团队共识的沉淀池，全员角色的上下文。',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z"/><path d="M8 12h8M8 16h5"/></svg>',
    route: null,
  },
  {
    name: '任务看板',
    desc: '所有人的进展，一眼看全，实时同步。',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="11" height="4" rx="1"/><rect x="3" y="16" width="14" height="4" rx="1"/></svg>',
    route: null,
  },
  {
    name: '总文档',
    desc: '从共享记忆自动聚合，也可手动编辑。',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 3h10l4 4v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 12h8M8 16h6"/></svg>',
    route: null,
  },
]

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function goEntry() {
  menuOpen.value = false
  router.push('/')
}

function scrollAbout() {
  menuOpen.value = false
  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onFeature(f) {
  menuOpen.value = false
  if (f.route) {
    router.push(f.route) // 未登录会被路由守卫引导至 /login
  } else {
    // 共享记忆 / 看板 / 总文档均为具体项目内功能，需先进入一个项目
    toast?.('请先创建或进入一个项目后再使用该功能')
  }
}

function logout() {
  setToken('')
  router.push('/')
}

function onDocPointerDown(e) {
  if (menuOpen.value && navEl.value && !navEl.value.contains(e.target)) {
    menuOpen.value = false
  }
}
function onDocKeydown(e) {
  if (e.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <header ref="navEl" class="top">
    <button type="button" class="brand" @click="goEntry">BRAINBOT</button>

    <nav class="top-nav">
      <a class="top-indicator" href="/" @click.prevent="goEntry">01 / 入口</a>

      <!-- 功能 · 点击下拉面板 -->
      <div class="nav-menu">
        <button
          class="nav-trigger"
          type="button"
          :class="{ active: menuOpen }"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
        >
          功能
        </button>

        <Transition name="menu-pop">
          <div v-if="menuOpen" class="func-panel" role="menu" @pointerdown.stop>
            <p class="func-panel-label">平台功能</p>
            <button
              v-for="f in features"
              :key="f.name"
              type="button"
              class="feat-card"
              role="menuitem"
              @click="onFeature(f)"
            >
              <span class="feat-icon" v-html="f.icon"></span>
              <span class="feat-info">
                <b>{{ f.name }}</b>
                <small>{{ f.desc }}</small>
              </span>
              <i class="feat-arrow">→</i>
            </button>
          </div>
        </Transition>
      </div>

      <a class="nav-link" href="#about" @click.prevent="scrollAbout">关于</a>

      <AmbientToggle />

      <ThemeSwitcher variant="site-nav" />

      <template v-if="user">
        <span class="top-divider">·</span>
        <span class="top-me">{{ user.display_name || user.username }}</span>
        <button class="top-logout" type="button" @click="logout">退出</button>
      </template>
    </nav>
  </header>
</template>

<style scoped>
/* ============ 顶部导航（样式与原落地页一致）============ */
.top {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; justify-content: space-between; align-items: center;
  height: 72px;
  padding: 0 clamp(48px, 7vw, 100px);
  background: var(--bb-nav-bg, var(--bb-bg-elevated));
  border-bottom: 1px solid var(--bb-line);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: background 0.25s ease, border-color 0.25s ease;
}
.brand {
  border: 0; background: transparent; cursor: pointer;
  font-family: var(--bb-font-mono);
  font-size: 13px; letter-spacing: 0.06em; color: var(--bb-text);
}
.top-nav {
  display: flex; align-items: center; gap: 20px;
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs); letter-spacing: 0.05em; color: var(--bb-dim);
}
.top-nav a, .nav-link {
  transition: color 0.25s; text-decoration: none; cursor: pointer;
  padding: 8px 4px; /* WCAG 2.5.8：扩大触控目标 ≥24px */
}
.top-nav a:hover, .nav-link:hover { color: var(--bb-text); }
.top-indicator {
  padding: 6px 14px; border: 1px solid var(--bb-line-strong);
  border-radius: 999px; color: var(--bb-muted);
}
.top-divider { color: var(--bb-line-strong); }
.top-me { color: var(--bb-muted); font-size: var(--bb-fs-xs); letter-spacing: 0.05em; }
.top-logout {
  border: 0; background: transparent; cursor: pointer;
  color: var(--bb-dim); font-size: var(--bb-fs-xs); padding: 8px 4px; letter-spacing: 0.05em;
  font-family: inherit; transition: color 0.25s;
}
.top-logout:hover { color: var(--bb-text); }
/* ============ 「功能」触发器 + 下拉面板 ============ */
.nav-menu { position: relative; }
.nav-trigger {
  position: relative;
  border: 0; background: transparent; padding: 8px 4px;
  font-family: inherit; font-size: var(--bb-fs-xs); letter-spacing: 0.05em;
  color: var(--bb-dim); cursor: pointer;
  transition: color 0.25s;
}
.nav-trigger:hover { color: var(--bb-text); }
.nav-trigger.active { color: var(--bb-text); }
.nav-trigger.active::after {
  content: '';
  position: absolute; left: 0; right: 0; bottom: -8px;
  height: 1px; background: var(--bb-text);
}

.func-panel {
  position: absolute;
  top: calc(100% + 20px);
  right: -60px;
  width: 580px;
  padding: 18px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  background: var(--bb-bg-elevated);
  border: 1px solid var(--bb-line);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: var(--bb-shadow-card);
  z-index: var(--z-dropdown);
}
.func-panel-label {
  grid-column: 1 / -1;
  margin: 2px 2px 6px;
  font-size: var(--bb-fs-xs); letter-spacing: 0.08em; color: var(--bb-dim);
}
.feat-card {
  position: relative;
  display: flex; flex-direction: column; justify-content: space-between;
  gap: 20px;
  min-height: 132px;
  padding: 22px 22px 20px;
  text-align: left;
  border: 1px solid var(--bb-line);
  background: var(--bb-card);
  cursor: pointer;
  transition: border-color 0.3s, background 0.3s, transform 0.3s, box-shadow 0.3s;
}
.feat-card:hover {
  border-color: var(--bb-accent-border);
  background: var(--bb-soft);
  transform: translateY(-2px);
  box-shadow: 0 0 36px var(--bb-accent-glow), inset 0 0 26px var(--bb-accent-tint);
}
.feat-icon { display: flex; color: var(--bb-dim); transition: color 0.3s; }
.feat-card:hover .feat-icon { color: var(--bb-text); }
.feat-info b {
  display: block;
  font-size: var(--bb-fs-md); font-weight: 500;
  color: var(--bb-text); letter-spacing: -0.01em;
  margin-bottom: 6px;
}
.feat-info small {
  display: block;
  font-size: var(--bb-fs-xs); color: var(--bb-muted); line-height: 1.6;
}
.feat-arrow {
  position: absolute; top: 18px; right: 18px;
  font-style: normal; font-size: 14px; color: var(--bb-text-3);
  opacity: 0; transform: translateX(-4px);
  transition: opacity 0.3s, transform 0.3s, color 0.3s;
}
.feat-card:hover .feat-arrow {
  opacity: 1; transform: none; color: var(--bb-text);
}

/* 弹出动效 — iOS 下拉：轻微上移 + 微回弹 */
.menu-pop-enter-active { transition: opacity var(--bb-dur-base) var(--bb-ease-out), transform var(--bb-dur-base) var(--bb-ease-spring); }
.menu-pop-leave-active { transition: opacity var(--bb-dur-fast) var(--bb-ease-out), transform var(--bb-dur-fast) var(--bb-ease-out); }
.menu-pop-enter-from, .menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

/* ============ 响应式 ============ */
@media (max-width: 760px) {
  .top { padding: 0 24px; }
  .top-nav { gap: 20px; }
  .func-panel {
    position: fixed;
    top: 64px; left: 12px; right: 12px;
    width: auto;
  }
}
@media (max-width: 480px) {
  .top-nav { gap: 16px; }
  .feat-card { min-height: 118px; padding: 18px; gap: 14px; }
}
</style>
