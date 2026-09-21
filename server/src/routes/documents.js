// M8 总文档与知识沉淀（P2）：总文档 = 共享记忆的视图，不是独立维护的文档
// refresh 从共享记忆按 category 重新聚合；手动编辑后 is_auto_synced=false（脱离自动聚合）
const express = require('express');
const prisma = require('../db');
const { ok, wrap, E } = require('../middleware/error');
const { authRequired } = require('../middleware/auth');
const hub = require('../services/events');

const router = express.Router({ mergeParams: true });
router.use(authRequired);

const CAT_LABEL = {
  decision: '决策记录', conclusion: '结论', todo: '待办', risk: '风险',
  snippet: '资料', fact: '事实', paper_card: '文献卡片',
};
const CAT_ORDER = ['decision', 'conclusion', 'risk', 'todo', 'fact', 'snippet', 'paper_card'];

const docView = (d) => ({
  id: d.id, project_id: d.projectId, parent_id: d.parentId, title: d.title,
  content: d.content, doc_type: d.docType, is_auto_synced: d.isAutoSynced,
  last_editor_id: d.lastEditorId,
  last_editor_name: d.lastEditor?.displayName || d.lastEditor?.username || null,
  created_at: d.createdAt, updated_at: d.updatedAt,
});

const INCLUDE_EDITOR = { lastEditor: { select: { username: true, displayName: true } } };

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

async function assertMasterWriteAccess(req, project, doc) {
  if (doc.docType !== 'master' || project.ownerId === req.user.id) return;
  const membership = await prisma.projectMember.findFirst({
    where: { projectId: project.id, userId: req.user.id },
    select: { isLeader: true },
  });
  if (!membership?.isLeader) throw E.noWrite('仅项目负责人可以修改项目总文档');
}

// 聚合逻辑：共享记忆 → 总文档 markdown（附来源链接，保证可追溯）
function aggregate(project, memories) {
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const lines = [
    `# ${project.name} · 项目总文档`,
    '',
    `> 本文档由共享记忆自动聚合生成（${now}），素材全部来自团队记忆库，可追溯来源。`,
    '',
  ];
  const groups = {};
  for (const m of memories) (groups[m.category] ||= []).push(m);
  let hasAny = false;
  for (const cat of CAT_ORDER) {
    const list = groups[cat];
    if (!list || !list.length) continue;
    hasAny = true;
    lines.push(`## ${CAT_LABEL[cat]}（${list.length}）`, '');
    for (const m of list) {
      const src = [
        m.sourceRole?.name ? `来源角色：${m.sourceRole.name}` : null,
        m.sourceUser?.displayName || m.sourceUser?.username ? `晋升人：${m.sourceUser?.displayName || m.sourceUser?.username}` : null,
        m.sourceConversationId ? `会话 ${m.sourceConversationId.slice(0, 8)}…` : null,
      ].filter(Boolean).join(' · ');
      lines.push(`### ${m.isPinned ? '📌 ' : ''}${m.title}`);
      lines.push('');
      lines.push(m.content.length > 600 ? m.content.slice(0, 600) + '……' : m.content);
      lines.push('');
      lines.push(`<sub>重要度 ${'★'.repeat(m.importance)}${m.tags.length ? ' · ' + m.tags.map((t) => '#' + t).join(' ') : ''}${src ? ' · ' + src : ''}</sub>`);
      lines.push('');
    }
  }
  if (!hasAny) {
    lines.push('## 暂无明显内容', '', '共享记忆库还是空的。在 AI 协作对话中对有价值的回复点击「晋升为共享记忆」，这里会自动长出项目的知识骨架。');
  }
  return lines.join('\n');
}

// GET /api/v1/projects/:pid/documents 总文档树（含 master 与其他文档）
router.get('/', wrap(async (req, res) => {
  await checkAccess(req);
  const docs = await prisma.document.findMany({
    where: { projectId: req.params.pid },
    orderBy: [{ docType: 'asc' }, { updatedAt: 'desc' }],
    include: INCLUDE_EDITOR,
  });
  ok(res, { items: docs.map(docView), total: docs.length });
}));

