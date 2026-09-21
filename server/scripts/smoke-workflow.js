const assert = require('node:assert/strict');
const crypto = require('crypto');
require('../src/database-url').configureDatabaseUrl();
if (process.env.BRAINBOT_TEST !== '1' || !process.env.DATABASE_URL?.includes('/brainbot_test')) throw new Error('仅允许 BRAINBOT_TEST=1 且数据库 brainbot_test');
const db = require('../src/db');
const base = 'http://web';
const projects = [], users = [];
async function request(method, path, token, body, status = 200) {
  const r = await fetch(base + '/api/v1' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const result = await r.json(); assert.equal(r.status, status, JSON.stringify(result)); return result.data;
}
async function account() { const a = await request('POST', '/auth/register', null, { username: 'journey_' + crypto.randomBytes(5).toString('hex'), password: 'Journey@123456' }); users.push(a.user.id); return a; }
async function main() {
  const owner = await account(), editor = await account(), outsider = await account();
  const p = await request('POST', '/projects', owner.token, { name: '隔离研究闭环验收' }); projects.push(p.id);
  const path = '/projects/' + p.id;
  const role = await request('POST', path + '/roles', owner.token, { name: '研究员', system_prompt: '测试' });
  await request('POST', path + '/members', owner.token, { user_id: editor.user.id, role_id: role.id });
  const ris = Array.from({ length: 100 }, (_, i) => `TY  - JOUR\nTI  - 研究 ${i}\nAU  - 李明\nAU  - Smith, A\nDO  - https://doi.org/10.1234/Test${i}\nPY  - 2025\nAB  - 第一行\n      第二行\nKW  - reasoning\nER  -`).join('\n');
  const preview = await request('POST', path + '/library/preview', editor.token, { text: ris }); assert.equal(preview.rows.length, 100);
  const imported = await request('POST', path + '/library/import', editor.token, { text: ris, lines: preview.rows.map(r => r.line) }); assert.equal(imported.results.filter(r => r.status === 'imported').length, 100);
  const retry = await request('POST', path + '/library/import', editor.token, { text: ris, lines: preview.rows.map(r => r.line) }); assert.equal(retry.results.filter(r => r.status === 'duplicate').length, 100);
  const exported = await request('GET', path + '/library/export', owner.token);
  const { parseRIS } = require('../src/services/ris'); const parsed = parseRIS(exported.content); assert.equal(parsed.length, 100); assert.deepEqual(parsed[0].authors, ['李明', 'Smith, A']); assert.equal(parsed[0].abstract, '第一行\n第二行');
  await request('GET', path + '/library/export', outsider.token, undefined, 403);
  const paperId = imported.results[0].id;
  const card = await request('POST', path + '/research/paper-cards', editor.token, { paper_id: paperId, role_id: role.id, notes: '在固定划分下比较', evidence_quote: '固定数据划分下对比方法', evidence_locator: '手工定位：第 1 段' });
  await request('POST', path + `/research/paper-cards/${card.id}/review-evidence`, owner.token, { status: 'reviewed' });
  const memory = await request('POST', path + '/memories', editor.token, { category: 'decision', title: '固定划分再验证', content: '使用同一数据版本比较结果。' });
  let m = await request('POST', path + `/reviews/${memory.id}/transition`, editor.token, { action: 'submit', expectedVersion: 1, source_ids: [card.id] });
  await request('POST', path + `/reviews/${memory.id}/transition`, editor.token, { action: 'approve', expectedVersion: m.version }, 403);
  m = await request('POST', path + `/reviews/${memory.id}/transition`, owner.token, { action: 'approve', expectedVersion: m.version });
  assert.equal(m.reviewStatus, 'approved');
  await request('POST', path + `/reviews/${memory.id}/transition`, owner.token, { action: 'approve', expectedVersion: m.version - 1 }, 409);
  const history = await request('GET', path + `/reviews/${memory.id}/history`, owner.token); assert.equal(history.items.length, 3);
  const reviewId = history.items[0].id;
  const from = new Date(Date.now() - 86400000).toISOString(), to = new Date(Date.now() + 86400000).toISOString();
  const input = { request_key: crypto.randomUUID(), start: from, end: to };
  let b = await request('POST', path + '/briefs', owner.token, input);
  const same = await request('POST', path + '/briefs', owner.token, input); assert.equal(same.id, b.id);
  b = await request('PATCH', path + `/briefs/${b.id}`, owner.token, { expectedVersion: b.version, content: b.content + '\n人工补充：控制变量。', actions: [{ title: '复现实验', role_id: role.id, due_at: null }] });
  b = await request('POST', path + `/briefs/${b.id}/publish`, owner.token, { expectedVersion: b.version });
  assert.equal(b.status, 'published');
  await request('PATCH', path + `/briefs/${b.id}`, owner.token, { expectedVersion: b.version, content: '覆盖' }, 409);
  const [t1, t2] = await Promise.all([request('POST', path + `/briefs/${b.id}/actions/0/accept`, owner.token, {}), request('POST', path + `/briefs/${b.id}/actions/0/accept`, owner.token, {})]); assert.equal(t1.id, t2.id);
  const e = await request('POST', path + '/research/experiments', editor.token, { title: '同划分复现', role_id: role.id, task_id: t1.id });
  await request('POST', path + `/handoff/experiments/${e.id}`, editor.token, { decision_revision_id: reviewId, dataset: 'data-v1/split-a', code_commit: 'abc123', seed: '42', baseline: 'baseline', metric_name: 'accuracy', metric_value: 0.71, unit: 'ratio', direction: 'higher', conclusion: '未达到预期，建议修订', failure_reason: '收益不足', status: 'failed' });
  const fixed = await request('GET', path + `/briefs/${b.id}/export`, owner.token);
  await request('PATCH', path + `/research/paper-cards/${card.id}`, editor.token, { evidence_quote: '已修改原文' });
  const invalid = await request('GET', path + `/reviews/${memory.id}/history`, owner.token); assert.equal(invalid.sources_valid, false);
  const warn = await request('GET', path + `/briefs/${b.id}/export`, owner.token); assert.equal(warn.content, fixed.content); assert(warn.warnings.length);
  const approved = await require('../src/services/review').approvedMemories(db, p.id); assert.equal(approved.length, 0);
  const handoff = JSON.parse((await request('GET', path + '/handoff/export', owner.token)).content); assert.equal(handoff.experiments[0].metric.protocol.decision_revision_id, reviewId); assert.equal(handoff.papers.length, 100);
  await request('DELETE', path + '/members/' + editor.user.id, owner.token);
  await request('GET', path + '/briefs', editor.token, undefined, 403);
  await request('DELETE', path, owner.token);
  await request('POST', path + '/library/import', owner.token, { text: ris, lines: [] }, 400);
  console.log('[workflow] PASS: 100 RIS round-trip, duplicate import, two-user review, 409, immutable publication, concurrent action acceptance, decision-linked experiment, invalid source exclusion, handoff export, isolation/revocation/archive.');
}
main().catch(e => { console.error(e); process.exitCode = 1 }).finally(async () => {
  for (const id of projects) await db.project.delete({ where: { id } });
  for (const id of users) await db.user.delete({ where: { id } });
  await db.$disconnect();
});
