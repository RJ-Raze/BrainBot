<template>
  <section class="role-select">
    <div class="role-content">
      <button type="button" class="flow-back" @click="router.push('/join')">← 返回邀请码</button>
      <p class="eyebrow">确认你的协作角色</p>
      <h1>你会怎样参与<br><span class="grad">这项研究？</span></h1>
      <p class="sub">认领后，Agent 会按你的分工建立独立的工作上下文；你不会被不相关的信息打扰。</p>

      <div v-if="project" class="project-line">
        <span>项目</span><b>{{ project.name }}</b>
      </div>

      <div class="role-options">
        <button
          v-for="r in roles"
          :key="r.id"
          class="role-option"
          :class="{ taken: r.is_claimed && !r.is_mine }"
          :disabled="r.is_claimed && !r.is_mine"
          @click="claim(r)"
        >
          <b>
            {{ r.member_name || r.name }}
            <span v-if="r.is_mine" class="bb-tag green">已认领</span>
            <span v-else-if="r.is_claimed" class="bb-tag red">已被认领</span>
          </b>
          <small>{{ r.description }}</small>
          <i>→</i>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInitStore } from '../stores/init'

const route = useRoute()
const router = useRouter()
const store = useInitStore()
const toast = inject('toast')
const claiming = ref(false)

const project = computed(() => store.joinData?.project)
const roles = computed(() => store.joinData?.roles || [])

async function claim(r) {
  if (claiming.value) return
  claiming.value = true
  try {
    if (!r.is_mine) await store.claimRole(r.id)
    toast(`已认领角色「${r.member_name || r.name}」`)
    router.replace(`/workspace/${store.projectId}`)
  } catch (e) {
    toast(e.message, true)
  } finally {
    claiming.value = false
  }
}

onMounted(() => {
  // 刷新丢失状态时退回 Join 重新输入邀请码
  if (!store.joinData) router.replace('/join')
})
</script>

<style scoped>
.role-select {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  background: transparent; min-height: 100vh;
  overflow: hidden;
}
.role-content { position: relative; z-index: 1; width: min(680px, calc(100% - 60px)); padding-top: 4vh; }
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
  max-width: 480px; margin: 18px 0 30px;
}
.project-line { font-size: var(--bb-fs-sm); color: var(--bb-text-2); margin-bottom: 20px; }
.project-line b { color: var(--bb-text); margin-left: 8px; }
.role-options { display: grid; gap: 0; margin-top: 30px; max-width: 570px; }
.role-option {
  border: 0; border-top: 1px solid var(--bb-line);
  background: transparent; color: var(--bb-text);
  display: grid; grid-template-columns: 1fr auto;
  grid-template-areas: 'title arrow' 'subtitle arrow';
  text-align: left; padding: 18px 0; cursor: pointer;
}
.role-option:last-child { border-bottom: 1px solid var(--bb-line); }
.role-option b { grid-area: title; font-size: 18px; font-weight: 500; display: flex; align-items: center; gap: 10px; }
.role-option small { grid-area: subtitle; color: var(--bb-muted); font-size: var(--bb-fs-sm); margin-top: 5px; line-height: 1.6; }
.role-option i { grid-area: arrow; align-self: center; color: var(--bb-dim); opacity: 0; transition: 0.2s; font-style: normal; }
.role-option:hover:not(:disabled) b { color: var(--bb-text); }
.role-option:hover:not(:disabled) i { opacity: 1; transform: translateX(4px); color: var(--bb-accent); }
.role-option.taken { opacity: 0.4; cursor: not-allowed; }
</style>
