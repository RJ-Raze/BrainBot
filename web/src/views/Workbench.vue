<template>
  <section class="workbench">
    <Sidebar
      :projectName="project?.name || '加载中…'"
      :subtitle="project?.status === 0 ? '初始化中' : '运行模式'"
      :navItems="navItems"
      :activeKey="page"
      :avatarChar="avatarChar"
      :userName="user?.display_name || user?.username || ''"
      :userRole="myRole ? `${myRole.member_name || myRole.name} · ${project?.owner_id === user?.id ? '创立人' : '成员'}` : '未认领角色'"
      @navigate="navigateTo"
      @back="$router.push('/projects')"
    />

    <main class="main">
      <div v-if="workspaceLoading" class="workspace-state">
        <p class="bb-progress" role="status" aria-live="polite" aria-atomic="true">
          <span class="bb-progress-mark" aria-hidden="true">⌁</span>
          <span class="bb-progress-copy">正在载入项目工作区</span>
        </p>
        <small>同步成员、任务与团队知识。</small>
      </div>
      <div v-else-if="workspaceError" class="workspace-state error-state" role="alert">
        <p>工作区暂时无法打开。</p>
        <small>{{ workspaceError }}</small>
        <button class="bb-btn" @click="loadWorkspace">重新加载</button>
      </div>
      <template v-else>
      <Transition name="panel" mode="out-in">
      <!-- ============ 我的任务 ============ -->
      <div v-if="page === 'tasks'" key="tasks" class="panel-page">
        <header class="head">
          <p class="eyebrow">{{ myRole ? `我的分工 · ${myRole.description || ''}` : '我的任务' }}</p>
          <h1>把今天要推进的事情做清楚。</h1>
          <p class="head-sub">这里只显示分派给你角色的任务。状态变更全队可见。</p>
          <div v-if="myRole" class="head-focus">
            <span>当前焦点</span>
            <b>{{ focusTask?.title || '整理今天的推进顺序' }}</b>
            <small>{{ focusTask ? focusTaskMeta : '暂无待推进任务' }}</small>
          </div>
        </header>
        <div class="body">
          <div v-if="!myRole" class="hint">
            <p>你还没有认领角色。</p>
            <button class="bb-btn primary" @click="$router.push('/join')">用邀请码认领角色 →</button>
          </div>
          <template v-else>
            <TransitionGroup name="task">
            <div v-for="t in myTasks" :key="t.id" class="task-row" :class="{ done: t.status === 'done', focus: t.id === focusTask?.id, pending: pendingTaskId === t.id }">
              <button
                class="check"
                :disabled="pendingTaskId === t.id"
                :title="taskAction(t).label"
                @click="toggleTask(t)"
              >{{ t.status === 'done' ? '✓' : taskAction(t).symbol }}</button>
              <div class="task-main">
                <b>{{ t.title }}</b>
                <p>{{ t.description }}</p>
                <small v-if="t.match_reasoning">{{ t.match_reasoning }}</small>
                <p v-if="pendingTaskId === t.id" class="task-progress bb-progress" role="status" aria-live="polite" aria-atomic="true">
                  <span class="bb-progress-mark" aria-hidden="true">⌁</span>
                  <span class="bb-progress-copy">正在更新任务状态</span>
                </p>
              </div>
              <div class="task-side">
                <span class="bb-tag" :class="{ red: t.priority === 'P0' }">{{ t.priority }}</span>
                <select class="bb-input status" :value="t.status" :disabled="pendingTaskId === t.id" @change="setStatus(t, $event.target.value)">
                  <option v-for="status in selectableStatuses(t)" :key="status" :value="status">{{ STATUS_LABEL[status] }}</option>
                </select>
              </div>
            </div>
            </TransitionGroup>
            <p v-if="!myTasks.length" class="empty">你的角色目前没有待办任务。</p>
          </template>
        </div>
      </div>

      <!-- ============ 任务看板（全队 · 实时联动） ============ -->
      <div v-else-if="page === 'board'" key="board" class="panel-page">
        <header class="head">
          <p class="eyebrow">任务看板 · 全队{{ syncLabel }}</p>
          <h1>所有人的进展，一眼看全。</h1>
          <p class="head-sub">拖拽卡片改状态，队友的屏幕上 1 秒内同步跳动。</p>
        </header>
        <div class="body board-body">
          <div class="mem-toolbar">
            <small class="doc-meta">{{ allTasks.length }} 项任务 · {{ doneCount }} 已完成</small>
            <button class="bb-btn" @click="showNewTask = true">+ 新建任务</button>
          </div>
          <div class="kanban">
            <div
              v-for="col in BOARD_COLS" :key="col.key"
              class="kcol" :class="{ over: dragOverCol === col.key, disabled: dragTask && !canMoveTo(dragTask, col.key) }"
              @dragover.prevent="onDragOver(col.key)"
              @dragleave="dragOverCol = null"
              @drop="dropTask(col.key)"
            >
              <div class="kcol-head">
                <span>{{ col.label }}</span>
                <i>{{ tasksByStatus(col.key).length }}</i>
              </div>
              <TransitionGroup name="kcard">
              <div
                v-for="t in tasksByStatus(col.key)" :key="t.id"
                class="kcard" draggable="true"
                @dragstart="dragTask = t"
                @dragend="dragTask = null; dragOverCol = null"
              >
                <b>{{ t.title }}</b>
                <p v-if="t.description">{{ t.description }}</p>
                <div class="kcard-foot">
                  <span class="bb-tag" :class="{ red: t.priority === 'P0' }">{{ t.priority }}</span>
                  <span v-if="t.member_name || t.role_name" class="krole">{{ t.member_name || t.role_name }}</span>
                  <span v-if="t.references?.length" class="kref" title="关联引用">🔗 {{ t.references.length }}</span>
                </div>
              </div>
              </TransitionGroup>
              <p v-if="!tasksByStatus(col.key).length" class="kempty">暂无任务，拖入卡片开始推进</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ AI 协作 ============ -->
      <div v-else-if="page === 'chat'" key="chat" class="panel-page">
        <header class="head chat-head">
          <div class="chat-head-row">
            <div>
              <p class="eyebrow">{{ myRole ? `与 AI 协作 · 以「${myRole.member_name || myRole.name}」的身份` : 'AI 协作' }}</p>
              <h1>{{ currentConv ? currentConv.title : '带着你的分工，和 AI 一起推进。' }}</h1>
            </div>
            <button v-if="currentConv" class="ctx-btn" @click="showContext" title="查看当前注入的上下文">注入上下文 · 透明化</button>
          </div>
        </header>

        <div v-if="!myRole" class="body"><div class="hint"><p>认领角色后才能与 AI 协作。</p></div></div>
        <template v-else>
          <div ref="msgBox" class="messages">
            <TransitionGroup name="msg">
            <div v-for="(m, i) in messages" :key="m.id || i" class="msg" :class="m.sender_type">
              <div class="bubble">
                <div class="mhead">{{ m.sender_type === 'user' ? (m.sender_name || '我') : 'AI 协作伙伴' }}</div>
                <div class="mtext">
                  <span v-if="m.streaming && !m.content" class="bb-progress-copy" role="status" aria-live="polite" aria-atomic="true">协作助手正在整理回复</span>
                  <template v-else>{{ m.content }}</template><span v-if="m.streaming" class="cursor">▍</span>
                </div>
                <div v-if="m.sender_type === 'assistant' && !m.streaming && m.id" class="mfoot">
                  <span v-if="m.promoted_memory_id" class="promoted-tag">已晋升到共享记忆 ✓</span>
                  <button v-else class="promote-btn" @click="openPromote(m)">↑ 晋升为共享记忆</button>
                </div>
              </div>
            </div>
            </TransitionGroup>
            <p v-if="!messages.length" class="empty">AI 已加载项目背景与你的分工。直接说出你要推进的事。</p>
          </div>
          <div class="input-bar">
            <textarea
              v-model="draft" class="bb-input" rows="2"
              placeholder="输入消息，Enter 发送（Shift+Enter 换行）"
              :disabled="sending"
              @keydown.enter.exact.prevent="send"
            ></textarea>
            <button class="bb-btn primary send-btn" :disabled="!draft.trim() || sending" :aria-busy="sending" @click="send">
              <span v-if="sending" class="bb-progress-copy">正在发送</span><span v-else>发送</span>
            </button>
          </div>
        </template>
      </div>

      <!-- ============ 共享记忆 ============ -->
      <div v-else-if="page === 'memory'" key="memory" class="panel-page">
        <header class="head">
          <p class="eyebrow">共享记忆 · 团队共识的沉淀池</p>
          <h1>被晋升的结论，会成为每个角色的上下文。</h1>
          <p class="head-sub">对话中有价值的 AI 回复一键晋升到这里；下一轮对话，全员角色的 AI 都会带上它们。</p>
        </header>
        <div class="body">
          <div class="mem-toolbar">
            <div class="chip-row">
              <button class="chip" :class="{ on: !memFilter }" @click="memFilter = ''; loadMemories()">全部</button>
              <button v-for="(label, cat) in CAT_LABEL" :key="cat" class="chip" :class="{ on: memFilter === cat }" @click="memFilter = cat; loadMemories()">{{ label }}</button>
            </div>
            <button class="bb-btn" @click="showManualMem = true">手工写入</button>
          </div>
          <div v-for="m in memories" :key="m.id" class="mem-row">
            <div class="mem-head">
              <span class="bb-tag" :class="CAT_CLASS[m.category]">{{ CAT_LABEL[m.category] || m.category }}</span>
              <b>{{ m.is_pinned ? '📌 ' : '' }}{{ m.title }}</b>
              <span class="stars">{{ '★'.repeat(m.importance) }}<i>{{ '★'.repeat(5 - m.importance) }}</i></span>
            </div>
            <p class="mem-content">{{ m.content }}</p>
            <div class="mem-foot">
              <small>
                {{ m.source_role_name ? `来源角色 ${m.source_role_name}` : '手工写入' }}
                {{ m.source_user_name ? ` · ${m.source_user_name}` : '' }}
                {{ m.source_conversation_id ? ` · 会话 ${m.source_conversation_id.slice(0, 8)}…` : '' }}
                {{ m.tags.length ? ' · ' + m.tags.map(t => '#' + t).join(' ') : '' }}
              </small>
              <div class="mem-actions">
                <button class="link-btn" @click="openTrace(m)">溯源</button>
                <button class="link-btn" @click="togglePin(m)">{{ m.is_pinned ? '取消置顶' : '置顶' }}</button>
                <button class="link-btn danger" @click="withdraw(m)">撤回</button>
              </div>
            </div>
          </div>
          <p v-if="!memories.length" class="empty">还没有共享记忆。去 AI 协作里把有价值的回复晋升上来。</p>
        </div>
      </div>

      <!-- ============ 总文档 ============ -->
      <div v-else-if="page === 'docs'" key="docs" class="panel-page">
        <header class="head">
          <p class="eyebrow">总文档 · 项目的单一事实来源</p>
          <h1>它不是被维护的，是自己长出来的。</h1>
          <p class="head-sub">总文档 = 共享记忆的视图。点刷新，从记忆库重新聚合；手动修改后将脱离自动同步。</p>
        </header>
        <div class="body">
          <div class="mem-toolbar">
            <small v-if="masterDoc" class="doc-meta">
              {{ masterDoc.is_auto_synced ? '自动同步中' : '已手动编辑 · 脱离自动同步' }} · 更新于 {{ fmtTime(masterDoc.updated_at) }}
            </small>
            <div style="display:flex;gap:10px">
              <button v-if="masterDoc && !editingDoc" class="bb-btn" @click="startEditDoc">手动编辑</button>
              <button class="bb-btn primary" :disabled="refreshing" :aria-busy="refreshing" @click="refreshDoc"><span v-if="refreshing" class="bb-progress-copy">正在聚合</span><span v-else>从共享记忆重新聚合</span></button>
            </div>
          </div>
          <div v-if="editingDoc" class="doc-edit">
            <textarea v-model="docDraft" class="bb-input doc-textarea" rows="24"></textarea>
            <div style="display:flex;gap:10px;margin-top:12px">
              <button class="bb-btn primary" :disabled="savingDoc" :aria-busy="savingDoc" @click="saveDoc"><span v-if="savingDoc" class="bb-progress-copy">正在提交文档</span><span v-else>保存</span></button>
              <button class="bb-btn" @click="editingDoc = false">取消</button>
            </div>
          </div>
          <pre v-else-if="masterDoc" class="doc-view">{{ masterDoc.content }}</pre>
          <p v-else class="empty">还没有总文档。点右上角「从共享记忆重新聚合」生成第一版。</p>
        </div>
      </div>

      <!-- ============ 科研工作区 ============ -->
      <ResearchPanel v-else-if="page === 'research'" key="research" class="panel-page" :pid="pid" :my-role="myRole" :refresh-key="researchRefreshKey" />

      <!-- ============ 科研驾驶舱 ============ -->
      <DashboardPanel v-else-if="page === 'dashboard'" key="dashboard" class="panel-page" :pid="pid" :refresh-key="researchRefreshKey" />

      <!-- ============ 审核与组会 ============ -->
      <WorkflowPanel v-else-if="page === 'workflow'" key="workflow" class="panel-page" :pid="pid" :can-review="canReviewEvidence" />

      <!-- ============ 团队通讯 ============ -->
      <TeamChatPanel v-else-if="page === 'team-chat'" key="team-chat" class="panel-page" :pid="pid" :user-id="user?.id" :project-name="project?.name" :archived="project?.status === 3" />

      <!-- ============ 团队 ============ -->
      <div v-else-if="page === 'team'" key="team" class="panel-page">
        <header class="head">
          <p class="eyebrow">团队</p>
          <h1>每个人都知道自己要接住什么。</h1>
          <p class="head-sub">角色边界清晰，协作时才不需要反复解释上下文。</p>
        </header>
        <div class="body">
          <div class="invite-code-box" v-if="project?.invite_code">
            <span>邀请码</span>
            <b>{{ project.invite_code }}</b>
            <small>分享给团队成员，他们输入后即可按分工认领角色加入</small>
          </div>
          <div class="member-list">
            <div v-for="r in roles" :key="r.id" class="member-row">
              <div class="avatar">{{ (r.member_name || r.name).slice(0, 1) }}</div>
              <div class="member-main">
                <b>{{ r.member_name || r.name }}</b>
                <p>{{ r.description }}</p>
              </div>
              <span v-if="claimantOf(r)" class="bb-tag green">{{ claimantOf(r) }}</span>
              <span v-else class="bb-tag">待认领</span>
            </div>
          </div>
        </div>
      </div>
      </Transition>
      </template>
    </main>

    <!-- ============ 新建任务弹窗 ============ -->
    <Transition name="bb-pop">
    <div v-if="showNewTask" class="modal-mask" @click.self="showNewTask = false">
      <div class="modal">
        <p class="eyebrow">新建任务</p>
        <h3>运行中发现的活，随时补进来。</h3>
        <label class="fld"><span>标题</span><input v-model="newTaskForm.title" class="bb-input" /></label>
        <label class="fld"><span>描述</span><textarea v-model="newTaskForm.description" class="bb-input" rows="3"></textarea></label>
        <label class="fld"><span>优先级</span>
          <select v-model="newTaskForm.priority" class="bb-input">
            <option value="P0">P0 · 关键路径</option>
            <option value="P1">P1 · 重要</option>
            <option value="P2">P2 · 常规</option>
          </select>
        </label>
        <label class="fld"><span>负责人</span>
          <select v-model="newTaskForm.role_id" class="bb-input">
            <option value="">暂不指派</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.member_name || r.name }}</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="bb-btn" @click="showNewTask = false">取消</button>
          <button class="bb-btn primary" :disabled="!newTaskForm.title.trim() || creatingTask" :aria-busy="creatingTask" @click="createTask"><span v-if="creatingTask" class="bb-progress-copy">正在提交任务</span><span v-else>创建</span></button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- ============ 晋升弹窗 ============ -->
    <Transition name="bb-pop">
    <div v-if="promoteTarget" class="modal-mask" @click.self="promoteTarget = null">
      <div class="modal">
        <p class="eyebrow">晋升为共享记忆</p>
        <h3>这条结论将进入全员的上下文。</h3>
        <div class="promote-preview">{{ promoteTarget.content.slice(0, 200) }}{{ promoteTarget.content.length > 200 ? '…' : '' }}</div>
        <label class="fld"><span>类型</span>
          <select v-model="promoteForm.category" class="bb-input">
            <option value="decision">决策</option>
            <option value="conclusion">结论</option>
            <option value="todo">待办</option>
            <option value="risk">风险</option>
            <option value="snippet">资料</option>
            <option value="fact">事实</option>
          </select>
        </label>
        <label class="fld"><span>标题</span>
          <input v-model="promoteForm.title" class="bb-input" placeholder="一句话概括这条记忆" />
        </label>
        <label class="fld"><span>标签（逗号分隔）</span>
          <input v-model="promoteForm.tags" class="bb-input" placeholder="如：蒸馏, BERT, 综述" />
        </label>
        <label class="fld"><span>重要度（1-5）</span>
          <select v-model.number="promoteForm.importance" class="bb-input">
            <option :value="5">5 · 核心结论</option>
            <option :value="4">4 · 重要</option>
            <option :value="3">3 · 一般</option>
            <option :value="2">2 · 参考</option>
            <option :value="1">1 · 弱相关</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="bb-btn" @click="promoteTarget = null">取消</button>
          <button class="bb-btn primary" :disabled="!promoteForm.title.trim() || promoting" :aria-busy="promoting" @click="doPromote">
            <span v-if="promoting" class="bb-progress-copy">正在写入共享记忆</span><span v-else>确认晋升</span>
          </button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- ============ 手工写入记忆弹窗 ============ -->
    <Transition name="bb-pop">
    <div v-if="showManualMem" class="modal-mask" @click.self="showManualMem = false">
      <div class="modal">
        <p class="eyebrow">手工写入共享记忆</p>
        <h3>直接把团队共识写进记忆库。</h3>
        <label class="fld"><span>类型</span>
          <select v-model="manualForm.category" class="bb-input">
            <option value="decision">决策</option>
            <option value="conclusion">结论</option>
            <option value="todo">待办</option>
            <option value="risk">风险</option>
            <option value="snippet">资料</option>
            <option value="fact">事实</option>
          </select>
        </label>
        <label class="fld"><span>标题</span><input v-model="manualForm.title" class="bb-input" /></label>
        <label class="fld"><span>正文</span><textarea v-model="manualForm.content" class="bb-input" rows="4"></textarea></label>
        <label class="fld"><span>重要度</span>
          <select v-model.number="manualForm.importance" class="bb-input">
            <option :value="5">5</option><option :value="4">4</option><option :value="3">3</option>
            <option :value="2">2</option><option :value="1">1</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="bb-btn" @click="showManualMem = false">取消</button>
          <button class="bb-btn primary" :disabled="!manualForm.title.trim() || !manualForm.content.trim()" @click="doManualMem">写入</button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- ============ 上下文透明化弹窗 ============ -->
    <Transition name="bb-pop">
    <div v-if="ctxPreview" class="modal-mask" @click.self="ctxPreview = null">
      <div class="modal wide">
        <p class="eyebrow">注入上下文 · 透明化</p>
        <h3>AI 下一轮回答前，实际看到的全部内容。</h3>
        <div class="ctx-layer">
          <b>L1 · 角色设定（恒定置顶，{{ ctxPreview.l1.tokens }} tokens）</b>
          <pre>{{ ctxPreview.l1.system_prompt }}</pre>
        </div>
        <div class="ctx-layer">
          <b>L2 · 共享记忆（{{ ctxPreview.l2.count }} 条注入）</b>
          <pre>{{ ctxPreview.l2.memories.join('\n') || '（暂无共享记忆）' }}</pre>
        </div>
        <div class="ctx-layer">
          <b>L3 · 会话历史（{{ ctxPreview.l3.message_count }} 条，超长只砍中部）</b>
        </div>
        <p class="ctx-total">预估总量 {{ ctxPreview.total_tokens }} tokens</p>
        <div class="modal-actions">
          <button class="bb-btn primary" @click="ctxPreview = null">知道了</button>
        </div>
      </div>
    </div>
    </Transition>

    <MemoryTrace v-if="traceTarget" :pid="pid" :memory="traceTarget" @close="traceTarget = null" />
  </section>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'
