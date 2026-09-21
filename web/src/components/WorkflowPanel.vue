<template>
  <section class="flow">
    <header><p>研究流程</p><h1>让每一次判断，都有后续。</h1><p>导入资料，确认依据，发布组会，再带着结果回来。</p></header>
    <nav aria-label="研究流程导航"><button v-for="(label, key) in stages" :key="key" :aria-current="stage === key ? 'page' : undefined" @click="stage = key">{{ label }}</button><button @click="download('/handoff/export')">导出交接包</button></nav>
    <p v-if="error" class="error" role="alert">{{ error }} <button @click="load">重新加载</button></p>
    <p v-if="busy" role="status">正在保存与同步…</p>
    <div v-if="stage === 'import'" class="content">
      <h2>从已有文献库开始</h2><p>选择 RIS 文件，预览后确认。重复记录会跳过，格式错误会逐条标记。</p>
      <input type="file" accept=".ris" aria-label="选择 RIS 文件" @change="readRis"><button @click="download('/library/export')">导出论文 RIS</button>
      <div v-if="preview.length"><p>{{ preview.length }} 条记录</p><label v-for="row in preview" :key="row.line" class="row"><input type="checkbox" v-model="selectedLines" :value="row.line" :disabled="Boolean(row.error)"><span>{{ row.title || '无法解析的记录' }}<small>第 {{ row.line }} 行 · {{ row.error || (row.duplicate ? '重复，导入时跳过' : '可导入') }}</small></span></label><button :disabled="busy || !selectedLines.length" @click="importRis">确认导入 {{ selectedLines.length }} 条</button></div>
      <p v-if="importResult">{{ importResult }}</p>
      <p>导入后，进入科研工作区的论文库创建带摘录和定位的文献卡片。</p><button @click="$emit('navigate', 'research')">打开科研工作区</button>
    </div>
    <div v-else-if="stage === 'review'" class="content">
      <div class="toolbar"><h2>待确认的判断</h2><button @click="showCreate = !showCreate">新建决策草稿</button></div>
      <form v-if="showCreate" @submit.prevent="createMemory"><label>标题<input v-model="newMemory.title" required maxlength="255"></label><label>判断与适用条件<textarea v-model="newMemory.content" required rows="4"></textarea></label><button :disabled="busy">保存草稿</button></form>
      <p>来源核验和结论审核是两步。团队审核需要另一位负责人；个人确认须在项目设置中启用。</p>
      <div class="split"><div><button v-for="m in memories" :key="m.id" class="row pick" :aria-pressed="history?.memory.id === m.id" @click="selectMemory(m.id)"><span>{{ m.title }}<small>{{ labels[m.review_status] || m.review_status }} · v{{ m.version }}</small></span></button><p v-if="!memories.length">先创建一条决策草稿，或将文献卡片晋升为共享记忆。</p></div>
      <section v-if="history" class="detail"><h3>{{ history.memory.title }}</h3><p v-if="!history.sources_valid" class="error">来源已变化，需要重新修订和核验。</p><pre>{{ history.memory.content }}</pre>
        <label>关联来源卡片（手工定位）<select v-model="sourceIds" multiple aria-label="关联来源卡片"><option v-for="c in cards" :key="c.id" :value="c.id">{{ c.paper?.title }} · {{ c.evidence_status }}</option></select></label>
        <label>原因 / 说明<input v-model="reason" maxlength="2000" placeholder="退回和失效时必填"></label>
        <div class="actions"><button v-if="['draft','rejected','legacy_unreviewed'].includes(history.memory.reviewStatus)" :disabled="busy" @click="transition('submit')">提交审核</button><template v-if="history.memory.reviewStatus === 'submitted' && canReview"><button :disabled="busy" @click="transition('approve')">批准此版本</button><button :disabled="busy" @click="transition('reject')">退回</button></template><button v-if="history.memory.reviewStatus === 'approved' && canReview" :disabled="busy" @click="transition('invalidate')">标记失效</button><button v-if="history.memory.reviewStatus !== 'submitted'" @click="editing = !editing">修订内容</button></div>
        <form v-if="editing" @submit.prevent="transition('revise')"><label>修订标题<input v-model="revision.title" required maxlength="255"></label><label>修订正文<textarea v-model="revision.content" rows="5" required></textarea></label><button :disabled="busy">保存为新草稿</button></form>
        <h3>历史版本</h3><details v-for="r in history.items" :key="r.id"><summary>v{{ r.version }} · {{ labels[r.status] || r.status }} · {{ time(r.createdAt) }}</summary><p>{{ r.reason }}</p><pre>{{ r.content }}</pre><small>版本 ID：{{ r.id }}</small></details>
      </section></div>
    </div>
    <div v-else-if="stage === 'meeting'" class="content">
      <h2>组会草稿与发布记录</h2><form class="dates" @submit.prevent="createBrief"><label>开始（上海时间）<input v-model="start" type="date" required></label><label>结束（包含当天）<input v-model="end" type="date" required></label><button :disabled="busy">生成草稿</button></form>
      <div class="split"><div><button v-for="b in briefs" :key="b.id" class="row pick" @click="selectBrief(b)"><span>{{ b.title }}<small>{{ b.status === 'published' ? '已发布' : '草稿' }} · {{ time(b.createdAt) }}</small></span></button><p v-if="!briefs.length">选择时间窗生成第一份组会草稿。</p></div>
      <section v-if="brief" class="detail"><h3>{{ brief.title }}</h3><p>{{ brief.status === 'published' ? '已发布快照，正文不可改写' : '编辑正文和行动建议，保存后再发布' }}</p><textarea v-if="brief.status === 'draft'" v-model="briefText" rows="14" aria-label="组会正文"></textarea><pre v-else>{{ brief.content }}</pre>
        <h3>行动项</h3><div v-for="(a, i) in actions" :key="i" class="action-item"><template v-if="brief.status === 'draft'"><input v-model="a.title" placeholder="行动标题" aria-label="行动标题"><select v-model="a.role_id" aria-label="负责人"><option :value="null">负责人待定</option><option v-for="r in assignedRoles" :value="r.id" :key="r.id">{{ r.member_name || r.name }}</option></select><input type="date" v-model="a.due_at" aria-label="截止日期"><button @click="actions.splice(i, 1)">移除</button></template><template v-else><span>{{ a.title }}<small>{{ a.role_id ? '已指定角色' : '负责人待定' }} · {{ a.due_at || '期限待定' }}</small></span><button v-if="canReview" :disabled="busy" @click="accept(i)">接受并创建任务</button></template></div>
        <div class="actions"><template v-if="brief.status === 'draft'"><button @click="actions.push({ title: '', role_id: null, due_at: null })">添加行动项</button><button :disabled="busy" @click="saveBrief">保存草稿</button><button v-if="canReview" :disabled="busy" @click="publish">保存并发布</button></template><button @click="download(`/briefs/${brief.id}/export`)">导出 Markdown</button></div>
      </section></div>
    </div>
    <div v-else class="content"><h2>决策之后，记录验证结果</h2><p>记录真实条件与原始指标。数据版本或指标口径不同的实验不能直接比较。</p>
      <form @submit.prevent="saveExperiment"><label>实验记录<select v-model="experimentId" required><option value="">选择实验</option><option v-for="e in experiments" :value="e.id" :key="e.id">{{ e.title }}</option></select></label>
      <label>关联已批准决策版本<select v-model="protocol.decision_revision_id" required><option value="">选择决策版本</option><option v-for="r in approved" :value="r.id" :key="r.id">{{ r.title }} · v{{ r.version }}</option></select></label>
      <div class="form-grid"><label v-for="(label, key) in protocolFields" :key="key">{{ label }}<input v-model="protocol[key]" :required="['dataset','code_commit','metric_name','metric_value'].includes(key)"></label></div>
      <label>指标方向<select v-model="protocol.direction"><option value="higher">越高越好</option><option value="lower">越低越好</option></select></label><label>结果状态<select v-model="protocol.status"><option value="running">进行中</option><option value="succeeded">已验证</option><option value="failed">未成功</option></select></label><label>复盘结论<textarea v-model="protocol.conclusion" rows="3"></textarea></label><label>失败原因<textarea v-model="protocol.failure_reason" rows="2"></textarea></label><button :disabled="busy || !experimentId">保存复盘</button></form>
      <details v-for="e in experiments.filter(e => e.metric?.protocol)" :key="e.id"><summary>{{ e.title }} · 已记录实验条件</summary><pre>{{ JSON.stringify(e.metric.protocol, null, 2) }}</pre><p>{{ e.conclusion }}</p></details>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { api, saveBlob } from '../api'
