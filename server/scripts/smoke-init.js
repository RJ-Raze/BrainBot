// 初始化模式 + 组队 + 运行模式 全链路冒烟（对齐原版 BrainBot 设计逻辑）
// 链路：创立人注册 → 建项目(邀请码/初始化中) → 初始化(成员分工→AI任务草案) → 确认草案(进入运行)
//      → 组员B注册 → 邀请码 join → 认领角色 → 拉取我的任务 → 以我的角色 SSE 对话
const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
const ts = Date.now();

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✔ ${name}${extra ? ' — ' + extra : ''}`); }
  else { failed++; console.error(`  ✘ ${name}${extra ? ' — ' + extra : ''}`); }
}

async function api(method, path, body, token) {
  const resp = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => null);
  return { status: resp.status, json };
}

(async () => {
  console.log(`[smoke-init] 目标 ${BASE}\n`);

  // --- 创立人 ---
  const creator = { username: `creator_${ts}`, password: 'Pass@123456', display_name: '创立人甲' };
  await api('POST', '/api/v1/auth/register', creator);
  const loginA = await api('POST', '/api/v1/auth/login', { username: creator.username, password: creator.password });
  const tokenA = loginA.json?.data?.token;
  check('创立人登录', !!tokenA);

  // 建项目：status=0（初始化中）+ 邀请码
  const proj = await api('POST', '/api/v1/projects', { name: '科研协作验证项目', description: '验证多Agent知识协作在真实科研团队中的效果。' }, tokenA);
  const pid = proj.json?.data?.id;
  const inviteCode = proj.json?.data?.invite_code;
  check('建项目（status=0 + 邀请码）', !!pid && proj.json?.data?.status === 0 && /^[0-9A-F]{8}$/.test(inviteCode || ''), `邀请码 ${inviteCode}`);

  // 初始化：3 名成员分工 → AI 一次性生成任务草案
  const init = await api('POST', `/api/v1/projects/${pid}/initialize`, {
    members: [
      { name: '创立人甲', role_description: '产品判断、全栈实现、最终拍板', me: true },
      { name: '成员乙', role_description: 'AI 能力、提示词与记忆机制' },
      { name: '成员丙', role_description: '科研调研、研究方法与验证设计' },
    ],
  }, tokenA);
  const draftTasks = init.json?.data?.tasks || [];
  check('初始化生成任务草案（draft 状态）', init.status === 200 && draftTasks.length >= 3, `${draftTasks.length} 条草案`);
  check('草案带建议负责人', draftTasks.some((t) => t.member_name), draftTasks.map((t) => t.member_name).filter(Boolean).join('/'));

  // 草案在确认前不出现在正式任务列表
  const beforeConfirm = await api('GET', `/api/v1/projects/${pid}/tasks`, null, tokenA);
  check('确认前正式任务列表为空', (beforeConfirm.json?.data?.total ?? -1) === 0);

  // 创立人调整一条标题后确认
  const edited = draftTasks.map((t, i) => ({
    title: i === 0 ? t.title + '（已人工调整）' : t.title,
    description: t.description, priority: t.priority, role_id: t.role_id, match_reasoning: t.match_reasoning,
  }));
  const confirm = await api('POST', `/api/v1/projects/${pid}/initialize/confirm`, { tasks: edited }, tokenA);
  check('确认草案 → 项目进入运行模式', confirm.status === 200 && confirm.json?.data?.status === 1);

  const afterConfirm = await api('GET', `/api/v1/projects/${pid}/tasks`, null, tokenA);
  check('确认后任务生效', (afterConfirm.json?.data?.total ?? 0) === draftTasks.length, `${afterConfirm.json?.data?.total} 条`);

  // --- 组员 B ---
  const member = { username: `member_${ts}`, password: 'Pass@123456', display_name: '成员乙' };
  await api('POST', '/api/v1/auth/register', member);
  const loginB = await api('POST', '/api/v1/auth/login', { username: member.username, password: member.password });
  const tokenB = loginB.json?.data?.token;

  // 错误邀请码
  const badJoin = await api('POST', '/api/v1/projects/join', { invite_code: 'DEADBEEF' }, tokenB);
  check('错误邀请码被拒', badJoin.status === 404);

  // 正确邀请码：看到角色占用情况
  const join = await api('POST', '/api/v1/projects/join', { invite_code: inviteCode }, tokenB);
  const roles = join.json?.data?.roles || [];
  const myRole = roles.find((r) => r.member_name === '成员乙');
  const creatorRole = roles.find((r) => r.member_name === '创立人甲');
  check('join 返回角色列表', join.status === 200 && roles.length === 3);
  check('创立人角色显示已被认领', creatorRole?.is_claimed === true);

  // 抢别人角色被拒
  const steal = await api('POST', `/api/v1/projects/${pid}/claim-role`, { invite_code: inviteCode, role_id: creatorRole?.id }, tokenB);
  check('抢占他人角色被拒（409）', steal.status === 409);

  // 认领自己的角色
  const claim = await api('POST', `/api/v1/projects/${pid}/claim-role`, { invite_code: inviteCode, role_id: myRole?.id }, tokenB);
  check('认领自己的角色', claim.status === 200);

  // 我的任务（按角色过滤）
  const myTasks = await api('GET', `/api/v1/projects/${pid}/tasks?mine=1`, null, tokenB);
  check('组员拉取我的任务', myTasks.status === 200 && (myTasks.json?.data?.items || []).every((t) => t.role_id === myRole.id), `${myTasks.json?.data?.total} 条属于我的角色`);

  // 任务状态流转
  const firstTask = myTasks.json?.data?.items?.[0];
  if (firstTask) {
    const upd = await api('PATCH', `/api/v1/projects/${pid}/tasks/${firstTask.id}`, { status: 'doing' }, tokenB);
    check('任务状态流转 todo→doing', upd.json?.data?.status === 'doing');
  }

  // 组员以自己的角色与 AI 对话（SSE）
  const conv = await api('POST', '/api/v1/conversations', { project_id: pid, role_id: myRole.id, title: '成员乙的协作会话' }, tokenB);
  check('组员以认领角色开会话', conv.status === 200);
  let deltas = 0, done = false;
  const resp = await fetch(`${BASE}/api/v1/conversations/${conv.json.data.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ content: '我该怎么开始第一项任务？' }),
  });
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buf += decoder.decode(value, { stream: true });
    if (buf.includes('event: delta')) deltas++;
    if (buf.includes('event: done')) done = true;
  }
  check('组员角色 SSE 对话流通', deltas > 0 && done);

  console.log(`\n[smoke-init] 通过 ${passed} 项，失败 ${failed} 项`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('[smoke-init] 异常中断:', e.message); process.exit(1); });
