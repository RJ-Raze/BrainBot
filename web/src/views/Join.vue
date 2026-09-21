<template>
  <section class="member-join">
    <div class="member-entry">
      <button type="button" class="flow-back" @click="router.push('/home')">← 返回我的项目</button>
      <p class="eyebrow">加入团队</p>
      <h1>带上邀请码，<br><span class="grad">加入正在进行的研究。</span></h1>
      <p class="sub">加入后，你只会看到与你的角色、任务和协作关系相关的信息。</p>
      <form class="join-form" @submit.prevent="handleJoin">
        <input
          v-model="code"
          class="bb-input code"
          autocomplete="off"
          placeholder="输入团队邀请码"
          maxlength="8"
        />
        <button class="bb-btn primary" type="submit" :disabled="loading || code.trim().length !== 8">
          {{ loading ? '验证中…' : '继续 →' }}
        </button>
      </form>
      <small>输入创立人分享的 8 位邀请码即可加入</small>
    </div>
  </section>
</template>

<script setup>
import { inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useInitStore } from '../stores/init'

const router = useRouter()
const store = useInitStore()
const toast = inject('toast')
const code = ref('')
const loading = ref(false)

async function handleJoin() {
  if (!code.value.trim()) return
  loading.value = true
  try {
    await store.join(code.value)
    router.push(`/claim/${store.projectId}`)
  } catch (e) {
    toast(e.message, true)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.member-join {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  background: transparent; min-height: 100vh;
  overflow: hidden;
}
.member-entry { position: relative; z-index: 1; width: min(680px, calc(100% - 60px)); }
.flow-back {
  border: 0; background: transparent; cursor: pointer; padding: 0;
  color: var(--bb-dim); font: var(--bb-fs-xs) var(--bb-font-mono);
  letter-spacing: .04em; transition: color .2s;
}
.flow-back:hover { color: var(--bb-text); }
h1 {
  font-size: clamp(38px, 4.8vw, 72px);
  line-height: 1.08; letter-spacing: -0.01em;
  font-weight: 500;
}
.sub {
  color: var(--bb-muted); line-height: 1.75; font-size: var(--bb-fs-md);
  max-width: 480px; margin: 18px 0 38px;
}
.join-form { display: flex; gap: 12px; max-width: 480px; }
.code {
  flex: 1;
  font-family: var(--bb-font-mono);
  font-size: 18px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
small { display: block; color: var(--bb-dim); font-size: var(--bb-fs-xs); margin-top: 14px; }
</style>
