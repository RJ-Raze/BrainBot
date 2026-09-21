<template>
  <section class="analysis">
    <div>
      <p class="eyebrow">Agent / 正在分析</p>
      <h1 v-if="error">分析没有完成。</h1>
      <h1 v-else>正在理解<span class="grad">这个项目。</span></h1>
      <p v-if="!error" class="bb-progress" role="status" aria-live="polite" aria-atomic="true"><span class="bb-progress-mark" aria-hidden="true">⌁</span><span class="bb-progress-copy">正在生成项目结构草案</span></p>
      <p v-if="!error" class="analysis-note">提取研究目标、成员分工与任务结构之间的关系…</p>
      <template v-else>
        <p class="err" role="alert">{{ error }}</p>
        <button class="bb-btn" @click="$router.push('/setup')">← 返回重试</button>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useInitStore } from '../stores/init'

const router = useRouter()
const store = useInitStore()

const error = computed(() => store.analyzeError)

watch(
  () => [store.analyzing, store.draft],
  ([analyzing, draft]) => {
    if (!analyzing && draft && store.projectId) {
      setTimeout(() => router.replace(`/proposal/${store.projectId}`), 600)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.analysis {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  background: transparent; min-height: 100vh;
  overflow: hidden;
}
.analysis > div { position: relative; z-index: 1; width: min(530px, calc(100% - 60px)); }
h1 {
  font-size: clamp(36px, 4vw, 59px);
  margin-bottom: 40px; line-height: 1.08;
  letter-spacing: -0.01em; font-weight: 500;
}
.bb-progress { margin: 0; }
.analysis-note { font-size: var(--bb-fs-sm); color: var(--bb-muted); margin-top: 21px; }
.err { font-size: var(--bb-fs-sm); color: var(--bb-danger); margin-top: 21px; }
button { margin-top: 20px; }
</style>
