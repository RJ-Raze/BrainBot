// P0 冒烟脚本（替代 smoke.sh，Windows 可跑）：
// 依次打 健康检查 → 注册 → 登录 → 无token访问(期望401) → 建项目 → 建角色 → 开会话 → 发消息(SSE) → 查消息
// 用法：先启动 server（npm run dev），再 node scripts/smoke.js
const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
const ts = Date.now();
const USER = { username: `smoke_${ts}`, password: 'Smoke@123456', display_name: '冒烟测试员' };

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✔ ${name}${extra ? ' — ' + extra : ''}`); }
  else { failed++; console.error(`  ✘ ${name}${extra ? ' — ' + extra : ''}`); }
}

async function api(method, path, body, token) {
  const resp = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* SSE 等非 JSON */ }
  return { status: resp.status, json, text };
}

(async () => {
  console.log(`[smoke] 目标 ${BASE}\n`);

  // 1. 健康检查
  const health = await api('GET', '/api/health');
  check('健康检查 /api/health', health.status === 200 && health.json?.code === 0);

  // 2. 注册
  const reg = await api('POST', '/api/v1/auth/register', USER);
  check('注册', reg.status === 200 || reg.status === 201, reg.json?.msg);

  // 3. 登录
  const login = await api('POST', '/api/v1/auth/login', { username: USER.username, password: USER.password });
  const token = login.json?.data?.token;
  check('登录拿 JWT', login.status === 200 && !!token);

  // 4. 无 token 访问业务接口 → 401（DoD 关键项）
  const noAuth = await api('GET', '/api/v1/projects');
  check('无 token 访问返回 401', noAuth.status === 401);

  // 5. 创建项目
  const proj = await api('POST', '/api/v1/projects', { name: '冒烟项目', description: 'smoke', domain: 'test' }, token);
  const pid = proj.json?.data?.id;
  check('创建项目', !!pid, proj.json?.msg);

  // 6. 创建角色（含 system_prompt + temp_limit）
  const role = await api('POST', `/api/v1/projects/${pid}/roles`, {
    name: '文献分析员', system_prompt: '你是一名严谨的文献分析员，只基于给定材料作答。',
    temp_limit: 0.3,
  }, token);
  const rid = role.json?.data?.id;
  check('创建角色（system_prompt+temp_limit）', !!rid, role.json?.msg);

  // 7. 创建会话
  const conv = await api('POST', '/api/v1/conversations', { project_id: pid, role_id: rid, title: '冒烟会话' }, token);
  const cid = conv.json?.data?.id;
  check('创建会话', !!cid, conv.json?.msg);

  // 8. 发消息（SSE 流式）
  let deltas = 0, done = false, sseErr = null;
  const resp = await fetch(`${BASE}/api/v1/conversations/${cid}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content: '你好，请用一句话介绍你自己。', temperature: 0.9 }),
  });
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop() || '';
    for (const ev of events) {
      if (ev.startsWith('event: delta')) deltas++;
      if (ev.startsWith('event: done')) done = true;
      if (ev.startsWith('event: error')) sseErr = ev;
    }
  }
  check('SSE 流式输出（delta≥3 + done）', deltas >= 3 && done, `delta=${deltas} done=${done}${sseErr ? ' ERR:' + sseErr.slice(0, 120) : ''}`);

  // 9. 消息已落库（用户+助手各一条）
  const msgs = await api('GET', `/api/v1/conversations/${cid}/messages`, null, token);
  const items = msgs.json?.data?.items || [];
  check('消息落库（user+assistant 共2条）', items.length === 2 && items[1]?.sender_type === 'assistant', `实际 ${items.length} 条`);

  console.log(`\n[smoke] 通过 ${passed} 项，失败 ${failed} 项`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('[smoke] 异常中断:', e.message); process.exit(1); });