const props = defineProps({ pid: String, canReview: Boolean })
defineEmits(['navigate'])
const toast = inject('toast')
const base = `/api/v1/projects/${props.pid}`
const stages = { import: '资料导入', review: '结论审核', meeting: '组会发布', experiment: '实验复盘' }
const labels = { draft: '草稿', submitted: '待审核', approved: '已批准', rejected: '已退回', invalidated: '已失效', legacy_unreviewed: '历史未审核' }
const stage = ref('review'), busy = ref(false), error = ref('')
const memories = ref([]), cards = ref([]), briefs = ref([]), experiments = ref([]), approved = ref([]), assignedRoles = ref([])
const history = ref(null), sourceIds = ref([]), reason = ref(''), editing = ref(false), revision = ref({ title: '', content: '' })
const showCreate = ref(false), newMemory = ref({ title: '', content: '' })
const ris = ref(''), preview = ref([]), selectedLines = ref([]), importResult = ref('')
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
const start = ref(new Date(Date.now() - 6 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })), end = ref(today)
const brief = ref(null), briefText = ref(''), actions = ref([])
const experimentId = ref(''), protocol = ref({ decision_revision_id: '', dataset: '', code_commit: '', seed: '', baseline: '', metric_name: '', metric_value: '', unit: '', direction: 'higher', status: 'running', conclusion: '', failure_reason: '' })
const protocolFields = { dataset: '数据集与划分版本', code_commit: '代码 commit / 版本', seed: '随机种子', baseline: '基线', metric_name: '指标名', metric_value: '原始数值', unit: '单位' }
const time = d => new Date(d).toLocaleString('zh-CN')
async function run(fn) { if (busy.value) return; busy.value = true; error.value = ''; try { await fn() } catch(e) { error.value = e.message; toast(e.message, true) } finally { busy.value = false } }
async function load() {
  try {
    const [m, c, b, e, p] = await Promise.all([api('GET', base + '/memories'), api('GET', base + '/research/paper-cards'), api('GET', base + '/briefs'), api('GET', base + '/research/experiments'), api('GET', base)])
    memories.value = m.items; cards.value = c.items; briefs.value = b.items; experiments.value = e.items
    assignedRoles.value = p.roles.filter(r => !r.is_archived && p.members.some(m => m.role_id === r.id))
    const histories = await Promise.all(m.items.filter(m => m.review_status === 'approved').map(m => api('GET', `${base}/reviews/${m.id}/history`)))
    approved.value = histories.flatMap(h => h.items.filter(r => r.status === 'approved'))
  } catch(e) { error.value = e.message }
}
async function readRis(event) { await run(async () => { const f = event.target.files[0]; if (!f) return; if (f.size > 1048576) throw new Error('最大 1 MB'); ris.value = await f.text(); preview.value = (await api('POST', base + '/library/preview', { text: ris.value })).rows; selectedLines.value = preview.value.filter(r => !r.error).map(r => r.line) }) }
async function importRis() { await run(async () => { const d = await api('POST', base + '/library/import', { text: ris.value, lines: selectedLines.value }); importResult.value = d.results.map(r => `第 ${r.line} 行：${r.error || (r.status === 'duplicate' ? '已存在' : '已导入')}`).join('；'); await load() }) }
async function createMemory() { await run(async () => { const m = await api('POST', base + '/memories', { ...newMemory.value, category: 'decision' }); showCreate.value = false; newMemory.value = { title: '', content: '' }; await load(); await selectMemory(m.id) }) }
async function selectMemory(id) { try { history.value = await api('GET', `${base}/reviews/${id}/history`); sourceIds.value = (history.value.items[0]?.sources || []).map(s => s.id); revision.value = { title: history.value.memory.title, content: history.value.memory.content }; editing.value = false; reason.value = '' } catch(e) { error.value = e.message } }
async function transition(action) { await run(async () => { await api('POST', `${base}/reviews/${history.value.memory.id}/transition`, { action, expectedVersion: history.value.memory.version, ...revision.value, source_ids: sourceIds.value, reason: reason.value }); await selectMemory(history.value.memory.id); await load(); toast('审核记录已更新') }) }
function selectBrief(b) { brief.value = b; briefText.value = b.content; actions.value = JSON.parse(JSON.stringify(b.actions)) }
let briefKey = null
async function createBrief() { await run(async () => { briefKey ||= crypto.randomUUID(); const d = await api('POST', base + '/briefs', { request_key: briefKey, start: start.value + 'T00:00:00+08:00', end: new Date(+new Date(end.value + 'T00:00:00+08:00') + 86400000).toISOString(), timezone: 'Asia/Shanghai' }); briefKey = null; await load(); selectBrief(d) }) }
async function persistBrief() { const d = await api('PATCH', `${base}/briefs/${brief.value.id}`, { expectedVersion: brief.value.version, content: briefText.value, actions: actions.value }); selectBrief(d); return d }
async function saveBrief() { await run(async () => { await persistBrief(); await load(); toast('草稿已保存') }) }
async function publish() { await run(async () => { const b = await persistBrief(); selectBrief(await api('POST', `${base}/briefs/${b.id}/publish`, { expectedVersion: b.version })); await load(); toast('组会已发布为固定快照') }) }
async function accept(i) { await run(async () => { await api('POST', `${base}/briefs/${brief.value.id}/actions/${i}/accept`, {}); toast('任务已创建；重复接受不会重复派工') }) }
async function saveExperiment() { await run(async () => { await api('POST', `${base}/handoff/experiments/${experimentId.value}`, protocol.value); await load(); toast('复盘已保存') }) }
async function download(path) { await run(async () => { const d = await api('GET', base + path); saveBlob(new Blob([d.content], { type: 'text/plain;charset=utf-8' }), d.filename); if (d.warnings?.length) error.value = d.warnings.join('；') }) }
onMounted(load)
</script>

