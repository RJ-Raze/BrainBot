<template>
  <section class="research-panel">
    <header class="research-head">
      <p class="eyebrow">科研工作区 · 离线核心版</p>
      <h1>把资料、判断与验证放到同一条研究链路。</h1>
      <p>联网检索（arXiv / OpenAlex）一键入库，或手动收录；论文 → 卡片 → 证据 → 共享记忆，全程可追溯。</p>
    </header>

    <div class="research-body">
      <div v-if="loading && !loadedOnce" class="panel-state"><p class="bb-progress" role="status" aria-live="polite" aria-atomic="true"><span class="bb-progress-mark" aria-hidden="true">⌁</span><span class="bb-progress-copy">正在载入研究资料</span></p></div>
      <div v-else-if="loadError && !loadedOnce" class="panel-state error-state" role="alert"><b>科研工作区暂时无法加载</b><small>{{ loadError }}</small><button class="bb-btn" @click="loadAll()">重新加载</button></div>
      <template v-else>
      <nav class="research-tabs" aria-label="科研工作区导航">
        <button v-for="tab in tabs" :key="tab.key" :class="{ active: active === tab.key }" @click="active = tab.key">{{ tab.label }}<small>{{ tab.count }}</small></button>
      </nav>
      <p v-if="progressLabel || refreshing" class="research-progress bb-progress" role="status" aria-live="polite" aria-atomic="true"><span class="bb-progress-mark" aria-hidden="true">⌁</span><span class="bb-progress-copy">{{ progressLabel || '正在刷新研究资料' }}</span></p>

      <template v-if="active === 'papers'">
        <div class="panel-toolbar">
          <span>{{ papers.length }} 篇已收录论文</span>
          <button class="bb-btn" @click="showPaperForm = !showPaperForm">{{ showPaperForm ? '收起' : '+ 手动收录' }}</button>
        </div>

        <!-- 联网检索 -->
        <div class="search-bar">
          <input v-model="searchQuery" class="bb-input wide" placeholder="联网检索论文，如 Mip-Splatting 3D Gaussian Splatting" @keydown.enter.prevent="startSearch">
          <label class="src-check"><input type="checkbox" value="arxiv" v-model="searchSources"> arXiv</label>
          <label class="src-check"><input type="checkbox" value="openalex" v-model="searchSources"> OpenAlex</label>
          <button class="bb-btn primary" :disabled="searching || !searchQuery.trim()" @click="startSearch">{{ searching ? '检索中…' : '检索' }}</button>
        </div>
        <p v-if="searching" class="search-status bb-progress" role="status" aria-live="polite" aria-atomic="true"><span class="bb-progress-mark" aria-hidden="true">⌁</span><span class="bb-progress-copy">正在检索文献库</span></p>
        <p v-if="searchErrors.length" class="search-status warn">部分来源不可用：{{ searchErrors.join('；') }}</p>
        <div v-if="searchResults.length" class="search-results">
          <div class="search-results-head">
            <span>{{ searchResults.length }} 条结果</span>
            <button v-if="searchResults.some((r) => !r.in_library)" class="bb-btn" :disabled="Boolean(submitting)" @click="importAll">全部入库</button>
          </div>
          <article v-for="r in searchResults" :key="r.source + ':' + r.external_id" class="search-result">
            <div class="sr-main"><b>{{ r.title }}</b><small>{{ r.source }} · {{ r.year || '—' }}<span v-if="r.citation_count"> · 引用 {{ r.citation_count }}</span><span v-if="r.doi"> · DOI {{ r.doi }}</span></small><p>{{ r.abstract || '无摘要' }}</p></div>
            <button v-if="!r.in_library" class="bb-btn" :disabled="Boolean(submitting)" @click="importPaper(r)">入库</button>
            <span v-else class="in-lib">已入库</span>
          </article>
        </div>
        <p v-else-if="searched && !searching" class="empty-state">没有检索到结果，换个关键词试试。</p>

        <form v-if="showPaperForm" class="quiet-form" @submit.prevent="createPaper">
          <input v-model="paperForm.title" class="bb-input wide" placeholder="论文标题 *">
          <input v-model="paperForm.external_id" class="bb-input" placeholder="DOI / 手动编号 *">
          <input v-model="paperForm.year" class="bb-input short" type="number" placeholder="年份">
          <input v-model="paperForm.source" class="bb-input" placeholder="来源，如 manual">
          <textarea v-model="paperForm.abstract" class="bb-input wide" rows="3" placeholder="摘要（可选）"></textarea>
          <button class="bb-btn primary" :disabled="Boolean(submitting)">收录论文</button>
        </form>
        <div v-if="papers.length" class="paper-list">
          <article v-for="paper in papers" :key="paper.id" class="paper-row">
            <div class="paper-mark">{{ paper.year || '—' }}</div>
            <div class="paper-main">
              <b>{{ paper.title }}</b>
              <p>{{ paper.abstract || '尚未填写摘要。' }}</p>
              <small>{{ paper.source }} · {{ paper.external_id }}<span v-if="paper.citation_count"> · 引用 {{ paper.citation_count }}</span></small>
            </div>
            <button v-if="myRole" class="card-cta" @click="openCard(paper)">写卡片</button>
          </article>
        </div>
        <p v-else class="empty-state">先手动录入一篇论文，建立可追溯的研究资料库。</p>
      </template>

      <template v-else-if="active === 'directions'">
        <div class="panel-toolbar"><span>{{ directions.length }} 个研究方向</span><button class="bb-btn" @click="showDirectionForm = !showDirectionForm">{{ showDirectionForm ? '收起' : '+ 新建方向' }}</button></div>
        <form v-if="showDirectionForm" class="quiet-form" @submit.prevent="createDirection">
          <input v-model="directionForm.name" class="bb-input wide" placeholder="方向名称 *">
          <select v-model="directionForm.status" class="bb-input"><option value="exploring">探索中</option><option value="selected">已选定</option><option value="parked">暂缓</option><option value="dropped">已放弃</option></select>
          <input v-model="directionForm.feasibility" class="bb-input short" type="number" min="1" max="5" placeholder="可行性">
          <input v-model="directionForm.novelty" class="bb-input short" type="number" min="1" max="5" placeholder="新颖性">
          <input v-model="directionForm.impact" class="bb-input short" type="number" min="1" max="5" placeholder="影响力">
          <textarea v-model="directionForm.description" class="bb-input wide" rows="2" placeholder="这条方向要回答什么问题？"></textarea>
          <button class="bb-btn primary" :disabled="Boolean(submitting)">保存方向</button>
        </form>
        <div v-if="directions.length" class="direction-grid">
          <article v-for="item in directions" :key="item.id" class="direction-card" :class="item.status">
            <div class="direction-top"><span>{{ directionLabel(item.status) }}</span><small>证据 {{ item.evidence_count }}</small></div>
            <b>{{ item.name }}</b><p>{{ item.description || '尚未补充研究说明。' }}</p>
            <div class="score-row"><span>可 {{ score(item.feasibility) }}</span><span>新 {{ score(item.novelty) }}</span><span>影 {{ score(item.impact) }}</span></div>
          </article>
        </div>
        <p v-else class="empty-state">先提出候选方向，再用论文与实验逐步验证。</p>
      </template>

      <template v-else-if="active === 'cards'">
        <div class="panel-toolbar"><span>{{ cards.length }} 张文献卡片</span><button v-if="papers.length && myRole" class="bb-btn" @click="openCard(papers[0])">+ 写卡片</button></div>
        <form v-if="cardTarget" class="quiet-form card-form" @submit.prevent="createCard">
          <p class="form-context">正在为《{{ cardTarget.title }}》写精读卡片</p>
          <textarea v-model="cardForm.notes" class="bb-input wide" rows="5" placeholder="记录问题、方法、限制与可复用的结论（Markdown 可用）"></textarea>
          <input v-model="cardForm.tags" class="bb-input" placeholder="标签，用逗号分隔">
          <select v-model="cardForm.rating" class="bb-input short"><option v-for="n in 5" :key="n" :value="n">价值 {{ n }}/5</option></select>
          <button class="bb-btn primary" :disabled="Boolean(submitting)">保存卡片</button><button type="button" class="link-btn" :disabled="Boolean(submitting)" @click="cardTarget = null">取消</button>
        </form>
        <div v-if="cards.length" class="card-list">
          <article v-for="card in cards" :key="card.id" class="research-card">
            <div><span class="bb-tag">{{ card.paper?.year || '资料' }}</span><small>{{ card.role_name || '团队成员' }} · {{ card.author_name || '匿名' }}</small><span v-if="!card.is_shared" class="evidence-badge" :class="card.evidence_status">{{ EVIDENCE_LABEL[card.evidence_status] || '未核验' }}</span></div>
            <b>{{ card.paper?.title }}</b><p>{{ card.notes || '尚未写入精读笔记。' }}</p>
            <footer><span>{{ card.tags.join(' · ') || '无标签' }}</span><button v-if="!card.is_shared" class="link-btn" :disabled="Boolean(submitting)" :title="card.evidence_status === 'reviewed' ? '' : '晋升前需先核验来源'" @click="promoteCard(card)">晋升共享记忆 ↗</button><span v-else class="shared">已共享</span></footer>
          </article>
        </div>
        <p v-else class="empty-state">文献卡片是论文进入团队共享记忆的唯一科研入口。</p>
      </template>

      <template v-else>
        <div class="panel-toolbar"><span>{{ experiments.length }} 条实验记录</span><button v-if="myRole" class="bb-btn" @click="showExperimentForm = !showExperimentForm">{{ showExperimentForm ? '收起' : '+ 新建实验' }}</button></div>
        <form v-if="showExperimentForm" class="quiet-form" @submit.prevent="createExperiment">
          <input v-model="experimentForm.title" class="bb-input wide" placeholder="实验标题 *">
          <select v-model="experimentForm.direction_id" class="bb-input"><option value="">关联方向（可选）</option><option v-for="d in directions" :key="d.id" :value="d.id">{{ d.name }}</option></select>
          <select v-model="experimentForm.status" class="bb-input"><option value="planned">计划中</option><option value="running">进行中</option><option value="succeeded">成功</option><option value="failed">未成功</option></select>
          <textarea v-model="experimentForm.hypothesis" class="bb-input wide" rows="2" placeholder="要验证的假设"></textarea>
          <textarea v-model="experimentForm.conclusion" class="bb-input wide" rows="2" placeholder="结论或下一步"></textarea>
          <button class="bb-btn primary" :disabled="Boolean(submitting)">记录实验</button>
        </form>
        <div v-if="experiments.length" class="experiment-list">
          <article v-for="item in experiments" :key="item.id" class="experiment-row">
            <span class="experiment-dot" :class="item.status"></span><div><b>{{ item.title }}</b><p>{{ item.hypothesis || item.conclusion || '尚未记录实验假设。' }}</p><small>{{ experimentLabel(item.status) }}<span v-if="item.direction_name"> · {{ item.direction_name }}</span></small></div>
          </article>
        </div>
        <p v-else class="empty-state">实验记录会成为驾驶舱的验证曲线，也会让研究过程可复盘。</p>
      </template>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from '../api'

