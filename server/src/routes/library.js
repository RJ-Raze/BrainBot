const router = require('express').Router({ mergeParams: true });
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess } = require('../middleware/permission');
const { ok, wrap, E } = require('../middleware/error');
const { parseRIS, exportRIS } = require('../services/ris');
router.use(authRequired, requireProjectAccess);
router.post('/preview', wrap(async (req, res) => {
  const rows = parseRIS(req.body.text);
  const seen = new Set();
  for (const row of rows) {
    if (row.error) continue;
    row.duplicate = seen.has(row.externalId) || Boolean(await db.paper.findFirst({ where: { projectId: req.project.id, OR: [{ externalId: row.externalId }, ...(row.doi ? [{ doi: row.doi }] : [])] } }));
    seen.add(row.externalId);
  }
  ok(res, { rows });
}));
router.post('/import', wrap(async (req, res) => {
  const rows = parseRIS(req.body.text);
  if (!Array.isArray(req.body.lines)) throw E.param('请选择要导入的行');
  const results = [];
  for (const row of rows.filter(r => req.body.lines.includes(r.line))) {
    if (row.error) { results.push({ line: row.line, error: row.error }); continue; }
    const { line, error, ...record } = row;
    try {
      const existing = await db.paper.findFirst({ where: { projectId: req.project.id, OR: [{ externalId: record.externalId }, ...(record.doi ? [{ doi: record.doi }] : [])] } });
      if (existing) { results.push({ line, id: existing.id, status: 'duplicate' }); continue; }
      const paper = await db.paper.upsert({ where: { projectId_source_externalId: { projectId: req.project.id, source: 'ris', externalId: record.externalId } }, create: { ...record, projectId: req.project.id, source: 'ris' }, update: {} });
      results.push({ line, id: paper.id, status: 'imported' });
    } catch { results.push({ line, error: '记录保存失败，请核对字段长度后重试' }); }
  }
  ok(res, { results });
}));
router.get('/export', wrap(async (req, res) => {
  const papers = await db.paper.findMany({ where: { projectId: req.project.id }, orderBy: { createdAt: 'asc' } });
  ok(res, { filename: 'library.ris', content: exportRIS(papers) });
}));
module.exports = router;
