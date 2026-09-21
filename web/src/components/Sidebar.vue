<template>
  <aside class="sidebar">
    <p class="sidebar-brand">协作平台</p>
    <div class="project-switch" @click="$emit('back')" style="cursor: pointer;">
      <span class="dot"></span>
      <b>{{ projectName }}</b>
      <small>{{ subtitle }}</small>
    </div>
    <nav>
      <template v-for="item in navItems" :key="item.key">
        <p v-if="item.section" class="nav-section">{{ item.section }}</p>
        <button
          class="nav-btn"
          :class="{ active: activeKey === item.key }"
          @click="$emit('navigate', item.key)"
        >
          {{ item.label }}
          <span v-if="item.badge !== undefined" class="badge">{{ item.badge }}</span>
        </button>
      </template>
    </nav>
    <div class="sidebar-bottom">
      <div class="avatar">{{ avatarChar }}</div>
      <p>{{ userName }}<small>{{ userRole }}</small></p>
      <ThemeSwitcher />
    </div>
  </aside>
</template>

<script setup>
import ThemeSwitcher from './ThemeSwitcher.vue'

defineProps({
  projectName: { type: String, default: '未命名项目' },
  subtitle: { type: String, default: '多人知识协作' },
  navItems: { type: Array, required: true },
  activeKey: { type: String, default: '' },
  avatarChar: { type: String, default: '我' },
  userName: { type: String, default: '' },
  userRole: { type: String, default: '' },
})

defineEmits(['navigate', 'back'])
</script>

<style scoped>
.sidebar {
  border-right: 1px solid var(--bb-line);
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  width: 236px;
  flex-shrink: 0;
  background: var(--bb-sidebar-bg, var(--bb-bg));
  backdrop-filter: blur(var(--bb-card-blur, 0px));
  transition: background 0.25s ease, border-color 0.25s ease;
}
.sidebar-brand {
  font-size: var(--bb-fs-md); font-weight: 500; margin: 0 0 48px;
  color: var(--bb-text);
}
.project-switch {
  border-bottom: 1px solid var(--bb-line);
  padding: 0 9px 28px;
}
.project-switch .dot {
  display: inline-block;
  width: 6px; height: 6px;
  background: var(--bb-accent);
  border-radius: 50%;
  margin-right: 6px;
  box-shadow: 0 0 8px var(--bb-accent-glow);
  animation: dot-pulse 2.4s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.project-switch b { font-size: var(--bb-fs-sm); color: var(--bb-text); }
.project-switch small {
  display: block;
  color: var(--bb-dim);
  font-size: var(--bb-fs-xs);
  margin: 7px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
nav { display: grid; padding: 18px 0; gap: 2px; overflow-y: auto; }
.nav-section {
  margin: 17px 9px 5px;
  color: var(--bb-dim);
  font-size: var(--bb-fs-xs);
  letter-spacing: .08em;
}
.nav-section:first-child { margin-top: 0; }
.nav-btn {
  position: relative;
  display: flex; align-items: center; gap: 8px;
  border: 0;
  background: transparent;
  color: var(--bb-muted);
  text-align: left;
  border-radius: var(--bb-radius-control);
  padding: 10px 12px;
  cursor: pointer;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  transition: color .18s ease, background-color .18s ease, padding-left .18s ease;
}
.nav-btn .badge {
  margin-left: auto; /* flex 自然对齐，替代 float + 心算 margin */
  font: var(--bb-fs-xs) var(--bb-font-mono);
  color: var(--bb-text-3);
}
.nav-btn:hover {
  background: var(--bb-accent-tint);
  color: var(--bb-text);
  padding-left: 14px;
}
/* 选中态：浅灰圆角背景块 + 强调色左竖条双重标识 */
.nav-btn.active {
  background: var(--bb-nav-active-bg);
  color: var(--bb-text);
  padding-left: 14px;
}
.nav-btn.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--bb-accent);
  box-shadow: 0 0 8px var(--bb-accent-glow);
}
.sidebar-bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px;
}
.sidebar-bottom .avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--bb-line-strong), var(--bb-soft));
  color: var(--bb-text);
  display: grid;
  place-items: center;
  font-size: var(--bb-fs-sm);
  font-weight: 600;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--bb-line-strong);
}
.sidebar-bottom p { font-size: var(--bb-fs-sm); margin: 0; color: var(--bb-text); }
.sidebar-bottom small { display: block; color: var(--bb-dim); font-size: var(--bb-fs-xs); margin-top: 2px; }
.sidebar-bottom .theme-switch { margin-left: auto; flex-shrink: 0; }

@media (max-width: 700px) {
  .sidebar { display: none; }
}
</style>