const props = defineProps({ pid: { type: String, required: true }, myRole: { type: Object, default: null }, refreshKey: { type: Number, default: 0 } })
const toast = inject('toast')
const EVIDENCE_LABEL = { unverified: '未核验', reviewed: '已核验', conflicting: '存在冲突' }
const active = ref('papers')
const loading = ref(true), refreshing = ref(false), loadedOnce = ref(false), loadError = ref('')
const papers = ref([]), directions = ref([]), cards = ref([]), experiments = ref([])
const showPaperForm = ref(false), showDirectionForm = ref(false), showExperimentForm = ref(false), cardTarget = ref(null)
const paperForm = ref({ title: '', external_id: '', source: 'manual', year: '', abstract: '' })
const directionForm = ref({ name: '', description: '', status: 'exploring', feasibility: '', novelty: '', impact: '' })
const cardForm = ref({ notes: '', tags: '', rating: 3 })
const experimentForm = ref({ title: '', direction_id: '', status: 'planned', hypothesis: '', conclusion: '' })
const submitting = ref('')
// 联网检索
const searchQuery = ref('')
const searchSources = ref(['arxiv', 'openalex'])
const searching = ref(false)
const searched = ref(false)
const searchResults = ref([])
const searchErrors = ref([])
const searchTaskId = ref(null)
let searchTimer = null
const tabs = computed(() => [
  { key: 'papers', label: '论文库', count: papers.value.length }, { key: 'directions', label: '方向树', count: directions.value.length },
  { key: 'cards', label: '文献卡片', count: cards.value.length }, { key: 'experiments', label: '实验记录', count: experiments.value.length },
])
const splitTags = (value) => String(value || '').split(/[,，]/).map((x) => x.trim()).filter(Boolean)
const score = (value) => value ? '●'.repeat(value) + '○'.repeat(5 - value) : '—'
const directionLabel = (status) => ({ exploring: '探索中', selected: '已选定', parked: '暂缓', dropped: '已放弃' })[status] || status
const experimentLabel = (status) => ({ planned: '计划中', running: '进行中', succeeded: '已验证', failed: '未成功' })[status] || status
const progressLabel = computed(() => ({
  paper: '正在收录论文', direction: '正在保存研究方向', card: '正在提交文献卡片',
  promote: '正在写入共享记忆', experiment: '正在记录实验',
}[submitting.value] || ''))

