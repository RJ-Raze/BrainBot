// M5 共享记忆（P2）：列表/手工写入/详情/置顶与重要度/撤回/检索
// 设计约束：手动晋升与手工写入是仅有的两个写入口，保证共享记忆质量
const express = require('express');
const prisma = require('../db');
const { ok, wrap, E } = require('../middleware/error');
const { authRequired } = require('../middleware/auth');
const hub = require('../services/events');

const router = express.Router({ mergeParams: true });
router.use(authRequired);

const CATS = ['decision', 'conclusion', 'todo', 'risk', 'snippet', 'fact', 'paper_card'];

const memView = (m) => ({
  id: m.id, project_id: m.projectId, category: m.category, title: m.title, content: m.content,
  source_role_id: m.sourceRoleId, source_role_name: m.sourceRole?.name || null,
  source_user_id: m.sourceUserId, source_user_name: m.sourceUser?.displayName || m.sourceUser?.username || null,
  source_msg_id: m.sourceMsgId,
  // v2.0 溯源三字段
  creator_rid: m.creatorRid,
  source_conversation_id: m.sourceConversationId,
  source_message_range: m.sourceMessageRange,
  tags: m.tags, importance: m.importance, is_pinned: m.isPinned,
  promoted_at: m.promotedAt, created_at: m.createdAt,
  review_status: m.reviewStatus, version: m.version,
});

const INCLUDE_SRC = {
  sourceRole: { select: { name: true } },
  sourceUser: { select: { username: true, displayName: true } },
};

// 项目访问校验（owner 或成员）
async function checkAccess(req) {
  const pid = req.params.pid;
  const project = await prisma.project.findUnique({ where: { id: pid } });
  if (!project) throw E.notFound('项目不存在');
  if (project.status === 3 && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    throw E.param('项目已归档，只可查看不可继续修改');
  }
  const isOwner = project.ownerId === req.user.id;
  const member = await prisma.projectMember.findFirst({ where: { projectId: pid, userId: req.user.id } });
  if (!isOwner && !member) throw E.noProject();
  return project;
}

// GET /api/v1/projects/:pid/memories?category=&tag=&importance=&q=
router.get('/', wrap(async (req, res) => {
  await checkAccess(req);
  const { category, tag, importance, q } = req.query;
  // 失效记录保留在审核历史中，但不再出现在日常工作列表里。
  const where = { projectId: req.params.pid, reviewStatus: { not: 'invalidated' } };
  if (category && CATS.includes(category)) where.category = category;
  if (importance) where.importance = { gte: parseInt(importance, 10) || 1 };
  if (tag) where.tags = { has: String(tag) };
  if (q) where.OR = [
    { title: { contains: q, mode: 'insensitive' } },
    { content: { contains: q, mode: 'insensitive' } },
  ];
  // 上限 200 条防响应无界；total 用独立 count 保证分页语义正确
  const [items, total] = await Promise.all([
    prisma.memory.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { importance: 'desc' }, { promotedAt: 'desc' }],
      take: 200,
      include: INCLUDE_SRC,
    }),
    prisma.memory.count({ where }),
  ]);
  ok(res, { items: items.map(memView), total });
}));

// GET /api/v1/projects/:pid/memories/search?q= 注入 Prompt 用检索（MVP 关键词版）
router.get('/search', wrap(async (req, res) => {
  await checkAccess(req);
  const { q } = req.query;
  if (!q) throw E.param('q 必填');
  const items = await prisma.memory.findMany({
    where: {
      projectId: req.params.pid,
      reviewStatus: { not: 'invalidated' },
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ],
    },
    orderBy: [{ importance: 'desc' }, { promotedAt: 'desc' }],
    take: 20,
    include: INCLUDE_SRC,
  });
  ok(res, { items: items.map(memView), total: items.length });
}));

