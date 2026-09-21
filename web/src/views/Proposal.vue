<template>
  <section class="proposal">
    <div>
      <p class="eyebrow">Agent / 项目起点草案</p>
      <h1>这是我对项目的<span class="grad">第一版理解。</span></h1>
      <p class="lead">它不是任务命令，而是一份由你确认后才会生效的协作建议。你可以直接改标题、描述和负责人。</p>

      <div class="project-summary">
        <span>项目</span>
        <b>{{ store.projectName }}</b>
        <p>{{ store.projectDesc }}</p>
      </div>

      <div class="proposal-list">
        <div v-for="(t, i) in tasks" :key="i" class="task-row">
          <span class="idx">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="task-body">
            <div class="task-top">
              <input v-model="t.title" class="bb-input title" />
              <select v-model="t.priority" class="bb-input pri">
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
              </select>
            </div>
            <textarea v-model="t.description" class="bb-input desc" rows="2"></textarea>
            <div class="task-meta">
              <select v-model="t.role_id" class="bb-input owner">
                <option :value="null">暂不指派</option>
                <option v-for="m in memberOptions" :key="m.role_id" :value="m.role_id">{{ m.name }}</option>
              </select>
              <small v-if="t.match_reasoning">{{ t.match_reasoning }}</small>
            </div>
          </div>
          <button class="bb-btn ghost small del" @click="tasks.splice(i, 1)">删除</button>
        </div>
      </div>

      <div v-if="gaps.length" class="gaps">
        <span>⚠ 未被覆盖的工作面</span>
        <p v-for="(g, i) in gaps" :key="i">{{ g }}</p>
      </div>

      <div class="invite-code-box" v-if="inviteCode">
        <span>邀请码</span>
        <b>{{ inviteCode }}</b>
        <small>分享给团队成员，他们输入后即可按分工认领角色加入</small>
      </div>

      <div class="proposal-foot">
        <button class="bb-btn ghost" @click="$router.push('/setup')">← 返回调整</button>
        <button class="bb-btn primary" :disabled="confirming || !tasks.length" @click="confirm">
          {{ confirming ? '生效中…' : '确认并进入工作台 →' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInitStore } from '../stores/init'
import { inject } from 'vue'

const route = useRoute()
const router = useRouter()
const store = useInitStore()
const toast = inject('toast')

const tasks = ref([])
const confirming = ref(false)

const gaps = computed(() => store.draft?.unassigned_gaps || [])
const inviteCode = computed(() => store.draft?.invite_code || '')

// 成员 → role_id 映射（草案任务的 role_id 已在后端绑好）
const memberOptions = computed(() => {
  const fromMembers = (store.members || []).filter((m) => m.role_id)
  if (fromMembers.length) return fromMembers
  // initialize 刚完成时 store.members 没有 role_id，从草案任务反推
  const map = new Map()
  for (const t of store.draft?.tasks || []) {
    if (t.role_id && t.member_name) map.set(t.role_id, t.member_name)
  }
  return [...map.entries()].map(([role_id, name]) => ({ role_id, name }))
})

async function confirm() {
  confirming.value = true
  try {
    await store.confirm(tasks.value.map((t) => ({
      title: t.title, description: t.description, priority: t.priority,
      role_id: t.role_id, match_reasoning: t.match_reasoning,
    })))
    toast('草案已生效，项目进入运行模式')
    router.replace(`/workspace/${store.projectId}`)
  } catch (e) {
    toast(e.message, true)
  } finally {
    confirming.value = false
  }
}

onMounted(async () => {
  if (!store.draft) {
    try {
      await store.loadDraft(route.params.pid)
    } catch (e) {
      toast(e.message, true)
      return router.replace('/projects')
    }
  }
  tasks.value = (store.draft.tasks || []).map((t) => ({ ...t }))
})
</script>

<style scoped>
.proposal {
  position: absolute; inset: 0;
  overflow: auto; padding: 100px max(11vw, 46px) 50px;
  background: transparent;
}
.proposal > div { max-width: 900px; }
h1 {
  font-size: clamp(38px, 4.4vw, 66px);
  line-height: 1.08; letter-spacing: -0.01em;
  font-weight: 500;
}
.project-summary {
  border-top: 1px solid var(--bb-line);
  border-bottom: 1px solid var(--bb-line);
  margin-top: 44px; padding: 17px 0;
}
.project-summary span { font-size: var(--bb-fs-xs); color: var(--bb-text-2); }
.project-summary b { display: block; font-size: 17px; margin: 5px 0; }
.project-summary p { color: var(--bb-muted); font-size: var(--bb-fs-sm); line-height: 1.7; max-width: 600px; }

.proposal-list { margin-top: 10px; }
.task-row {
  display: grid; grid-template-columns: 45px 1fr auto;
  gap: 14px;
  border-bottom: 1px solid var(--bb-line); padding: 19px 0;
  align-items: start;
}
.idx { font: var(--bb-fs-xs) var(--bb-font-mono); color: var(--bb-accent); opacity: 0.65; padding-top: 12px; }
.task-body { display: grid; gap: 8px; }
.task-top { display: flex; gap: 10px; }
.task-top .title { flex: 1; font-weight:500; }
.task-top .pri { width: 84px; }
.desc { font-size: var(--bb-fs-sm); color: var(--bb-text-2); }
.task-meta { display: flex; align-items: center; gap: 14px; }
.task-meta .owner { width: 150px; padding: 7px 10px; font-size: var(--bb-fs-sm); }
.task-meta small { color: var(--bb-muted); font-size: var(--bb-fs-xs); line-height: 1.6; flex: 1; }
.del { margin-top: 8px; }

.gaps {
  border: 1px solid var(--bb-warning-border);
  background: var(--bb-warning-bg);
  border-radius: var(--bb-radius-control);
  padding: 14px 18px;
  margin-top: 28px;
}
.gaps span { font-size: var(--bb-fs-xs); color: var(--bb-warning); }
.gaps p { color: var(--bb-text-2); font-size: var(--bb-fs-sm); line-height: 1.7; margin-top: 6px; }

.invite-code-box {
  border: 1px solid var(--bb-accent-border);
  background: var(--bb-accent-tint);
  border-radius: var(--bb-radius-control); padding: 16px 20px;
  margin-top: 32px;
}
.invite-code-box span { font-size: var(--bb-fs-xs); color: var(--bb-text-2); }
.invite-code-box b { display: block; font-size: 18px; font-family: var(--bb-font-mono); letter-spacing: 0.04em; margin: 6px 0 4px; }
.invite-code-box small { font-size: var(--bb-fs-xs); color: var(--bb-muted); }
.proposal-foot { display: flex; justify-content: space-between; margin-top: 35px; }
</style>