async function loadAll({ showLoading = true } = {}) {
  const isInitial = showLoading && !loadedOnce.value
  if (isInitial) loading.value = true
  else refreshing.value = true
  loadError.value = ''
  try {
    const base = `/api/v1/projects/${props.pid}/research`
    const [p, d, c, e] = await Promise.all([api('GET', `${base}/papers`), api('GET', `${base}/directions`), api('GET', `${base}/paper-cards`), api('GET', `${base}/experiments`)])
    papers.value = p.items; directions.value = d.items; cards.value = c.items; experiments.value = e.items
    loadedOnce.value = true
  } catch (error) {
    loadError.value = error.message || '请检查项目访问权限后重试。'
    toast(loadError.value, true)
  } finally { loading.value = false; refreshing.value = false }
}
async function runSubmission(key, action) {
  if (submitting.value) return
  submitting.value = key
  try { await action() } finally { submitting.value = '' }
}
async function createPaper() { await runSubmission('paper', async () => { try { await api('POST', `/api/v1/projects/${props.pid}/research/papers`, paperForm.value); paperForm.value = { title: '', external_id: '', source: 'manual', year: '', abstract: '' }; showPaperForm.value = false; toast('论文已收录'); await loadAll({ showLoading: false }) } catch (e) { toast(e.message, true) } }) }

