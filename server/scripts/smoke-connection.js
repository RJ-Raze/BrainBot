// 连接稳定性验收：经 Nginx 代理测试鉴权 SSE、聊天断线重试和消息幂等。
const assert = require('assert');
const crypto = require('crypto');

require('dotenv').config();
require('../src/database-url').configureDatabaseUrl();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';

async function json(method, path, token, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body == null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  assert.strictEqual(response.status, 200, `${method} ${path}: ${JSON.stringify(value)}`);
  assert.strictEqual(value.code, 0, `${method} ${path}: ${JSON.stringify(value)}`);
  return value.data;
}

async function chat(cid, token, requestId, content, abortAfterFirstChunk = false) {
  const controller = new AbortController();
  const response = await fetch(`${BASE}/api/v1/conversations/${cid}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content, request_id: requestId }),
    signal: controller.signal,
  });
  assert.strictEqual(response.status, 200);
  const reader = response.body.getReader();
  let output = '';
  if (abortAfterFirstChunk) {
    await reader.read();
    controller.abort();
    return '';
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    output += Buffer.from(value).toString('utf8');
  }
  assert(output.includes('event: done'), `聊天流没有完成事件：${output.slice(-300)}`);
  return output;
}

(async () => {
  let userId;
  let projectId;
  try {
    const username = `connect_${Date.now()}`;
    const registered = await json('POST', '/api/v1/auth/register', null, {
      username, password: crypto.randomBytes(16).toString('hex'), display_name: '连接验收',
    });
    userId = registered.user.id;
    const token = registered.token;
    const project = await json('POST', '/api/v1/projects', token, { name: '连接稳定性验收' });
    projectId = project.id;
    const role = await json('POST', `/api/v1/projects/${projectId}/roles`, token, {
      name: '测试角色', system_prompt: '简短回答。', temp_limit: 0.5,
    });
    const conv = await json('POST', '/api/v1/conversations', token, { project_id: projectId, role_id: role.id });

    const eventController = new AbortController();
    const eventResponse = await fetch(`${BASE}/api/v1/projects/${projectId}/events`, {
      headers: { Authorization: `Bearer ${token}` }, signal: eventController.signal,
    });
    assert.strictEqual(eventResponse.status, 200);
    const eventReader = eventResponse.body.getReader();
    const firstEvent = await eventReader.read();
    assert(Buffer.from(firstEvent.value).toString('utf8').includes('event: connected'));
    await json('POST', `/api/v1/projects/${projectId}/memories`, token, {
      category: 'decision', title: '事件推送验收', content: '测试事件',
    });
    const brief = await json('GET', `/api/v1/projects/${projectId}/research/brief?days=7`, token);
    assert(brief.stats.decisions >= 1, '研究进展包没有汇总刚写入的决策');
    const eventDeadline = setTimeout(() => eventController.abort(), 3000);
    let pushed = '';
    try {
      while (!pushed.includes('event: memory.promoted')) {
        const chunk = await eventReader.read();
        if (chunk.done) throw new Error('事件流提前结束');
        pushed += Buffer.from(chunk.value).toString('utf8');
      }
    } finally {
      clearTimeout(eventDeadline);
    }
    eventController.abort();
    const queryToken = await fetch(`${BASE}/api/v1/projects/${projectId}/events?token=${token}`);
    assert.strictEqual(queryToken.status, 401, '事件流不应接受 URL 中的 JWT');

    const firstId = crypto.randomUUID();
    await chat(conv.id, token, firstId, '第一次回答');
    await chat(conv.id, token, firstId, '第一次回答');
    const secondId = crypto.randomUUID();
    await chat(conv.id, token, secondId, '断线重试回答', true);
    await chat(conv.id, token, secondId, '断线重试回答');

    const messages = await json('GET', `/api/v1/conversations/${conv.id}/messages`, token);
    assert.strictEqual(messages.total, 4, `预期两组用户+助手消息，实际 ${messages.total}`);
    assert.strictEqual(messages.items.filter((item) => item.sender_type === 'user').length, 2);
    const conversations = await json('GET', `/api/v1/conversations?project_id=${projectId}`, token);
    assert.strictEqual(conversations.items[0].message_count, 4);
    console.log('[smoke:connection] 鉴权 SSE、事件推送、研究进展包、重复请求、断线重试均通过');
  } finally {
    if (projectId) await prisma.project.delete({ where: { id: projectId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
})().catch((error) => { console.error('[smoke:connection]', error); process.exitCode = 1; });
