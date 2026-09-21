<template>
  <section class="dashboard-panel">
    <header class="dashboard-head"><p class="eyebrow">科研驾驶舱 · 项目概览</p><h1>用最少的数字，看清下一步该往哪里推。</h1><p>数据来自团队当前任务、论文、方向和实验记录；无需外部服务。</p></header>
    <div v-if="loading && !data" class="dashboard-state"><p class="bb-progress" role="status" aria-live="polite" aria-atomic="true"><span class="bb-progress-mark" aria-hidden="true">⌁</span><span class="bb-progress-copy">正在汇总项目数据</span></p></div>
    <div v-else-if="error && !data" class="dashboard-state error-state" role="alert"><b>驾驶舱暂时无法加载</b><small>{{ error }}</small><button class="bb-btn" @click="load">重新加载</button></div>
    <div class="dashboard-body" v-else-if="data">
      <p v-if="refreshing" class="dashboard-progress bb-progress" role="status" aria-live="polite" aria-atomic="true"><span class="bb-progress-mark" aria-hidden="true">⌁</span><span class="bb-progress-copy">正在汇总最新数据</span></p>
      <div class="metric-grid"><article v-for="item in metrics" :key="item.label" class="metric"><small>{{ item.label }}</small><b>{{ item.value }}</b><span>{{ item.note }}</span></article></div>
      <div class="dashboard-grid">
        <article class="chart-card">
          <header><b>任务推进</b><small>{{ doneTasks }}/{{ totalTasks }} 已完成</small></header>
          <div class="donut-wrap">
            <div class="donut">
              <svg viewBox="0 0 120 120" role="img" aria-label="任务状态分布环形图">
                <circle class="ring-bg" cx="60" cy="60" r="46"/>
                <g transform="rotate(-90 60 60)">
                  <circle v-for="seg in donutSegs" :key="seg.key" class="ring-seg" cx="60" cy="60" r="46"
                    :stroke="seg.color" :stroke-dasharray="`${seg.len} ${CIRC - seg.len}`" :stroke-dashoffset="seg.offset"/>
                </g>
              </svg>
              <div class="donut-center"><b>{{ totalTasks }}</b><small>全部任务</small></div>
            </div>
            <ul class="legend">
              <li v-for="item in taskBars" :key="item.key"><i :style="{ background: TASK_COLORS[item.key] }"></i>{{ item.label }}<em>{{ item.value }}</em></li>
            </ul>
          </div>
        </article>
        <article class="chart-card">
          <header><b>方向状态</b><small>从探索到取舍</small></header>
          <div class="radar-wrap">
            <svg viewBox="0 0 220 196" role="img" aria-label="研究方向状态雷达图">
              <polygon v-for="(g, gi) in RADAR_GRID" :key="gi" class="radar-grid" :points="radarGridPoints(g)"/>
              <line class="radar-axis" :x1="110" :y1="92" :x2="110" :y2="92 - RADAR_R"/>
              <line class="radar-axis" :x1="110" :y1="92" :x2="110 + RADAR_R" :y2="92"/>
              <line class="radar-axis" :x1="110" :y1="92" :x2="110" :y2="92 + RADAR_R"/>
              <line class="radar-axis" :x1="110" :y1="92" :x2="110 - RADAR_R" :y2="92"/>
              <polygon class="radar-data" :points="radarDataPoints"/>
              <text class="radar-label" x="110" y="16" text-anchor="middle">探索中</text>
              <text class="radar-label" :x="110 + RADAR_R + 6" y="96" text-anchor="start">放弃</text>
              <text class="radar-label" x="110" :y="92 + RADAR_R + 16" text-anchor="middle">暂缓</text>
              <text class="radar-label" :x="110 - RADAR_R - 6" y="96" text-anchor="end">已选定</text>
            </svg>
            <small class="legend-note">研究方向分布</small>
          </div>
        </article>
        <article class="chart-card"><header><b>实验验证</b><small>每一条记录都可回溯</small></header><div class="bar-stack"><div v-for="item in experimentBars" :key="item.key" class="bar-line"><span>{{ item.label }}</span><i><em :style="{ width: `${item.percent}%` }" :class="item.key"></em></i><small>{{ item.value }}</small></div></div></article>
        <article class="chart-card growth">
          <header><b>资料沉淀</b><small>按收录日期累计</small></header>
          <svg v-if="areaChart" class="area-chart" viewBox="0 0 340 170" role="img" aria-label="论文收录累计曲线">
            <g v-for="t in areaChart.ticks" :key="t.value">
              <line class="area-grid" x1="34" :y1="t.y" x2="330" :y2="t.y"/>
              <text class="area-tick" x="28" :y="t.y + 3" text-anchor="end">{{ t.value }}</text>
            </g>
            <polygon class="area-fill" :points="areaChart.fill"/>
            <polyline class="area-line" :points="areaChart.line"/>
          </svg>
          <p v-else class="empty-state">尚无论文数据</p>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { api } from '../api'
