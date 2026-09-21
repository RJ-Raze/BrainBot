<template>
  <section class="auth">
    <!-- ===== 极简顶栏 ===== -->
    <header class="auth-top">
      <button type="button" class="brand" @click="router.push('/')">BRAINBOT</button>
      <button type="button" class="back" @click="router.push('/')">返回首页</button>
    </header>

    <!-- ===== 左右分栏：左品牌 / 右表单 ===== -->
    <div class="auth-grid">
      <!-- 左：品牌 Slogan -->
      <div class="auth-brand">
        <p class="eyebrow">多人知识协作智能平台</p>
        <h1>让团队的智慧<br><span class="grad">彼此接住。</span></h1>
        <p class="lead">每个角色都有自己的设定与记忆，关键结论晋升为团队共享上下文——不再反复解释。</p>
      </div>

      <!-- 右：登录/注册表单 -->
      <div class="auth-panel">
        <div class="panel-inner">
          <p v-if="demoMode" class="demo-badge">
            演示模式 · 数据为本地模拟，无需后端
            <button type="button" class="demo-exit" @click="exitDemo">退出演示</button>
          </p>

          <div class="demo-entry">
            <div><b>科研复现 Demo 已准备</b><small>yun_tianming · Demo@123456</small></div>
            <button type="button" class="bb-btn small" @click="fillDemo">填入演示账号</button>
          </div>

          <div class="mode-switch">
            <button class="mode-btn" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
            <button class="mode-btn" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
          </div>

          <form class="form" @submit.prevent="submit">
            <input v-model="form.username" class="bb-input" placeholder="用户名" autocomplete="username" />
            <input v-if="mode === 'register'" v-model="form.display_name" class="bb-input" placeholder="昵称（可选）" />
            <input v-model="form.password" class="bb-input" type="password" placeholder="密码" autocomplete="current-password" />
            <button class="bb-btn primary submit" type="submit" :disabled="loading">
              {{ loading ? '请稍候…' : mode === 'login' ? '进入平台' : '创建账号' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { inject, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, setToken, isDemoMode } from '../api'
import { enableDemo, disableDemo } from '../mock/demo'

const router = useRouter()
const toast = inject('toast')
const mode = ref('login')
const loading = ref(false)
const demoMode = ref(isDemoMode())
const form = reactive({ username: '', password: '', display_name: '' })

function fillDemo() {
  enableDemo()
  demoMode.value = true
  mode.value = 'login'
  form.username = 'yun_tianming'
  form.password = 'Demo@123456'
  toast('演示模式已开启，点击「进入平台」即可（无需后端）')
}

function exitDemo() {
  disableDemo()
  demoMode.value = false
  form.password = ''
  toast('已退出演示模式，登录将连接真实后端')
}

async function submit() {
  if (!form.username || !form.password) return toast('请填写用户名和密码', true)

  // 离线演示模式：本地签发 token，不发任何网络请求
  if (isDemoMode()) {
    setToken(`demo.${form.username.trim()}`)
    toast(mode.value === 'login' ? '欢迎回来（演示模式）' : '账号已创建（演示模式）')
    router.push('/home')
    return
  }

  loading.value = true
  try {
    const data = await api('POST', `/api/v1/auth/${mode.value}`, form)
    setToken(data.token)
    toast(mode.value === 'login' ? '欢迎回来' : '账号已创建')
    router.push('/home')
  } catch (e) {
    toast(e.message, true)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ===== RAZE 极简登录页 · 左右分栏 ===== */
.auth {
  position: absolute;
  inset: 0;
  background: transparent;
  min-height: 100vh;
  overflow: auto;
  color: var(--bb-text);
}

/* 顶栏 */
.auth-top {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  height: 72px;
  padding: 0 clamp(32px, 6vw, 88px);
  display: flex; align-items: center; justify-content: space-between;
}
.brand {
  border: 0; background: transparent; cursor: pointer;
  font-family: var(--bb-font-mono);
  font-size: 13px; letter-spacing: 0.06em; color: var(--bb-text);
}
.back {
  border: 0; background: transparent; cursor: pointer;
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs); letter-spacing: 0.05em; color: var(--bb-dim);
  padding: 8px 4px;
  transition: color 0.25s;
}
.back:hover { color: var(--bb-text); }

/* 分栏：各占一半，各自垂直水平居中 */
.auth-grid {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.auth-brand,
.auth-panel {
  display: flex;
  align-items: center;
  padding: 96px clamp(32px, 5vw, 72px) 64px;
  animation: raze-in .5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.auth-brand { justify-content: flex-end; }
.auth-brand > * { width: 100%; max-width: 520px; }
.auth-panel { justify-content: flex-start; }
.panel-inner { width: 100%; max-width: 440px; }

@keyframes raze-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }

/* 左栏：品牌文案 */
.eyebrow {
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.06em;
  color: var(--bb-dim);
  margin-bottom: 40px;
}
h1 {
  font-size: clamp(40px, 4.6vw, 76px);
  line-height: 1.04;
  letter-spacing: -0.01em;
  font-weight: 500;
  margin: 0;
}
h1 .grad {
  background: none;
  -webkit-text-fill-color: var(--bb-text-3);
  color: var(--bb-text-3);
}
.lead {
  margin: 32px 0 0;
  max-width: 420px;
  font-size: 14px;
  line-height: 1.85;
  color: var(--bb-dim);
}

/* 演示模式徽标 */
.demo-badge {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin: 0 0 18px;
  padding: 10px 14px;
  border: 1px solid var(--bb-line-strong);
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs); letter-spacing: 0.04em; color: var(--bb-muted);
}
.demo-exit {
  border: 0; background: transparent; cursor: pointer;
  color: var(--bb-dim); font-family: inherit; font-size: var(--bb-fs-xs);
  letter-spacing: 0.04em; text-decoration: underline;
  text-underline-offset: 3px;
  transition: color .25s;
}
.demo-exit:hover { color: var(--bb-text); }

/* 右栏：演示账号入口 —— 细线行 */
.demo-entry {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 18px 0; border-top: 1px solid var(--bb-line); border-bottom: 1px solid var(--bb-line);
}
.demo-entry b { display: block; font-size: var(--bb-fs-sm); font-weight: 500; color: var(--bb-text); }
.demo-entry small { display: block; margin-top: 4px; color: var(--bb-dim); font: var(--bb-fs-xs) var(--bb-font-mono); letter-spacing: 0.04em; }

/* 登录/注册切换 —— RAZE 细线 tab */
.mode-switch {
  display: flex;
  gap: 36px;
  margin: 36px 0 28px;
  border-bottom: 1px solid var(--bb-line);
}
.mode-btn {
  border: 0;
  background: transparent;
  color: var(--bb-dim);
  padding: 14px 0;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.02em;
  cursor: pointer;
  border-bottom: 1px solid transparent;
  margin-bottom: -1px;
  transition: color .25s, border-color .25s;
}
.mode-btn:hover { color: var(--bb-text); }
.mode-btn.active { color: var(--bb-text); border-bottom-color: var(--bb-accent); }

/* 表单 —— RAZE 透明下划线输入，加宽加大 */
.form { display: grid; gap: 0; }
.form .bb-input {
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--bb-line);
  border-radius: 0;
  padding: 20px 0;
  font-size: 15px;
  color: var(--bb-text);
  transition: border-color .25s;
}
.form .bb-input::placeholder { color: var(--bb-dim); }
.form .bb-input:focus {
  border-color: var(--bb-accent);
  box-shadow: none;
  background: transparent;
  outline: none;
}

/* 提交按钮 —— 通栏银白，更大气 */
.submit {
  margin-top: 40px;
  width: 100%;
  padding: 17px 32px;
  font-size: var(--bb-fs-md);
  letter-spacing: 0.04em;
  border-radius: var(--bb-radius-control);
  border: 1px solid var(--bb-accent);
  background: var(--bb-accent);
  color: var(--bb-accent-on);
  font-weight: 600;
  cursor: pointer;
  transition: background .25s, color .25s, box-shadow .25s;
}
.submit:hover:not(:disabled) {
  background: var(--bb-accent-soft);
  box-shadow: 0 0 32px var(--bb-accent-glow);
}
.submit:disabled {
  opacity: .5;
  cursor: not-allowed;
}

/* ============ 响应式：窄屏上下堆叠 ============ */
@media (max-width: 900px) {
  .auth-grid { grid-template-columns: 1fr; }
  .auth-brand {
    justify-content: flex-start;
    padding: 120px 24px 24px;
  }
  .auth-panel {
    justify-content: flex-start;
    padding: 24px 24px 72px;
  }
  .auth-brand > *, .panel-inner { max-width: 520px; }
  h1 { font-size: clamp(36px, 9vw, 52px); }
}
</style>
