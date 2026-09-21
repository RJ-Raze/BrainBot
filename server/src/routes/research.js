// 科研工作台：论文库、方向树、文献卡片、实验记录与驾驶舱。
// 联网检索（arXiv / OpenAlex）经 search_tasks 异步执行：立即返回 task_id，
// 后台 worker 并发≤3 拉取，完成后广播 search.done / search.failed 项目事件。
const express = require('express');
const prisma = require('../db');
const { ok, wrap, E } = require('../middleware/error');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess } = require('../middleware/permission');
const rateLimit = require('../middleware/rate-limit');
const hub = require('../services/events');
const academic = require('../services/academic');
const { normalizeDoi } = require('../services/ris');

const router = express.Router({ mergeParams: true });
router.use(authRequired);
router.use(requireProjectAccess);

const DIRECTION_STATUS = ['exploring', 'selected', 'parked', 'dropped'];
const EXPERIMENT_STATUS = ['planned', 'running', 'succeeded', 'failed'];
const EVIDENCE_STATUS = ['unverified', 'reviewed', 'conflicting'];

const paperView = (p) => ({
  id: p.id, project_id: p.projectId, source: p.source, external_id: p.externalId,
  title: p.title, authors: p.authors, abstract: p.abstract, year: p.year,
  venue: p.venue, doi: p.doi, pdf_url: p.pdfUrl, code_url: p.codeUrl,
  keywords: p.keywords, citation_count: p.citationCount, created_at: p.createdAt,
});

const directionView = (d) => ({
  id: d.id, project_id: d.projectId, parent_id: d.parentId, root_task_id: d.rootTaskId,
  name: d.name, description: d.description, feasibility: d.feasibility,
  novelty: d.novelty, impact: d.impact, evidence_count: d.evidenceCount,
  status: d.status, created_by: d.createdBy, created_at: d.createdAt, updated_at: d.updatedAt,
});

const cardView = (c) => ({
  id: c.id, project_id: c.projectId, paper_id: c.paperId, role_id: c.roleId,
  author_user_id: c.authorUserId, notes: c.notes, evidence_quote: c.evidenceQuote,
  evidence_locator: c.evidenceLocator, evidence_status: c.evidenceStatus,
  tags: c.tags, is_shared: c.isShared,
  rating: c.rating, created_at: c.createdAt, updated_at: c.updatedAt,
  paper: c.paper ? paperView(c.paper) : undefined,
  role_name: c.role?.name || null,
  author_name: c.author?.displayName || c.author?.username || null,
});

const experimentView = (e) => ({
  id: e.id, project_id: e.projectId, role_id: e.roleId, task_id: e.taskId,
  direction_id: e.directionId, title: e.title, hypothesis: e.hypothesis, setup: e.setup,
  result: e.result, metric: e.metric, conclusion: e.conclusion, log_url: e.logUrl,
  status: e.status, run_at: e.runAt, created_by: e.createdBy,
  created_at: e.createdAt, updated_at: e.updatedAt,
  role_name: e.role?.name || null, direction_name: e.direction?.name || null,
});

async function assertProjectRole(req, roleId) {
  if (!roleId) throw E.param('role_id 必填');
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.projectId !== req.project.id || role.isArchived) throw E.param('角色不属于当前项目或已归档');
  if (!req.isLeader) {
    const bound = await prisma.projectMember.findFirst({
      where: { projectId: req.project.id, userId: req.user.id, roleId },
    });
    if (!bound) throw E.noRole('只能以自己认领的角色写入科研记录');
  }
  return role;
}

async function assertProjectTask(projectId, taskId) {
  if (!taskId) return null;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) throw E.param('任务不属于当前项目');
  return task;
}

// ---------- 项目论文库：人工录入 / 导入结果入库 ----------
router.get('/papers', wrap(async (req, res) => {
  const { q, year } = req.query;
  const where = { projectId: req.project.id };
  if (year) where.year = parseInt(year, 10);
  if (q) where.OR = [
    { title: { contains: String(q), mode: 'insensitive' } },
    { abstract: { contains: String(q), mode: 'insensitive' } },
    { keywords: { has: String(q) } },
  ];
  const [items, total] = await Promise.all([
    prisma.paper.findMany({ where, orderBy: [{ year: 'desc' }, { createdAt: 'desc' }], take: 200 }),
    prisma.paper.count({ where }),
  ]);
  ok(res, { items: items.map(paperView), total });
}));