// POST /api/v1/projects/:pid/memories 手工写入记忆
router.post('/', wrap(async (req, res) => {
  await checkAccess(req);
  const { category, title, content, tags, importance } = req.body || {};
  if (!CATS.includes(category)) throw E.param(`category 必须是 ${CATS.join('/')}`);
  if (!title || !title.trim()) throw E.param('标题必填');
  if (!content || !content.trim()) throw E.param('正文必填');
  const memory = await prisma.memory.create({
    data: {
      projectId: req.params.pid,
      category, title: title.trim(), content: content.trim(),
      sourceUserId: req.user.id,
      creatorRid: 'manual',
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      importance: Math.min(5, Math.max(1, parseInt(importance, 10) || 3)),
    },
    include: INCLUDE_SRC,
  });
  ok(res, memView(memory), '记忆已写入');
  hub.emit(req.params.pid, 'memory.promoted', {
    memory_id: memory.id, category: memory.category, title: memory.title,
    manual: true, by: req.user.username,
  });
}));

// GET /api/v1/projects/:pid/memories/:mid 详情
router.get('/:mid', wrap(async (req, res) => {
  await checkAccess(req);
  const m = await prisma.memory.findUnique({ where: { id: req.params.mid }, include: INCLUDE_SRC });
  if (!m || m.projectId !== req.params.pid) throw E.notFound('记忆不存在');
  ok(res, memView(m));
}));

// GET /api/v1/projects/:pid/memories/:mid/provenance  溯源链路（记忆 ← 角色/成员 ← 会话 ← 源消息 / 文献卡片 ← 论文）
// 三类来源：conversation（对话晋升）、paper_card（文献卡片晋升）、manual（手工写入，无上游）
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.get('/:mid/provenance', wrap(async (req, res) => {
  await checkAccess(req);
  const m = await prisma.memory.findUnique({ where: { id: req.params.mid } });
  if (!m || m.projectId !== req.params.pid) throw E.notFound('记忆不存在');

  const base = {
    kind: 'manual',
    memory: { id: m.id, title: m.title, content: m.content, category: m.category, promoted_at: m.promotedAt },
    role: m.sourceRoleId && UUID_RE.test(m.sourceRoleId)
      ? await prisma.role.findUnique({ where: { id: m.sourceRoleId }, select: { id: true, name: true, memberName: true } })
      : null,
    author: m.sourceUserId && UUID_RE.test(m.sourceUserId)
      ? await prisma.user.findUnique({ where: { id: m.sourceUserId }, select: { id: true, username: true, displayName: true } })
      : null,
  };

  // 文献卡片晋升：sourceConversationId = `paper-card:<cardId>`
  if (m.sourceConversationId && m.sourceConversationId.startsWith('paper-card:')) {
    const cardId = m.sourceConversationId.slice('paper-card:'.length);
    let card = null;
    if (UUID_RE.test(cardId)) {
      card = await prisma.paperCard.findUnique({
        where: { id: cardId },
        include: { paper: true, role: { select: { name: true } }, author: { select: { username: true, displayName: true } } },
      });
    }
    base.kind = 'paper_card';
    base.paper_card = card ? {
      id: card.id, notes: card.notes, evidence_quote: card.evidenceQuote, evidence_status: card.evidenceStatus,
      rating: card.rating, created_at: card.createdAt,
      role_name: card.role?.name || null,
      author_name: card.author?.displayName || card.author?.username || null,
      paper: card.paper ? {
        id: card.paper.id, title: card.paper.title, authors: card.paper.authors,
        year: card.paper.year, venue: card.paper.venue, doi: card.paper.doi, source: card.paper.source,
      } : null,
    } : null;
    return ok(res, base);
  }

  // 对话晋升：sourceConversationId 为会话 ID，sourceMessageRange/sourceMsgId 定位源消息
  if (m.sourceConversationId) {
    base.kind = 'conversation';
    let conv = null;
    if (UUID_RE.test(m.sourceConversationId)) {
      conv = await prisma.conversation.findUnique({
        where: { id: m.sourceConversationId },
        include: { role: { select: { id: true, name: true, memberName: true } } },
      });
    }
    base.conversation = conv ? { id: conv.id, title: conv.title, role_name: conv.role?.name || null } : null;

    const fromId = m.sourceMessageRange?.from || m.sourceMsgId || null;
    const toId = m.sourceMessageRange?.to || fromId || null;
    let sourceMessages = [];
    if (fromId && UUID_RE.test(fromId)) {
      if (fromId === toId) {
        const msg = await prisma.message.findUnique({ where: { id: fromId }, include: { sender: { select: { username: true, displayName: true } } } });
        if (msg) sourceMessages = [msg];
      } else if (toId && UUID_RE.test(toId)) {
        const [fromMsg, toMsg] = await Promise.all([
          prisma.message.findUnique({ where: { id: fromId } }),
          prisma.message.findUnique({ where: { id: toId } }),
        ]);
        if (fromMsg && toMsg && fromMsg.conversationId === toMsg.conversationId) {
          sourceMessages = await prisma.message.findMany({
            where: { conversationId: fromMsg.conversationId, createdAt: { gte: fromMsg.createdAt, lte: toMsg.createdAt } },
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { username: true, displayName: true } } },
          });
        }
      }
    }
    base.source_messages = sourceMessages.map((msg) => ({
      id: msg.id, sender_type: msg.senderType,
      sender_name: msg.sender?.displayName || msg.sender?.username || null,
      content: msg.content, created_at: msg.createdAt,
      is_source: msg.id === (m.sourceMsgId || fromId),
    }));
    return ok(res, base);
  }

  return ok(res, base);
}));

