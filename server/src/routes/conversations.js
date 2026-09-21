// M3 对话与消息（P1）：会话 CRUD + 消息落库 + SSE 流式对话主链路
const express = require('express');
const crypto = require('crypto');
const prisma = require('../db');
const { ok, wrap, E } = require('../middleware/error');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess } = require('../middleware/permission');
const rateLimit = require('../middleware/rate-limit');
const llm = require('../services/llm');
const context = require('../services/context');
const hub = require('../services/events');

const router = express.Router();
router.use(authRequired);
// 流式对话直连付费 LLM：按用户限流（20 次/分），防止脚本化刷接口产生无上限 API 费用
const chatGuard = rateLimit({ limit: 20, key: (req) => req.user?.id || req.ip });
const activeReplies = new Map(); // 单实例内：断线后原生成继续完成，同一请求等待同一结果

const convView = (c) => ({
  id: c.id, project_id: c.projectId, role_id: c.roleId, title: c.title,
  context_type: c.contextType, context_ref_id: c.contextRefId,
  message_count: c.messageCount, last_message_at: c.lastMessageAt,
  is_pinned: c.isPinned, is_archived: c.isArchived,
  created_by: c.createdBy, created_at: c.createdAt,
});

const msgView = (m) => ({
  id: m.id, conversation_id: m.conversationId, sender_type: m.senderType,
  sender_user_id: m.senderUserId, sender_name: m.sender?.displayName || m.sender?.username || null,
  content: m.content, token_in: m.tokenIn, token_out: m.tokenOut,
  promoted_memory_id: m.meta?.promoted_memory_id || null,
  created_at: m.createdAt,
});

// 加载会话并校验项目权限。
// 注意：会话 ID 本身不是授权凭证；所有按会话 ID 的操作都必须回到项目成员关系校验。
async function loadConversation(req, { requireRoleWrite = false, write = false } = {}) {
  const conv = await prisma.conversation.findUnique({ where: { id: req.params.cid } });
  if (!conv) throw E.notFound('会话不存在');

  const project = await prisma.project.findUnique({ where: { id: conv.projectId } });
  if (!project) throw E.notFound('项目不存在');
  if ((requireRoleWrite || write) && project.status === 3) throw E.param('项目已归档，只可查看不可继续修改');
  const membership = await prisma.projectMember.findFirst({
    where: { projectId: project.id, userId: req.user.id },
  });
  const isLeader = project.ownerId === req.user.id || !!membership?.isLeader;
  if (!isLeader && !membership) throw E.noProject();

  if (requireRoleWrite && !isLeader && membership.roleId !== conv.roleId) {
    throw E.noWrite('只能以自己认领的角色继续该会话');
  }
  return { conv, project, membership, isLeader };
}

// GET /api/v1/conversations?project_id= 会话列表
router.get('/', wrap(async (req, res) => {
  const { project_id, role_id } = req.query;
  if (!project_id) throw E.param('project_id 必填');
  // 项目权限校验（复用中间件逻辑：查成员或 owner）
  const project = await prisma.project.findUnique({ where: { id: project_id } });
  if (!project) throw E.notFound('项目不存在');
  const isOwner = project.ownerId === req.user.id;
  const member = await prisma.projectMember.findFirst({ where: { projectId: project_id, userId: req.user.id } });
  if (!isOwner && !member) throw E.noProject();

  const convs = await prisma.conversation.findMany({
    where: {
      projectId: project_id,
      isArchived: false,
      ...(role_id && { roleId: role_id }),
    },
    orderBy: [{ isPinned: 'desc' }, { lastMessageAt: 'desc' }],
    include: { role: { select: { id: true, name: true, color: true, icon: true } } },
  });
  ok(res, {
    items: convs.map((c) => ({ ...convView(c), role_name: c.role.name, role_color: c.role.color, role_icon: c.role.icon })),
    total: convs.length,
  });
}));

// POST /api/v1/conversations 创建会话 {project_id, role_id, title?, context_type?, context_ref_id?}
router.post('/', wrap(async (req, res) => {
  const { project_id, role_id, title, context_type, context_ref_id } = req.body || {};
  if (!project_id || !role_id) throw E.param('project_id 与 role_id 必填');
  const role = await prisma.role.findUnique({ where: { id: role_id } });
  if (!role || role.projectId !== project_id) throw E.param('角色不属于该项目');
  if (role.isArchived) throw E.param('角色已归档，请先复活');
  // 必须绑定该角色才能以该角色开对话
  const binding = await prisma.projectMember.findFirst({
    where: { projectId: project_id, userId: req.user.id, roleId: role_id },
  });
  const project = await prisma.project.findUnique({ where: { id: project_id } });
  if (!project) throw E.notFound('项目不存在');
  if (project.status === 3) throw E.param('项目已归档，只可查看不可继续修改');
  if (!binding && project.ownerId !== req.user.id) throw E.noRole('你未绑定该角色，无法以该角色对话');

  const conv = await prisma.conversation.create({
    data: {
      projectId: project_id, roleId: role_id,
      title: title || `与「${role.name}」的对话`,
      contextType: context_type || 'general',
      contextRefId: context_ref_id || null,
      createdBy: req.user.id,
    },
  });
  ok(res, convView(conv), '会话已创建');
}));