import ResearchPanel from '../components/ResearchPanel.vue'
import DashboardPanel from '../components/DashboardPanel.vue'
import WorkflowPanel from '../components/WorkflowPanel.vue'
import TeamChatPanel from '../components/TeamChatPanel.vue'
import MemoryTrace from '../components/MemoryTrace.vue'
import { api, chatStream, subscribeProjectEvents } from '../api'

const route = useRoute()
const toast = inject('toast')
const pid = route.params.pid

const CAT_LABEL = { decision: '决策', conclusion: '结论', todo: '待办', risk: '风险', snippet: '资料', fact: '事实', paper_card: '文献' }
const CAT_CLASS = { decision: 'green', conclusion: '', todo: '', risk: 'red', snippet: '', fact: '', paper_card: '' }

const user = ref(null)
const project = ref(null)
const roles = ref([])
const members = ref([])
const myTasks = ref([])
const page = ref('tasks')
const workspaceLoading = ref(true)
const workspaceError = ref('')

const currentConv = ref(null)
const messages = ref([])
const draft = ref('')
const sending = ref(false)
const msgBox = ref(null)

// 共享记忆
const memories = ref([])
const memFilter = ref('')
// 任务看板
const allTasks = ref([])
const dragTask = ref(null)
const dragOverCol = ref(null)
const pendingTaskId = ref('')
const showNewTask = ref(false)
const newTaskForm = ref({ title: '', description: '', priority: 'P1', role_id: '' })
const creatingTask = ref(false)
const BOARD_COLS = [
  { key: 'todo', label: '待开始' },
  { key: 'doing', label: '推进中' },
  { key: 'blocked', label: '受阻' },
  { key: 'review', label: '待评审' },
  { key: 'done', label: '已完成' },
]
// SSE 项目事件流
const eventSource = ref(null)
const syncState = ref('idle')
const syncTimer = ref(null)
const researchRefreshKey = ref(0)
// 总文档
const masterDoc = ref(null)
const refreshing = ref(false)
const editingDoc = ref(false)
const docDraft = ref('')
const savingDoc = ref(false)
// 晋升
const promoteTarget = ref(null)
const promoteForm = ref({ category: 'conclusion', title: '', tags: '', importance: 3 })
const promoting = ref(false)
// 手工记忆
const showManualMem = ref(false)
const manualForm = ref({ category: 'decision', title: '', content: '', importance: 3 })
// 记忆溯源
const traceTarget = ref(null)
// 上下文透明化
const ctxPreview = ref(null)

