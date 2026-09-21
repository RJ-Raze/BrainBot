const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.env.BRAINBOT_TEST !== '1') throw new Error('Requires isolated BRAINBOT_TEST=1');
const base = process.env.SMOKE_BASE || 'http://web';
async function request(method, path, token, body, expected = 200) {
  const r = await fetch(base + '/api/v1' + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const j = await r.json(); assert.equal(r.status, expected, JSON.stringify(j)); return j.data;
}
async function account() { return request('POST', '/auth/register', null, { username: 'team_' + crypto.randomBytes(5).toString('hex'), password: 'Team@123456' }); }
async function stream(path, token, after) {
  const controller = new AbortController();
  const response = await fetch(base + '/api/v1' + path + '/events?after=' + after, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
  assert.equal(response.status, 200);
  const events = []; let ended = false;
  const done = (async () => {
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const parts = buffer.split('\n\n'); buffer = parts.pop(); for (const p of parts) { const type = p.match(/^event: (.+)$/m)?.[1], raw = p.match(/^data: (.+)$/m)?.[1]; if (type && raw) events.push({ type, data: JSON.parse(raw) }); } } } catch (e) { if (!controller.signal.aborted) throw e; } finally { ended = true; }
  })();
  done.catch(() => {});
  return { events, close: () => controller.abort(), get ended() { return ended }, done };
}
async function until(predicate) { const end = Date.now() + 8000; while (!predicate()) { if (Date.now() > end) throw new Error('Real-time event timeout'); await new Promise(r => setTimeout(r, 50)); } }
(async () => {
  const owner = await account(), member = await account(), outsider = await account();
  const p = await request('POST', '/projects', owner.token, { name: 'Team communication acceptance' });
  const role = await request('POST', `/projects/${p.id}/roles`, owner.token, { name: 'Member', system_prompt: 'test' });
  await request('POST', `/projects/${p.id}/members`, owner.token, { user_id: member.user.id, role_id: role.id });
  const root = `/projects/${p.id}/team-chat`;
  await request('GET', root + '/messages', null, undefined, 401);
  await request('GET', root + '/messages', outsider.token, undefined, 403);
  await request('GET', root + '/events', outsider.token, undefined, 403);
  await request('GET', root + '/messages?before=invalid', owner.token, undefined, 400);
  await request('POST', root + '/messages', owner.token, { request_id: crypto.randomUUID(), content: ' '.repeat(2) }, 400);
  await request('POST', root + '/messages', owner.token, { request_id: crypto.randomUUID(), content: 'x'.repeat(5001) }, 400);
  let live;
  try {
    live = await stream(root, member.token, '0');
    const input = { request_id: crypto.randomUUID(), content: '你好队员\n这是一条实时消息。' };
    const started = Date.now();
    const sent = await request('POST', root + '/messages', owner.token, input);
    await until(() => live.events.some(e => e.type === 'team.message' && e.data.id === sent.id));
    const latency = Date.now() - started;
    const retries = await Promise.all(Array.from({ length: 5 }, () => request('POST', root + '/messages', owner.token, input)));
    assert(retries.every(m => m.id === sent.id));
    await request('POST', root + '/messages', owner.token, { ...input, content: 'changed' }, 409);
    const history = await request('GET', root + '/messages', member.token); assert.equal(history.items.length, 1); assert.equal(history.items[0].content, input.content);
    live.close(); await live.done;
    const offline = await request('POST', root + '/messages', member.token, { request_id: crypto.randomUUID(), content: '断线期间消息' });
    live = await stream(root, owner.token, sent.id);
    await until(() => live.events.some(e => e.type === 'team.message' && e.data.id === offline.id));
    assert(!live.events.some(e => e.data.id === sent.id));
    live.close(); await live.done;
    // More than one page, with concurrent writes, must preserve cursor order.
    const batch = await Promise.all(Array.from({ length: 52 }, (_, i) => request('POST', root + '/messages', owner.token, { request_id: crypto.randomUUID(), content: `page-${i}` })));
    assert.equal(new Set(batch.map(x => x.id)).size, 52);
    const latest = await request('GET', root + '/messages', member.token); assert.equal(latest.items.length, 50); assert.equal(latest.has_more, true);
    const older = await request('GET', root + '/messages?before=' + latest.items[0].id, member.token); assert.equal(older.items.length, 4); assert.equal(older.has_more, false);
    live = await stream(root, member.token, latest.latest_cursor);
    await request('DELETE', `/projects/${p.id}/members/${member.user.id}`, owner.token);
    await until(() => live.events.some(e => e.type === 'access.revoked')); await until(() => live.ended);
    await request('GET', root + '/messages', member.token, undefined, 403);
    await request('DELETE', `/projects/${p.id}`, owner.token);
    await request('POST', root + '/messages', owner.token, { request_id: crypto.randomUUID(), content: 'archived' }, 400);
    assert.equal((await request('GET', root + '/messages', owner.token)).items.length, 50);
    console.log(`[team-chat] PASS: two-user real-time (${latency}ms), persisted history, concurrent idempotency, reconnect catch-up, pagination, member revocation, archive read-only, input/tenant isolation`);
  } finally { live?.close(); await live?.done; }
})().catch(e => { console.error(e); process.exitCode = 1 });