// ---- 联网检索：POST /search → 轮询 task → 一键入库 ----
async function startSearch() {
  const q = searchQuery.value.trim()
  if (!q || searching.value) return
  searching.value = true
  searched.value = true
  searchResults.value = []
  searchErrors.value = []
  try {
    const data = await api('POST', `/api/v1/projects/${props.pid}/research/search`, { query: q, sources: searchSources.value })
    searchTaskId.value = data.task.id
    pollSearch(data.task.id)
  } catch (e) { searching.value = false; toast(e.message, true) }
}
async function pollSearch(taskId) {
  try {
    const { task } = await api('GET', `/api/v1/projects/${props.pid}/research/search/${taskId}`)
    if (task.status === 'done') {
      searching.value = false
      searchResults.value = task.result?.items || []
      searchErrors.value = task.result?.errors || []
      return
    }
    if (task.status === 'fail') {
      searching.value = false
      toast(task.error_msg || '检索失败', true)
      return
    }
    searchTimer = setTimeout(() => pollSearch(taskId), 1200)
  } catch (e) { searching.value = false; toast(e.message, true) }
}
async function importPaper(item) {
  await runSubmission('paper', async () => {
    try {
      const r = await api('POST', `/api/v1/projects/${props.pid}/research/papers`, item)
      item.in_library = true
      toast(r.created ? '论文已入库' : '论文已在库中')
      await loadAll({ showLoading: false })
    } catch (e) { toast(e.message, true) }
  })
}
async function importAll() {
  if (!searchTaskId.value) return
  await runSubmission('paper', async () => {
    try {
      const r = await api('POST', `/api/v1/projects/${props.pid}/research/search/${searchTaskId.value}/import-all`, {})
      searchResults.value = searchResults.value.map((it) => ({ ...it, in_library: true }))
      toast(`已入库 ${r.imported} 篇，跳过 ${r.skipped} 篇`)
      await loadAll({ showLoading: false })
    } catch (e) { toast(e.message, true) }
  })
}
async function createDirection() { await runSubmission('direction', async () => { try { await api('POST', `/api/v1/projects/${props.pid}/research/directions`, directionForm.value); directionForm.value = { name: '', description: '', status: 'exploring', feasibility: '', novelty: '', impact: '' }; showDirectionForm.value = false; toast('研究方向已保存'); await loadAll({ showLoading: false }) } catch (e) { toast(e.message, true) } }) }
function openCard(paper) { cardTarget.value = paper; active.value = 'cards'; cardForm.value = { notes: '', tags: '', rating: 3 } }
async function createCard() { await runSubmission('card', async () => { try { await api('POST', `/api/v1/projects/${props.pid}/research/paper-cards`, { paper_id: cardTarget.value.id, role_id: props.myRole.id, notes: cardForm.value.notes, tags: splitTags(cardForm.value.tags), rating: cardForm.value.rating }); cardTarget.value = null; toast('文献卡片已保存'); await loadAll({ showLoading: false }) } catch (e) { toast(e.message, true) } }) }
async function promoteCard(card) { await runSubmission('promote', async () => { try { await api('POST', `/api/v1/projects/${props.pid}/research/paper-cards/${card.id}/promote`, {}); toast('已晋升到共享记忆'); await loadAll({ showLoading: false }) } catch (e) { toast(e.message, true) } }) }
async function createExperiment() { await runSubmission('experiment', async () => { try { await api('POST', `/api/v1/projects/${props.pid}/research/experiments`, { ...experimentForm.value, role_id: props.myRole.id }); experimentForm.value = { title: '', direction_id: '', status: 'planned', hypothesis: '', conclusion: '' }; showExperimentForm.value = false; toast('实验记录已保存'); await loadAll({ showLoading: false }) } catch (e) { toast(e.message, true) } }) }
onMounted(loadAll)
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })
watch(() => [props.pid, props.refreshKey], () => loadAll())
</script>