// 论文入库（单条 POST /papers 与检索批量入库共用）：DOI 优先去重，返回幂等结果
async function importPaperRecord(projectId, body) {
  const title = String(body.title || '').trim();
  const source = String(body.source || 'manual').trim().toLowerCase();
  const externalId = String(body.external_id || body.doi || title).trim();
  const doi = body.doi ? normalizeDoi(body.doi) : null;
  if (!title || !externalId) throw E.param('title 与 external_id（或 doi）必填');

  // DOI 优先去重：同一 DOI 视为同一篇论文，跨来源不重复收录
  let existing = null;
  if (doi) existing = await prisma.paper.findFirst({ where: { projectId, doi } });
  if (!existing) existing = await prisma.paper.findFirst({ where: { projectId, source, externalId } });
  if (existing) return { created: false, paper: existing, cloned_from_public: false };

  // 公共库记录只作为元数据模板复制，项目的卡片、笔记和文件仍保持隔离。
  const publicRecord = await prisma.paper.findFirst({ where: { projectId: null, source, externalId } });
  let paper;
  try {
    paper = await prisma.paper.create({
      data: {
        projectId, source, externalId, title,
        authors: Array.isArray(body.authors) ? body.authors : (publicRecord?.authors || []),
        abstract: body.abstract ? String(body.abstract) : (publicRecord?.abstract || null),
        year: body.year ? parseInt(body.year, 10) : (publicRecord?.year || null),
        venue: body.venue ? String(body.venue) : (publicRecord?.venue || null), doi: doi || (publicRecord?.doi || null),
        pdfUrl: body.pdf_url ? String(body.pdf_url) : (publicRecord?.pdfUrl || null), codeUrl: body.code_url ? String(body.code_url) : (publicRecord?.codeUrl || null),
        keywords: Array.isArray(body.keywords) ? body.keywords.map(String).filter(Boolean) : (publicRecord?.keywords || []),
        citationCount: body.citation_count !== undefined ? Math.max(0, parseInt(body.citation_count, 10) || 0) : (publicRecord?.citationCount || 0),
        rawMeta: body.raw_meta || publicRecord?.rawMeta || {},
      },
    });
  } catch (error) {
    // 并发入库时 DOI 唯一约束兜底：回查已有论文返回幂等结果
    if (error.code !== 'P2002') throw error;
    paper = await prisma.paper.findFirst({ where: { projectId, OR: [{ doi: doi || undefined }, { source, externalId }] } });
    if (paper) return { created: false, paper, cloned_from_public: false };
    throw error;
  }
  return { created: true, paper, cloned_from_public: Boolean(publicRecord) };
}

router.post('/papers', wrap(async (req, res) => {
  const r = await importPaperRecord(req.project.id, req.body || {});
  ok(res, { ...paperView(r.paper), created: r.created, cloned_from_public: r.cloned_from_public },
    r.created ? (r.cloned_from_public ? '论文已复制到当前项目' : '论文已收录') : '论文已在当前项目中');
  if (r.created) hub.emit(req.project.id, 'paper.created', { paper: paperView(r.paper), by: req.user.username });
}));

router.patch('/papers/:paperId', wrap(async (req, res) => {
  const paper = await prisma.paper.findUnique({ where: { id: req.params.paperId } });
  if (!paper || paper.projectId !== req.project.id) throw E.notFound('论文不存在');
  const body = req.body || {};
  const updated = await prisma.paper.update({
    where: { id: paper.id },
    data: {
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.abstract !== undefined && { abstract: body.abstract ? String(body.abstract) : null }),
      ...(body.authors !== undefined && { authors: Array.isArray(body.authors) ? body.authors : paper.authors }),
      ...(body.year !== undefined && { year: body.year ? parseInt(body.year, 10) : null }),
      ...(body.venue !== undefined && { venue: body.venue ? String(body.venue) : null }),
      ...(body.keywords !== undefined && { keywords: Array.isArray(body.keywords) ? body.keywords.map(String).filter(Boolean) : paper.keywords }),
      ...(body.citation_count !== undefined && { citationCount: Math.max(0, parseInt(body.citation_count, 10) || 0) }),
    },
  });
  ok(res, paperView(updated), '论文已更新');
  hub.emit(req.project.id, 'paper.updated', { paper: paperView(updated), by: req.user.username });
}));

// ---------- 联网文献检索（search_tasks 异步） ----------
const searchView = (t) => ({
  id: t.id, project_id: t.projectId, query: t.query, sources: t.sources,
  status: t.status, result: t.result, error_msg: t.errorMsg,
  created_by: t.createdBy, created_at: t.createdAt, finished_at: t.finishedAt,
});

