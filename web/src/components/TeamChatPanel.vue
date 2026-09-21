<template>
  <section class="team-chat">
    <header>
      <div><p class="eyebrow">团队通讯</p><h1>和队员一起，把事情聊清楚。</h1><p class="intro">{{ projectName }} · 团队成员可查看聊天记录</p></div>
      <span class="connection" :class="{ online: status === '已连接' }" role="status">{{ status }}</span>
    </header>
    <div v-if="loading" class="empty" role="status">正在加载团队消息…</div>
    <div v-else-if="loadError" class="empty" role="alert"><p>{{ loadError }}</p><button class="bb-btn" @click="start">重新加载</button></div>
    <template v-else>
      <div ref="scroller" class="message-list" role="log" aria-label="团队聊天记录" aria-live="polite" @scroll="onScroll">
        <button v-if="hasMore" class="history" :disabled="loadingOlder" @click="loadOlder">{{ loadingOlder ? '正在加载…' : '加载更早消息' }}</button>
        <p v-if="!messages.length && !outgoing.length" key="empty" class="empty">还没有消息，向队员打个招呼吧。</p>
        <TransitionGroup name="tm">
        <article v-for="message in messages" :key="message.id" class="team-message" :class="{ mine: message.sender_id === userId }">
          <div class="message-meta"><strong>{{ message.sender_name }}</strong><time :datetime="message.created_at">{{ formatTime(message.created_at) }}</time></div>
          <p class="message-content">{{ message.content }}</p>
        </article>
        </TransitionGroup>
        <article v-for="item in outgoing" :key="item.request_id" class="team-message mine pending">
          <div class="message-meta"><strong>我</strong><span role="status">{{ item.sending ? '发送中…' : '尚未确认送达' }}</span></div>
          <p class="message-content">{{ item.content }}</p>
          <div v-if="!item.sending" class="retry" role="alert"><span>{{ item.error }}</span><button class="history" :disabled="denied || archived" @click="deliver(item)">重试发送</button></div>
        </article>
      </div>
      <button v-if="newMessages" class="new-messages" @click="scrollBottom">有新消息 ↓</button>
      <p v-if="actionError" class="action-error" role="alert">{{ actionError }}</p>
      <form class="composer" @submit.prevent="send">
        <label class="sr-label" for="team-message-draft">发送给团队</label>
        <textarea id="team-message-draft" v-model="draft" class="bb-input" rows="3" maxlength="5000" placeholder="发送给队员，Enter 发送，Shift+Enter 换行" :disabled="denied || archived" @keydown="onKeydown"></textarea>
        <div class="composer-footer"><span>{{ archived ? '项目已归档，聊天只读' : denied ? '已无权访问此团队' : `${draft.length}/5000 · 仅发送给团队成员` }}</span><button class="bb-btn primary" :disabled="!draft.trim() || denied || archived || outgoing.length >= 5" type="submit">发送</button></div>
      </form>
    </template>
  </section>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { api, subscribeTeamMessages } from '../api'
