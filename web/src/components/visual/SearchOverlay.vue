<script setup lang="ts">
/**
 * 搜索浮层（Language Explorer 搜索框/筛选器 → BRAINBOT 语义映射）
 *
 * ⌘K / Ctrl+K 唤起，Esc 关闭；搜索记忆 / 任务 / 文档；
 * 筛选器：类型 · 标签 · 时间 · 负责人 · 状态（绝无语言/国家/地区/濒危度）。
 * 后端未接入时使用演示数据（标注「演示数据」）；接入后仅需替换 DEMO 数据源。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useVisualizerStore } from '../../stores/visualizer'

const viz = useVisualizerStore()

type ItemType = '记忆' | '任务' | '文档'
interface SearchItem {
  type: ItemType
  title: string
  meta: string
  tags: string[]
  owner: string
  status: '进行中' | '已完成' | '已归档'
  daysAgo: number
}

/* —— 演示数据（占位；接入后端后由 API 数据替换）—— */
const DEMO: SearchItem[] = [
  { type: '记忆', title: '实验对照组的采样口径统一为 500ml', meta: '来自「周三组会」讨论', tags: ['实验设计', '口径'], owner: '林科', status: '进行中', daysAgo: 1 },
  { type: '记忆', title: '评审意见：文献综述需补充近两年方法', meta: '来自「开题预评审」', tags: ['文献', '评审'], owner: '苏晚', status: '进行中', daysAgo: 3 },
  { type: '记忆', title: '术语表 V2 定稿：特征提取统一命名', meta: '来自「术语同步会」', tags: ['术语'], owner: '周砚', status: '已完成', daysAgo: 9 },
  { type: '记忆', title: '用户访谈结论：看板默认按负责人分组', meta: '来自「可用性测试」', tags: ['看板', '用户研究'], owner: '陈默', status: '已完成', daysAgo: 14 },
  { type: '记忆', title: '数据清洗规则：缺失值超过 40% 的列剔除', meta: '来自「数据准备」讨论', tags: ['数据清洗'], owner: '林科', status: '进行中', daysAgo: 6 },
  { type: '任务', title: '完成基线模型复现', meta: '实验组 · 本周截止', tags: ['基线'], owner: '林科', status: '进行中', daysAgo: 2 },
  { type: '任务', title: '撰写第二章实验设计', meta: '论文组 · 进行中', tags: ['论文'], owner: '苏晚', status: '进行中', daysAgo: 4 },
  { type: '任务', title: '整理 20 篇相关文献入库', meta: '文献组 · 已完成 13 篇', tags: ['文献'], owner: '周砚', status: '进行中', daysAgo: 1 },
  { type: '任务', title: '部署评测脚本到内网 GPU', meta: '工程组', tags: ['评测'], owner: '陈默', status: '已完成', daysAgo: 21 },
  { type: '任务', title: '绘制系统架构图 V3', meta: '设计组', tags: ['架构'], owner: '陈默', status: '进行中', daysAgo: 5 },
  { type: '文档', title: '总文档 · 第一章 研究背景', meta: '由 6 条记忆聚合', tags: ['论文'], owner: '苏晚', status: '进行中', daysAgo: 2 },
  { type: '文档', title: '总文档 · 第二章 方法设计', meta: '由 9 条记忆聚合', tags: ['论文', '实验设计'], owner: '林科', status: '进行中', daysAgo: 1 },
  { type: '文档', title: '会议纪要 · 9 月第 2 周组会', meta: '手动创建', tags: ['会议纪要'], owner: '周砚', status: '已归档', daysAgo: 12 },
  { type: '文档', title: '术语表 · 特征工程部分', meta: '由 4 条记忆聚合', tags: ['术语'], owner: '周砚', status: '已完成', daysAgo: 9 },
  { type: '文档', title: '实验记录 · Batch 16 vs 32 对照', meta: '关联实验 #12', tags: ['实验设计', '评测'], owner: '林科', status: '进行中', daysAgo: 3 },
]

/* 筛选选项（由数据聚合，保持真实） */
const allTags = [...new Set(DEMO.flatMap((i) => i.tags))]
const allOwners = [...new Set(DEMO.map((i) => i.owner))]
const typeOptions = ['全部', '记忆', '任务', '文档']
const timeOptions = ['全部', '今天', '本周', '本月']
const statusOptions = ['全部', '进行中', '已完成', '已归档']

const query = ref('')
const fType = ref('全部')
const fTag = ref('全部')
const fTime = ref('全部')
const fOwner = ref('全部')
const fStatus = ref('全部')