// PATCH /api/v1/projects/:pid/memories/:mid 改置顶/重要度
// 内容类字段（标题/正文/标签/分类）一律走版本修订入口（reviews），此处直接拒绝
router.patch('/:mid', wrap(async (req, res) => {
  const project = await checkAccess(req);
  const m = await prisma.memory.findUnique({ where: { id: req.params.mid } });
  if (!m || m.projectId !== req.params.pid) throw E.notFound('记忆不存在');
  if (m.sourceUserId && m.sourceUserId !== req.user.id && project.ownerId !== req.user.id) {
    throw E.noWrite('仅记忆创建者或项目创立人可以修改');
  }
  const { title, content, tags, importance, is_pinned, category } = req.body || {};
  if ([title, content, tags, category].some(v => v !== undefined)) {
    throw E.conflict('内容类字段（标题/正文/标签/分类）修改请通过版本修订入口，保留历史');
  }
  const updated = await prisma.memory.update({
    where: { id: m.id },
    data: {
      ...(importance !== undefined && { importance: Math.min(5, Math.max(1, parseInt(importance, 10) || m.importance)) }),
      ...(is_pinned !== undefined && { isPinned: !!is_pinned }),
    },
    include: INCLUDE_SRC,
  });
  ok(res, memView(updated), '已更新');
}));

// DELETE /api/v1/projects/:pid/memories/:mid 撤回共享
router.delete('/:mid', wrap(async (req, res) => {
  await checkAccess(req);
  const m = await prisma.memory.findUnique({ where: { id: req.params.mid } });
  if (!m || m.projectId !== req.params.pid) throw E.notFound('记忆不存在');
  // 只有晋升者本人或项目 owner 可撤回
  const project = await prisma.project.findUnique({ where: { id: req.params.pid } });
  if (m.sourceUserId !== req.user.id && project.ownerId !== req.user.id) {
    throw E.noProject('只有晋升者本人或项目创立人可以撤回');
  }
  await prisma.memory.update({ where: { id: m.id }, data: { reviewStatus: 'invalidated', version: { increment: 1 } } });
  // 解除消息上的晋升标记
  if (m.sourceMsgId) {
    const msg = await prisma.message.findUnique({ where: { id: m.sourceMsgId } });
    if (msg && msg.meta?.promoted_memory_id === m.id) {
      const meta = { ...msg.meta };
      delete meta.promoted_memory_id;
      await prisma.message.update({ where: { id: msg.id }, data: { meta } });
    }
  }
  ok(res, { id: m.id }, '已撤回共享');
  hub.emit(req.params.pid, 'memory.withdrawn', { memory_id: m.id, title: m.title, by: req.user.username });
}));

module.exports = router;