const props = defineProps({ pid: { type: String, required: true }, refreshKey: { type: Number, default: 0 } })
const toast = inject('toast'); const data = ref(null); const loading = ref(true); const refreshing = ref(false); const error = ref('')
const count = (group, key) => Number(group?.[key] || 0)
const totalTasks = computed(() => Object.values(data.value?.tasks || {}).reduce((sum, value) => sum + Number(value), 0))
const doneTasks = computed(() => count(data.value?.tasks, 'done'))
const metrics = computed(() => data.value ? [
  { label: '科研资料', value: data.value.totals.files || 0, note: `${data.value.totals.papers} 篇论文 · ${data.value.totals.cards} 张卡片` },
  { label: '研究方向', value: Object.values(data.value.directions).reduce((s, n) => s + Number(n), 0), note: `${count(data.value.directions, 'selected')} 条已选定` },
  { label: '实验记录', value: data.value.totals.experiments, note: `${count(data.value.experiments, 'succeeded')} 条已验证` },
  { label: '共享记忆', value: data.value.totals.memories, note: '正在注入团队协作' },
] : [])
const buildBars = (group, config) => { const total = Math.max(1, Object.values(group || {}).reduce((s, n) => s + Number(n), 0)); return config.map((x) => ({ ...x, value: count(group, x.key), percent: Math.round(count(group, x.key) / total * 100) })) }
const TASK_COLORS = { todo: '#5B8FF9', doing: '#85B8FF', review: '#B9D4FF', done: '#61DDAA', blocked: '#E8684A' }
const taskBars = computed(() => buildBars(data.value?.tasks, [{ key: 'todo', label: '待办' }, { key: 'doing', label: '进行中' }, { key: 'review', label: '待评审' }, { key: 'done', label: '已完成' }, { key: 'blocked', label: '受阻' }]))
const directionBars = computed(() => buildBars(data.value?.directions, [{ key: 'exploring', label: '探索中' }, { key: 'selected', label: '已选定' }, { key: 'parked', label: '暂缓' }, { key: 'dropped', label: '放弃' }]))
const experimentBars = computed(() => buildBars(data.value?.experiments, [{ key: 'planned', label: '计划中' }, { key: 'running', label: '进行中' }, { key: 'succeeded', label: '已验证' }, { key: 'failed', label: '未成功' }]))
const timeline = computed(() => {
  const groups = new Map()
  for (const at of data.value?.paper_timeline || []) {
    const key = new Date(at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
    groups.set(key, (groups.get(key) || 0) + 1)
  }
  let total = 0
  const items = [...groups.entries()].map(([label, value]) => ({ key: label, label, value, total: total += value }))
  const max = Math.max(1, ...items.map((item) => item.total))
  return items.map((item) => ({ ...item, percent: Math.max(18, Math.round(item.total / max * 100)) }))
})

// ---- 环形图（任务推进）----
const CIRC = 2 * Math.PI * 46
const donutSegs = computed(() => {
  const total = Math.max(1, totalTasks.value)
  let acc = 0
  return ['todo', 'doing', 'review', 'done', 'blocked']
    .map((key) => {
      const len = count(data.value?.tasks, key) / total * CIRC
      const seg = { key, color: TASK_COLORS[key], len, offset: -acc }
      acc += len
      return seg
    })
    .filter((seg) => seg.len > 0.5)
})

// ---- 雷达图（方向状态）：上=探索中 右=放弃 下=暂缓 左=已选定 ----
const RADAR_R = 62
const RADAR_GRID = [1 / 3, 2 / 3, 1]
const radarValues = computed(() => {
  const g = data.value?.directions || {}
  return { exploring: count(g, 'exploring'), dropped: count(g, 'dropped'), parked: count(g, 'parked'), selected: count(g, 'selected') }
})
const radarMax = computed(() => Math.max(1, ...Object.values(radarValues.value)))
function radarGridPoints(fraction) {
  const r = RADAR_R * fraction
  return `110,${92 - r} ${110 + r},92 110,${92 + r} ${110 - r},92`
}
const radarDataPoints = computed(() => {
  const v = radarValues.value
  const pts = [[0, v.exploring], [90, v.dropped], [180, v.parked], [270, v.selected]]
  return pts.map(([deg, val]) => {
    const rad = (deg * Math.PI) / 180
    const r = (val / radarMax.value) * RADAR_R
    return `${110 + r * Math.sin(rad)},${92 - r * Math.cos(rad)}`
  }).join(' ')
})

// ---- 面积折线图（资料沉淀）----
const areaChart = computed(() => {
  const pts = timeline.value
  if (!pts.length) return null
  const W = 296, H = 130, top = 8
  const max = Math.max(3, ...pts.map((p) => p.total))
  const xy = pts.map((p, i) => {
    const x = 34 + (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W)
    const y = top + H - (p.total / max) * H
    return { x, y }
  })
  const line = xy.map((p) => `${p.x},${p.y}`).join(' ')
  const fill = `34,${top + H} ${line} ${34 + W},${top + H}`
  const tickStep = max <= 4 ? 1 : Math.ceil(max / 4)
  const ticks = []
  for (let v = 0; v <= max; v += tickStep) ticks.push({ value: v, y: top + H - (v / max) * H })
  return { line, fill, ticks }
})
async function load() {
  const isInitial = !data.value
  if (isInitial) loading.value = true
  else refreshing.value = true
  error.value = ''
  try { data.value = await api('GET', `/api/v1/projects/${props.pid}/research/dashboard`) }
  catch (e) { error.value = e.message || '请检查项目访问权限后重试。'; toast(error.value, true) }
  finally { loading.value = false; refreshing.value = false }
}
onMounted(load); watch(() => [props.pid, props.refreshKey], () => load())
</script>

<style scoped>
.dashboard-panel { display: flex; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; }
.dashboard-head { padding: clamp(44px, 6vw, 60px) clamp(28px, 6vw, 72px) 24px; border-bottom: 1px solid var(--bb-line); background: var(--bb-surface); }
.dashboard-head h1 { margin: 10px 0; font-size: clamp(26px, 3.2vw, 44px); font-weight: 500; letter-spacing: -.01em; }
.dashboard-head > p:last-child { color: var(--bb-muted); font-size: var(--bb-fs-sm); }
.dashboard-body { padding: 28px clamp(28px, 6vw, 72px) 48px; overflow: auto; animation: reveal .34s var(--bb-ease) both; }
.dashboard-progress { margin: 0 0 16px; font-size: var(--bb-fs-xs); }
.dashboard-state { display: grid; gap: 10px; align-content: start; justify-items: start; padding: 48px clamp(28px, 6vw, 72px); color: var(--bb-muted); font-size: var(--bb-fs-sm); }
.dashboard-state small { color: var(--bb-dim); }
.dashboard-state.error-state b { color: var(--bb-text); font-size: 15px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); max-width: 940px; border-top: 1px solid var(--bb-line); border-bottom: 1px solid var(--bb-line); background: var(--bb-surface); }
.metric { min-height: 96px; display: flex; flex-direction: column; justify-content: space-between; padding: 14px 16px; border-right: 1px solid var(--bb-line); }
.metric:last-child { border-right: 0; }
.metric small, .metric span, .chart-card header small { color: var(--bb-dim); font-size: var(--bb-fs-xs); }
.metric b { font-size: 28px; font-weight: 500; letter-spacing: -.04em; }
.metric span { color: var(--bb-muted); }
.dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); max-width: 940px; border-bottom: 1px solid var(--bb-line); }
.chart-card { min-height: 210px; padding: 18px 16px; border-right: 1px solid var(--bb-line); border-bottom: 1px solid var(--bb-line); }
.chart-card:nth-child(2n) { border-right: 0; }
.chart-card:nth-last-child(-n + 2) { border-bottom: 0; }
.chart-card header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
.chart-card header b { font-size: 14px; font-weight: 550; }