// 单进程检索 worker：并发 ≤3，多余任务排队；进程重启后遗留 pending/running 任务标记为失败
let runningSearches = 0;
const searchQueue = [];
const MAX_CONCURRENT_SEARCHES = 3;
function pumpSearchQueue() {
  while (runningSearches < MAX_CONCURRENT_SEARCHES && searchQueue.length) {
    const taskId = searchQueue.shift();
    runningSearches++;
    // 必须兜底 .catch：worker 内任何未捕获 rejection 都会让 Node 直接退出进程
    runSearchTask(taskId)
      .catch((error) => console.error('[search] 检索 worker 未捕获异常:', error))
      .finally(() => { runningSearches--; pumpSearchQueue(); });
  }
}
async function runSearchTask(taskId) {
  let task = null;
  try {
    task = await prisma.searchTask.findUnique({ where: { id: taskId } });
    if (!task || task.status !== 'pending') return;
    await prisma.searchTask.update({ where: { id: taskId }, data: { status: 'running' } });
    const { items, errors } = await academic.searchAll(task.query, { sources: task.sources, maxResults: 10 });
    // 标注项目库中已收录的论文，前端据此显示"已入库"
    const existing = await prisma.paper.findMany({ where: { projectId: task.projectId }, select: { source: true, externalId: true } });
    const have = new Set(existing.map((p) => `${p.source}:${p.externalId}`));
    const annotated = items.map((p) => ({ ...p, in_library: have.has(`${p.source}:${p.external_id}`) }));
    const done = await prisma.searchTask.update({ where: { id: taskId }, data: { status: 'done', result: { items: annotated, errors }, finishedAt: new Date() } });
    hub.emit(task.projectId, 'search.done', { task: searchView(done) });
  } catch (error) {
    // 失败标记自身也可能因 DB 瞬断失败，不能再向外抛（外层已有兜底 .catch）
    try {
      const failed = await prisma.searchTask.update({ where: { id: taskId }, data: { status: 'fail', errorMsg: String(error.message || error), finishedAt: new Date() } });
      if (task) hub.emit(task.projectId, 'search.failed', { task: searchView(failed) });
    } catch (inner) {
      console.error('[search] 标记检索失败时出错:', inner);
    }
  }
}
// 启动时恢复上次进程遗留的未完成检索任务（断点续传，而非直接标记失败）
async function recoverSearchTasks() {
  try {
    // running 任务（上次进程崩溃时卡住）先回退为 pending，再统一入队重跑
    await prisma.searchTask.updateMany({ where: { status: 'running' }, data: { status: 'pending' } });
    const stale = await prisma.searchTask.findMany({ where: { status: 'pending' }, select: { id: true } });
    for (const t of stale) searchQueue.push(t.id);
    if (stale.length) { console.log(`[search] 断点续传：恢复 ${stale.length} 个未完成检索任务`); pumpSearchQueue(); }
  } catch (e) { console.error('[search] 恢复检索任务失败', e); }
}
recoverSearchTasks();

