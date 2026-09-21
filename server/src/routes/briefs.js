const router = require('express').Router({ mergeParams: true });
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess } = require('../middleware/permission');
const { ok, wrap, E } = require('../middleware/error');
const { approvedMemories, validSources } = require('../services/review');
const hub = require('../services/events');
router.use(authRequired, requireProjectAccess);
router.get('/', wrap(async (req, res) => ok(res, { items: await db.meetingBrief.findMany({ where: { projectId: req.project.id }, orderBy: { createdAt: 'desc' } }) })));
router.post('/', wrap(async (req, res) => {
  const { request_key, start, end, timezone = 'Asia/Shanghai' } = req.body || {};
  if (typeof request_key !== 'string' || !request_key || request_key.length > 100) throw E.param('request_key 必填');
  const from = new Date(start), to = new Date(end);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || from >= to || +to - +from > 31 * 86400000) throw E.param('请选择最多 31 天的起止时间');
  try { new Intl.DateTimeFormat('zh-CN', { timeZone: timezone }); } catch { throw E.param('无效时区'); }
  const where = { projectId_requestKey: { projectId: req.project.id, requestKey: request_key } };
  const existing = await db.meetingBrief.findUnique({ where });
  if (existing) return ok(res, existing);
  const [decisions, experiments, tasks, evidence] = await Promise.all([
    approvedMemories(db, req.project.id),
    db.experiment.findMany({ where: { projectId: req.project.id, updatedAt: { gte: from, lt: to } } }),
    db.task.findMany({ where: { projectId: req.project.id, status: { not: 'draft' } } }),
    db.paperCard.findMany({ where: { projectId: req.project.id, updatedAt: { gte: from, lt: to } } }),
  ]);
  const snapshot = JSON.parse(JSON.stringify({ schemaVersion: 1, start: from, end: to, timezone, decisions, experiments, tasks, evidence }));
  const content = [`# ${req.project.name} · 研究进展`, `时间窗：${from.toISOString()} 至 ${to.toISOString()}（右端不含，显示时区 ${timezone}）`, '', '## 已确认决策', ...decisions.map(m => `- ${m.title} [${m.id}@v${m.version}]\n  ${m.content}`), '', '## 更新的证据', ...evidence.map(c => `- ${c.notes || '来源卡'}（${c.evidenceStatus}）[${c.id}]`), '', '## 实验结果', ...experiments.map(e => `- ${e.title}（${e.status}）：${e.conclusion || '待补充结论'}`), '', '## 行动进展', ...tasks.map(t => `- ${t.title}（${t.status}）`)].join('\n');
  const data = { projectId: req.project.id, requestKey: request_key, title: `${req.project.name} · 研究进展`, content, snapshot, createdBy: req.user.id };
  ok(res, await db.meetingBrief.upsert({ where, create: data, update: {} }));
}));
async function locked(req, fn) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM meeting_briefs WHERE id = ${req.params.bid}::uuid FOR UPDATE`;
    const b = await tx.meetingBrief.findFirst({ where: { id: req.params.bid, projectId: req.project.id } });
    if (!b) throw E.notFound();
    return fn(tx, b);
  });
}
router.patch('/:bid', wrap(async (req, res) => {
  ok(res, await locked(req, async (tx, b) => {
    if (b.status !== 'draft') throw E.conflict('已发布快照不可修改');
    if (req.body.expectedVersion !== b.version) throw E.conflict('草稿已更新，请刷新');
    const content = String(req.body.content || '');
    if (!content.trim() || content.length > 100000) throw E.param('正文为空或超过 10 万字符');
    const actions = req.body.actions || [];
    if (!Array.isArray(actions) || actions.length > 30) throw E.param('行动项最多 30 条');
    const clean = [];
    for (const a of actions) {
      if (!String(a.title || '').trim() || a.title.length > 255) throw E.param('行动项标题无效');
      if (a.role_id && !await tx.role.findFirst({ where: { id: a.role_id, projectId: b.projectId, isArchived: false, members: { some: {} } } })) throw E.param('负责人必须是已被成员认领的项目角色');
      if (a.due_at && !/^\d{4}-\d{2}-\d{2}$/.test(a.due_at)) throw E.param('期限格式应为 YYYY-MM-DD');
      clean.push({ title: a.title.trim(), role_id: a.role_id || null, due_at: a.due_at || null });
    }
    return tx.meetingBrief.update({ where: { id: b.id }, data: { content, actions: clean, version: { increment: 1 }, edits: [...b.edits, { at: new Date().toISOString(), actor: req.user.id, content: b.content, actions: b.actions }] } });
  }));
}));
router.post('/:bid/publish', wrap(async (req, res) => {
  if (!req.isLeader) throw E.noWrite('仅负责人可发布组会');
  ok(res, await locked(req, async (tx, b) => {
    if (b.status === 'published') return b;
    if (b.version !== req.body.expectedVersion) throw E.conflict('草稿已更新，请刷新');
    for (const m of b.snapshot.decisions) {
      const current = await tx.memory.findUnique({ where: { id: m.id } });
      if (!current || current.version !== m.version || current.reviewStatus !== 'approved' || !await validSources(tx, b.projectId, m.revisions[0]?.sources)) throw E.conflict('决策来源已变化，请重新生成草稿');
    }
    return tx.meetingBrief.update({ where: { id: b.id }, data: { status: 'published', publishedAt: new Date(), version: { increment: 1 } } });
  }));
}));
router.post('/:bid/actions/:index/accept', wrap(async (req, res) => {
  if (!req.isLeader) throw E.noWrite('仅负责人可以接受行动项');
  const task = await locked(req, async (tx, b) => {
    if (b.status !== 'published') throw E.conflict('请先发布组会');
    const index = Number(req.params.index), action = b.actions[index];
    if (!Number.isInteger(index) || !action) throw E.notFound('行动项不存在');
    const key = `brief:${b.id}:${index}`;
    const old = await tx.task.findFirst({ where: { projectId: b.projectId, meta: { path: ['brief_item'], equals: key } } });
    if (old) return old;
    if (action.role_id && !await tx.role.findFirst({ where: { id: action.role_id, projectId: b.projectId, isArchived: false, members: { some: {} } } })) throw E.conflict('负责人已失效');
    return tx.task.create({ data: { projectId: b.projectId, title: action.title, roleId: action.role_id, dueDate: action.due_at ? new Date(action.due_at) : null, meta: { brief_item: key, brief_id: b.id }, priority: 1 } });
  });
  hub.emit(req.project.id, 'task.updated', { task_id: task.id });
  ok(res, task);
}));
router.get('/:bid/export', wrap(async (req, res) => {
  const b = await db.meetingBrief.findFirst({ where: { id: req.params.bid, projectId: req.project.id } });
  if (!b) throw E.notFound();
  const warnings = [];
  for (const m of b.snapshot.decisions) {
    const current = await db.memory.findUnique({ where: { id: m.id } });
    if (!current || current.version !== m.version || current.reviewStatus !== 'approved' || !await validSources(db, b.projectId, m.revisions[0]?.sources)) warnings.push(`来源 ${m.id}@v${m.version} 后来发生变化，需复核`);
  }
  ok(res, { filename: `brief-${b.id}.md`, content: b.content, warnings, status: b.status, version: b.version });
}));
module.exports = router;