/* 环形图 */
.donut-wrap { display: flex; align-items: center; gap: 22px; padding: 4px 6px; }
.donut { position: relative; width: 148px; height: 148px; flex-shrink: 0; }
.donut svg { width: 100%; height: 100%; }
.ring-bg { fill: none; stroke: var(--bb-surface-2, #eef1f6); stroke-width: 17; }
.ring-seg { fill: none; stroke-width: 17; stroke-linecap: butt; }
.donut-center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.donut-center b { font-size: 26px; font-weight: 500; letter-spacing: -.03em; }
.donut-center small { color: var(--bb-dim); font-size: 11px; }
.legend { list-style: none; display: grid; gap: 8px; margin: 0; padding: 0; font-size: 12px; color: var(--bb-muted); }
.legend li { display: flex; align-items: center; gap: 8px; }
.legend i { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; }
.legend em { margin-left: auto; font-style: normal; color: var(--bb-text); min-width: 16px; text-align: right; }

/* 雷达图 */
.radar-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.radar-wrap svg { width: min(250px, 100%); height: auto; }
.radar-grid { fill: none; stroke: var(--bb-line); stroke-width: 1; }
.radar-axis { stroke: var(--bb-line); stroke-width: 1; }
.radar-data { fill: rgba(91, 143, 249, .14); stroke: #5B8FF9; stroke-width: 1.6; stroke-linejoin: round; }
.radar-label { fill: var(--bb-muted); font-size: 11px; }
.legend-note { color: var(--bb-dim); font-size: 11px; }

/* 条形图 */
.bar-stack { display: grid; gap: 11px; padding-top: 4px; }
.bar-line { display: grid; grid-template-columns: 52px 1fr 22px; align-items: center; gap: 10px; font-size: 12px; color: var(--bb-muted); }
.bar-line i { display: block; height: 8px; border-radius: 4px; background: var(--bb-surface-2, #eef1f6); overflow: hidden; }
.bar-line em { display: block; height: 100%; border-radius: 4px; background: var(--bb-dim); transition: width .5s var(--bb-ease); }
.bar-line em.planned { background: #B9D4FF; } .bar-line em.running { background: #85B8FF; }
.bar-line em.succeeded { background: #61DDAA; } .bar-line em.failed { background: #E8684A; }
.bar-line small { text-align: right; color: var(--bb-text); }

/* 面积折线图 */
.area-chart { width: 100%; height: auto; margin-top: 4px; }
.area-grid { stroke: var(--bb-line); stroke-width: 1; }
.area-tick { fill: var(--bb-dim); font-size: 10px; }
.area-fill { fill: rgba(91, 143, 249, .12); }
.area-line { fill: none; stroke: #5B8FF9; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.empty-state { color: var(--bb-dim); font-size: 12px; padding: 24px 0; }
</style>
