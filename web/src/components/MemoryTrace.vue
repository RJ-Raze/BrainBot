<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const props = defineProps({
  pid: { type: String, required: true },
  memory: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const loading = ref(true)
const error = ref('')
const trace = ref(null)
const expanded = ref(new Set())

const KIND_LABEL = {
  conversation: '对话晋升',
  paper_card: '文献卡片晋升',
  manual: '手工录入',
}

function toggle(id) {
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

onMounted(async () => {
  try {
    trace.value = await api('GET', `/api/v1/projects/${props.pid}/memories/${props.memory.id}/provenance`)
    // 默认展开源消息
    if (trace.value.source_messages?.length) {
      trace.value.source_messages.forEach((m) => expanded.value.add('msg-' + m.id))
    }
  } catch (e) {
    error.value = e.message || '溯源信息加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal wide trace-modal" role="dialog" aria-modal="true" aria-label="记忆溯源">
      <p class="eyebrow">记忆溯源 · {{ KIND_LABEL[trace?.kind] || '…' }}</p>
      <h3>{{ memory.title }}</h3>

      <p v-if="loading" class="trace-state" role="status">正在追溯这条记忆的来龙去脉…</p>
      <p v-else-if="error" class="trace-state error">{{ error }}</p>

      <template v-else>
        <!-- 手工录入：无上游 -->
        <div v-if="trace.kind === 'manual'" class="trace-chain">
          <div class="trace-node">
            <b>{{ memory.title }}</b>
            <p class="trace-desc">这条记忆由成员手工录入，没有可追溯的上游来源。</p>
          </div>
        </div>

        <!-- 对话晋升：记忆 → 角色/成员 → 会话 → 源消息 -->
        <div v-else-if="trace.kind === 'conversation'" class="trace-chain">
          <div class="trace-node is-root">
            <span class="trace-node-label">共享记忆</span>
            <b>{{ memory.title }}</b>
            <p class="trace-desc">{{ memory.content }}</p>
          </div>

          <div class="trace-connector">↓ 由谁晋升</div>

          <div class="trace-node">
            <span class="trace-node-label">来源角色 · 成员</span>
            <b>{{ trace.role?.name || '未知角色' }}</b>
            <p class="trace-desc">
              {{ trace.role?.memberName ? trace.role.memberName + ' · ' : '' }}{{ trace.author?.display_name || trace.author?.username || '已注销成员' }}
            </p>
          </div>

          <div class="trace-connector">↓ 出自会话</div>

          <div class="trace-node">
            <span class="trace-node-label">源会话</span>
            <b>{{ trace.conversation?.title || '源会话已删除' }}</b>
            <p v-if="trace.conversation?.role_name" class="trace-desc">角色「{{ trace.conversation.role_name }}」的协作会话</p>
            <p v-else class="trace-desc">该会话已被归档或删除，仅保留记忆快照。</p>
          </div>

          <div class="trace-connector">↓ 摘取自这段回复</div>

          <div v-if="trace.source_messages?.length" class="trace-node source">
            <div v-for="m in trace.source_messages" :key="m.id" class="src-msg">
              <button class="src-head" type="button" @click="toggle('msg-' + m.id)">
                <span class="bb-tag" :class="{ highlight: m.is_source }">{{ m.is_source ? '源消息' : '上下文' }}</span>
                <small>{{ m.sender_type === 'assistant' ? 'AI 回复' : m.sender_name || '成员' }} · {{ new Date(m.created_at).toLocaleString('zh-CN', { hour12: false }) }}</small>
                <i class="chev">{{ expanded.has('msg-' + m.id) ? '▾' : '▸' }}</i>
              </button>
              <pre v-if="expanded.has('msg-' + m.id)" class="src-body" :class="{ highlight: m.is_source }">{{ m.content }}</pre>
            </div>
          </div>
          <div v-else class="trace-node">
            <span class="trace-node-label">源消息</span>
            <p class="trace-desc">源消息已不存在（可能被清理），仅保留记忆内容。</p>
          </div>
        </div>

        <!-- 文献卡片晋升：记忆 → 卡片 → 论文 -->
        <div v-else-if="trace.kind === 'paper_card'" class="trace-chain">
          <div class="trace-node is-root">
            <span class="trace-node-label">共享记忆</span>
            <b>{{ memory.title }}</b>
            <p class="trace-desc">{{ memory.content }}</p>
          </div>

          <div class="trace-connector">↓ 由谁晋升</div>

          <div class="trace-node">
            <span class="trace-node-label">文献卡片</span>
            <b>{{ trace.paper_card?.author_name || '未知成员' }} 的精读笔记</b>
            <p v-if="trace.paper_card?.notes" class="trace-desc">{{ trace.paper_card.notes }}</p>
            <p class="trace-meta">
              <span class="bb-tag">{{ { unverified: '未核验', reviewed: '已核验', conflicting: '存在冲突' }[trace.paper_card?.evidence_status] || trace.paper_card?.evidence_status }}</span>
              <small v-if="trace.paper_card?.role_name">角色「{{ trace.paper_card.role_name }}」</small>
            </p>
            <blockquote v-if="trace.paper_card?.evidence_quote" class="src-body">“{{ trace.paper_card.evidence_quote }}”</blockquote>
          </div>

          <div class="trace-connector">↓ 出处论文</div>

          <div class="trace-node">
            <span class="trace-node-label">论文</span>
            <b>{{ trace.paper_card?.paper?.title || '论文已删除' }}</b>
            <p class="trace-desc">
              {{ (trace.paper_card?.paper?.authors || []).slice(0, 3).join(', ') }}{{ (trace.paper_card?.paper?.authors || []).length > 3 ? ' 等' : '' }}
              <template v-if="trace.paper_card?.paper?.year"> · {{ trace.paper_card.paper.year }}</template>
              <template v-if="trace.paper_card?.paper?.venue"> · {{ trace.paper_card.paper.venue }}</template>
            </p>
          </div>
        </div>
      </template>

      <div class="modal-actions">
        <button class="bb-btn primary" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trace-modal h3 { margin: 6px 0 22px; }
.trace-state { color: var(--bb-muted); font-size: var(--bb-fs-sm); padding: 20px 0; }
.trace-state.error { color: var(--bb-danger, #e05c5c); }
.trace-chain { display: flex; flex-direction: column; gap: 0; }
.trace-node {
  border: 1px solid var(--bb-line);
  border-radius: var(--bb-radius-control, 10px);
  padding: 14px 16px;
  background: var(--bb-surface);
  text-align: left;
}
.trace-node.is-root { border-color: var(--bb-accent-border, var(--bb-accent)); }
.trace-node-label {
  display: block;
  font-size: 11px;
  letter-spacing: .08em;
  color: var(--bb-dim, var(--bb-muted));
  text-transform: uppercase;
  margin-bottom: 6px;
}
.trace-node b { display: block; font-size: 15px; font-weight: 550; }
.trace-desc { margin: 8px 0 0; color: var(--bb-muted); font-size: var(--bb-fs-sm); line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.trace-meta { margin: 10px 0 0; display: flex; align-items: center; gap: 10px; }
.trace-meta small { color: var(--bb-dim, var(--bb-muted)); }
.trace-connector {
  align-self: flex-start;
  margin: 4px 0 4px 14px;
  padding-left: 14px;
  border-left: 2px solid var(--bb-line);
  color: var(--bb-dim, var(--bb-muted));
  font-size: 12px;
  line-height: 2.4;
}
.source { display: flex; flex-direction: column; gap: 10px; }
.src-msg { border-top: 1px dashed var(--bb-line); padding-top: 10px; }
.src-msg:first-child { border-top: 0; padding-top: 0; }
.src-head {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: transparent; border: 0; padding: 0; cursor: pointer; text-align: left;
  font: inherit;
}
.src-head small { color: var(--bb-dim, var(--bb-muted)); flex: 1; }
.src-head .chev { color: var(--bb-dim, var(--bb-muted)); }
.src-body {
  margin: 10px 0 0;
  font: 13px/1.7 inherit;
  white-space: pre-wrap; overflow-wrap: anywhere;
  background: var(--bb-surface-2, var(--bb-btn-bg, #f5f5f5));
  border: 1px solid var(--bb-line);
  border-radius: 8px;
  padding: 12px;
  max-height: 320px; overflow: auto;
}
.src-body.highlight, .src-body blockquote { border-color: var(--bb-accent-border, var(--bb-accent)); }
blockquote.src-body { margin: 10px 0 0; border-left: 3px solid var(--bb-accent); }
</style>