const navItems = [
  { section: '推进', key: 'tasks', label: '我的任务' },
  { key: 'board', label: '任务看板' },
  { section: '协作与知识', key: 'chat', label: 'AI 协作' },
  { key: 'memory', label: '共享记忆' },
  { key: 'docs', label: '总文档' },
  { section: '研究', key: 'research', label: '科研工作区' },
  { key: 'dashboard', label: '科研驾驶舱' },
  { key: 'workflow', label: '审核与组会' },
  { section: '团队', key: 'team-chat', label: '团队通讯' },
  { key: 'team', label: '团队' },
]

function navigateTo(nextPage) {
  if (navItems.some((item) => item.key === nextPage)) page.value = nextPage
}

const avatarChar = computed(() => (user.value?.display_name || user.value?.username || '我').slice(0, 1))
const syncLabel = computed(() => ({
  connecting: ' · 正在连接同步',
  online: ' · 实时同步中',
  reconnecting: ' · 正在重连',
}[syncState.value] || ''))

const canReviewEvidence = computed(() => {
  if (!user.value) return false
  if (project.value?.owner_id === user.value.id) return true
  return Boolean(members.value.find((member) => member.user_id === user.value.id)?.is_leader)
})

const myRole = computed(() => {
  if (!user.value) return null
  const m = members.value.find((x) => x.user_id === user.value.id)
  if (m) return roles.value.find((r) => r.id === m.role_id) || null
  return null
})

