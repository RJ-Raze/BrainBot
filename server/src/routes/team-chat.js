const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess } = require('../middleware/permission');
const { ok, wrap, E } = require('../middleware/error');
const router = express.Router({ mergeParams: true });
const sender = { select: { id: true, username: true, displayName: true } };
const view = m => ({ id: String(m.seq), request_id: m.requestId, project_id: m.projectId, sender_id: m.senderId, sender_name: m.sender.displayName || m.sender.username, content: m.content, created_at: m.createdAt });
const connections = new Map();
let connectionCount = 0;
function cursor(value, fallback = 0n) {
  if (value === undefined) return fallback;
  if (!/^\d{1,19}$/.test(String(value)) || BigInt(value) > 9223372036854775807n) throw E.param('消息游标无效');
  return BigInt(value);
}
async function stillAllowed(req) {
  const user = await db.user.findUnique({ where: { id: req.user.id }, select: { status: true } });
  const project = await db.project.findUnique({ where: { id: req.params.pid }, select: { ownerId: true } });
  return Boolean(user?.status === 1 && project && (project.ownerId === req.user.id || await db.projectMember.findFirst({ where: { projectId: req.params.pid, userId: req.user.id }, select: { id: true } })));
}
router.use(authRequired, requireProjectAccess, wrap(async (req, _res, next) => {
  if (!await stillAllowed(req)) throw E.noProject();
  next();
}));

router.get('/messages', wrap(async (req, res) => {
  const before = cursor(req.query.before, 9223372036854775807n);
  const rows = await db.teamMessage.findMany({ where: { projectId: req.project.id, seq: { lt: before } }, include: { sender }, orderBy: { seq: 'desc' }, take: 51 });
  const hasMore = rows.length > 50;
  const items = rows.slice(0, 50).reverse().map(view);
  ok(res, { items, has_more: hasMore, latest_cursor: items.at(-1)?.id || '0' });
}));

router.post('/messages', wrap(async (req, res) => {
  const { content, request_id } = req.body || {};
  if (typeof content !== 'string' || !content.trim() || content.length > 5000) throw E.param('消息需为 1–5000 字符');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request_id || '')) throw E.param('request_id 必须为 UUID');
  const message = await db.$transaction(async tx => {
    // Serialize inserts per project so cursor order also follows commit order.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.project.id}))::text`;
    const existing = await tx.teamMessage.findUnique({ where: { requestId: request_id }, include: { sender } });
    if (existing) {
      if (existing.projectId !== req.project.id || existing.senderId !== req.user.id || existing.content !== content.trim()) throw E.conflict('发送标识已用于其他消息');
      return existing;
    }
    const count = await tx.teamMessage.count({ where: { projectId: req.project.id, senderId: req.user.id, createdAt: { gte: new Date(Date.now() - 60000) } } });
    if (count >= 60) throw E.llmRate('消息发送过快，请稍后重试');
    return tx.teamMessage.create({ data: { projectId: req.project.id, senderId: req.user.id, requestId: request_id, content: content.trim() }, include: { sender } });
  });
  ok(res, view(message));
}));

router.get('/events', wrap(async (req, res) => {
  let after = cursor(req.query.after);
  const count = connections.get(req.user.id) || 0;
  if (count >= 5 || connectionCount >= 100) throw E.llmRate('实时连接已达上限，请关闭多余窗口');
  const token = req.headers.authorization.slice(7);
  connections.set(req.user.id, count + 1); connectionCount++;
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
  let closed = false, timer;
  const close = () => {
    if (closed) return;
    closed = true; clearTimeout(timer); connectionCount--;
    const remaining = (connections.get(req.user.id) || 1) - 1;
    if (remaining) connections.set(req.user.id, remaining); else connections.delete(req.user.id);
    res.end();
  };
  res.on('close', close);
  const send = (event, data) => { if (!closed && !res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) close(); };
  send('connected', { project_id: req.project.id });
  async function pump() {
    if (closed) return;
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      if (!await stillAllowed(req)) { send('access.revoked', {}); return close(); }
      const rows = await db.teamMessage.findMany({ where: { projectId: req.project.id, seq: { gt: after } }, include: { sender }, orderBy: { seq: 'asc' }, take: 100 });
      for (const row of rows) { if (closed) break; send('team.message', view(row)); after = row.seq; }
      if (!closed) res.write(': heartbeat\n\n');
      if (!closed) timer = setTimeout(pump, rows.length === 100 ? 0 : 1000);
    } catch (error) {
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') send('access.revoked', {});
      close();
    }
  }
  pump();
}));
module.exports = router;