<style scoped>
.research-panel { display: flex; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; }
.research-head { padding: 60px clamp(28px, 6vw, 72px) 24px; border-bottom: 1px solid var(--bb-line); }
.research-head h1 { margin: 10px 0; font-size: clamp(26px, 3.2vw, 44px); font-weight: 500; letter-spacing: -.01em; }
.research-head > p:last-child { max-width: 620px; color: var(--bb-muted); font-size: 13px; line-height: 1.7; }
.research-body { padding: 24px clamp(28px, 6vw, 72px) 48px; overflow: auto; }.panel-state { display: grid; align-content: start; justify-items: start; gap: 10px; min-height: 180px; padding: 25px 0; color: var(--bb-muted); font-size: 13px; }.panel-state small { color: var(--bb-dim); }.panel-state.error-state b { color: var(--bb-text); font-size: 15px; }
.research-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--bb-line); margin-bottom: 22px; }
.research-tabs button { border: 0; border-bottom: 1px solid transparent; background: transparent; color: var(--bb-dim); padding: 10px 12px; margin-bottom: -1px; cursor: pointer; font-size: 12px; transition: color .18s, border-color .18s; }
.research-tabs button.active { color: var(--bb-text); border-color: var(--bb-accent); }.research-tabs small { margin-left: 6px; color: var(--bb-dim); }
.evidence-badge { margin-left: 8px; font-size: 10px; padding: 1px 6px; border-radius: 8px; border: 1px solid var(--bb-line); color: var(--bb-dim); }
.evidence-badge.reviewed { color: var(--bb-accent); border-color: var(--bb-accent-border, var(--bb-accent)); }
.evidence-badge.unverified { color: var(--bb-dim); }
.evidence-badge.conflicting { color: var(--bb-danger, #e05c5c); border-color: var(--bb-danger, #e05c5c); }
.search-bar { display: flex; align-items: center; gap: 10px; max-width: 820px; padding: 14px 0 6px; }
.search-bar .bb-input.wide { flex: 1 1 380px; min-height: 38px; }
.src-check { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--bb-muted); white-space: nowrap; }
.search-status { margin: 6px 0; font-size: 12px; color: var(--bb-muted); }
.search-status.warn { color: var(--bb-danger, #e05c5c); }
.search-results { max-width: 900px; border-top: 1px solid var(--bb-line); margin-top: 10px; }
.search-results-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; font-size: 12px; color: var(--bb-dim); border-bottom: 1px solid var(--bb-line); }
.search-result { display: flex; align-items: flex-start; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--bb-line); }
.sr-main { flex: 1; min-width: 0; }
.sr-main b { font-size: 14px; font-weight: 550; }
.sr-main small { display: block; margin: 5px 0 0; color: var(--bb-dim); font-size: 11px; }
.sr-main p { margin: 7px 0 0; color: var(--bb-muted); font-size: 12px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.in-lib { font-size: 12px; color: var(--bb-accent); white-space: nowrap; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: var(--bb-muted); font-size: 12px; margin: 16px 0; }
.research-progress { margin: -7px 0 14px; font-size: 11px; }
.quiet-form { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; max-width: 820px; padding: 15px 0 18px; margin-bottom: 18px; border-top: 1px solid var(--bb-line); border-bottom: 1px solid var(--bb-line); animation: reveal .18s ease-out; }.quiet-form .wide { flex: 1 1 460px; }.quiet-form .short { width: 92px; }.quiet-form .bb-input { min-height: 36px; }.quiet-form textarea { resize: vertical; }.form-context { width: 100%; color: var(--bb-muted); font-size: 12px; }
.paper-list, .card-list, .experiment-list { max-width: 900px; }.paper-row { display: flex; gap: 14px; padding: 17px 0; border-bottom: 1px solid var(--bb-line); }
/* 写卡片 · 卡片堆叠 CTA — 伪元素做两层错位卡片，hover 散开 + 本体上浮 */
.card-cta {
  position: relative;
  z-index: 0;
  flex-shrink: 0;
  align-self: center;
  padding: 10px 16px;
  border: 1px solid var(--bb-line-strong);
  border-radius: var(--bb-radius-control);
  background: var(--bb-btn-bg, var(--bb-soft));
  color: var(--bb-text);
  font-size: var(--bb-fs-sm);
  white-space: nowrap;
  cursor: pointer;
  box-shadow: var(--bb-shadow-card);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}
.card-cta::before,
.card-cta::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
  transition: transform 0.25s ease;
}
.card-cta::after { background: var(--bb-stack-a); transform: translate(3px, 3px) rotate(-2deg); }
.card-cta::before { background: var(--bb-stack-b); transform: translate(6px, 5px) rotate(-4deg); }
.card-cta:hover {
  transform: translateY(-2px);
  border-color: var(--bb-accent-border);
  box-shadow: 0 8px 20px var(--bb-accent-glow), 0 2px 6px var(--bb-shadow-card);
}
.card-cta:hover::after { transform: translate(6px, 6px) rotate(-3deg); }
.card-cta:hover::before { transform: translate(11px, 9px) rotate(-5deg); }.paper-mark { width: 40px; color: var(--bb-dim); font: 11px ui-monospace, monospace; padding-top: 2px; }.paper-main { min-width: 0; flex: 1; }.paper-main b, .research-card b, .experiment-row b { font-size: 14px; font-weight: 500; }.paper-main p, .research-card p, .experiment-row p { margin: 7px 0; color: var(--bb-muted); font-size: 12px; line-height: 1.65; white-space: pre-wrap; }.paper-main p { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }.paper-main small, .experiment-row small { color: var(--bb-dim); font-size: 11px; }
.direction-grid { display: grid; grid-template-columns: 1fr; max-width: 900px; border-top: 1px solid var(--bb-line); }.direction-card, .research-card { padding: 16px 0; border: 0; border-bottom: 1px solid var(--bb-line); background: transparent; }.direction-card.selected { border-left: 1px solid var(--bb-accent); padding-left: 12px; }.direction-top, .research-card > div, .research-card footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--bb-dim); font-size: 11px; }.direction-card b { display: block; margin-top: 14px; font-size: 14px; font-weight: 500; }.direction-card p { color: var(--bb-muted); font-size: 12px; line-height: 1.65; margin: 7px 0; }.score-row { display: flex; gap: 8px; color: var(--bb-muted); font-size: 10px; letter-spacing: 1px; }
.card-list { display: grid; grid-template-columns: 1fr; max-width: 900px; border-top: 1px solid var(--bb-line); }.research-card { display: flex; flex-direction: column; gap: 11px; }.research-card p { flex: 1; }.research-card footer span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.shared { color: var(--bb-accent-soft); }
.experiment-row { display: flex; gap: 12px; padding: 15px 0; border-bottom: 1px solid var(--bb-line); }.experiment-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; margin-top: 5px; background: var(--bb-dim); }.experiment-dot.running { background: var(--bb-muted); }.experiment-dot.succeeded { background: var(--bb-accent); box-shadow: 0 0 8px var(--bb-accent-glow); }.experiment-dot.failed { background: var(--bb-dim); }.empty-state { color: var(--bb-dim); font-size: 13px; padding: 32px 0; }
@keyframes reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 620px) { .research-head { padding-top: 34px; }.research-tabs { overflow-x: auto; }.research-tabs button { white-space: nowrap; }.paper-row { align-items: flex-start; }.paper-row > .link-btn { flex-shrink: 0; }.quiet-form .wide { flex-basis: 100%; } }
</style>