function claimantOf(role) {
  const m = members.value.find((x) => x.role_id === role.id)
  return m ? (m.display_name || m.username) : null
}

function fmtTime(t) {
  try { return new Date(t).toLocaleString('zh-CN', { hour12: false }) } catch { return t }
}

async function loadWorkspace() {
  workspaceLoading.value = true
  workspaceError.value = ''
  try {
    user.value = await api('GET', '/api/v1/auth/me')
    const detail = await api('GET', `/api/v1/projects/${pid}`)
    project.value = detail
    roles.value = detail.roles.filter((r) => !r.is_archived)
    members.value = detail.members
    await Promise.all([loadTasks(), loadAllTasks(), loadMemories(), loadMasterDoc()])
    connectEvents()
    if (myRole.value) await ensureConversation()
  } catch (e) {
    workspaceError.value = e.message || '请检查服务与登录状态后重试。'
    eventSource.value?.close()
    eventSource.value = null
    syncState.value = 'idle'
  } finally {
    workspaceLoading.value = false
  }
}
async function loadTasks() {
  const data = await api('GET', `/api/v1/projects/${pid}/tasks?mine=1`)
  myTasks.value = data.items
}

// ---- 任务看板 ----
const doneCount = computed(() => allTasks.value.filter((t) => t.status === 'done').length)

function tasksByStatus(status) {
  return allTasks.value.filter((t) => t.status === status)
}

const TASK_ACTIONS = {
  todo: { status: 'doing', label: '开始推进', symbol: '→' },
  doing: { status: 'review', label: '提交评审', symbol: '→' },
  blocked: { status: 'doing', label: '恢复推进', symbol: '→' },
  review: { status: 'done', label: '确认完成', symbol: '✓' },
  done: { status: 'todo', label: '重新打开', symbol: '↺' },
}
const TASK_TRANSITIONS = {
  todo: ['doing'], doing: ['todo', 'blocked', 'review', 'done'], blocked: ['todo', 'doing'], review: ['doing', 'done'], done: ['todo'],
}
const STATUS_LABEL = { todo: '待开始', doing: '推进中', blocked: '受阻', review: '待评审', done: '已完成' }
const focusTask = computed(() => {
  const actionable = myTasks.value.filter((task) => task.status !== 'done')
  return actionable.find((task) => task.priority === 'P0') || actionable.find((task) => task.status === 'doing') || actionable[0] || null
})
const focusTaskMeta = computed(() => {
  const task = focusTask.value
  return task ? `${STATUS_LABEL[task.status] || task.status} · ${task.priority}` : ''
})

