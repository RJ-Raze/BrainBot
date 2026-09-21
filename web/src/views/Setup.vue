<template>
  <section class="setup">
    <aside class="setup-side">
      <p>01</p>
      <div><b>建立项目背景</b><small>让 Agent 先理解研究</small></div>
      <p class="side-note">{{ members.length }} 位成员<br>含你自己</p>
    </aside>

    <div class="setup-main">
      <button type="button" class="flow-back" @click="router.push('/home')">← 返回我的项目</button>
      <p class="eyebrow">作为创立人，先告诉我这项研究是什么。</p>
      <h1>从项目本身<span class="grad">开始。</span></h1>
      <p class="lead">项目描述与成员分工越清晰，Agent 给出的任务结构建议就越贴近真实。所有内容确认前都只是草案。</p>

      <!-- 大输入框白卡：纯白 + 大圆角 + 极柔和悬浮阴影 -->
      <div class="setup-card">
      <div class="form-block">
        <label class="section-label">项目名称</label>
        <input v-model="name" class="bb-input" placeholder="例如：面向科研团队的知识协作 Agent" />
      </div>

      <div class="form-block">
        <label class="section-label">研究目标与问题</label>
        <textarea v-model="description" class="bb-input lead-input" rows="4"
          placeholder="用几句话描述：你们在研究什么、希望解决什么问题、计划产出什么…"></textarea>
      </div>

      <div class="form-block">
        <label class="section-label">成员分工（第 1 位是你自己）</label>
        <div v-for="(m, i) in members" :key="i" class="member-row">
          <div class="member-head">
            <span class="member-idx">{{ String(i + 1).padStart(2, '0') }}</span>
            <input v-model="m.name" class="bb-input name" :placeholder="i === 0 ? '你的名字' : '成员名字'" />
            <span v-if="i === 0" class="bb-tag green">我</span>
            <button v-if="i > 0" class="bb-btn ghost small" @click="members.splice(i, 1)">移除</button>
          </div>
          <textarea v-model="m.role_description" class="bb-input" rows="2"
            :placeholder="i === 0 ? '你的分工，如：产品判断、全栈实现、最终拍板' : '这位成员的分工，如：AI 能力、提示词与记忆机制'"></textarea>
        </div>
        <button class="bb-btn small" @click="members.push({ name: '', role_description: '' })">＋ 添加成员</button>
      </div>

      <div class="setup-foot">
        <span>下一步：Agent 生成任务结构建议（草案，需你确认）</span>
        <button class="bb-btn primary" :disabled="!valid" @click="start">开始分析 →</button>
      </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { useInitStore } from '../stores/init'

const router = useRouter()
const store = useInitStore()

const name = ref('')
const description = ref('')
const members = ref([{ name: '', role_description: '', me: true }])

const valid = computed(() =>
  name.value.trim() &&
  description.value.trim() &&
  members.value.every((m) => m.name.trim() && m.role_description.trim())
)

function start() {
  store.initialize({
    name: name.value.trim(),
    description: description.value.trim(),
    members: members.value.map((m, i) => ({
      name: m.name.trim(),
      role_description: m.role_description.trim(),
      me: i === 0,
    })),
  })
  router.push('/analyzing')
}

onMounted(async () => {
  // 预填自己的名字
  try {
    const me = await api('GET', '/api/v1/auth/me')
    if (me.display_name || me.username) members.value[0].name = me.display_name || me.username
  } catch (e) { console.warn('预填用户名失败', e) }
})
</script>

<style scoped>
.setup {
  position: absolute; inset: 0;
  display: grid; grid-template-columns: 255px 1fr;
  background: transparent; min-height: 100vh;
}
.setup-side {
  border-right: 1px solid var(--bb-line);
  padding: 112px 32px 32px;
  display: flex; flex-direction: column;
}
.setup-side > p:first-child { font: var(--bb-fs-sm) var(--bb-font-mono); color: var(--bb-accent); opacity: 0.75; margin: 0 0 20px; }
.setup-side b { font-size: 13px; display: block; }
.setup-side small { display: block; color: var(--bb-muted); font-size: var(--bb-fs-xs); margin-top: 5px; }
.side-note { margin-top: auto; color: var(--bb-dim); font-size: var(--bb-fs-xs); line-height: 1.8; }
/* 大输入框白卡 — 纯白 + 16px 圆角 + 极柔和悬浮阴影 */
.setup-card {
  background: var(--bb-card);
  border: 1px solid var(--bb-card-border, transparent);
  border-radius: var(--bb-radius-card);
  box-shadow: var(--bb-shadow-card);
  padding: clamp(24px, 3.2vw, 40px);
  margin-top: 32px;
}
.lead-input { min-height: 128px; font-size: 14.5px; }
.setup-main {
  width: min(710px, calc(100% - 80px));
  padding: 100px 0 60px;
  margin-left: clamp(55px, 10vw, 165px);
  overflow: auto;
}
.flow-back {
  border: 0; background: transparent; cursor: pointer; padding: 0;
  color: var(--bb-dim); font: var(--bb-fs-xs) var(--bb-font-mono);
  letter-spacing: .04em; transition: color .2s;
}
.flow-back:hover { color: var(--bb-text); }
h1 {
  font-size: clamp(39px, 4.6vw, 68px);
  line-height: 1.08; letter-spacing: -0.01em;
  font-weight: 500;
}
.form-block { margin-bottom: 30px; }
.form-block .bb-input { margin-top: 4px; }
.member-row {
  border: 1px solid var(--bb-line);
  border-radius: var(--bb-radius-item);
  padding: 14px 16px;
  margin-bottom: 12px;
  display: grid;
  gap: 10px;
  transition: border-color 0.2s;
}
.member-row:focus-within { border-color: var(--bb-accent-border); }
.member-head { display: flex; align-items: center; gap: 10px; }
.member-idx { font: var(--bb-fs-xs) var(--bb-font-mono); color: var(--bb-accent); opacity: 0.65; }
.member-head .name { flex: 1; }
.member-row textarea { border-color: transparent; background: var(--bb-card); }
.setup-foot {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid var(--bb-line); padding-top: 23px; margin-top: 42px;
  color: var(--bb-dim); font-size: 11px;
}

@media (max-width: 700px) {
  .setup { grid-template-columns: 1fr; }
  .setup-side { display: none; }
  .setup-main { width: auto; margin: 0; padding: 80px 27px 40px; }
}
</style>