<style scoped>
.flow{flex:1;min-height:0;overflow:auto;padding:36px clamp(20px,4vw,56px);color:var(--bb-text)}header h1{font-size:28px;letter-spacing:-.01em;margin:8px 0}p,small{color:var(--bb-muted);font-size:var(--bb-fs-sm);line-height:1.7}nav,.actions,.toolbar,.dates{display:flex;gap:10px;align-items:center;flex-wrap:wrap}nav{margin:24px 0;border-bottom:1px solid var(--bb-line);padding-bottom:12px}button{font:inherit;font-size:var(--bb-fs-sm);cursor:pointer;border:1px solid var(--bb-line);border-radius:var(--bb-radius-control);padding:9px 13px;background:var(--bb-btn-bg,var(--bb-surface));color:var(--bb-text)}button[aria-current],button[aria-pressed=true]{background:var(--bb-accent-tint);border-color:var(--bb-accent-border);color:var(--bb-text)}button:disabled{opacity:.5;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--bb-accent-border);outline-offset:2px}.content{max-width:1100px}h2{font-size:var(--bb-fs-xl);font-weight:550}h3{font-size:15px;margin:18px 0 10px}.split{display:grid;grid-template-columns:minmax(180px,1fr) minmax(280px,2fr);gap:24px;margin-top:20px}.row{display:flex;gap:10px;padding:14px 10px;border-bottom:1px solid var(--bb-line);text-align:left}.pick{width:100%;border:0;border-bottom:1px solid var(--bb-line);border-radius:0;background:transparent}.row span{min-width:0;overflow-wrap:anywhere}.row small,.action-item small{display:block;margin-top:5px}.detail{padding:0 20px 24px;border-left:1px solid var(--bb-line);min-width:0}pre{font:12px/1.8 inherit;white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto}label{display:block;font-size:var(--bb-fs-sm);margin:12px 0}input:not([type=checkbox]),textarea,select{display:block;width:100%;box-sizing:border-box;margin-top:6px;border:1px solid var(--bb-line);border-radius:6px;padding:9px;color:var(--bb-text);background:var(--bb-surface);font:inherit}textarea{resize:vertical}.dates input{width:auto}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}form{max-width:740px}details{padding:12px 0;border-bottom:1px solid var(--bb-line)}summary{cursor:pointer;font-size:var(--bb-fs-sm)}.action-item{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.action-item input,.action-item select{flex:1;min-width:120px}.error{color:var(--bb-danger)}.toolbar{justify-content:space-between}@media(max-width:900px){.split{grid-template-columns:1fr}.detail{border-left:0;padding:0}.flow{padding-top:60px}.form-grid{grid-template-columns:1fr}}
</style>