router.post('/search', rateLimit({ limit: 10 }), wrap(async (req, res) => {
  const query = String(req.body?.query || '').trim();
  if (!query || query.length > 200) throw E.param('检索词需为 1–200 字符');
  // 前端未指定源时用 DEFAULT_SOURCES；无论是否显式传参，都受 ACADEMIC_SOURCES 白名单约束
  const allowed = academic.DEFAULT_SOURCES.filter((s) => academic.SOURCES.includes(s));
  const sources = (Array.isArray(req.body?.sources) ? req.body.sources : academic.DEFAULT_SOURCES)
    .filter((s) => allowed.includes(s));
  if (!sources.length) throw E.param(`至少选择一个检索源（${academic.SOURCES.join(' / ')}）`);
  // 同项目同词有未完成检索则复用，避免重复请求外部 API
  const existing = await prisma.searchTask.findFirst({
    where: { projectId: req.project.id, query, status: { in: ['pending', 'running'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return ok(res, { task: searchView(existing), reused: true }, '相同检索正在进行中');
  const task = await prisma.searchTask.create({ data: { projectId: req.project.id, query, sources, createdBy: req.user.id } });
  searchQueue.push(task.id);
  pumpSearchQueue();
  ok(res, { task: searchView(task), reused: false }, '检索任务已创建');
}));

router.get('/search', wrap(async (req, res) => {
  const items = await prisma.searchTask.findMany({ where: { projectId: req.project.id }, orderBy: { createdAt: 'desc' }, take: 10 });
  ok(res, { items: items.map(searchView) });
}));

router.get('/search/:taskId', wrap(async (req, res) => {
  const task = await prisma.searchTask.findUnique({ where: { id: req.params.taskId } });
  if (!task || task.projectId !== req.project.id) throw E.notFound('检索任务不存在');
  ok(res, { task: searchView(task) });
}));

// 批量入库：把某次检索结果中尚未入库的论文一次性收录（跳过已入库/重复）
router.post('/search/:taskId/import-all', wrap(async (req, res) => {
  const task = await prisma.searchTask.findUnique({ where: { id: req.params.taskId } });
  if (!task || task.projectId !== req.project.id) throw E.notFound('检索任务不存在');
  if (task.status !== 'done') throw E.param('检索任务尚未完成，无法批量入库');
  const all = task.result?.items || [];
  const pending = all.filter((it) => !it.in_library);
  let imported = 0, skipped = 0;
  for (const item of pending) {
    const r = await importPaperRecord(req.project.id, item);
    r.created ? imported++ : skipped++;
  }
  if (imported) hub.emit(req.project.id, 'paper.created', { paper: { count: imported }, by: req.user.username });
  ok(res, { imported, skipped, already: all.length - pending.length }, `已入库 ${imported} 篇，跳过 ${skipped} 篇`);
}));

// ---------- 研究方向树 ----------
router.get('/directions', wrap(async (req, res) => {
  const where = { projectId: req.project.id };
  if (req.query.status && DIRECTION_STATUS.includes(req.query.status)) where.status = req.query.status;
  const items = await prisma.directionNode.findMany({ where, orderBy: { createdAt: 'asc' }, take: 500 });
  ok(res, { items: items.map(directionView), total: items.length });
}));

router.post('/directions', wrap(async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) throw E.param('方向名称必填');
  if (body.parent_id) {
    const parent = await prisma.directionNode.findUnique({ where: { id: body.parent_id } });
    if (!parent || parent.projectId !== req.project.id) throw E.param('父方向不属于当前项目');
  }
  await assertProjectTask(req.project.id, body.root_task_id);
  const node = await prisma.directionNode.create({
    data: {
      projectId: req.project.id, parentId: body.parent_id || null, rootTaskId: body.root_task_id || null,
      name, description: body.description ? String(body.description) : null,
      feasibility: body.feasibility == null ? null : Math.min(5, Math.max(1, parseInt(body.feasibility, 10))),
      novelty: body.novelty == null ? null : Math.min(5, Math.max(1, parseInt(body.novelty, 10))),
      impact: body.impact == null ? null : Math.min(5, Math.max(1, parseInt(body.impact, 10))),
      evidenceCount: Math.max(0, parseInt(body.evidence_count, 10) || 0),
      status: DIRECTION_STATUS.includes(body.status) ? body.status : 'exploring', createdBy: req.user.id,
    },
  });
  ok(res, directionView(node), '研究方向已创建');
  hub.emit(req.project.id, 'direction.updated', { direction: directionView(node), action: 'created', by: req.user.username });
}));

router.patch('/directions/:directionId', wrap(async (req, res) => {
  const node = await prisma.directionNode.findUnique({ where: { id: req.params.directionId } });
  if (!node || node.projectId !== req.project.id) throw E.notFound('研究方向不存在');
  const body = req.body || {};
  if (body.parent_id) {
    if (body.parent_id === node.id) throw E.param('方向不能以自身为父节点');
    const parent = await prisma.directionNode.findUnique({ where: { id: body.parent_id } });
    if (!parent || parent.projectId !== req.project.id) throw E.param('父方向不属于当前项目');
    // 多代环校验：沿新父节点的父链向上走，遇到当前节点即成环（seen 防历史脏数据死循环）
    const seen = new Set([node.id]);
    let cursor = parent;
    while (cursor && cursor.parentId) {
      if (seen.has(cursor.parentId)) throw E.param('不能形成循环父子关系');
      seen.add(cursor.id);
      cursor = await prisma.directionNode.findUnique({ where: { id: cursor.parentId } });
    }
  }
  await assertProjectTask(req.project.id, body.root_task_id);
  const score = (key, old) => body[key] === undefined ? old : (body[key] == null ? null : Math.min(5, Math.max(1, parseInt(body[key], 10))));
  const updated = await prisma.directionNode.update({
    where: { id: node.id },
    data: {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.description !== undefined && { description: body.description ? String(body.description) : null }),
      ...(body.parent_id !== undefined && { parentId: body.parent_id || null }),
      ...(body.root_task_id !== undefined && { rootTaskId: body.root_task_id || null }),
      feasibility: score('feasibility', node.feasibility), novelty: score('novelty', node.novelty), impact: score('impact', node.impact),
      ...(body.evidence_count !== undefined && { evidenceCount: Math.max(0, parseInt(body.evidence_count, 10) || 0) }),
      ...(body.status !== undefined && DIRECTION_STATUS.includes(body.status) && { status: body.status }),
    },
  });
  ok(res, directionView(updated), '研究方向已更新');
  hub.emit(req.project.id, 'direction.updated', { direction: directionView(updated), action: 'updated', by: req.user.username });
}));

// ---------- 文献卡片与晋升共享记忆 ----------
router.get('/paper-cards', wrap(async (req, res) => {
  const where = { projectId: req.project.id, ...(req.query.paper_id && { paperId: req.query.paper_id }) };
  const items = await prisma.paperCard.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 200,
    include: { paper: true, role: { select: { name: true } }, author: { select: { username: true, displayName: true } } },
  });
  ok(res, { items: items.map(cardView), total: items.length });
}));