function taskAction(task) {
  return TASK_ACTIONS[task.status] || { status: task.status, label: '更新任务', symbol: '·' }
}

function selectableStatuses(task) {
  return [task.status, ...(TASK_TRANSITIONS[task.status] || [])]
}

function canMoveTo(task, status) {
  return selectableStatuses(task).includes(status)
}

function onDragOver(status) {
  dragOverCol.value = dragTask.value && canMoveTo(dragTask.value, status) ? status : null
}

async function loadAllTasks() {
  const data = await api('GET', `/api/v1/projects/${pid}/tasks`)
  allTasks.value = data.items
}

async function dropTask(status) {
  dragOverCol.value = null
  const t = dragTask.value
  dragTask.value = null
  if (!t || t.status === status) return
  if (!canMoveTo(t, status)) {
    toast(`「${t.title}」请按状态流程逐步推进`, true)
    return
  }
  await setStatus(t, status)
}

async function createTask() {
  if (!newTaskForm.value.title.trim() || creatingTask.value) return
  creatingTask.value = true
  try {
    await api('POST', `/api/v1/projects/${pid}/tasks`, {
      title: newTaskForm.value.title.trim(),
      description: newTaskForm.value.description.trim() || undefined,
      priority: newTaskForm.value.priority,
      role_id: newTaskForm.value.role_id || undefined,
    })
    showNewTask.value = false
    newTaskForm.value = { title: '', description: '', priority: 'P1', role_id: '' }
    toast('任务已创建')
    loadAllTasks()
    loadTasks()
  } catch (e) { toast(e.message, true) } finally { creatingTask.value = false }
}

// ---- SSE 项目事件流：全队实时联动 ----
let streamConnected = false
function connectEvents() {
  if (eventSource.value) return
  syncState.value = 'connecting'
  eventSource.value = subscribeProjectEvents(pid, {
    onOpen: () => {
      streamConnected = true
      syncState.value = 'online'
      loadAllTasks().catch((e) => console.warn('任务列表刷新失败', e))
      loadTasks().catch((e) => console.warn('我的任务刷新失败', e))
    },
    onDisconnect: () => {
      streamConnected = false
      syncState.value = 'reconnecting'
    },
    onEvent: (type, data) => {
      if (type.startsWith('task.')) queueTaskRefresh()
      else if (type === 'memory.promoted') {
        toast(`${data.by || '队友'} 晋升了一条${CAT_LABEL[data.category] || ''}记忆：${data.title}`)
        loadMemories()
      } else if (type === 'memory.withdrawn') {
        loadMemories()
      } else if (type === 'role.claimed') {
        toast(`${data.user_name || '新成员'} 认领了角色「${data.role_name}」`)
        reloadProject()
      } else if (type === 'doc.refreshed') {
        toast(`总文档已由 ${data.by || '队友'} 重新聚合（${data.memory_count} 条记忆）`)
        loadMasterDoc()
      } else if (['paper.created', 'paper.updated', 'direction.updated', 'paper-card.updated', 'experiment.updated'].includes(type)) {
        queueResearchRefresh()
      }
    },
  })
  // 定期对账也覆盖多后端实例时没有收到跨实例广播的窗口。
  syncTimer.value = window.setInterval(() => {
    if (!streamConnected) connectEvents()
    else Promise.all([loadAllTasks(), loadTasks()]).catch((e) => { syncState.value = 'reconnecting'; console.warn('对账刷新失败', e) })
  }, 30000)
}

let taskRefreshTimer = null
let researchRefreshTimer = null
function queueTaskRefresh() {
  window.clearTimeout(taskRefreshTimer)
  taskRefreshTimer = window.setTimeout(() => { Promise.all([loadAllTasks(), loadTasks()]).catch((e) => console.warn('任务防抖刷新失败', e)) }, 280)
}
function queueResearchRefresh() {
  window.clearTimeout(researchRefreshTimer)
  researchRefreshTimer = window.setTimeout(() => { researchRefreshKey.value++ }, 280)
}

async function reloadProject() {
  const detail = await api('GET', `/api/v1/projects/${pid}`)
  project.value = detail
  roles.value = detail.roles.filter((r) => !r.is_archived)
  members.value = detail.members
}

async function setStatus(t, status) {
  if (!t || pendingTaskId.value) return false
  if (t.status === status) return true
  pendingTaskId.value = t.id
  try {
    const updated = await api('PATCH', `/api/v1/projects/${pid}/tasks/${t.id}`, { status })
    Object.assign(t, updated)
    await Promise.all([loadTasks(), loadAllTasks()])
    return true
  } catch (e) {
    toast(e.message, true)
    await Promise.all([loadTasks(), loadAllTasks()])
    return false
  } finally {
    pendingTaskId.value = ''
  }
}

async function toggleTask(t) {
  const action = taskAction(t)
  await setStatus(t, action.status)
}

// ---- AI 协作 ----
async function ensureConversation() {
  const data = await api('GET', `/api/v1/conversations?project_id=${pid}&role_id=${myRole.value.id}`)
  if (data.items.length) {
    currentConv.value = data.items[0]
  } else {
    currentConv.value = await api('POST', '/api/v1/conversations', {
      project_id: pid, role_id: myRole.value.id, title: `${myRole.value.member_name || myRole.value.name} 的协作会话`,
    })
  }
  const msgs = await api('GET', `/api/v1/conversations/${currentConv.value.id}/messages`)
  messages.value = msgs.items
  scrollBottom()
}