const results = computed<SearchItem[]>(() => {
  const q = query.value.trim().toLowerCase()
  return DEMO.filter((item) => {
    if (fType.value !== '全部' && item.type !== fType.value) return false
    if (fTag.value !== '全部' && !item.tags.includes(fTag.value)) return false
    if (fOwner.value !== '全部' && item.owner !== fOwner.value) return false
    if (fStatus.value !== '全部' && item.status !== fStatus.value) return false
    if (fTime.value !== '全部') {
      const limit = fTime.value === '今天' ? 1 : fTime.value === '本周' ? 7 : 30
      if (item.daysAgo > limit) return false
    }
    if (q) {
      const hay = `${item.title} ${item.meta} ${item.tags.join(' ')} ${item.owner}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

/* 快捷键：⌘K / Ctrl+K 唤起，Esc 关闭 */
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (viz.searchOpen) viz.closeSearch()
    else viz.openSearch()
  } else if (e.key === 'Escape' && viz.searchOpen) {
    viz.closeSearch()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const inputEl = ref<HTMLInputElement | null>(null)
watch(
  () => viz.searchOpen,
  (open) => {
    if (open) {
      query.value = ''
      void nextTick(() => inputEl.value?.focus())
    }
  },
)

function pick(_item: SearchItem) {
  /* TODO：接入后端后按 _item.type 跳转工作台对应模块 */
  viz.closeSearch()
}
</script>

<template>
  <Transition name="search-fade">
    <div v-if="viz.searchOpen" class="search-layer" @click.self="viz.closeSearch()">
      <div class="search-panel" role="dialog" aria-modal="true" aria-label="搜索记忆、任务与文档">
        <div class="search-row">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input ref="inputEl" v-model="query" class="search-input" type="text" placeholder="搜索记忆、任务与文档…" />
          <button class="search-esc" type="button" @click="viz.closeSearch()">ESC</button>
        </div>

        <div class="filters">
          <label class="filter">
            <span>类型</span>
            <select v-model="fType">
              <option v-for="o in typeOptions" :key="o">{{ o }}</option>
            </select>
          </label>
          <label class="filter">
            <span>标签</span>
            <select v-model="fTag">
              <option>全部</option>
              <option v-for="o in allTags" :key="o">{{ o }}</option>
            </select>
          </label>
          <label class="filter">
            <span>时间</span>
            <select v-model="fTime">
              <option v-for="o in timeOptions" :key="o">{{ o }}</option>
            </select>
          </label>
          <label class="filter">
            <span>负责人</span>
            <select v-model="fOwner">
              <option>全部</option>
              <option v-for="o in allOwners" :key="o">{{ o }}</option>
            </select>
          </label>
          <label class="filter">
            <span>状态</span>
            <select v-model="fStatus">
              <option v-for="o in statusOptions" :key="o">{{ o }}</option>
            </select>
          </label>
        </div>

        <p class="data-note">演示数据</p>

        <ul class="results">
          <li v-for="item in results" :key="item.title" @click="pick(item)">
            <span class="result-type">{{ item.type }}</span>
            <span class="result-main">
              <b>{{ item.title }}</b>
              <small>{{ item.meta }} · {{ item.owner }} · {{ item.status }}</small>
            </span>
            <span class="result-arrow">→</span>
          </li>
          <li v-if="!results.length" class="results-empty">没有匹配的结果</li>
        </ul>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.search-layer {
  position: fixed;
  inset: 0;
  z-index: var(--z-search);
  background: var(--bb-modal-mask);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 16vh 20px 40px;
  overflow-y: auto;
}
.search-panel {
  width: 100%;
  max-width: 660px;
  background: var(--bb-bg-elevated);
  backdrop-filter: blur(var(--bb-card-blur));
  border: 1px solid var(--bb-line-strong);
  box-shadow: 0 30px 80px var(--bb-modal-mask);
}
.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--bb-line);
}
.search-icon {
  color: var(--bb-dim);
  flex: 0 0 auto;
}
.search-input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--bb-text);
  font-size: 15px;
  font-family: inherit;
  letter-spacing: 0.01em;
}
.search-input::placeholder {
  color: var(--bb-dim);
}
.search-esc {
  border: 1px solid var(--bb-line-strong);
  background: transparent;
  color: var(--bb-dim);
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.08em;
  padding: 3px 7px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}
.search-esc:hover {
  color: var(--bb-text);
  border-color: var(--bb-accent-border);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--bb-line);
}
.filter {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter span {
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.08em;
  color: var(--bb-dim);
}
.filter select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--bb-card);
  color: var(--bb-text);
  border: 1px solid var(--bb-line-strong);
  border-radius: 4px;
  padding: 5px 24px 5px 8px;
  font-size: var(--bb-fs-xs);
  font-family: inherit;
  outline: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%23808080' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}
.data-note {
  margin: 0;
  padding: 10px 20px 0;
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.08em;
  color: var(--bb-text-3);
  text-align: right;
}
.results {
  list-style: none;
  margin: 0;
  padding: 6px 0 10px;
  max-height: 42vh;
  overflow-y: auto;
}
.results li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--bb-line);
  cursor: pointer;
  transition: background 0.2s;
}
.results li:hover {
  background: var(--bb-accent-tint);
}
.result-type {
  flex: 0 0 auto;
  font-family: var(--bb-font-mono);
  font-size: var(--bb-fs-xs);
  letter-spacing: 0.08em;
  color: var(--bb-muted);
  border: 1px solid var(--bb-line-strong);
  padding: 2px 7px;
}
.result-main {
  flex: 1;
  min-width: 0;
}
.result-main b {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--bb-text);
}
.result-main small {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--bb-dim);
}
.result-arrow {
  color: var(--bb-dim);
  transition: color 0.2s, transform 0.2s;
}
.results li:hover .result-arrow {
  color: var(--bb-text);
  transform: translateX(4px);
}
.results-empty {
  justify-content: center;
  color: var(--bb-dim);
  font-size: var(--bb-fs-sm);
  cursor: default;
}
.results-empty:hover {
  background: transparent;
}
.search-fade-enter-active {
  transition: opacity var(--bb-dur-base) var(--bb-ease-out);
}
.search-fade-leave-active {
  transition: opacity var(--bb-dur-fast) var(--bb-ease-out);
}
.search-fade-enter-from,
.search-fade-leave-to {
  opacity: 0;
}
/* 面板升起 + 回弹：Transition 类与 .search-layer 同元素复合 */
.search-layer.search-fade-enter-active .search-panel {
  transition: transform var(--bb-dur-base) var(--bb-ease-spring);
}
.search-layer.search-fade-enter-from .search-panel {
  transform: translateY(-10px) scale(0.98);
}
</style>