router.post('/paper-cards', wrap(async (req, res) => {
  const body = req.body || {};
  const paper = await prisma.paper.findUnique({ where: { id: body.paper_id } });
  if (!paper || paper.projectId !== req.project.id) throw E.param('论文不属于当前项目');
  await assertProjectRole(req, body.role_id);
  const card = await prisma.paperCard.create({
    data: {
      projectId: req.project.id, paperId: paper.id, roleId: body.role_id, authorUserId: req.user.id,
      notes: body.notes ? String(body.notes) : null,
      evidenceQuote: body.evidence_quote ? String(body.evidence_quote).trim().slice(0, 8000) : null,
      evidenceLocator: body.evidence_locator ? String(body.evidence_locator).trim().slice(0, 255) : null,
      evidenceStatus: 'unverified',
      tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [],
      rating: Math.min(5, Math.max(1, parseInt(body.rating, 10) || 3)),
    },
    include: { paper: true, role: { select: { name: true } }, author: { select: { username: true, displayName: true } } },
  });
  ok(res, cardView(card), '文献卡片已创建');
  hub.emit(req.project.id, 'paper-card.updated', { card_id: card.id, action: 'created', by: req.user.username });
}));

router.patch('/paper-cards/:cardId', wrap(async (req, res) => {
  const card = await prisma.paperCard.findUnique({ where: { id: req.params.cardId } });
  if (!card || card.projectId !== req.project.id) throw E.notFound('文献卡片不存在');
  if (card.authorUserId !== req.user.id && !req.isLeader) throw E.noWrite('仅卡片作者或负责人可编辑');
  const body = req.body || {};
  const updated = await prisma.paperCard.update({
    where: { id: card.id },
    data: {
        ...(body.notes !== undefined && { notes: body.notes ? String(body.notes) : null }),
        ...((body.evidence_quote !== undefined || body.evidence_locator !== undefined) && { evidenceStatus: 'unverified' }),
      ...(body.evidence_quote !== undefined && { evidenceQuote: body.evidence_quote ? String(body.evidence_quote).trim().slice(0, 8000) : null }),
      ...(body.evidence_locator !== undefined && { evidenceLocator: body.evidence_locator ? String(body.evidence_locator).trim().slice(0, 255) : null }),
      ...(body.tags !== undefined && { tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : card.tags }),
      ...(body.rating !== undefined && { rating: Math.min(5, Math.max(1, parseInt(body.rating, 10) || card.rating)) }),
    },
    include: { paper: true, role: { select: { name: true } }, author: { select: { username: true, displayName: true } } },
  });
  ok(res, cardView(updated), '文献卡片已更新');
  hub.emit(req.project.id, 'paper-card.updated', { card_id: card.id, action: 'updated', by: req.user.username });
}));

