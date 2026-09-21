// 多人知识协作智能 Web 平台 - 后端入口
// 架构：Express + Prisma(PostgreSQL) + JWT + SSE
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./db');
const { errorHandler, ok } = require('./middleware/error');

const app = express();
// 部署拓扑为 Caddy/Nginx 单入口反代：信任第一跳代理的 X-Forwarded-For，
// 否则 req.ip 全是网关地址，按 IP 的限流会退化为全站共享配额。
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3001', 10);
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

if (isProduction && (!process.env.DATABASE_URL || !process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-to-a-long-random-string')) {
  throw new Error('生产环境必须配置 DATABASE_URL 与强随机 JWT_SECRET');
}
if (isProduction && !corsOrigins.length) throw new Error('生产环境必须配置 CORS_ORIGIN');
if (isProduction && process.env.LLM_MOCK === 'true' && process.env.ALLOW_MOCK_PRODUCTION !== 'true') throw new Error('生产环境禁止 mock；隔离测试须显式设置 ALLOW_MOCK_PRODUCTION');
if (isProduction && process.env.LLM_MOCK !== 'true' && !process.env.LLM_API_KEY) throw new Error('真实模型必须配置 LLM_API_KEY');

app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));
app.use(express.json({ limit: '2mb' }));

// 健康检查
app.get('/api/health', (_req, res) => ok(res, { status: 'up', ts: Date.now() }));
// 就绪检查：用于容器编排，确认 API 与数据库都可用。
app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, { status: 'ready', ts: Date.now() });
  } catch {
    res.status(503).json({ code: 50002, data: null, msg: '数据库尚未就绪' });
  }
});

// 业务路由（一文件一域）
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/projects', require('./routes/projects'));
app.use('/api/v1/projects', require('./routes/init')); // 初始化模式 / 组队 / 任务
app.use('/api/v1/projects/:pid/memories', require('./routes/memories'));
app.use('/api/v1/projects/:pid/reviews', require('./routes/reviews'));
app.use('/api/v1/projects/:pid/briefs', require('./routes/briefs'));
app.use('/api/v1/projects/:pid/library', require('./routes/library'));
app.use('/api/v1/projects/:pid/handoff', require('./routes/handoff'));
app.use('/api/v1/projects/:pid/documents', require('./routes/documents'));
app.use('/api/v1/projects/:pid/files', require('./routes/files'));
app.use('/api/v1/projects/:pid/events', require('./routes/events'));
app.use('/api/v1/projects/:pid/team-chat', require('./routes/team-chat'));
app.use('/api/v1/projects/:pid/research', require('./routes/research'));
app.use('/api/v1/conversations', require('./routes/conversations'));

// 404
app.use((_req, res) => res.status(404).json({ code: 40401, data: null, msg: '接口不存在' }));

// 统一错误处理
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[server] 多人知识协作平台后端已启动: http://localhost:${PORT}`);
  console.log(`[server] LLM 模式: ${require('./services/llm').IS_MOCK ? 'mock（演示彩排）' : 'real'}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] 收到 ${signal}，正在关闭服务…`);
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();
  server.close(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
