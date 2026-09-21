// SSE 项目事件流（P3-03）：GET /api/v1/projects/:pid/events
// 前端 EventSource 订阅；任务/记忆/角色/文档变更时 1s 内推送到全队
const express = require('express');
const prisma = require('../db');
const { wrap, E } = require('../middleware/error');
const { authRequired } = require('../middleware/auth');
const hub = require('../services/events');

const router = express.Router({ mergeParams: true });

// 连接数限制（与 team-chat 同策略）：单用户 5 条、全局 200 条，防无限挂连接与心跳定时器
const connections = new Map();
let connectionCount = 0;

router.get('/', authRequired, wrap(async (req, res) => {
  const pid = req.params.pid;
  const project = await prisma.project.findUnique({ where: { id: pid } });
  if (!project) throw E.notFound('项目不存在');
  const isOwner = project.ownerId === req.user.id;
  const member = await prisma.projectMember.findFirst({ where: { projectId: pid, userId: req.user.id } });
  if (!isOwner && !member) throw E.noProject();

  const userConns = connections.get(req.user.id) || 0;
  if (userConns >= 5 || connectionCount >= 200) throw E.llmRate('实时连接已达上限，请关闭多余窗口');
  connections.set(req.user.id, userConns + 1);
  connectionCount++;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ project_id: pid, online: hub.onlineCount(pid) + 1 })}\n\n`);

  hub.subscribe(pid, res);

  // 心跳保活；客户端每次重连后回拉完整项目状态。
  const heartbeat = setInterval(() => {
    try { res.write(`: hb\n\n`); } catch { /* noop */ }
  }, 25000);

  res.on('close', () => {
    clearInterval(heartbeat);
    hub.unsubscribe(pid, res);
    connectionCount--;
    const remaining = (connections.get(req.user.id) || 1) - 1;
    if (remaining) connections.set(req.user.id, remaining); else connections.delete(req.user.id);
  });
}));

module.exports = router;
