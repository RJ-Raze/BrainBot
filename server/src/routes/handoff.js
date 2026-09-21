const router = require('express').Router({ mergeParams: true });
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess } = require('../middleware/permission');
const { ok, wrap, E } = require('../middleware/error');
router.use(authRequired, requireProjectAccess);
router.post('/experiments/:eid', wrap(async (req, res) => {
  const { decision_revision_id, dataset, code_commit, seed, baseline, metric_name, metric_value, unit, direction, conclusion, failure_reason, status } = req.body;
  if (!['succeeded', 'failed', 'running', 'planned'].includes(status)) throw E.param('实验状态无效');
  if (!String(dataset || '').trim() || !String(code_commit || '').trim() || !String(metric_name || '').trim() || !Number.isFinite(Number(metric_value))) throw E.param('请填写数据版本、代码版本、指标名称和有限数值');
  if (!['higher', 'lower'].includes(direction)) throw E.param('请选择指标方向');
  if (status === 'failed' && !String(failure_reason || '').trim()) throw E.param('失败实验请填写原因');
  const revision = await db.memoryRevision.findFirst({ where: { id: decision_revision_id, status: 'approved', memory: { projectId: req.project.id } } });
  if (!revision) throw E.param('请关联当前项目曾批准的决策版本');
  const experiment = await db.experiment.findFirst({ where: { id: req.params.eid, projectId: req.project.id } });
  if (!experiment) throw E.notFound();
  if (!req.isLeader && experiment.createdBy !== req.user.id) throw E.noWrite();
  const updated = await db.experiment.update({ where: { id: experiment.id }, data: {
    status, conclusion: String(conclusion || ''), result: String(failure_reason || ''),
    metric: { ...experiment.metric, protocol: { decision_revision_id, dataset, code_commit, seed: String(seed || ''), baseline: String(baseline || ''), metric_name, value: Number(metric_value), unit: String(unit || ''), direction }, history: [...(experiment.metric?.history || []), { at: new Date().toISOString(), actor: req.user.id, status: experiment.status, conclusion: experiment.conclusion, protocol: experiment.metric?.protocol || null }] },
  } });
  ok(res, updated);
}));
router.get('/export', wrap(async (req, res) => {
  const projectId = req.project.id;
  const [papers, evidence, decisions, briefs, experiments, tasks, files] = await Promise.all([
    db.paper.findMany({ where: { projectId } }), db.paperCard.findMany({ where: { projectId } }),
    db.memory.findMany({ where: { projectId }, include: { revisions: true } }), db.meetingBrief.findMany({ where: { projectId } }),
    db.experiment.findMany({ where: { projectId } }), db.task.findMany({ where: { projectId } }),
    db.researchFile.findMany({ where: { projectId }, select: { id: true, originalName: true, contentHash: true, sizeBytes: true } }),
  ]);
  ok(res, { filename: 'brainbot-handoff.json', content: JSON.stringify({ manifest: { schemaVersion: 1, projectId, exportedAt: new Date(), fileBytesIncluded: false }, project: { name: req.project.name, description: req.project.description }, papers, evidence, decisions, briefs, experiments, tasks, files }, null, 2) });
}));
module.exports = router;