let retryMessage = null
async function send() {
  const content = draft.value.trim()
  if (!content || sending.value || !currentConv.value) return
  const requestId = retryMessage?.content === content ? retryMessage.id : crypto.randomUUID()
  draft.value = ''
  sending.value = true
  messages.value.push({ sender_type: 'user', content, sender_name: '我' })
  const aiMsg = { sender_type: 'assistant', content: '', streaming: true }
  messages.value.push(aiMsg)
  scrollBottom()
  let completed = false
  try {
    await chatStream(currentConv.value.id, content, requestId, {
      onDelta: (d) => { aiMsg.content += d; scrollBottom() },
      onDone: (data) => {
        completed = true
        retryMessage = null
        aiMsg.streaming = false
        if (data?.assistant_message) {
          aiMsg.id = data.assistant_message.id
          aiMsg.promoted_memory_id = data.assistant_message.promoted_memory_id
        }
        scrollBottom()
      },
      onError: (msg) => {
        retryMessage = { id: requestId, content }
        if (!draft.value.trim()) draft.value = content
        aiMsg.streaming = false
        aiMsg.content = aiMsg.content || `⚠ ${msg}`
        toast(msg, true)
      },
    })
  } catch (e) {
    retryMessage = { id: requestId, content }
    if (!draft.value.trim()) draft.value = content
    aiMsg.streaming = false
    aiMsg.content = aiMsg.content || '⚠ 网络连接异常，请重试。'
    toast(e.message || '消息发送失败', true)
  } finally {
    sending.value = false
    try {
      const data = await api('GET', `/api/v1/conversations/${currentConv.value.id}/messages`)
      if (completed) { messages.value = data.items; scrollBottom() }
    } catch (e) { /* 保留当前消息及错误提示，允许用同一个 request_id 重试 */ console.warn('发送后回拉消息失败', e) }
  }
}

// ---- 晋升 ----
function openPromote(m) {
  promoteTarget.value = m
  promoteForm.value = { category: 'conclusion', title: '', tags: '', importance: 3 }
}

async function doPromote() {
  if (promoting.value) return
  promoting.value = true
  try {
    await api('POST', `/api/v1/conversations/${currentConv.value.id}/messages/${promoteTarget.value.id}/promote`, {
      category: promoteForm.value.category,
      title: promoteForm.value.title.trim(),
      tags: promoteForm.value.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      importance: promoteForm.value.importance,
    })
    promoteTarget.value.promoted_memory_id = 'pending'
    promoteTarget.value = null
    toast('已晋升到共享记忆，全员角色的下一轮对话都会带上它')
    loadMemories()
  } catch (e) { toast(e.message, true) } finally { promoting.value = false }
}

// ---- 共享记忆 ----
async function loadMemories() {
  const q = memFilter.value ? `?category=${memFilter.value}` : ''
  const data = await api('GET', `/api/v1/projects/${pid}/memories${q}`)
  memories.value = data.items
}

function openTrace(m) {
  traceTarget.value = m
}

async function togglePin(m) {
  try {
    await api('PATCH', `/api/v1/projects/${pid}/memories/${m.id}`, { is_pinned: !m.is_pinned })
    loadMemories()
  } catch (e) { toast(e.message, true) }
}

async function withdraw(m) {
  try {
    await api('DELETE', `/api/v1/projects/${pid}/memories/${m.id}`)
    toast('已撤回共享')
    loadMemories()
  } catch (e) { toast(e.message, true) }
}

async function doManualMem() {
  try {
    await api('POST', `/api/v1/projects/${pid}/memories`, {
      category: manualForm.value.category,
      title: manualForm.value.title.trim(),
      content: manualForm.value.content.trim(),
      importance: manualForm.value.importance,
    })
    showManualMem.value = false
    manualForm.value = { category: 'decision', title: '', content: '', importance: 3 }
    toast('记忆已写入')
    loadMemories()
  } catch (e) { toast(e.message, true) }
}

// ---- 总文档 ----
async function loadMasterDoc() {
  const data = await api('GET', `/api/v1/projects/${pid}/documents`)
  masterDoc.value = data.items.find((d) => d.doc_type === 'master') || null
}

async function refreshDoc() {
  refreshing.value = true
  try {
    const data = await api('POST', `/api/v1/projects/${pid}/documents/master/refresh`, {})
    masterDoc.value = data
    toast(`已从 ${data.memory_count} 条共享记忆重新聚合`)
  } catch (e) { toast(e.message, true) } finally { refreshing.value = false }
}

function startEditDoc() {
  docDraft.value = masterDoc.value?.content || ''
  editingDoc.value = true
}

async function saveDoc() {
  if (savingDoc.value) return
  savingDoc.value = true
  try {
    const data = await api('PATCH', `/api/v1/projects/${pid}/documents/${masterDoc.value.id}`, { content: docDraft.value })
    masterDoc.value = data
    editingDoc.value = false
    toast('已保存（本文档已脱离自动同步）')
  } catch (e) { toast(e.message, true) } finally { savingDoc.value = false }
}

// ---- 上下文透明化 ----
async function showContext() {
  try {
    ctxPreview.value = await api('GET', `/api/v1/conversations/${currentConv.value.id}/context-preview`)
  } catch (e) { toast(e.message, true) }
}

function scrollBottom() {
  nextTick(() => { if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight })
}

onMounted(async () => {
  await loadWorkspace()
})

onBeforeUnmount(() => {
  eventSource.value?.close()
  eventSource.value = null
  if (syncTimer.value) window.clearInterval(syncTimer.value)
  window.clearTimeout(taskRefreshTimer)
  window.clearTimeout(researchRefreshTimer)
  syncState.value = 'idle'
})
</script>

<style scoped>
.workbench { position: absolute; inset: 0; display: flex; background: transparent; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.panel-page { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; }

/* 面板切换过渡：旧面板快速淡出，新面板平滑升起（iOS 风格） */
.panel-enter-active { transition: opacity var(--bb-dur-base) var(--bb-ease-smooth), transform var(--bb-dur-base) var(--bb-ease-smooth); }
.panel-leave-active { transition: opacity var(--bb-dur-fast) var(--bb-ease-out), transform var(--bb-dur-fast) var(--bb-ease-out); }
.panel-enter-from { opacity: 0; transform: translateY(10px); }
.panel-leave-to { opacity: 0; transform: translateY(-6px); }
.workspace-state { display: grid; align-content: center; justify-items: start; gap: 10px; flex: 1; padding: 48px clamp(28px, 6vw, 72px); color: var(--bb-muted); font-size: 13px; animation: page-in .2s ease-out; }
.workspace-state small { color: var(--bb-dim); }.workspace-state.error-state p { color: var(--bb-text); font-size: 16px; font-weight: 500; }
.head { padding: clamp(44px, 6vw, 60px) clamp(28px, 6vw, 72px) 26px; border-bottom: 1px solid var(--bb-line); flex-shrink: 0; animation: page-in .24s ease-out; }
.head h1 { font-size: clamp(26px, 3.2vw, 44px); line-height: 1.12; letter-spacing: -0.01em; font-weight: 500; }
.head .eyebrow { margin-bottom: 12px; }
.head-sub { color: var(--bb-muted); font-size: 13px; line-height: 1.7; margin-top: 12px; max-width: 540px; }
.head-focus {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  max-width: 760px;
  margin-top: 20px;
  padding: 13px 0;
  border-top: 1px solid var(--bb-line);
  border-bottom: 1px solid var(--bb-line);
}
.head-focus > span, .head-focus small { color: var(--bb-dim); font-size: 11px; }
.head-focus > b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; }
.head-focus small { text-align: right; white-space: nowrap; }
.body { flex: 1; overflow-y: auto; padding: 30px clamp(28px, 6vw, 72px); }
.hint { color: var(--bb-muted); font-size: 14px; display: grid; gap: 16px; justify-items: start; }
.empty { color: var(--bb-dim); font-size: 13px; }