// GET /api/v1/conversations/:cid/messages 消息列表（最新 500 条，防响应无界）
router.get('/:cid/messages', wrap(async (req, res) => {
  const { conv } = await loadConversation(req);
  const latest = await prisma.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { sender: { select: { username: true, displayName: true } } },
  });
  const messages = latest.reverse();
  ok(res, { items: messages.map(msgView), total: messages.length });
}));

// POST /api/v1/conversations/:cid/messages 发消息并触发 SSE 流式回复
// 请求体: {content, temperature?, request_id?}
// SSE 事件: meta(用户消息+会话信息) → delta*(流式片段) → done(完整消息+token) / error
router.post('/:cid/messages', chatGuard, wrap(async (req, res) => {
  const { content, temperature, request_id: suppliedRequestId } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) throw E.param('消息内容不能为空');
  const requestId = suppliedRequestId || crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw E.param('request_id 必须是 UUID');
  }

  const { conv } = await loadConversation(req, { requireRoleWrite: true });
  if (conv.isArchived) throw E.param('会话已归档');
  const [project, role] = await Promise.all([
    prisma.project.findUnique({ where: { id: conv.projectId } }),
    prisma.role.findUnique({ where: { id: conv.roleId } }),
  ]);
  if (!role || role.isArchived) throw E.param('角色已归档');

  // 客户端重试沿用消息 ID；数据库主键保证用户消息只落库一次。
  let userMsg;
  let created = false;
  try {
    userMsg = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          id: requestId, conversationId: conv.id, projectId: conv.projectId, roleId: conv.roleId,
          senderType: 'user', senderUserId: req.user.id, content: content.trim(),
        },
      });
      await tx.conversation.update({
        where: { id: conv.id }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
      });
      return message;
    });
    created = true;
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    userMsg = await prisma.message.findUnique({ where: { id: requestId } });
    if (!userMsg || userMsg.senderType !== 'user' || userMsg.senderUserId !== req.user.id ||
        userMsg.conversationId !== conv.id || userMsg.content !== content.trim()) {
      throw E.conflict('request_id 已用于其他消息');
    }
  }

  // 2) 建立 SSE 通道
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => {
    try {
      if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch { /* 断线后生成继续完成，客户端可按 request_id 取回 */ }
  };
  send('meta', { user_message: msgView({ ...userMsg, sender: req.user }), conversation_id: conv.id, request_id: requestId });

  try {
    // 断线重试已完成的请求直接回放最终结果，不再调用模型。
    if (!created) {
      const existing = await prisma.message.findFirst({
        where: { conversationId: conv.id, senderType: 'assistant', meta: { path: ['request_id'], equals: requestId } },
      });
      if (existing) {
        send('done', { assistant_message: msgView(existing), request_id: requestId });
        return res.end();
      }
    }

    let reply = activeReplies.get(requestId);
    if (!reply) {
      reply = (async () => {
        // 3) 三层上下文拼装（L1 角色设定 / L2 共享记忆 / L3 历史截断只砍中部）
        const messages = await context.buildMessages({ project, role, conversation: conv });

        // 4) 调 LLM（temperature 自动降档到角色上限，v2.0 保险二）
        const temp = llm.clampTemperature(role.tempLimit, temperature);
        const result = await llm.chat({
          messages,
          temperature: temp,
          onDelta: (delta) => { if (activeReplies.get(requestId) === reply) send('delta', { delta }); },
        });

        // 5) LLM 调用日志 + 助手消息落库
        const assistantMsg = await prisma.$transaction(async (tx) => {
          const llmCall = await tx.llmCall.create({
            data: {
              projectId: conv.projectId, roleId: conv.roleId, userId: req.user.id,
              modelName: result.model, promptTokens: result.promptTokens,
              completionTokens: result.completionTokens,
              totalTokens: result.promptTokens + result.completionTokens,
              latencyMs: result.latencyMs, status: 'success',
            },
          });
          const message = await tx.message.create({
            data: {
              conversationId: conv.id, projectId: conv.projectId, roleId: conv.roleId,
              senderType: 'assistant', content: result.content,
              tokenIn: result.promptTokens, tokenOut: result.completionTokens,
              llmCallId: llmCall.id, meta: { request_id: requestId },
            },
          });
          await tx.conversation.update({
            where: { id: conv.id }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
          });
          return message;
        });
        return { assistantMsg, temp };
      })();
      activeReplies.set(requestId, reply);
      reply.finally(() => { if (activeReplies.get(requestId) === reply) activeReplies.delete(requestId); }).catch(() => {});
    }
    const { assistantMsg, temp } = await reply;
    send('done', { assistant_message: msgView(assistantMsg), temperature_used: temp, request_id: requestId });
  } catch (err) {
    // 调用失败同样落日志（status=failed），保证成本/失败可审计
    await prisma.llmCall.create({
      data: {
        projectId: conv.projectId, roleId: conv.roleId, userId: req.user.id,
        modelName: process.env.LLM_MODEL || 'deepseek-chat', status: 'failed',
        errorMsg: String(err.message || err).slice(0, 500),
      },
    }).catch(() => {});
    send('error', { message: err.isRateLimit ? '模型限流，请稍后重试' : '模型调用失败：' + err.message });
  }
  res.end();
}));