// 项目负责人核验来源：状态变化是显式动作，不能由普通编辑隐式触发。
router.post('/paper-cards/:cardId/review-evidence', wrap(async (req, res) => {
  const card = await prisma.paperCard.findUnique({ where: { id: req.params.cardId } });
  if (!card || card.projectId !== req.project.id) throw E.notFound('文献卡片不存在');
  if (!req.isLeader) throw E.noWrite('仅项目负责人可以核验文献来源');
  const status = EVIDENCE_STATUS.includes(req.body?.status) ? req.body.status : 'reviewed';
  if (status === 'reviewed' && !await require('../services/citation').validCitation(prisma, req.project.id, card.evidenceLocator, card.evidenceQuote)) throw E.param('原文引用已失效或摘录不匹配');
  if (status === 'reviewed' && (!card.evidenceQuote || !card.evidenceLocator)) {
    throw E.param('核验前请补充原文摘录和来源定位');
  }
  const updated = await prisma.paperCard.update({
    where: { id: card.id },
    data: { evidenceStatus: status },
    include: { paper: true, role: { select: { name: true } }, author: { select: { username: true, displayName: true } } },
  });
  ok(res, cardView(updated), status === 'reviewed' ? '来源已核验' : '证据状态已更新');
  hub.emit(req.project.id, 'paper-card.updated', { card_id: card.id, action: 'evidence-reviewed', status, by: req.user.username });
}));

router.post('/paper-cards/:cardId/promote', wrap(async (req, res) => {
  const card = await prisma.paperCard.findUnique({ where: { id: req.params.cardId }, include: { paper: true } });
  if (!card || card.projectId !== req.project.id) throw E.notFound('文献卡片不存在');
  if (card.authorUserId !== req.user.id && !req.isLeader) throw E.noWrite('仅卡片作者或项目负责人可以晋升');
  if (card.isShared) throw E.conflict('该文献卡片已晋升为共享记忆');

  // 引用核验前置（Sprint 3）：来源未通过核验的卡片不得进入团队共识池，防止 AI 编造的引用被沉淀。
  if (card.evidenceStatus === 'conflicting') {
    throw E.param('该卡片来源存在冲突，请先复核原文后再晋升');
  }
  if (card.evidenceStatus !== 'reviewed') {
    const locator = card.evidenceLocator || '';
    if (locator.startsWith('file:')) {
      // 带真实文件定位的卡片：晋升前自动核验（重算哈希 + 摘录逐字校验），通过则视为已核验
      const valid = await require('../services/citation').validCitation(prisma, req.project.id, card.evidenceLocator, card.evidenceQuote);
      if (!valid) throw E.param('该卡片的原文引用未通过核验，请先修正摘录或来源定位后再晋升');
      await prisma.paperCard.update({ where: { id: card.id }, data: { evidenceStatus: 'reviewed' } });
      card.evidenceStatus = 'reviewed';
    } else {
      // 人工写来源的卡片：仍需项目负责人显式核验
      throw E.param('该卡片的来源尚未由项目负责人核验，请先在卡片上完成「核验来源」再晋升');
    }
  }

  // 事务内先原子占位（isShared false→true）再建记忆，杜绝并发重复晋升
  const memory = await prisma.$transaction(async (tx) => {
    const claimed = await tx.paperCard.updateMany({ where: { id: card.id, isShared: false }, data: { isShared: true } });
    if (claimed.count === 0) throw E.conflict('该文献卡片已晋升为共享记忆');
    return tx.memory.create({
      data: {
        projectId: req.project.id, category: 'paper_card', title: card.paper.title,
        content: [
          card.notes || card.paper.abstract || '该论文尚未填写精读笔记。',
          card.evidenceQuote ? `\n\n> 原文摘录：${card.evidenceQuote}` : null,
          card.evidenceLocator ? `\n> 来源定位：${card.evidenceLocator}` : null,
          `\n> 证据状态：${card.evidenceStatus === 'reviewed' ? '项目负责人已核验' : card.evidenceStatus === 'conflicting' ? '存在冲突，需复核' : '未核验'}`,
        ].filter(Boolean).join(''),
        sourceRoleId: card.roleId, sourceUserId: card.authorUserId, creatorRid: String(card.roleId),
        sourceConversationId: `paper-card:${card.id}`, sourceMessageRange: { from: card.id, to: card.id },
        tags: [...new Set([...(card.tags || []), `paper:${card.paper.externalId}`])], importance: Math.min(5, Math.max(1, card.rating)),
      },
    });
  });
  ok(res, { memory_id: memory.id, card_id: card.id }, '文献卡片已晋升为共享记忆');
  hub.emit(req.project.id, 'memory.promoted', { memory_id: memory.id, category: 'paper_card', title: memory.title, by: req.user.username });
}));