/* 任务 */
.task-row {
  position: relative;
  display: flex; gap: 14px; align-items: flex-start;
  border-bottom: 1px solid var(--bb-line);
  padding: 18px 0; transition: background .18s ease, border-color .18s ease;
}
/* hover 用左竖条淡入，不动 padding，避免整行文字跳动 */
.task-row::before {
  content: '';
  position: absolute;
  left: 0; top: 6px; bottom: 6px;
  width: 2px;
  border-radius: 2px;
  background: var(--bb-accent);
  opacity: 0;
  transition: opacity .18s ease;
}
.task-row:hover { background: var(--bb-accent-tint); }
.task-row:hover::before { opacity: 1; }
.task-row.focus { margin-left: -12px; padding-left: 12px; border-left: 1px solid var(--bb-accent); box-shadow: inset 2px 0 6px -4px var(--bb-accent-glow); }
.task-row.pending { background: var(--bb-accent-tint); }
/* 任务行增删/重排过渡 */
.task-enter-active { transition: opacity var(--bb-dur-base) var(--bb-ease-out), transform var(--bb-dur-base) var(--bb-ease-spring); }
.task-leave-active { transition: opacity var(--bb-dur-fast) var(--bb-ease-out), transform var(--bb-dur-fast) var(--bb-ease-out); }
.task-enter-from { opacity: 0; transform: translateY(8px); }
.task-leave-to { opacity: 0; transform: scale(0.98); }
.task-move { transition: transform var(--bb-dur-base) var(--bb-ease-smooth); }
.task-row.done .task-main b { text-decoration: line-through; color: var(--bb-dim); }
.check {
  width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px;
  border: 1px solid var(--bb-line-strong); border-radius: 50%;
  background: transparent; color: var(--bb-accent-soft);
  cursor: pointer; font-size: 11px;
  display: grid; place-items: center;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.check:hover:not(:disabled) { border-color: var(--bb-accent-border); box-shadow: 0 0 10px var(--bb-accent-glow); }
.task-row.done .check { background: var(--bb-accent-tint); border-color: var(--bb-accent-border); }
.check:disabled { opacity: .45; cursor: wait; }
.task-main { flex: 1; }
.task-main b { font-size: 14px; font-weight: 500; }
.task-main p { color: var(--bb-muted); font-size: 12px; line-height: 1.7; margin-top: 5px; }
.task-main .task-progress { margin: 7px 0 0; font-size: 11px; }
.task-main small { color: var(--bb-dim); font-size: 11px; display: block; margin-top: 4px; }
.task-side { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.status { width: 96px; padding: 6px 8px; font-size: var(--bb-fs-xs); }

/* 对话 */
.chat-head-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.ctx-btn {
  background: transparent; border: 1px solid var(--bb-line); border-radius: 999px;
  color: var(--bb-muted); font-size: 11px; padding: 8px 16px; cursor: pointer;
  white-space: nowrap; transition: color .2s, border-color .2s;
}
.ctx-btn:hover { color: var(--bb-accent-soft); border-color: var(--bb-accent-border); }
.messages { flex: 1; overflow-y: auto; padding: 28px clamp(28px, 6vw, 72px); }
.msg { display: flex; margin-bottom: 22px; }
.msg.user { justify-content: flex-end; }
.bubble { max-width: 72%; }
.msg.user .bubble { border-right: 1px solid var(--bb-user-mark); padding: 3px 14px 3px 0; }
.msg.assistant .bubble { max-width: 85%; }
.mhead { font-size: 11px; color: var(--bb-dim); margin-bottom: 6px; }
.mtext { font-size: 14px; line-height: 1.85; white-space: pre-wrap; word-break: break-word; color: var(--bb-text); }
/* 消息进入动效：轻量上浮 + 回弹，不打扰阅读 */
.msg-enter-active { transition: opacity var(--bb-dur-base) var(--bb-ease-out), transform var(--bb-dur-base) var(--bb-ease-spring); }
.msg-enter-from { opacity: 0; transform: translateY(8px); }
.mfoot { margin-top: 10px; }
.promote-btn {
  background: transparent; border: none; color: var(--bb-dim);
  font-size: 11px; cursor: pointer; padding: 0;
  transition: color .2s;
}
.promote-btn:hover { color: var(--bb-accent-soft); }
.promoted-tag { font-size: 11px; color: var(--bb-accent-soft); }
.cursor { animation: blink 0.8s infinite; color: var(--bb-accent); }
@keyframes blink { 50% { opacity: 0; } }
.input-bar {
  display: flex; gap: 12px; align-items: flex-end;
  padding: 16px clamp(28px, 6vw, 72px) 20px;
  border-top: 1px solid var(--bb-line);
}
.input-bar .bb-input { resize: none; }
.send-btn { padding: 12px 26px; flex-shrink: 0; }

/* 共享记忆 */
.mem-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
.chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  background: transparent; border: 1px solid var(--bb-line); border-radius: 999px;
  color: var(--bb-muted); font-size: 11px; padding: 6px 14px; cursor: pointer;
  transition: all .2s;
}
.chip.on { color: var(--bb-accent-soft); background: var(--bb-accent-tint); border-color: var(--bb-accent-border); }
.mem-row { position: relative; border-bottom: 1px solid var(--bb-line); padding: 18px 0; max-width: 760px; transition: background .18s ease; }
.mem-row::before {
  content: '';
  position: absolute;
  left: 0; top: 6px; bottom: 6px;
  width: 2px;
  border-radius: 2px;
  background: var(--bb-accent);
  opacity: 0;
  transition: opacity .18s ease;
}
.mem-row:hover { background: var(--bb-accent-tint); }
.mem-row:hover::before { opacity: 1; }
.mem-head { display: flex; align-items: center; gap: 10px; }
.mem-head b { font-size: var(--bb-fs-md); font-weight: 500; flex: 1; }
.stars { color: var(--bb-accent); font-size: var(--bb-fs-xs); letter-spacing: 1px; }
.stars i { color: var(--bb-line-strong); font-style: normal; }
.mem-content {
  color: var(--bb-muted); font-size: 12px; line-height: 1.8; margin-top: 8px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  white-space: pre-wrap;
}
.mem-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.mem-foot small { color: var(--bb-dim); font-size: 11px; }
.mem-actions { display: flex; gap: 14px; }
.link-btn { background: none; border: none; color: var(--bb-dim); font-size: 11px; cursor: pointer; padding: 0; }
.link-btn:hover { color: var(--bb-text); }
.link-btn.danger:hover { color: var(--bb-muted); }

/* 总文档 */
.doc-meta { color: var(--bb-dim); font-size: 11px; }
.doc-view {
  max-width: 860px; color: var(--bb-text-2); font-size: 13px; line-height: 1.9;
  white-space: pre-wrap; word-break: break-word;
  font-family: inherit;
}
.doc-textarea { min-height: 420px; font-size: 13px; line-height: 1.8; font-family: inherit; }

/* 团队 */
.invite-code-box {
  border: 1px solid var(--bb-accent-border);
  background: var(--bb-accent-tint);
  border-radius: var(--bb-radius-control);
  padding: 16px 20px; margin-bottom: 28px; max-width: 460px;
}
.invite-code-box span { font-size: 11px; color: var(--bb-dim); }
.invite-code-box b { display: block; font-size: 18px; font-family: monospace; letter-spacing: 0.05em; margin: 6px 0 4px; }
.invite-code-box small { font-size: 11px; color: var(--bb-dim); }
.member-list { display: grid; max-width: 640px; }
.member-row {
  display: flex; align-items: center; gap: 14px;
  border-bottom: 1px solid var(--bb-line); padding: 16px 0;
}
.avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: linear-gradient(135deg, var(--bb-line-strong), var(--bb-soft)); color: var(--bb-text);
  display: grid; place-items: center;
  font-size: 12px; font-weight: 600; flex-shrink: 0;
}
.member-main { flex: 1; }
.member-main b { font-size: 14px; }
.member-main p { color: var(--bb-muted); font-size: 12px; margin-top: 3px; line-height: 1.6; }