const props = defineProps({ pid: { type: String, required: true }, userId: String, projectName: String, archived: Boolean })
const messages = ref([]), outgoing = ref([]), draft = ref(''), status = ref('正在连接'), loading = ref(true), loadError = ref(''), actionError = ref(''), denied = ref(false)
const scroller = ref(null), hasMore = ref(false), loadingOlder = ref(false), newMessages = ref(false)
let stream, disposed = false, nearBottom = true
const root = () => `/api/v1/projects/${props.pid}/team-chat`
const formatTime = value => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
function onScroll() { const el = scroller.value; if (el) { nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80; if (nearBottom) newMessages.value = false } }
async function scrollBottom() { await nextTick(); if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight; nearBottom = true; newMessages.value = false }
function merge(items) {
  const known = new Map(messages.value.map(m => [m.id, m]))
  let added = false
  for (const m of items) { if (!known.has(m.id)) added = true; known.set(m.id, m); outgoing.value = outgoing.value.filter(p => p.request_id !== m.request_id) }
  messages.value = [...known.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1)
  return added
}
async function start() {
  stream?.close(); loading.value = true; loadError.value = ''; denied.value = false
  try {
    const data = await api('GET', root() + '/messages')
    if (disposed) return
    messages.value = []; merge(data.items); hasMore.value = data.has_more
    stream = subscribeTeamMessages(props.pid, data.latest_cursor, {
      onOpen: () => { status.value = '已连接' },
      onDisconnect: error => { status.value = '连接中断，正在重连'; if (error.message.includes('无权')) { denied.value = true; status.value = '访问已终止' } },
      onEvent(type, data) {
        if (type === 'access.revoked') { denied.value = true; status.value = '访问已终止'; messages.value = []; return }
        if (type === 'team.message' && merge([data])) { if (nearBottom) scrollBottom(); else newMessages.value = true }
      },
    })
  } catch (e) { loadError.value = e.message; status.value = '未连接' }
  finally { loading.value = false; scrollBottom() }
}
async function loadOlder() {
  if (loadingOlder.value) return
  loadingOlder.value = true; actionError.value = ''
  const oldHeight = scroller.value?.scrollHeight || 0, oldTop = scroller.value?.scrollTop || 0
  try { const data = await api('GET', root() + `/messages?before=${messages.value[0].id}`); merge(data.items); hasMore.value = data.has_more; await nextTick(); if (scroller.value) scroller.value.scrollTop = oldTop + scroller.value.scrollHeight - oldHeight }
  catch (e) { actionError.value = e.message } finally { loadingOlder.value = false }
}
async function deliver(item) {
  if (item.sending) return
  item.sending = true; item.error = ''
  try { const message = await api('POST', root() + '/messages', { content: item.content, request_id: item.request_id }); merge([message]); if (nearBottom) scrollBottom() }
  catch (e) { item.error = e.message } finally { item.sending = false }
}
function send() {
  if (!draft.value.trim() || denied.value || props.archived || outgoing.value.length >= 5) return
  outgoing.value.push({ request_id: crypto.randomUUID(), content: draft.value.trim(), sending: false, error: '' })
  const item = outgoing.value[outgoing.value.length - 1]
  draft.value = ''; scrollBottom(); deliver(item)
}
function onKeydown(e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send() } }
onMounted(start)
onBeforeUnmount(() => { disposed = true; stream?.close() })
</script>

<style scoped>
.team-chat { height: 100%; min-height: 0; display: flex; flex-direction: column; padding: 32px 48px 24px; position: relative; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid var(--bb-line); }
h1 { font-size: 25px; margin: 8px 0; letter-spacing: -.02em; }
.intro { color: var(--bb-muted); font-size: var(--bb-fs-sm); }
.connection { font-size: var(--bb-fs-sm); color: var(--bb-warning); white-space: nowrap; padding-top: 8px; }
.connection.online { color: var(--bb-success); }
.message-list { flex: 1; min-height: 180px; overflow-y: auto; padding: 24px 4px; display: flex; flex-direction: column; gap: 20px; }
.tm-enter-active { transition: opacity var(--bb-dur-base) var(--bb-ease-out), transform var(--bb-dur-base) var(--bb-ease-spring); }
.tm-enter-from { opacity: 0; transform: translateY(8px); }
.team-message { max-width: 78%; align-self: flex-start; }
.team-message.mine { align-self: flex-end; }
.message-meta { display: flex; align-items: baseline; gap: 12px; font-size: var(--bb-fs-sm); margin-bottom: 7px; color: var(--bb-text); }
.message-meta time,.message-meta span { font-size: var(--bb-fs-xs); color: var(--bb-dim); }
.message-content { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; padding: 12px 16px; border-radius: 4px 14px 14px; background: var(--bb-chat-bubble); color: var(--bb-text); font-size: var(--bb-fs-md); line-height: 1.7; }
.mine .message-content { background: var(--bb-chat-mine); border-radius: 14px 4px 14px 14px; }
.pending { opacity: .7; }
.empty { margin: auto; padding: 32px; color: var(--bb-dim); text-align: center; }
.history { border: 0; background: none; color: var(--bb-accent-soft); font-size: var(--bb-fs-sm); padding: 8px; cursor: pointer; align-self: center; }
.history:disabled { opacity: .5; }
.retry { font-size: var(--bb-fs-sm); color: var(--bb-danger); }
.composer { border-top: 1px solid var(--bb-line); padding-top: 16px; }
.composer textarea { width: 100%; resize: vertical; max-height: 180px; box-sizing: border-box; }
.composer-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }
.composer-footer span { font-size: var(--bb-fs-xs); color: var(--bb-dim); }
.sr-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.new-messages { align-self: center; border: 1px solid var(--bb-line-strong); background: var(--bb-bg-elevated); color: var(--bb-text); border-radius: 20px; padding: 8px 20px; cursor: pointer; font-size: var(--bb-fs-sm); }
.new-messages:hover { border-color: var(--bb-accent-border); color: var(--bb-accent-soft); }
.action-error { color: var(--bb-danger); font-size: var(--bb-fs-sm); }
@media(max-width:760px) { .team-chat { padding: 64px 18px 16px; } header { flex-direction: column; gap: 4px; } h1 { font-size: 21px; }.team-message { max-width: 92%; } }
</style>