// ---------- 实验记录 ----------
router.get('/experiments', wrap(async (req, res) => {
  const where = { projectId: req.project.id, ...(req.query.status && EXPERIMENT_STATUS.includes(req.query.status) && { status: req.query.status }) };
  const items = await prisma.experiment.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 200,
    include: { role: { select: { name: true } }, direction: { select: { name: true } } },
  });
  ok(res, { items: items.map(experimentView), total: items.length });
}));

router.post('/experiments', wrap(async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  if (!title) throw E.param('实验标题必填');
  await assertProjectRole(req, body.role_id);
  await assertProjectTask(req.project.id, body.task_id);
  if (body.direction_id) {
    const direction = await prisma.directionNode.findUnique({ where: { id: body.direction_id } });
    if (!direction || direction.projectId !== req.project.id) throw E.param('研究方向不属于当前项目');
  }
  const experiment = await prisma.experiment.create({
    data: {
      projectId: req.project.id, roleId: body.role_id, taskId: body.task_id || null, directionId: body.direction_id || null,
      title, hypothesis: body.hypothesis ? String(body.hypothesis) : null, setup: body.setup ? String(body.setup) : null,
      result: body.result ? String(body.result) : null, metric: body.metric || {}, conclusion: body.conclusion ? String(body.conclusion) : null,
      logUrl: body.log_url ? String(body.log_url) : null, status: EXPERIMENT_STATUS.includes(body.status) ? body.status : 'planned',
      runAt: body.run_at ? new Date(body.run_at) : null, createdBy: req.user.id,
    },
    include: { role: { select: { name: true } }, direction: { select: { name: true } } },
  });
  ok(res, experimentView(experiment), '实验记录已创建');
  hub.emit(req.project.id, 'experiment.updated', { experiment: experimentView(experiment), action: 'created', by: req.user.username });
}));

router.patch('/experiments/:experimentId', wrap(async (req, res) => {
  const experiment = await prisma.experiment.findUnique({ where: { id: req.params.experimentId } });
  if (!experiment || experiment.projectId !== req.project.id) throw E.notFound('实验记录不存在');
  if (experiment.createdBy !== req.user.id && !req.isLeader) throw E.noWrite('仅创建者或负责人可编辑');
  const body = req.body || {};
  if (body.direction_id) {
    const direction = await prisma.directionNode.findUnique({ where: { id: body.direction_id } });
    if (!direction || direction.projectId !== req.project.id) throw E.param('研究方向不属于当前项目');
  }
  const updated = await prisma.experiment.update({
    where: { id: experiment.id },
    data: {
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.hypothesis !== undefined && { hypothesis: body.hypothesis ? String(body.hypothesis) : null }),
      ...(body.setup !== undefined && { setup: body.setup ? String(body.setup) : null }),
      ...(body.result !== undefined && { result: body.result ? String(body.result) : null }),
      ...(body.metric !== undefined && { metric: body.metric || {} }),
      ...(body.conclusion !== undefined && { conclusion: body.conclusion ? String(body.conclusion) : null }),
      ...(body.log_url !== undefined && { logUrl: body.log_url ? String(body.log_url) : null }),
      ...(body.direction_id !== undefined && { directionId: body.direction_id || null }),
      ...(body.status !== undefined && EXPERIMENT_STATUS.includes(body.status) && { status: body.status }),
      ...(body.run_at !== undefined && { runAt: body.run_at ? new Date(body.run_at) : null }),
    },
    include: { role: { select: { name: true } }, direction: { select: { name: true } } },
  });
  ok(res, experimentView(updated), '实验记录已更新');
  hub.emit(req.project.id, 'experiment.updated', { experiment: experimentView(updated), action: 'updated', by: req.user.username });
}));

