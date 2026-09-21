const { E } = require('../middleware/error');
const { validCitation } = require('./citation');

// Snapshots are compared as well as IDs: editing an approved source cannot
// silently keep the dependent decision eligible for formal context.
async function sourceSnapshot(db, projectId, ids) {
  if (!Array.isArray(ids) || ids.length > 30) throw E.param('来源卡片最多 30 张');
  const unique = [...new Set(ids)];
  const cards = await db.paperCard.findMany({ where: { projectId, id: { in: unique } } });
  if (cards.length !== unique.length) throw E.param('来源不存在或不属于项目');
  return cards.map(c => ({ id: c.id, quote: c.evidenceQuote, locator: c.evidenceLocator, status: c.evidenceStatus, notes: c.notes }));
}
async function validSources(db, projectId, sources) {
  if (!sources?.length) return true; // Manual decisions need no invented source.
  const current = await sourceSnapshot(db, projectId, sources.map(s => s.id)).catch(() => null);
  if (current) for (const c of current) if (!await validCitation(db, projectId, c.locator, c.quote)) return false;
  return Boolean(current && sources.every(s => current.some(c => c.id === s.id && c.quote === s.quote && c.locator === s.locator && c.notes === s.notes && c.status === 'reviewed')));
}
async function approvedMemories(db, projectId) {
  const items = await db.memory.findMany({ where: { projectId, reviewStatus: 'approved' }, include: { revisions: { orderBy: { version: 'desc' }, take: 1 } }, orderBy: [{ isPinned: 'desc' }, { importance: 'desc' }] });
  const valid = [];
  for (const item of items) if (item.revisions[0] && await validSources(db, projectId, item.revisions[0].sources)) valid.push(item);
  return valid;
}
module.exports = { sourceSnapshot, validSources, approvedMemories };