// POST /api/v1/projects/:pid/documents 新建文档
router.post('/', wrap(async (req, res) => {
  await checkAccess(req);
  const { title, content, parent_id, doc_type } = req.body || {};
  if (!title || !title.trim()) throw E.param('标题必填');
  if (parent_id) {
    const parent = await prisma.document.findUnique({ where: { id: parent_id } });
    if (!parent || parent.projectId !== req.params.pid) throw E.param('父文档不属于当前项目');
  }
  const doc = await prisma.document.create({
    data: {
      projectId: req.params.pid, title: title.trim(), content: content || '',
      parentId: parent_id || null, docType: doc_type || 'note',
      isAutoSynced: false, lastEditorId: req.user.id,
    },
    include: INCLUDE_EDITOR,
  });
  ok(res, docView(doc), '文档已创建');
}));

// GET /api/v1/projects/:pid/documents/:did 单篇
router.get('/:did', wrap(async (req, res) => {
  await checkAccess(req);
  const doc = await prisma.document.findUnique({ where: { id: req.params.did }, include: INCLUDE_EDITOR });
  if (!doc || doc.projectId !== req.params.pid) throw E.notFound('文档不存在');
  ok(res, docView(doc));
}));

// PATCH /api/v1/projects/:pid/documents/:did 手动编辑（master 文档编辑后脱离自动聚合）
router.patch('/:did', wrap(async (req, res) => {
  const project = await checkAccess(req);
  const doc = await prisma.document.findUnique({ where: { id: req.params.did } });
  if (!doc || doc.projectId !== req.params.pid) throw E.notFound('文档不存在');
  await assertMasterWriteAccess(req, project, doc);
  const { title, content, is_auto_synced } = req.body || {};
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      ...(title !== undefined && { title: String(title).trim() }),
      ...(content !== undefined && { content: String(content), isAutoSynced: false }),
      ...(is_auto_synced !== undefined && { isAutoSynced: !!is_auto_synced }),
      lastEditorId: req.user.id,
    },
    include: INCLUDE_EDITOR,
  });
  ok(res, docView(updated), '已保存');
}));

// POST /api/v1/projects/:pid/documents/:did/refresh 从共享记忆重新聚合
// did 传 "master" 时自动定位/创建项目总文档
router.post('/:did/refresh', wrap(async (req, res) => {
  const project = await checkAccess(req);
  let doc;
  if (req.params.did === 'master') {
    await assertMasterWriteAccess(req, project, { docType: 'master' });
    doc = await prisma.document.findFirst({ where: { projectId: project.id, docType: 'master' } });
    if (!doc) {
      doc = await prisma.document.create({
        data: { projectId: project.id, title: `${project.name} · 项目总文档`, docType: 'master', isAutoSynced: true, lastEditorId: req.user.id },
      });
    }
  } else {
    doc = await prisma.document.findUnique({ where: { id: req.params.did } });
    if (!doc || doc.projectId !== project.id) throw E.notFound('文档不存在');
    if (!doc.isAutoSynced) throw E.param('该文档已手动编辑脱离自动同步，如需恢复请先把 is_auto_synced 置回 true');
  }
  await assertMasterWriteAccess(req, project, doc);
  const memories = await prisma.memory.findMany({
    where: { projectId: project.id },
    orderBy: [{ isPinned: 'desc' }, { importance: 'desc' }, { promotedAt: 'desc' }],
    include: {
      sourceRole: { select: { name: true } },
      sourceUser: { select: { username: true, displayName: true } },
    },
  });
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { content: aggregate(project, memories), lastEditorId: req.user.id },
    include: INCLUDE_EDITOR,
  });
  ok(res, { ...docView(updated), memory_count: memories.length }, `已从 ${memories.length} 条共享记忆重新聚合`);
  hub.emit(project.id, 'doc.refreshed', { document_id: doc.id, memory_count: memories.length, by: req.user.username });
}));

module.exports = router;