// ---------- 研究进展包（确定性聚合，不调用外部模型） ----------
// 用于组会/比赛演示：把已有资料、证据、决策和实验按时间窗组织起来，
// 每个条目保留原对象 ID，后续接入 AI 时也只能生成草稿而不能直接发布。
router.get('/brief', wrap(async (req, res) => {
  const projectId = req.project.id;
  const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [files, papers, cards, memories, experiments, tasks, directions] = await Promise.all([
    prisma.researchFile.findMany({
      where: { projectId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, originalName: true, extension: true, createdAt: true },
    }),
    prisma.paper.findMany({
      where: { projectId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, title: true, source: true, year: true, createdAt: true },
    }),
    prisma.paperCard.findMany({
      where: { projectId, updatedAt: { gte: since } }, orderBy: { updatedAt: 'desc' }, take: 30,
      include: { paper: { select: { id: true, title: true } }, role: { select: { name: true } } },
    }),
    prisma.memory.findMany({
      where: { projectId, createdAt: { gte: since }, category: { in: ['decision', 'conclusion', 'risk', 'todo'] } },
      orderBy: { createdAt: 'desc' }, take: 30,
      select: { id: true, category: true, title: true, content: true, importance: true, createdAt: true },
    }),
    prisma.experiment.findMany({
      where: { projectId, updatedAt: { gte: since } }, orderBy: { updatedAt: 'desc' }, take: 20,
      select: { id: true, title: true, status: true, hypothesis: true, conclusion: true, directionId: true, updatedAt: true },
    }),
    prisma.task.findMany({
      where: { projectId, status: { not: 'done' } }, orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }], take: 12,
      select: { id: true, title: true, status: true, priority: true, dueDate: true, updatedAt: true },
    }),
    prisma.directionNode.findMany({
      where: { projectId, updatedAt: { gte: since } }, orderBy: { updatedAt: 'desc' }, take: 20,
      select: { id: true, name: true, status: true, evidenceCount: true, updatedAt: true },
    }),
  ]);
  const cardItems = cards.map((card) => ({
    id: card.id, paper_id: card.paperId, title: card.paper.title, role_name: card.role?.name || null,
    evidence_status: card.evidenceStatus, has_quote: Boolean(card.evidenceQuote), evidence_quote: card.evidenceQuote,
    notes: card.notes,
    locator: card.evidenceLocator, is_shared: card.isShared, updated_at: card.updatedAt,
  }));
  const decisionItems = memories.map((memory) => ({
    id: memory.id, category: memory.category, title: memory.title, content: memory.content,
    importance: memory.importance, created_at: memory.createdAt,
  }));
  const experimentItems = experiments.map((experiment) => ({
    id: experiment.id, title: experiment.title, status: experiment.status,
    hypothesis: experiment.hypothesis, conclusion: experiment.conclusion,
    direction_id: experiment.directionId, updated_at: experiment.updatedAt,
  }));
  ok(res, {
    window_days: days,
    since,
    generated_at: new Date(),
    stats: {
      files: files.length, papers: papers.length, cards: cards.length,
      reviewed_cards: cards.filter((card) => card.evidenceStatus === 'reviewed').length,
      shared_cards: cards.filter((card) => card.isShared).length,
      decisions: decisionItems.length, experiments: experiments.length,
      open_tasks: tasks.length, directions: directions.length,
    },
    sections: {
      sources: [
        ...files.map((file) => ({ id: file.id, kind: 'file', title: file.originalName, meta: file.extension, at: file.createdAt })),
        ...papers.map((paper) => ({ id: paper.id, kind: 'paper', title: paper.title, meta: `${paper.source}${paper.year ? ` · ${paper.year}` : ''}`, at: paper.createdAt })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at)),
      evidence: cardItems,
      decisions: decisionItems,
      experiments: experimentItems,
      next_actions: tasks,
      directions,
    },
  });
}));

// ---------- 驾驶舱聚合数据（无视图依赖，便携 PostgreSQL 也可运行） ----------
router.get('/dashboard', wrap(async (req, res) => {
  const projectId = req.project.id;
  const [files, papers, cards, memories, taskGroups, directionGroups, experimentGroups, paperTimeline, experimentTimeline] = await Promise.all([
    prisma.researchFile.count({ where: { projectId } }),
    prisma.paper.count({ where: { projectId } }), prisma.paperCard.count({ where: { projectId } }), prisma.memory.count({ where: { projectId } }),
    prisma.task.groupBy({ by: ['status'], where: { projectId, status: { not: 'draft' } }, _count: true }),
    prisma.directionNode.groupBy({ by: ['status'], where: { projectId }, _count: true }),
    prisma.experiment.groupBy({ by: ['status'], where: { projectId }, _count: true }),
    prisma.paper.findMany({ where: { projectId }, select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1000 }),
    prisma.experiment.findMany({ where: { projectId }, select: { status: true, runAt: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1000 }),
  ]);
  const toCounts = (groups) => Object.fromEntries(groups.map((g) => [g.status, g._count]));
  ok(res, {
    totals: { files, papers, cards, memories, experiments: experimentTimeline.length },
    tasks: toCounts(taskGroups), directions: toCounts(directionGroups), experiments: toCounts(experimentGroups),
    paper_timeline: paperTimeline.map((p) => p.createdAt),
    experiment_timeline: experimentTimeline.map((e) => ({ at: e.runAt || e.createdAt, status: e.status })),
  });
}));

module.exports = router;