// PATCH /api/v1/conversations/:cid 重命名/置顶/归档
router.patch('/:cid', wrap(async (req, res) => {
  const { conv, isLeader } = await loadConversation(req, { write: true });
  if (!isLeader && conv.createdBy !== req.user.id) {
    throw E.noWrite('仅会话创建者或项目负责人可以修改会话');
  }
  const { title, is_pinned, is_archived } = req.body || {};
  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      ...(title !== undefined && { title }),
      ...(is_pinned !== undefined && { isPinned: !!is_pinned }),
      ...(is_archived !== undefined && { isArchived: !!is_archived }),
    },
  });
  ok(res, convView(updated), '已更新');
}));

// GET /api/v1/conversations/:cid/context-preview 上下文透明化（答辩演示亮点）
// 展示该会话下一次对话将注入的内容：L1 角色设定 / L2 共享记忆明细 / L3 历史规模
router.get('/:cid/context-preview', wrap(async (req, res) => {
  const { conv } = await loadConversation(req);
  const [project, role] = await Promise.all([
    prisma.project.findUnique({ where: { id: conv.projectId } }),
    prisma.role.findUnique({ where: { id: conv.roleId } }),
  ]);
  const messages = await context.buildMessages({ project, role, conversation: conv });
  const l2Raw = messages.length > 1 && messages[1].role === 'system' && messages[1].content.startsWith('以下是项目')
    ? messages[1].content : null;
  const l2Lines = l2Raw ? l2Raw.split('\n').slice(1) : [];
  ok(res, {
    l1: { system_prompt: role.systemPrompt, tokens: context.estimateTokens(role.systemPrompt) },
    l2: { memories: l2Lines, count: l2Lines.length },
    l3: { message_count: messages.length - 1 - (l2Raw ? 1 : 0) },
    total_tokens: messages.reduce((s, m) => s + context.estimateTokens(m.content), 0),
  });
}));

// POST /api/v1/conversations/:cid/messages/:mid/promote 一键晋升为共享记忆（P2-02）
// DoD：溯源三字段非空；重复晋升返回 40901；溯源字段为字符串 ID 不建外键
router.post('/:cid/messages/:mid/promote', wrap(async (req, res) => {
  const { conv } = await loadConversation(req, { requireRoleWrite: true });
  const msg = await prisma.message.findUnique({ where: { id: req.params.mid } });
  if (!msg || msg.conversationId !== conv.id) throw E.notFound('消息不存在');
  if (msg.senderType !== 'assistant') throw E.param('只有 AI 的回复可以晋升为共享记忆');

  const { category, title, tags, importance } = req.body || {};
  const CATS = ['decision', 'conclusion', 'todo', 'risk', 'snippet', 'fact', 'paper_card'];
  if (!CATS.includes(category)) throw E.param(`category 必须是 ${CATS.join('/')}`);
  if (!title || !title.trim()) throw E.param('记忆标题必填');

  // 重复晋升检查（同一消息只允许晋升一次）；source_msg_id 上有唯一约束兜底并发
  const dup = await prisma.memory.findFirst({ where: { sourceMsgId: msg.id } });
  if (dup) throw E.conflict('该消息已晋升过共享记忆');

  const imp = Math.min(5, Math.max(1, parseInt(importance, 10) || 3));
  let memory;
  try {
    memory = await prisma.memory.create({
    data: {
      projectId: conv.projectId,
      category,
      title: title.trim(),
      content: msg.content,
      sourceRoleId: conv.roleId,
      sourceUserId: req.user.id,
      sourceMsgId: msg.id,
      // v2.0 溯源三字段（字符串 ID 出生证明，不设外键防级联丢失）
      creatorRid: String(conv.roleId),
      sourceConversationId: String(conv.id),
      sourceMessageRange: { from: String(msg.id), to: String(msg.id) },
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      importance: imp,
    },
  });
  } catch (error) {
    if (error.code === 'P2002') throw E.conflict('该消息已晋升过共享记忆');
    throw error;
  }
  // 在消息 meta 上标记已晋升（幂等展示用）
  await prisma.message.update({
    where: { id: msg.id },
    data: { meta: { ...(msg.meta || {}), promoted_memory_id: memory.id } },
  });
  ok(res, { memory_id: memory.id, promoted_at: memory.promotedAt }, '已晋升为共享记忆');
  hub.emit(conv.projectId, 'memory.promoted', {
    memory_id: memory.id, category: memory.category, title: memory.title,
    role_id: conv.roleId, by: req.user.username,
  });
}));

module.exports = router;