/* 看板 */
.board-body { overflow-x: auto; }
.kanban { display: flex; gap: 10px; min-width: 900px; align-items: stretch; }
.kcol {
  flex: 1; min-width: 170px;
  border: 0;
  background: var(--bb-soft);      /* 共同区域底色：卡片归属感 */
  border-radius: var(--bb-radius-item);
  padding: 0 14px 14px; transition: background .2s ease;
}
.kcol.disabled { opacity: .5; }
.kcol.over { background: var(--bb-accent-tint); box-shadow: inset 0 0 0 1px var(--bb-accent-border); }
.kcol-head {
  display: flex; justify-content: space-between; align-items: center;
  font-size: var(--bb-fs-xs); color: var(--bb-muted); padding: 13px 0 12px;
}
.kcol-head i { font-style: normal; color: var(--bb-dim); }
.kcard {
  position: relative;
  border: 0; border-top: 1px solid var(--bb-line);
  padding: 13px 0; margin: 0; cursor: grab;
  transition: background var(--bb-dur-fast) var(--bb-ease-out), transform var(--bb-dur-fast) var(--bb-ease-out);
}
.kcard::before {
  content: '';
  position: absolute;
  left: 0; top: 6px; bottom: 6px;
  width: 2px;
  border-radius: 2px;
  background: var(--bb-accent);
  opacity: 0;
  transition: opacity .18s ease;
}
.kcard:hover { background: var(--bb-accent-tint); }
.kcard:hover::before { opacity: 1; }
.kcard:active { cursor: grabbing; }
/* 拖拽中的卡片：轻微下压手感，落列时吸附回弹 */
.kcard:active { transform: scale(0.98); }
.kcard-enter-active { transition: opacity var(--bb-dur-base) var(--bb-ease-out), transform var(--bb-dur-base) var(--bb-ease-spring); }
.kcard-leave-active { transition: opacity var(--bb-dur-fast) var(--bb-ease-out), transform var(--bb-dur-fast) var(--bb-ease-out); }
.kcard-enter-from { opacity: 0; transform: translateY(-6px) scale(0.97); }
.kcard-leave-to { opacity: 0; transform: scale(0.96); }
.kcard-move { transition: transform var(--bb-dur-base) var(--bb-ease-smooth); }
.kcard b { font-size: var(--bb-fs-sm); font-weight: 500; display: block; }
.kcard p {
  color: var(--bb-muted); font-size: var(--bb-fs-xs); line-height: 1.6; margin-top: 4px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.kcard-foot { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.krole { font-size: var(--bb-fs-xs); color: var(--bb-dim); }
.kref { font-size: var(--bb-fs-xs); color: var(--bb-dim); }
.kempty { color: var(--bb-dim); font-size: var(--bb-fs-xs); text-align: center; padding: 14px 0; }

/* 弹窗 */
.modal-mask {
  position: fixed; inset: 0; background: var(--bb-modal-mask);
  display: grid; place-items: center; z-index: var(--z-overlay);
}
/* 弹窗弹簧过渡：全局规则见 style.css（.modal-mask.bb-pop-*），此处不重复定义 */
.modal {
  width: min(480px, 92vw); max-height: 86vh; overflow-y: auto;
  background: var(--bb-bg-elevated); border: 1px solid var(--bb-line-strong); border-radius: var(--bb-radius-card);
  padding: 30px 32px;
  box-shadow: var(--bb-shadow-card);
}
.modal.wide { width: min(680px, 94vw); }
.modal h3 { font-size: 18px; letter-spacing: -0.02em; font-weight: 500; margin: 6px 0 20px; }
.promote-preview {
  color: var(--bb-muted); font-size: 12px; line-height: 1.7;
  border-left: 2px solid var(--bb-text-3); padding-left: 12px; margin-bottom: 18px;
  white-space: pre-wrap;
}
.fld { display: block; margin-bottom: 14px; }
.fld span { display: block; font-size: 11px; color: var(--bb-dim); margin-bottom: 6px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.ctx-layer { margin-bottom: 16px; }
.ctx-layer b { font-size: 12px; color: var(--bb-text-2); display: block; margin-bottom: 8px; }
.ctx-layer pre {
  color: var(--bb-muted); font-size: 11px; line-height: 1.7;
  background: var(--bb-soft); border: 1px solid var(--bb-line); border-radius: 8px;
  padding: 12px 14px; max-height: 180px; overflow-y: auto;
  white-space: pre-wrap; word-break: break-word; font-family: inherit;
}
.ctx-total { color: var(--bb-dim); font-size: 11px; }
@keyframes page-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 700px) { .head-focus { grid-template-columns: 1fr; gap: 5px; }.head-focus small { text-align: left; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
</style>
